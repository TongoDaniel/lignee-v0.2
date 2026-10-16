// PAR-01 (partie moteur) : « Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000
// personnes ». Mesuré ici sur le poste de développement ; le budget fin (50 ms sur l'Android de
// référence, calcul découpé) est T-028. Arbre type de 5 000 personnes (graine fixe), et un chef
// de famille à 8 épouses et 40 enfants (TRD, Performance ; agent moteur-parente).
import type { Id } from '@lignee/domain';
import { referenceTree, testTree } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph } from './graph';
import { findRelationships } from './kinship';

const PAR_01_BUDGET_MS = 200;

/** Graine fixe pour tirer les paires (reproductible). */
function* pairsOf(ids: readonly Id[], count: number): Generator<[Id, Id]> {
  let state = 12345;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state;
  };
  for (let index = 0; index < count; index += 1) {
    const a = ids[next() % ids.length];
    const b = ids[next() % ids.length];
    if (a !== undefined && b !== undefined) yield [a, b];
  }
}

function measure(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe('PAR-01 : temps de réponse du moteur', () => {
  it('arbre de 5 000 personnes : chaque lien en moins de 200 ms, graphe compris', () => {
    // La copie de l'arbre type (environ 110 ms) est faite hors des mesures.
    const tree = referenceTree(5000);
    let graph = createKinshipGraph(tree);
    const build = measure(() => {
      graph = createKinshipGraph(tree);
    });

    const ids = tree.people.map((person) => person.id);
    // Paires au hasard, plus des paires proches (même famille) : les plus coûteuses, car elles
    // ont le plus de chemins de sang et d'alliance.
    const close: [Id, Id][] = tree.filiations
      .slice(0, 100)
      .map((filiation) => [
        filiation.childId,
        graph.childrenOf(filiation.parentId).at(-1)?.childId ?? filiation.parentId,
      ]);
    const samples = [...pairsOf(ids, 300), ...close];
    const times = samples.map(([a, b]) => measure(() => findRelationships(graph, a, b)));
    times.sort((x, y) => x - y);
    const max = times.at(-1) ?? 0;
    const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    console.info(
      `PAR-01, 5 000 personnes : graphe ${build.toFixed(1)} ms ; ${String(times.length)} liens, ` +
        `moyenne ${mean.toFixed(2)} ms, 95e centile ${p95.toFixed(2)} ms, max ${max.toFixed(2)} ms`,
    );
    expect(build + max).toBeLessThan(PAR_01_BUDGET_MS);
  });

  it('chef de famille à 8 épouses et 40 enfants, avec leurs petits-enfants', () => {
    const context = testTree();
    const treeId = context.treeId;
    const person = (gender: 'female' | 'male') => ({
      id: context.nextId(),
      treeId,
      nature: 'known' as const,
      gender,
      vitalStatus: 'unknown' as const,
      version: 0,
    });
    const filiation = (parentId: Id, childId: Id) => ({
      id: context.nextId(),
      treeId,
      parentId,
      childId,
      type: 'birth' as const,
      certainty: 'certain' as const,
      recognitionStatus: 'unknown' as const,
    });
    const union = (a: Id, rankA: number, b: Id) => ({
      id: context.nextId(),
      treeId,
      spouses: [
        { personId: a, rank: rankA },
        { personId: b, rank: 1 },
      ] as [{ personId: Id; rank: number }, { personId: Id; rank: number }],
      type: 'customary' as const,
    });

    const head = person('male');
    const wives = Array.from({ length: 8 }, () => person('female'));
    const people = [head, ...wives];
    const unions = wives.map((wife, index) => union(head.id, index + 1, wife.id));
    const filiations = [];
    const children = [];
    for (let index = 0; index < 40; index += 1) {
      const child = person(index % 2 === 0 ? 'male' : 'female');
      const mother = wives[index % 8];
      if (mother === undefined) throw new Error('No wife');
      children.push(child);
      people.push(child);
      filiations.push(filiation(head.id, child.id), filiation(mother.id, child.id));
      // Chaque enfant marié, avec trois enfants.
      const spouse = person(index % 2 === 0 ? 'female' : 'male');
      people.push(spouse);
      unions.push(union(child.id, 1, spouse.id));
      for (let k = 0; k < 3; k += 1) {
        const grandchild = person('male');
        people.push(grandchild);
        filiations.push(filiation(child.id, grandchild.id), filiation(spouse.id, grandchild.id));
      }
    }
    const graph = createKinshipGraph({ people, unions, filiations });
    const ids = people.map((p) => p.id);
    const times = [...pairsOf(ids, 300)].map(([a, b]) =>
      measure(() => findRelationships(graph, a, b)),
    );
    const max = Math.max(...times);
    console.info(
      `PAR-01, chef de famille (${String(people.length)} personnes, 8 épouses, 40 enfants) : max ${max.toFixed(2)} ms`,
    );
    expect(max).toBeLessThan(PAR_01_BUDGET_MS);

    // Deux co-épouses : un lien, par le mari ; deux enfants de deux épouses : demi-frères.
    const [first, second] = wives;
    const [c0, c1] = children;
    if (first === undefined || second === undefined || c0 === undefined || c1 === undefined) {
      throw new Error('Missing people');
    }
    const coWives = findRelationships(graph, first.id, second.id);
    expect(coWives.status === 'related' && coWives.relationships.map((r) => r.unionCount)).toEqual([
      2,
    ]);
    const halfSiblings = findRelationships(graph, c0.id, c1.id);
    const segment =
      halfSiblings.status === 'related' ? halfSiblings.relationships[0]?.segments[0] : undefined;
    expect(segment?.kind === 'blood' && segment.sharing).toBe('half');
  });
});
