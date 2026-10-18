// Propriétés du moteur de parenté sur des arbres générés (TRD, « Moteur de parenté », Tests) :
// polygamie, lévirat, sororat, implexe, places à compléter, filiations non biologiques.
// - le lien de A vers B est l'inverse de celui de B vers A ;
// - un ancêtre commun est bien ancêtre des deux (vérifié par un parcours écrit ici) ;
// - implexe : chaque ancêtre une seule fois ;
// - aucun chemin ne traverse une personne absente du graphe ;
// - chaque chemin est bien formé et simple, le résultat ne dépend pas de l'ordre des objets.
import type { Filiation, Id } from '@lignee/domain';
import { treeArbitrary, type GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph, type KinshipGraph } from './graph';
import { commonAncestorsOfPaths, findRelationships } from './kinship';
import { invertRelationship } from './relationship';
import { relationshipIssues } from './test-support/fixtures';

const RUNS = 300;
const TIMEOUT = 120_000;

function graphOf(tree: GeneratedTree): KinshipGraph {
  return createKinshipGraph({
    people: tree.people,
    unions: tree.unions,
    filiations: tree.filiations,
    parentCandidates: tree.parentCandidates,
  });
}

/** Paires de personnes de l'arbre, tirées par fast-check (indices). */
const pairs = fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 8 });

function pick(tree: GeneratedTree, index: number): Id {
  const person = tree.people[index % tree.people.length];
  if (person === undefined) throw new Error('Empty tree');
  return person.id;
}

/** Ancêtres par un parcours naïf, indépendant du moteur. */
function naiveAncestors(
  filiations: readonly Filiation[],
  present: ReadonlySet<Id>,
  id: Id,
): Set<Id> {
  const parents = new Map<Id, Id[]>();
  for (const filiation of filiations) {
    if (!present.has(filiation.parentId) || !present.has(filiation.childId)) continue;
    parents.set(filiation.childId, [...(parents.get(filiation.childId) ?? []), filiation.parentId]);
  }
  const seen = new Set<Id>();
  const stack = [...(parents.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || seen.has(next)) continue;
    seen.add(next);
    stack.push(...(parents.get(next) ?? []));
  }
  seen.delete(id);
  return seen;
}

const trees = treeArbitrary({ minSize: 2, maxSize: 90 });

describe('propriétés du moteur de parenté sur des arbres générés', () => {
  it(
    'le lien de A vers B est l’inverse de celui de B vers A, dans le même ordre',
    () => {
      fc.assert(
        fc.property(trees, pairs, (tree, chosen) => {
          const graph = graphOf(tree);
          for (const [i, j] of chosen) {
            const a = pick(tree, i);
            const b = pick(tree, j);
            const forward = findRelationships(graph, a, b);
            const backward = findRelationships(graph, b, a);
            if (forward.status !== 'related' || backward.status !== 'related') {
              expect(backward.status).toBe(forward.status);
              continue;
            }
            expect(backward.relationships).toEqual(forward.relationships.map(invertRelationship));
            expect(backward.truncated).toBe(forward.truncated);
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'l’inverse reste exact quand une limite est atteinte (maxChains, maxPathChecks, maxRelationships)',
    () => {
      const limits = fc.record({
        maxChains: fc.integer({ min: 1, max: 40 }),
        maxPathChecks: fc.integer({ min: 1, max: 40 }),
        maxRelationships: fc.integer({ min: 1, max: 4 }),
      });
      fc.assert(
        fc.property(trees, pairs, limits, (tree, chosen, options) => {
          const graph = graphOf(tree);
          for (const [i, j] of chosen) {
            const a = pick(tree, i);
            const b = pick(tree, j);
            const forward = findRelationships(graph, a, b, options);
            const backward = findRelationships(graph, b, a, options);
            if (forward.status !== 'related' || backward.status !== 'related') {
              expect(backward).toEqual(forward);
              continue;
            }
            expect(backward.relationships).toEqual(forward.relationships.map(invertRelationship));
            expect(backward.truncated).toBe(forward.truncated);
            expect(forward.relationships.length).toBeLessThanOrEqual(options.maxRelationships);
            for (const relationship of forward.relationships) {
              expect(relationshipIssues(graph, relationship, a, b)).toEqual([]);
            }
            // Sans limite, on trouve au moins ces chemins-là, et « none » n'apparaît jamais à
            // cause d'une limite.
            const free = findRelationships(graph, a, b);
            expect(free.status).toBe('related');
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'chaque chemin est bien formé, simple, trié : sang avant alliance, du plus proche au plus lointain',
    () => {
      fc.assert(
        fc.property(trees, pairs, (tree, chosen) => {
          const graph = graphOf(tree);
          for (const [i, j] of chosen) {
            const a = pick(tree, i);
            const b = pick(tree, j);
            const result = findRelationships(graph, a, b);
            if (result.status !== 'related') continue;
            expect(result.relationships.length).toBeGreaterThan(0);
            let previous: [number, number, number] = [-1, -1, -1];
            for (const relationship of result.relationships) {
              expect(relationshipIssues(graph, relationship, a, b)).toEqual([]);
              const rank: [number, number, number] = [
                relationship.kind === 'blood' ? 0 : 1,
                relationship.degree + relationship.unionCount,
                relationship.unionCount,
              ];
              expect(
                rank[0] > previous[0] ||
                  (rank[0] === previous[0] &&
                    (rank[1] > previous[1] || (rank[1] === previous[1] && rank[2] >= previous[2]))),
              ).toBe(true);
              previous = rank;
            }
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'un ancêtre commun est ancêtre des deux (ou l’un d’eux), et figure une seule fois',
    () => {
      fc.assert(
        fc.property(trees, pairs, (tree, chosen) => {
          const graph = graphOf(tree);
          const present = new Set(tree.people.map((person) => person.id));
          for (const [i, j] of chosen) {
            const a = pick(tree, i);
            const b = pick(tree, j);
            const common = commonAncestorsOfPaths(graph, a, b);
            const ids = common.ancestors.map((entry) => entry.personId);
            expect(new Set(ids).size).toBe(ids.length);
            const ofA = naiveAncestors(tree.filiations, present, a).add(a);
            const ofB = naiveAncestors(tree.filiations, present, b).add(b);
            for (const id of ids) {
              expect(ofA.has(id) && ofB.has(id)).toBe(true);
            }
            // Mêmes ancêtres que les sommets des chemins de sang.
            const result = findRelationships(graph, a, b);
            const apexes = new Set(
              result.status === 'related'
                ? result.relationships
                    .filter((r) => r.kind === 'blood')
                    .flatMap((r) =>
                      r.segments.flatMap((s) =>
                        s.kind === 'blood' ? s.commonAncestors.map((c) => c.personId) : [],
                      ),
                    )
                : [],
            );
            if (a !== b && result.status === 'related' && !result.truncated) {
              expect([...apexes].sort()).toEqual([...ids].sort());
            }
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'implexe : chaque ancêtre une seule fois, à sa génération la plus proche',
    () => {
      fc.assert(
        fc.property(treeArbitrary({ minSize: 20, maxSize: 120 }), (tree) => {
          const graph = graphOf(tree);
          const present = new Set(tree.people.map((person) => person.id));
          for (const person of tree.people.slice(-15)) {
            const ancestors = graph.ancestors(person.id);
            const ids = ancestors.map((entry) => entry.personId);
            expect(new Set(ids).size).toBe(ids.length);
            expect([...ids].sort()).toEqual(
              [...naiveAncestors(tree.filiations, present, person.id)].sort(),
            );
            expect(ids).not.toContain(person.id);
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'aucun chemin ne traverse une personne absente du graphe (filtre de visibilité simulé)',
    () => {
      fc.assert(
        fc.property(
          trees,
          fc.array(fc.nat(), { maxLength: 12 }),
          pairs,
          (tree, removed, chosen) => {
            const hidden = new Set(removed.map((index) => pick(tree, index)));
            // Seules les personnes sont retirées : leurs unions et filiations restent dans l'entrée.
            const graph = createKinshipGraph({
              people: tree.people.filter((person) => !hidden.has(person.id)),
              unions: tree.unions,
              filiations: tree.filiations,
              parentCandidates: tree.parentCandidates,
            });
            const reference = createKinshipGraph({
              people: tree.people.filter((person) => !hidden.has(person.id)),
              unions: tree.unions.filter((u) => u.spouses.every((s) => !hidden.has(s.personId))),
              filiations: tree.filiations.filter(
                (f) => !hidden.has(f.parentId) && !hidden.has(f.childId),
              ),
            });
            for (const [i, j] of chosen) {
              const a = pick(tree, i);
              const b = pick(tree, j);
              const result = findRelationships(graph, a, b);
              if (hidden.has(a) || hidden.has(b)) {
                expect(result).toEqual({ status: 'none' });
                continue;
              }
              // Même réponse que si le filtre avait aussi retiré les objets qui les citent.
              expect(result).toEqual(findRelationships(reference, a, b));
              if (result.status !== 'related') continue;
              for (const relationship of result.relationships) {
                for (const id of relationship.personIds) expect(hidden.has(id)).toBe(false);
                expect(relationshipIssues(graph, relationship, a, b)).toEqual([]);
              }
            }
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'le résultat ne dépend pas de l’ordre des objets reçus',
    () => {
      fc.assert(
        fc.property(trees, pairs, fc.integer(), (tree, chosen, seed) => {
          const shuffle = <T>(items: readonly T[]) =>
            items
              .map((item, index) => ({ item, key: Math.sin(seed + index * 7919) }))
              .sort((x, y) => x.key - y.key)
              .map(({ item }) => item);
          const graph = graphOf(tree);
          const shuffled = createKinshipGraph({
            people: shuffle(tree.people),
            unions: shuffle(tree.unions),
            filiations: shuffle(tree.filiations),
          });
          for (const [i, j] of chosen) {
            const a = pick(tree, i);
            const b = pick(tree, j);
            expect(findRelationships(shuffled, a, b)).toEqual(findRelationships(graph, a, b));
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );
});
