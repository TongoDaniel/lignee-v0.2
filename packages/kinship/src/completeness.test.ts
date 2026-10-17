// Complétude du sang contre une force brute (relecture de contrôle de T-013) : sur de petits
// graphes de filiation tirés au hasard, avec beaucoup d'implexe et plusieurs types de
// filiation, le moteur rend exactement les chemins simples « montée puis descente » qu'une
// énumération naïve trouve : même sommet, mêmes générations de chaque côté, aucun de plus,
// aucun de moins, et sans limite signalée.
import type { Filiation, FiliationType, Person } from '@lignee/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph } from './graph';
import { findRelationships } from './kinship';

const TYPES: readonly FiliationType[] = ['birth', 'adoptive', 'raised'];

/** Un graphe sans cycle : chaque personne a 0 à 3 parents parmi celles créées avant elle. */
const dags = fc.integer({ min: 2, max: 14 }).chain((size) =>
  fc.tuple(
    fc.constant(size),
    fc.array(
      fc.array(fc.tuple(fc.nat(), fc.integer({ min: 0, max: TYPES.length - 1 })), {
        maxLength: 3,
      }),
      { minLength: size, maxLength: size },
    ),
  ),
);

function build(size: number, draws: readonly (readonly [number, number])[][]) {
  const id = (index: number) => `p${String(index).padStart(3, '0')}`;
  const people: Person[] = Array.from({ length: size }, (_, index) => ({
    id: id(index),
    treeId: 't',
    nature: 'known',
    gender: 'unspecified',
    vitalStatus: 'unknown',
    version: 0,
  }));
  const parents: number[][] = people.map(() => []);
  const filiations: Filiation[] = [];
  draws.forEach((choices, child) => {
    if (child === 0) return;
    for (const [pick, type] of choices) {
      const parent = pick % child;
      if (parents[child]?.includes(parent)) continue;
      parents[child]?.push(parent);
      filiations.push({
        id: `f${String(filiations.length).padStart(4, '0')}`,
        treeId: 't',
        parentId: id(parent),
        childId: id(child),
        type: TYPES[type] ?? 'birth',
        certainty: 'certain',
        recognitionStatus: 'unknown',
      });
    }
  });
  return { people, parents, filiations, id };
}

/** Toutes les montées simples depuis `start` (elle comprise), naïvement. */
function ascents(parents: readonly number[][], start: number): number[][] {
  const out: number[][] = [[start]];
  const grow = (chain: number[]) => {
    for (const parent of parents[chain[chain.length - 1] ?? start] ?? []) {
      if (chain.includes(parent)) continue;
      const next = [...chain, parent];
      out.push(next);
      grow(next);
    }
  };
  grow([start]);
  return out;
}

describe('complétude des chemins de sang', () => {
  it('mêmes chemins qu’une énumération naïve, sommet et générations compris', () => {
    fc.assert(
      fc.property(dags, ([size, draws]) => {
        const { people, parents, filiations, id } = build(size, draws);
        const graph = createKinshipGraph({ people, unions: [], filiations });
        for (let a = 0; a < size; a += 1) {
          for (let b = 0; b < size; b += 1) {
            if (a === b) continue;
            const expected: string[] = [];
            const fromB = ascents(parents, b);
            for (const up of ascents(parents, a)) {
              const apex = up[up.length - 1];
              const below = new Set(up.slice(0, -1));
              for (const down of fromB) {
                if (down[down.length - 1] !== apex) continue;
                if (down.slice(0, -1).some((node) => below.has(node))) continue;
                expected.push(
                  `${id(apex ?? -1)}:${String(up.length - 1)}:${String(down.length - 1)}`,
                );
              }
            }
            const result = findRelationships(graph, id(a), id(b), {
              maxUnions: 0,
              maxRelationships: Number.POSITIVE_INFINITY,
            });
            const found: string[] = [];
            if (result.status === 'related') {
              expect(result.truncated).toBe(false);
              for (const relationship of result.relationships) {
                for (const segment of relationship.segments) {
                  if (segment.kind !== 'blood') continue;
                  for (const ancestor of segment.commonAncestors) {
                    found.push(
                      `${ancestor.personId}:${String(segment.generationsUp)}:${String(segment.generationsDown)}`,
                    );
                  }
                }
              }
            } else {
              expect(result.status).toBe('none');
            }
            expect(found.sort()).toEqual(expected.sort());
          }
        }
      }),
      { numRuns: 300 },
    );
  }, 120_000);
});
