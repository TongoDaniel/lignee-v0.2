// Propriétés de l'alliance nommée (T-021, ADR 0019) sur des arbres générés : polygamie, lévirat,
// sororat, implexe, unions datées ou non, réponses « simultanées ou successives » gardées.
// - symétrie : le lien de B vers A est l'inverse exact (co-épouse ↔ co-épouse, conjoint d'un
//   parent ↔ enfant du conjoint, parent du conjoint ↔ conjoint de l'enfant…), et classer le
//   chemin inversé donne le lien inversé ;
// - forme : la nature du lien et ses passages sont revérifiés ici sans se fier au moteur ;
// - aucune co-épouse sans simultanéité établie (vérifié avec `resolveSimultaneity` de
//   @lignee/domain, sur l'arbre lui-même) ; sans dates ni réponses, aucune co-épouse ;
// - une union masquée ne produit aucun lien d'alliance : masqué équivaut à jamais saisi, même si
//   le contexte garde ses réponses et ses faits.
// Les paires sont tirées autour de chaque personne (conjoints, conjoints des conjoints, conjoints
// des parents, enfants des conjoints…) pour que les liens par alliance soient nombreux.
import { resolveSimultaneity, type Id, type Union } from '@lignee/domain';
import {
  generateTree,
  treeArbitrary,
  treeRatesArbitrary,
  type GeneratedTree,
  type TreeData,
} from '@lignee/domain/test-support';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';

import { classifyAlliance, createAllianceContext } from './alliance';
import { createKinshipGraph, type KinshipGraph } from './graph';
import { findRelationships } from './kinship';
import {
  INVERSE_ALLIANCE_KIND,
  invertAlliance,
  invertRelationship,
  type AllianceKind,
  type BloodSegment,
  type Relationship,
} from './relationship';
import { neverEntered } from './test-support/never-entered';

const RUNS = 400;
const TIMEOUT = 180_000;
/**
 * Arbres tirés comme ailleurs (probabilités variées), ou avec beaucoup de mariages, de polygamie
 * et de remariages : sans eux, les co-épouses et les familles recomposées seraient rares.
 */
const trees = fc.oneof(
  treeArbitrary({ minSize: 2, maxSize: 80 }),
  fc
    .record({
      seed: fc.integer({ min: 0, max: 0x7fffffff }),
      size: fc.integer({ min: 10, max: 80 }),
      rates: treeRatesArbitrary(),
    })
    .map(({ seed, size, rates }) =>
      generateTree({
        seed,
        size,
        rates: {
          ...rates,
          marriage: Math.max(rates.marriage, 0.8),
          polygamy: Math.max(rates.polygamy, 0.4),
          remarriage: Math.max(rates.remarriage, 0.4),
        },
      }),
    ),
);
const picks = fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 16 });

/** Toutes les natures rencontrées, pour vérifier que les propriétés ne sont pas vides. */
const seen = new Map<AllianceKind, number>();

function graphOf(data: Pick<TreeData, 'people' | 'unions' | 'filiations' | 'parentCandidates'>) {
  return createKinshipGraph(data);
}

/** Personnes proches de A par une ou deux unions (conjoints, et leurs parents et enfants…). */
function near(graph: KinshipGraph, a: Id): Id[] {
  const spousesOf = (id: Id) =>
    graph
      .unionsOf(id)
      .flatMap((union) => union.spouses.map((spouse) => spouse.personId))
      .filter((other) => other !== id);
  const out = new Set<Id>();
  const parents = graph.parentsOf(a).map((filiation) => filiation.parentId);
  for (const spouse of spousesOf(a)) {
    out.add(spouse);
    for (const next of spousesOf(spouse)) out.add(next);
    for (const child of graph.childrenOf(spouse)) out.add(child.childId);
    for (const parent of graph.parentsOf(spouse)) out.add(parent.parentId);
  }
  for (const parent of parents) {
    for (const spouse of spousesOf(parent)) {
      out.add(spouse);
      for (const child of graph.childrenOf(spouse)) out.add(child.childId);
    }
    // Conjoints des frères et sœurs.
    for (const sibling of graph.childrenOf(parent)) {
      for (const spouse of spousesOf(sibling.childId)) out.add(spouse);
    }
  }
  // Conjoints des enfants (gendre, bru).
  for (const child of graph.childrenOf(a)) {
    for (const spouse of spousesOf(child.childId)) out.add(spouse);
  }
  out.delete(a);
  return [...out].sort();
}

/** Paires tirées : une personne, puis une personne proche (ou quelconque s'il n'y en a pas). */
function pairsOf(tree: TreeData, graph: KinshipGraph, chosen: readonly [number, number][]) {
  const pairs: [Id, Id][] = [];
  for (const [i, j] of chosen) {
    const a = tree.people[i % tree.people.length]?.id;
    if (a === undefined) continue;
    const around = near(graph, a);
    const b =
      around.length > 0 ? around[j % around.length] : tree.people[j % tree.people.length]?.id;
    if (b !== undefined) pairs.push([a, b]);
  }
  return pairs;
}

const shape = (segment: BloodSegment) =>
  `${String(segment.generationsUp)}/${String(segment.generationsDown)}`;

/** Nature attendue d'après la forme, écrite ici sans se fier au moteur (ADR 0019). */
function expectedKind(blood: readonly BloodSegment[], simultaneous: boolean): AllianceKind {
  const key = blood.map(shape).join(' ');
  const table: Record<string, AllianceKind> = {
    '0/0 0/0': 'spouse',
    '0/0 1/0': 'parent_of_spouse',
    '1/0 0/0': 'spouse_of_parent',
    '0/0 0/1': 'child_of_spouse',
    '0/1 0/0': 'spouse_of_child',
    '0/0 1/1': 'sibling_of_spouse',
    '1/1 0/0': 'spouse_of_sibling',
    '1/0 0/1': 'step_sibling',
    '0/0 0/0 0/0': simultaneous ? 'co_spouse' : 'spouse_of_spouse',
    '0/0 1/1 0/0': 'spouse_of_sibling_of_spouse',
  };
  return table[key] ?? 'other';
}

/**
 * Problèmes d'un lien par alliance, vérifiés sans se fier au moteur : présent si et seulement si
 * le chemin passe une union ; passages identiques aux unions du chemin ; nature conforme à la
 * forme ; co-épouse si et seulement si une paire d'unions est simultanée selon
 * `resolveSimultaneity` sur l'arbre ; côté enfant cohérent avec le graphe.
 */
function allianceIssues(graph: KinshipGraph, tree: TreeData, relationship: Relationship): string[] {
  const { alliance } = relationship;
  if (relationship.kind === 'blood') return alliance === undefined ? [] : ['blood with alliance'];
  if (alliance === undefined) return ['alliance missing'];
  const issues: string[] = [];
  const blood = relationship.segments.filter((s): s is BloodSegment => s.kind === 'blood');
  const links = relationship.segments.filter((s) => s.kind === 'union');
  if (alliance.crossings.length !== links.length) issues.push('crossing count');
  alliance.crossings.forEach((crossing, index) => {
    const link = links[index];
    if (crossing.fromId !== link?.fromId || crossing.toId !== link.toId) {
      issues.push('crossing people');
    }
    if (
      JSON.stringify(crossing.unions.map((union) => union.unionId)) !==
      JSON.stringify(link?.unions.map((union) => union.unionId))
    ) {
      issues.push('crossing unions');
    }
    for (const side of [crossing.fromChild, crossing.toChild]) {
      if (side === undefined) continue;
      const parentIds = graph.parentsOf(side.childId).map((filiation) => filiation.parentId);
      if (!parentIds.includes(side.parentId)) issues.push('child side: not a parent');
      for (const entry of side.unions) {
        const union = graph.union(entry.unionId);
        const spouses = union?.spouses.map((spouse) => spouse.personId) ?? [];
        if (!spouses.includes(side.parentId) || !spouses.includes(entry.otherParentId)) {
          issues.push('child side: union does not join the parents');
        }
        if (!parentIds.includes(entry.otherParentId)) issues.push('child side: other parent');
      }
    }
  });
  const unionById = new Map<Id, Union>(tree.unions.map((union) => [union.id, union]));
  let simultaneous = false;
  if (alliance.sharedSpouse !== undefined) {
    for (const pair of alliance.sharedSpouse.pairs) {
      const [a, b] = pair.unionIds.map((id) => unionById.get(id));
      if (a === undefined || b === undefined) {
        issues.push('shared spouse: unknown union');
        continue;
      }
      const timing = resolveSimultaneity(tree, a, b);
      if (JSON.stringify(timing) !== JSON.stringify(pair.timing)) issues.push('pair timing');
      if (timing.source !== 'unknown' && timing.value === 'simultaneous') simultaneous = true;
    }
  }
  const expected = expectedKind(blood, simultaneous);
  if (alliance.kind !== expected) issues.push(`kind ${alliance.kind}, expected ${expected}`);
  return issues;
}

function record(relationships: readonly Relationship[]) {
  for (const relationship of relationships) {
    const kind = relationship.alliance?.kind;
    if (kind !== undefined) seen.set(kind, (seen.get(kind) ?? 0) + 1);
  }
}

describe('alliance nommée sur des arbres générés', () => {
  afterAll(() => {
    // Les propriétés ont bien porté sur des co-épouses, des conjoints de parents, des enfants du
    // conjoint d'un parent… et sur des épouses sans simultanéité établie.
    for (const kind of [
      'spouse',
      'co_spouse',
      'spouse_of_spouse',
      'spouse_of_parent',
      'child_of_spouse',
      'step_sibling',
      'parent_of_spouse',
      'spouse_of_child',
    ] as const) {
      expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0);
    }
  });

  it(
    'symétrie et forme : B vers A est l’inverse exact, la nature suit la forme et les dates',
    () => {
      fc.assert(
        fc.property(trees, picks, (tree: GeneratedTree, chosen) => {
          const graph = graphOf(tree);
          const context = createAllianceContext(tree);
          for (const [a, b] of pairsOf(tree, graph, chosen)) {
            const forward = findRelationships(graph, a, b, { allianceContext: context });
            const backward = findRelationships(graph, b, a, { allianceContext: context });
            if (forward.status !== 'related' || backward.status !== 'related') {
              expect(backward.status).toBe(forward.status);
              continue;
            }
            record(forward.relationships);
            expect(backward.relationships).toEqual(forward.relationships.map(invertRelationship));
            forward.relationships.forEach((relationship, index) => {
              expect(allianceIssues(graph, tree, relationship)).toEqual([]);
              const alliance = relationship.alliance;
              if (alliance === undefined) return;
              const inverse = backward.relationships[index]?.alliance;
              expect(inverse?.kind).toBe(INVERSE_ALLIANCE_KIND[alliance.kind]);
              // Calculé directement dans l'autre sens, sans passer par l'inversion du moteur.
              expect(classifyAlliance(graph, invertRelationship(relationship), context)).toEqual(
                invertAlliance(alliance),
              );
            });
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'aucune co-épouse sans simultanéité établie : sans dates ni réponses, jamais',
    () => {
      fc.assert(
        fc.property(trees, picks, (tree: GeneratedTree, chosen) => {
          // Mêmes unions sans dates, aucune réponse, aucun fait : rien n'établit la simultanéité.
          const unions = tree.unions.map((union) => {
            const copy = { ...union };
            delete copy.start;
            delete copy.end;
            return copy;
          });
          const bare = { ...tree, unions, simultaneityAnswers: [], facts: [] };
          const graph = graphOf(bare);
          const allianceContext = createAllianceContext(bare);
          for (const [a, b] of pairsOf(bare, graph, chosen)) {
            const result = findRelationships(graph, a, b, { allianceContext });
            if (result.status !== 'related') continue;
            for (const relationship of result.relationships) {
              expect(relationship.alliance?.kind).not.toBe('co_spouse');
              const shared = relationship.alliance?.sharedSpouse;
              if (shared !== undefined) expect(shared.timing).toBe('unknown');
              for (const crossing of relationship.alliance?.crossings ?? []) {
                for (const side of [crossing.fromChild, crossing.toChild]) {
                  if (side !== undefined) expect(['unknown', 'none']).toContain(side.timing);
                }
              }
            }
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'une union masquée ne produit aucun lien d’alliance : masqué équivaut à jamais saisi',
    () => {
      fc.assert(
        fc.property(
          trees,
          fc.array(fc.nat(), { maxLength: 4 }),
          fc.array(fc.nat(), { minLength: 1, maxLength: 4 }),
          picks,
          (tree: GeneratedTree, peoplePicks, unionPicks, chosen) => {
            const at = <T>(items: readonly T[], index: number) => items[index % items.length];
            const hiddenPeople = new Set(
              peoplePicks.map((i) => at(tree.people, i)?.id).filter((id) => id !== undefined),
            );
            const hiddenUnions = new Set(
              tree.unions.length === 0
                ? []
                : unionPicks.map((i) => at(tree.unions, i)?.id).filter((id) => id !== undefined),
            );
            // Filtre : objets masqués retirés ; réponses et faits laissés dans le contexte.
            const filtered = graphOf({
              ...tree,
              people: tree.people.filter((person) => !hiddenPeople.has(person.id)),
              unions: tree.unions.filter((union) => !hiddenUnions.has(union.id)),
            });
            const leaky = createAllianceContext(tree);
            const never = neverEntered(tree, hiddenPeople, hiddenUnions, new Set());
            const reference = graphOf(never);
            const context = createAllianceContext(never);
            const visible = new Set(never.people.map((person) => person.id));
            const pairs = pairsOf(tree, graphOf(tree), chosen).filter(
              ([a, b]) => visible.has(a) && visible.has(b),
            );
            for (const [a, b] of pairs) {
              const result = findRelationships(filtered, a, b, { allianceContext: leaky });
              expect(result).toEqual(
                findRelationships(reference, a, b, { allianceContext: context }),
              );
              const text = JSON.stringify(result);
              for (const id of hiddenUnions) expect(text).not.toContain(id);
              for (const id of hiddenPeople) expect(text).not.toContain(id);
            }
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );
});
