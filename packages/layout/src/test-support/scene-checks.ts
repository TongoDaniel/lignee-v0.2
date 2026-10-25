// Vérifications de la scène à peindre (T-017), écrites sans se fier au code vérifié : une fiche à
// sa place, aucun chevauchement en pixels, des traits à angles droits qui ne traversent aucune
// fiche, des pastilles et des mentions à leur place. Réservé aux tests.
import type { Id } from '@lignee/domain';
import type { ScenarioTree } from '@lignee/domain/test-support';
import { expect } from 'vitest';

import type { TreeLayout } from '../layout-types';
import { buildOutline } from '../scene/outline';
import type { Rect } from '../scene/geometry';
import { cardRect, counterRect, type SceneEdge, type TreeScene } from '../scene/scene';
import { buildSceneSpec, type SceneSpec, type SceneSpecInput } from '../scene/spec';
import type { DrawingExpected, ScenarioFamily } from './layout-scenario';

/**
 * Mesures de la charte au zoom standard, recopiées ici parce que ce paquet ne dépend pas de
 * `@lignee/ui` : elles ne servent qu'à exercer la scène. Les mesures réelles de l'app viennent
 * des tokens (`apps/mobile/src/tree/sceneSpec.ts`), et un test de l'app vérifie qu'elles respectent
 * le même contrat.
 */
export const REFERENCE_SPEC_INPUT: SceneSpecInput = {
  avatarSizes: { small: 40, medium: 58, large: 88, extraLarge: 108 },
  smallestDot: 20,
  ringSpace: 6,
  textScale: 1,
  nodeWidth: 96,
  nodeGap: 16,
  textGap: 6,
  nameLines: 2,
  nameLineHeight: 20,
  secondaryLineHeight: 16,
  markLineHeight: 16,
  secondaryOverlap: 4,
  connectorGap: 40,
  touchTarget: 48,
  counterHeight: 32,
  counterMinWidth: 56,
};

export function referenceSpec(overrides: Partial<SceneSpecInput> = {}): SceneSpec {
  return buildSceneSpec({ ...REFERENCE_SPEC_INPUT, ...overrides });
}

const EPSILON = 1e-6;

function interiorsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right - EPSILON &&
    b.left < a.right - EPSILON &&
    a.top < b.bottom - EPSILON &&
    b.top < a.bottom - EPSILON
  );
}

/** Les deux boîtes d'une fiche : l'avatar, puis le texte dessous (prénom, ligne, mention). */
function boxesOf(spec: SceneSpec, x: number, y: number): Rect[] {
  const card = cardRect(spec, x, y);
  return [
    {
      left: x - spec.radius,
      right: x + spec.radius,
      top: y - spec.radius,
      bottom: y + spec.radius,
    },
    { ...card, top: y + spec.radius + spec.input.ringSpace },
  ];
}

/** Segments d'un trait, avec un peu d'épaisseur pour que les croisements se voient. */
function segmentBoxes(edge: SceneEdge, thickness: number): Rect[] {
  const boxes: Rect[] = [];
  for (let index = 1; index < edge.points.length; index += 1) {
    const a = edge.points[index - 1];
    const b = edge.points[index];
    if (a === undefined || b === undefined) continue;
    // Épaisseur dans le sens perpendiculaire seulement : un trait qui touche le bord d'une fiche
    // par son bout (départ sous la fiche, arrivée sur son haut) ne la traverse pas.
    const vertical = Math.abs(a.x - b.x) < EPSILON;
    boxes.push({
      left: Math.min(a.x, b.x) - (vertical ? thickness : 0),
      right: Math.max(a.x, b.x) + (vertical ? thickness : 0),
      top: Math.min(a.y, b.y) - (vertical ? 0 : thickness),
      bottom: Math.max(a.y, b.y) + (vertical ? 0 : thickness),
    });
  }
  return boxes;
}

/** Les cartes (personnes et places « non précisé ») se chevauchent-elles, en pixels ? */
export function overlappingCards(scene: TreeScene): number {
  const cards = [...scene.people, ...scene.missing]
    .map((card) => cardRect(scene.spec, card.x, card.y))
    .sort((a, b) => a.left - b.left);
  let overlapping = 0;
  for (let i = 0; i < cards.length; i += 1) {
    const a = cards[i] as Rect;
    for (let j = i + 1; j < cards.length; j += 1) {
      const b = cards[j] as Rect;
      if (b.left >= a.right - EPSILON) break;
      if (interiorsIntersect(a, b)) overlapping += 1;
    }
  }
  return overlapping;
}

/**
 * Traits de foyers (union, tronc, barre, jambe) qui traversent le texte ou l'avatar d'une fiche
 * qui n'est pas la leur : doit rester à zéro. Les liens hors des foyers sont exclus : un trait
 * long passe où il peut (ADR 0025).
 */
export function crossedCards(scene: TreeScene): { edge: SceneEdge; box: Rect }[] {
  const { spec } = scene;
  const boxes = [...scene.people, ...scene.missing].flatMap((card) =>
    boxesOf(spec, card.x, card.y),
  );
  const found: { edge: SceneEdge; box: Rect }[] = [];
  for (const edge of scene.edges) {
    if (edge.kind === 'link') continue;
    const segments = segmentBoxes(edge, 0.5);
    for (const box of boxes) {
      if (segments.some((segment) => interiorsIntersect(segment, box))) found.push({ edge, box });
    }
  }
  return found;
}

/** Les invariants de la scène, sur n'importe quel arbre. */
export function expectSceneInvariants(layout: TreeLayout, scene: TreeScene): void {
  const { spec } = scene;
  expect(scene.people).toHaveLength(layout.people.size);
  for (const person of layout.people.values()) {
    const placed = scene.personById.get(person.personId);
    expect(placed?.x).toBeCloseTo(person.x * spec.unitX, 6);
    expect(placed?.y).toBeCloseTo(person.y * spec.unitY, 6);
  }
  expect(overlappingCards(scene)).toBe(0);

  // Traits à angles droits : chaque segment est horizontal ou vertical.
  for (const edge of scene.edges) {
    expect(edge.points.length).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < edge.points.length; index += 1) {
      const a = edge.points[index - 1];
      const b = edge.points[index];
      expect(a !== undefined && b !== undefined).toBe(true);
      if (a === undefined || b === undefined) continue;
      expect(Math.abs(a.x - b.x) < EPSILON || Math.abs(a.y - b.y) < EPSILON).toBe(true);
    }
  }
  expect(crossedCards(scene)).toEqual([]);

  // Liens : un trait pour `line`, aucun tracé pour `seeAlso`, mention aux deux bouts.
  const lines = layout.links.filter((link) => link.drawing === 'line');
  const renvois = layout.links.filter((link) => link.drawing === 'seeAlso');
  expect(scene.edges.filter((edge) => edge.kind === 'link')).toHaveLength(lines.length);
  expect(scene.seeAlso).toHaveLength(renvois.length);
  for (const link of renvois) {
    for (const [here, there] of [
      [link.fromId, link.toId],
      [link.toId, link.fromId],
    ] as const) {
      const mark = scene.marks.find((m) => m.kind === 'seeAlso' && m.personId === here);
      expect(mark?.kind === 'seeAlso' && mark.targets.includes(there)).toBe(true);
    }
  }
  // Aucune mention « Voir aussi » sans renvoi.
  const ends = new Set(renvois.flatMap((link) => [link.fromId, link.toId]));
  for (const mark of scene.marks) {
    if (mark.kind === 'seeAlso') expect(ends.has(mark.personId)).toBe(true);
  }

  // Une pastille par foyer replié qui a des enfants, rien d'autre, sans chevaucher une fiche.
  const folded = [...layout.families.values()].filter(
    (family) => family.folded && family.childCount > 0 && family.anchor !== undefined,
  );
  expect(scene.counters.map((counter) => counter.familyKey).sort()).toEqual(
    folded.map((family) => family.key).sort(),
  );
  const cards = [...scene.people, ...scene.missing].map((card) => cardRect(spec, card.x, card.y));
  for (const counter of scene.counters) {
    const rect = counterRect(spec, counter.x, counter.y);
    expect(cards.filter((card) => interiorsIntersect(card, rect))).toEqual([]);
    expect(counter.count).toBe(layout.families.get(counter.familyKey)?.childCount);
  }

  // Ce qui est dessiné reste dans les bornes annoncées.
  for (const card of cards) {
    expect(card.left).toBeGreaterThanOrEqual(scene.bounds.left - EPSILON);
    expect(card.right).toBeLessThanOrEqual(scene.bounds.right + EPSILON);
    expect(card.top).toBeGreaterThanOrEqual(scene.bounds.top - EPSILON);
    expect(card.bottom).toBeLessThanOrEqual(scene.bounds.bottom + EPSILON);
  }
}

function familyOf(layout: TreeLayout, tree: ScenarioTree, family: ScenarioFamily) {
  const ids = family.map((key) => tree.id(key));
  const found = [...layout.families.values()].find(
    (candidate) =>
      candidate.parentIds.length === ids.length &&
      ids.every((id) => candidate.parentIds.includes(id)),
  );
  if (found === undefined) throw new Error(`No family for ${family.join(' + ')}`);
  return found;
}

/** Compare la scène et le parcours accessible à `attendu.dessin` d'un scénario. */
export function expectDrawing(
  layout: TreeLayout,
  scene: TreeScene,
  tree: ScenarioTree,
  expected: DrawingExpected,
): void {
  const key = (id: Id) => tree.keyOf(id) ?? id;
  const sorted = (values: readonly string[]) => [...values].sort();
  expect(scene.people, 'fiches dessinées').toHaveLength(expected.noeuds);

  const unions = scene.edges
    .filter((edge) => edge.kind === 'union')
    .map((edge) => sorted((layout.families.get(edge.familyKey)?.parentIds ?? []).map(key)));
  expect(unions.sort(), 'traits d’union').toEqual(
    expected.unions.map((pair) => sorted(pair)).sort(),
  );

  expect(
    scene.counters.map((counter) => ({
      famille: sorted((layout.families.get(counter.familyKey)?.parentIds ?? []).map(key)),
      enfants: counter.count,
    })),
    'pastilles',
  ).toHaveLength(expected.pastilles.length);
  for (const pastille of expected.pastilles) {
    const family = familyOf(layout, tree, pastille.famille);
    const counter = scene.counters.find((candidate) => candidate.familyKey === family.key);
    expect(counter?.count, `pastille de ${pastille.famille.join(' + ')}`).toBe(pastille.enfants);
  }

  const legs = new Map<string, string[]>();
  for (const edge of scene.edges) {
    if (edge.kind !== 'leg' || edge.childId === undefined) continue;
    legs.set(edge.familyKey, [...(legs.get(edge.familyKey) ?? []), key(edge.childId)]);
  }
  expect(legs.size, 'foyers dépliés avec des enfants').toBe(expected.descentes.length);
  for (const descente of expected.descentes) {
    const family = familyOf(layout, tree, descente.famille);
    expect(
      sorted(legs.get(family.key) ?? []),
      `enfants de ${descente.famille.join(' + ')}`,
    ).toEqual(sorted(descente.enfants));
  }

  expect(scene.seeAlso, 'renvois « Voir aussi »').toHaveLength(expected.renvois ?? 0);

  const outline = buildOutline(layout);
  for (const step of expected.parcours ?? []) {
    const entry = outline.get(tree.id(step.personne));
    if (entry === undefined) throw new Error(`${step.personne} absent du parcours`);
    if (step.parents !== undefined) {
      expect(
        entry.parents.map((parents) => sorted(parents.parentIds.map(key))),
        `parents de ${step.personne}`,
      ).toEqual(step.parents.map((pair) => sorted(pair)));
    }
    if (step.conjoints !== undefined) {
      const unionsOf = entry.unions.filter((union) => union.kind === 'foyer');
      expect(
        unionsOf.map((union) => (union.partnerId === undefined ? '' : key(union.partnerId))),
        `conjoints de ${step.personne}, dans l’ordre des rangs`,
      ).toEqual(step.conjoints.map((spouse) => spouse.conjoint));
      step.conjoints.forEach((spouse, index) => {
        expect(sorted((unionsOf[index]?.childIds ?? []).map(key))).toEqual(sorted(spouse.enfants));
      });
    }
  }
}
