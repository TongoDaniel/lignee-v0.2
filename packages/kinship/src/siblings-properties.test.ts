// Propriétés de la fratrie sur des arbres générés (polygamie, lévirat, sororat, implexe, places à
// compléter, parents candidats, filiations non biologiques) : TRD, « Moteur de parenté », Tests.
// - symétrie : le lien de B vers A est l'inverse de celui de A vers B ;
// - jamais « frère » sans deux parents communs, jamais quand l'un a un parent à compléter
//   distinct de ceux de l'autre ;
// - accord avec les chemins de sang de naissance (T-013) : fratrie de naissance si et seulement
//   s'il existe un chemin 1/1 par la naissance, « frère » si et seulement si ce chemin est `full` ;
// - siblingsOf rend exactement les personnes pour lesquelles siblingLink donne un lien ;
// - retirer à A l'un de ses deux parents communs avec B donne « frère ou demi-frère » ; le
//   préciser (PAR-03, UNI-13) redonne « frère » si c'est l'autre parent de B, « demi-frère » si
//   c'est une autre personne connue.
import type { Filiation, Id, Person } from '@lignee/domain';
import { treeArbitrary, type GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph, type KinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { invertSiblingLink, siblingLink, siblingsOf } from './siblings';

const RUNS = 200;
const TIMEOUT = 120_000;
const trees = treeArbitrary({ minSize: 2, maxSize: 90 });

function graphOf(
  tree: Pick<GeneratedTree, 'people' | 'unions' | 'filiations' | 'parentCandidates'>,
) {
  return createKinshipGraph({
    people: tree.people,
    unions: tree.unions,
    filiations: tree.filiations,
    parentCandidates: tree.parentCandidates,
  });
}

/** Parents de naissance, par un parcours écrit ici. */
function birthParents(graph: KinshipGraph, id: Id): Set<Id> {
  return new Set(
    graph
      .parentsOf(id)
      .filter((filiation) => filiation.type === 'birth')
      .map((filiation) => filiation.parentId),
  );
}

/** Toutes les paires de personnes qui ont un parent (tout type) ou un conjoint de parent. */
function closePairs(graph: KinshipGraph, tree: GeneratedTree): [Id, Id][] {
  const pairs: [Id, Id][] = [];
  for (const person of tree.people) {
    const near = new Set<Id>();
    for (const parent of graph.parentsOf(person.id)) {
      for (const child of graph.childrenOf(parent.parentId)) near.add(child.childId);
      for (const union of graph.unionsOf(parent.parentId)) {
        for (const spouse of union.spouses) {
          for (const child of graph.childrenOf(spouse.personId)) near.add(child.childId);
        }
      }
    }
    near.delete(person.id);
    for (const other of near) pairs.push([person.id, other]);
  }
  return pairs;
}

describe('propriétés de la fratrie sur des arbres générés', () => {
  it(
    'symétrie, jamais « frère » sans deux parents communs ni avec une place à compléter distincte',
    () => {
      fc.assert(
        fc.property(trees, (tree) => {
          const graph = graphOf(tree);
          for (const [a, b] of closePairs(graph, tree)) {
            const forward = siblingLink(graph, a, b);
            const backward = siblingLink(graph, b, a);
            expect(backward).toEqual(
              forward === undefined ? undefined : invertSiblingLink(forward),
            );
            if (forward?.kind !== 'sibling') continue;
            for (const shared of forward.sharedParents) {
              expect(graph.parentsOf(a).some((f) => f.parentId === shared.personId)).toBe(true);
              expect(graph.parentsOf(b).some((f) => f.parentId === shared.personId)).toBe(true);
            }
            if (forward.sharing === 'full') {
              expect(forward.sharedParents.length).toBeGreaterThanOrEqual(2);
            } else {
              expect(forward.sharedParents).toHaveLength(1);
            }
            if (forward.basis !== 'birth') continue;
            // Une place à compléter parent de A et pas de B (ou l'inverse) : jamais « frère ».
            const pa = birthParents(graph, a);
            const pb = birthParents(graph, b);
            const distinctPlaceholder = [...pa, ...pb].some(
              (p) => graph.person(p)?.nature === 'placeholder' && pa.has(p) !== pb.has(p),
            );
            if (distinctPlaceholder) expect(forward.sharing).not.toBe('full');
            // Un seul parent de naissance commun, l'autre parent manquant d'un côté : incertain.
            const shared = [...pa].filter((p) => pb.has(p));
            if (shared.length === 1 && (pa.size === 1 || pb.size === 1)) {
              expect(forward.sharing).toBe('full_or_half');
            }
            if (shared.length >= 2) expect(forward.sharing).toBe('full');
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'accord avec les chemins de sang par la naissance (T-013)',
    () => {
      fc.assert(
        fc.property(trees, (tree) => {
          const graph = graphOf(tree);
          for (const [a, b] of closePairs(graph, tree)) {
            const link = siblingLink(graph, a, b);
            const result = findRelationships(graph, a, b, {
              filiationTypes: ['birth'],
              maxUnions: 0,
            });
            const siblingPath =
              result.status === 'related'
                ? result.relationships.find((relationship) => {
                    const [segment] = relationship.segments;
                    return (
                      segment?.kind === 'blood' &&
                      segment.generationsUp === 1 &&
                      segment.generationsDown === 1
                    );
                  })
                : undefined;
            const isBirthSibling = link?.kind === 'sibling' && link.basis === 'birth';
            expect(isBirthSibling).toBe(siblingPath !== undefined);
            if (link?.kind !== 'sibling' || siblingPath === undefined) continue;
            const [segment] = siblingPath.segments;
            if (segment?.kind !== 'blood') throw new Error('Expected blood');
            expect(link.sharing === 'full').toBe(segment.sharing === 'full');
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'siblingsOf rend exactement les liens de siblingLink (UNI-13)',
    () => {
      fc.assert(
        fc.property(trees, fc.nat(), (tree, index) => {
          const graph = graphOf(tree);
          const person = tree.people[index % tree.people.length];
          if (person === undefined) return;
          const listed = siblingsOf(graph, person.id);
          const expected = tree.people
            .map((other) => siblingLink(graph, person.id, other.id))
            .filter((link) => link !== undefined)
            .sort((x, y) => (x.toId < y.toId ? -1 : x.toId > y.toId ? 1 : 0));
          expect(listed).toEqual(expected);
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'retirer puis préciser un parent : frère ou demi-frère, puis frère ou demi-frère selon la personne (PAR-03, UNI-13)',
    () => {
      let total = 0;
      fc.assert(
        fc.property(trees, (tree) => {
          const graph = graphOf(tree);
          let checked = 0;
          for (const [a, b] of closePairs(graph, tree)) {
            if (checked >= 5) break;
            const link = siblingLink(graph, a, b);
            if (link?.kind !== 'sibling' || link.basis !== 'birth' || link.sharing !== 'full') {
              continue;
            }
            const pa = birthParents(graph, a);
            const pb = birthParents(graph, b);
            if (pa.size !== 2 || pb.size !== 2 || [...pa].some((p) => !pb.has(p))) continue;
            checked += 1;
            total += 1;
            // A perd sa filiation de naissance vers R : son autre parent n'est plus précisé.
            const [kept, removed] = [...pa].sort();
            if (kept === undefined || removed === undefined) throw new Error('two parents');
            const without = tree.filiations.filter(
              (f) => !(f.childId === a && f.parentId === removed && f.type === 'birth'),
            );
            const unspecified = siblingLink(graphOf({ ...tree, filiations: without }), a, b);
            if (unspecified?.kind !== 'sibling') throw new Error('Expected a sibling');
            expect(unspecified.sharing).toBe('full_or_half');
            expect(unspecified.fromOtherParent?.status).toBe('unspecified');
            expect(unspecified.toOtherParent).toEqual({
              status: graph.person(removed)?.nature === 'placeholder' ? 'placeholder' : 'known',
              personId: removed,
            });

            const precise = (parentId: Id, extra: Person[] = []) => {
              const filiation: Filiation = {
                id: `precise-${parentId}`,
                treeId: tree.tree.id,
                parentId,
                childId: a,
                type: 'birth',
                certainty: 'certain',
                recognitionStatus: 'unknown',
              };
              return graphOf({
                ...tree,
                people: [...tree.people, ...extra],
                filiations: [...without, filiation],
              });
            };
            // Précisé : c'est bien R, frères.
            const same = siblingLink(precise(removed), a, b);
            expect(same?.kind === 'sibling' && same.sharing).toBe('full');
            // Précisé : une autre personne connue, de l'autre genre que le parent commun.
            // Demi-frères, du même côté qu'avant, que l'autre parent de B soit connu ou à
            // compléter (une personne connue et une place à compléter : deux personnes, ADR 0017).
            const common = graph.person(kept)?.gender;
            const stranger: Person = {
              id: 'precise-stranger',
              treeId: tree.tree.id,
              nature: 'known',
              gender: common === 'male' ? 'female' : common === 'female' ? 'male' : 'unspecified',
              vitalStatus: 'unknown',
              version: 0,
            };
            const other = siblingLink(precise(stranger.id, [stranger]), a, b);
            if (other?.kind !== 'sibling') throw new Error('Expected a sibling');
            expect(other.sharing).toBe('half');
            expect(other.side).toBe(unspecified.side);
          }
        }),
        { numRuns: RUNS },
      );
      // Les arbres générés contiennent bien des frères à défaire et à préciser.
      expect(total).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});
