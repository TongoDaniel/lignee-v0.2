// Vérifications des étapes 3 à 5 (T-012), écrites sans se fier au code vérifié : aucun
// chevauchement, groupes de conjoints et fratries jamais coupés, compteurs, repli cohérent.
// Partagées par les scénarios et les propriétés. Réservé aux tests.
import type { Id } from '@lignee/domain';
import type { ScenarioTree } from '@lignee/domain/test-support';
import { expect } from 'vitest';

import { CARD_HEIGHT_LIMIT } from '../blocks';
import { unspecifiedKey } from '../folding';
import type { TreeLayout } from '../layout-types';
import { MAX_LINE_CROSSINGS, MAX_LINE_ROW_SPAN } from '../links';
import type { TreeStructure } from '../types';
import {
  linkDrawings,
  linkNatures,
  type DispositionExpected,
  type ScenarioFamily,
} from './layout-scenario';

const EPSILON = 1e-9;

/** Toutes les fiches (personnes et mentions « non précisé ») à leur place. */
function cards(layout: TreeLayout) {
  const list: { id: string; x: number; y: number }[] = [...layout.people.values()].map(
    (person) => ({ id: person.personId, x: person.x, y: person.y }),
  );
  for (const family of layout.families.values()) {
    if (family.header !== undefined) list.push({ id: family.key, ...family.header });
  }
  return list;
}

/**
 * Paires de fiches qui se chevauchent, en deux dimensions, avec le contrat de hauteur du dessin
 * (`CARD_HEIGHT_LIMIT`) : moins d'une fiche d'écart en largeur et moins d'une demi-rangée en
 * hauteur. `stacked` compte les paires au même endroit en largeur, l'une sur la rangée et l'autre
 * sur la demi-rangée, que le contrat autorise.
 */
export function overlaps(layout: TreeLayout): { overlapping: number; stacked: number } {
  const list = cards(layout).sort((a, b) => a.x - b.x);
  let overlapping = 0;
  let stacked = 0;
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i] as { x: number; y: number };
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j] as { x: number; y: number };
      if (b.x - a.x >= 1 - EPSILON) break;
      const dy = Math.abs(a.y - b.y);
      if (dy < CARD_HEIGHT_LIMIT - EPSILON) overlapping += 1;
      else if (dy < 2 * CARD_HEIGHT_LIMIT - EPSILON) stacked += 1;
    }
  }
  return { overlapping, stacked };
}

/** Les invariants de la disposition, sur n'importe quel arbre. */
export function expectLayoutInvariants(layout: TreeLayout): void {
  const { structure } = layout;
  // Personne centrale dessinée, en x = 0 ; chacun une seule fois, à sa rangée de l'étape 1.
  expect(layout.people.get(layout.centerId)?.x).toBe(0);
  for (const person of layout.people.values()) {
    expect(person.row).toBe(structure.rowOf.get(person.personId));
    expect([0, 0.5]).toContain(person.y - person.row);
  }
  expect(overlaps(layout).overlapping).toBe(0);

  // Groupes : intervalles disjoints sur chaque rangée, une personne dans un seul groupe.
  const blocksByRow = new Map<number, TreeLayout['blocks'][number][]>();
  for (const block of layout.blocks) {
    const list = blocksByRow.get(block.row);
    if (list === undefined) blocksByRow.set(block.row, [block]);
    else list.push(block);
  }
  const seen = new Set<Id>();
  for (const [index, block] of layout.blocks.entries()) {
    for (const id of block.personIds) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      expect(layout.people.get(id)?.block).toBe(index);
    }
  }
  expect(seen.size).toBe(layout.people.size);
  for (const list of blocksByRow.values()) {
    list.sort((a, b) => a.left - b.left);
    for (let i = 1; i < list.length; i += 1) {
      const previous = list[i - 1] as { right: number };
      expect((list[i] as { left: number }).left - previous.right).toBeGreaterThanOrEqual(
        1 - EPSILON,
      );
    }
    // Fratries jamais coupées : les groupes enfants d'une même famille se suivent, dans l'ordre
    // des frères et sœurs.
    const sequence = list.map((block) => block.familyKey);
    const closed = new Set<string>();
    sequence.forEach((key, i) => {
      if (key === undefined) return;
      expect(closed.has(key), `fratrie ${key} coupée`).toBe(false);
      if (sequence[i + 1] !== key) closed.add(key);
    });
    for (const key of new Set(sequence)) {
      if (key === undefined) continue;
      const children = layout.families.get(key)?.shownChildren ?? [];
      const ranks = list
        .filter((block) => block.familyKey === key)
        .map((block) =>
          Math.min(...block.personIds.map((id) => children.indexOf(id)).filter((at) => at >= 0)),
        );
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  }

  // Conjoints d'un foyer dessiné sur la même rangée : dans le même groupe (foyer jamais coupé).
  for (const family of layout.families.values()) {
    const placed = family.parentIds.map((id) => layout.people.get(id));
    const [a, b] = placed;
    if (family.kind === 'foyer' && a !== undefined && b !== undefined && a.row === b.row) {
      expect(a.block, `foyer ${family.key} coupé`).toBe(b.block);
    }
    // Compteur : les enfants présents dans la structure, donc dans le graphe reçu.
    const foyer = structure.foyerOf.get(family.key);
    const expectedCount =
      foyer?.children.length ??
      structure.unitOf.get(family.parentIds[0] ?? '')?.unspecified?.children.length;
    expect(family.childCount).toBe(expectedCount);
    if (family.folded) expect(family.shownChildren).toEqual([]);
    else if (placed.some((person) => person !== undefined)) {
      // Dépliée et touchée par un parent : tous ses enfants sont dessinés.
      if (placed.every((person) => person !== undefined)) {
        expect(family.shownChildren.length).toBe(family.childCount);
      }
    }
    for (const child of family.shownChildren) {
      const person = layout.people.get(child);
      expect(person).toBeDefined();
      // Un enfant de la rangée suivante pend sous le point d'attache (sinon c'est un trait long).
      const parentRow = layout.people.get(family.parentIds[0] ?? '')?.row;
      if (
        family.anchor !== undefined &&
        person !== undefined &&
        person.row === (parentRow ?? NaN) + 1
      ) {
        expect(person.y).toBeGreaterThan(family.anchor.y);
      }
    }
  }
  // Étape 6 (T-019) : une fiche par personne, chaque lien hors des foyers présent et bien tracé.
  expectLinkInvariants(layout, MAX_LINE_ROW_SPAN, MAX_LINE_CROSSINGS);
}

function sameMembers(a: readonly Id[], b: readonly Id[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Clé de la famille désignée dans un scénario : un foyer par ses deux parents, ou une colonne. */
export function familyKeyOf(
  structure: TreeStructure,
  tree: ScenarioTree,
  family: ScenarioFamily,
): string {
  if (family.length === 1) return unspecifiedKey(tree.id(family[0]));
  const ids = family.map((key) => tree.id(key));
  const foyer = [...structure.foyerOf.values()].find((candidate) =>
    sameMembers([candidate.hubId, candidate.partnerId], ids),
  );
  if (foyer === undefined) throw new Error(`No foyer between ${family.join(' and ')}`);
  return foyer.key;
}

/** Compare une disposition à l'attendu d'un scénario. */
export function expectDisposition(
  layout: TreeLayout,
  tree: ScenarioTree,
  expected: DispositionExpected,
): void {
  const key = (id: Id) => tree.keyOf(id) ?? id;
  for (const [height, names] of Object.entries(expected.lignes ?? {})) {
    const y = Number(height);
    const line = [...layout.people.values()]
      .filter((person) => person.y === y)
      .sort((a, b) => a.x - b.x)
      .map((person) => key(person.personId));
    expect(line, `ligne ${height}`).toEqual(names);
  }
  if (expected.visibles !== undefined) {
    expect([...layout.people.keys()].map(key).sort()).toEqual([...expected.visibles].sort());
  }
  if (expected.replis !== undefined) {
    const wanted = expected.replis.map((line) => ({
      key: familyKeyOf(layout.structure, tree, line.famille),
      folded: line.replie,
      count: line.enfants,
    }));
    const actual = [...layout.families.values()].map((family) => ({
      key: family.key,
      folded: family.folded,
      count: family.childCount,
    }));
    const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : 1);
    expect(actual.sort(byKey)).toEqual(wanted.sort(byKey));
  }
  if (expected.liens_hors_foyers !== undefined) {
    const wanted = expected.liens_hors_foyers
      .map((line) => {
        const nature = linkNatures[line.nature];
        const from =
          nature === 'elsewhere' || nature === 'long'
            ? familyKeyOf(layout.structure, tree, line.de)
            : line.de.join('+');
        return `${nature} ${from} -> ${line.vers} : ${linkDrawings[line.trace]}`;
      })
      .sort();
    const actual = layout.links
      .map((link) => {
        const from =
          link.nature === 'elsewhere' || link.nature === 'long' ? link.key : key(link.fromId);
        return `${link.nature} ${from} -> ${key(link.toId)} : ${link.drawing}`;
      })
      .sort();
    expect(actual, 'liens hors des foyers').toEqual(wanted);
  }
  if (expected.largeur_max !== undefined) {
    expect(layout.bounds.maxX - layout.bounds.minX + 1).toBeLessThanOrEqual(expected.largeur_max);
  }
}

/** Vrai si les segments [p1, p2] et [q1, q2] se coupent en un point intérieur aux deux. */
function properlyCross(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  q1: { x: number; y: number },
  q2: { x: number; y: number },
): boolean {
  const side = (a: typeof p1, b: typeof p1, c: typeof p1) => {
    const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(value) < EPSILON ? 0 : Math.sign(value);
  };
  return side(p1, p2, q1) * side(p1, p2, q2) < 0 && side(q1, q2, p1) * side(q1, q2, p2) < 0;
}

/**
 * Étape 6 (T-019), vérifiée sans se fier au code : chaque personne n'a qu'une fiche ; chaque
 * enfant dessiné d'une famille dépliée y est relié, sous elle dans sa fratrie ou par un seul lien
 * (`elsewhere` à la rangée suivante, `long` ailleurs) ; deux parents d'un foyer sur deux rangées
 * sont reliés (`couple`) ; chaque filiation secondaire entre deux fiches dessinées a son lien ;
 * aucun autre lien, aucun lien vers une personne non dessinée ; le tracé suit la règle (plus de
 * `maxRowSpan` rangées ou plus de `maxCrossings` croisements : renvoi) et les croisements sont
 * recomptés ici, segment contre segment ; les liens sont dans l'ordre du dessin.
 */
export function expectLinkInvariants(
  layout: TreeLayout,
  maxRowSpan: number,
  maxCrossings: number,
): void {
  const all = [...layout.rows.values()].flat();
  expect(new Set(all).size, 'une seule fiche par personne').toBe(all.length);
  expect(all.length).toBe(layout.people.size);

  const expected: string[] = [];
  const regular: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  for (const family of layout.families.values()) {
    const placed = family.parentIds.map((id) => layout.people.get(id));
    const [a, b] = placed;
    if (family.kind === 'foyer' && a !== undefined && b !== undefined && a.row !== b.row) {
      expected.push(`couple ${family.key} ${b.personId}`);
    }
    if (family.folded || family.anchor === undefined) continue;
    const anchorRow = Math.floor(family.anchor.y + EPSILON);
    for (const child of family.shownChildren) {
      const person = layout.people.get(child);
      if (person === undefined) throw new Error(`Enfant ${child} non dessiné`);
      const block = layout.blocks[person.block];
      if (person.row === anchorRow + 1 && block?.familyKey === family.key) {
        regular.push({ from: family.anchor, to: person });
      } else {
        const nature = person.row === anchorRow + 1 ? 'elsewhere' : 'long';
        expected.push(`${nature} ${family.key} ${child}`);
      }
    }
  }
  for (const link of layout.structure.crossLinks) {
    if (link.role !== 'secondary') continue;
    if (layout.people.has(link.fromId) && layout.people.has(link.toId)) {
      expected.push(`secondary ${link.id} ${link.toId}`);
    }
  }
  expect(
    layout.links.map((link) => `${link.nature} ${link.key} ${link.toId}`).sort(),
    'liens hors des foyers',
  ).toEqual(expected.sort());

  for (const link of layout.links) {
    const to = layout.people.get(link.toId);
    expect(layout.people.has(link.fromId)).toBe(true);
    expect(to).toBeDefined();
    expect(link.to).toEqual({ x: to?.x, y: to?.y });
    const crossings = regular.filter((edge) =>
      properlyCross(link.from, link.to, edge.from, edge.to),
    ).length;
    expect(link.crossings, `croisements du lien ${link.key}`).toBe(crossings);
    const seeAlso = Math.abs(link.rowSpan) > maxRowSpan || link.crossings > maxCrossings;
    expect(link.drawing).toBe(seeAlso ? 'seeAlso' : 'line');
  }
  const order = layout.links.map((link) => [link.from.y, link.from.x, link.to.y, link.to.x]);
  for (let i = 1; i < order.length; i += 1) {
    const previous = order[i - 1] as number[];
    const current = order[i] as number[];
    const at = previous.findIndex((value, k) => value !== current[k]);
    if (at >= 0) expect(previous[at], 'ordre des liens').toBeLessThan(current[at] as number);
  }
}
