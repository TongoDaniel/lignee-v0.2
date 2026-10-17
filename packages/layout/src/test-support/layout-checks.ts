// Vérifications des étapes 3 à 5 (T-012), écrites sans se fier au code vérifié : aucun
// chevauchement, groupes de conjoints et fratries jamais coupés, compteurs, repli cohérent.
// Partagées par les scénarios et les propriétés. Réservé aux tests.
import type { Id } from '@lignee/domain';
import type { ScenarioTree } from '@lignee/domain/test-support';
import { expect } from 'vitest';

import { unspecifiedKey } from '../folding';
import type { TreeLayout } from '../layout-types';
import type { TreeStructure } from '../types';
import type { DispositionExpected, ScenarioFamily } from './layout-scenario';

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

/** Nombre de paires de fiches qui se chevauchent (même hauteur, moins d'une fiche d'écart). */
export function overlaps(layout: TreeLayout): number {
  const byY = new Map<number, number[]>();
  for (const card of cards(layout)) {
    const list = byY.get(card.y);
    if (list === undefined) byY.set(card.y, [card.x]);
    else list.push(card.x);
  }
  let count = 0;
  for (const xs of byY.values()) {
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      if ((xs[i] as number) - (xs[i - 1] as number) < 1 - EPSILON) count += 1;
    }
  }
  return count;
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
  expect(overlaps(layout)).toBe(0);

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
  if (expected.largeur_max !== undefined) {
    expect(layout.bounds.maxX - layout.bounds.minX + 1).toBeLessThanOrEqual(expected.largeur_max);
  }
}
