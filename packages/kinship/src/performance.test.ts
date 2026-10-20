// PAR-01 (partie moteur) : « Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000
// personnes ». Mesuré ici sur le poste de développement ; le budget fin (50 ms sur l'Android de
// référence, calcul découpé) est T-028. Arbre type de 5 000 personnes (graine fixe), et un chef
// de famille à 8 épouses et 40 enfants (TRD, Performance ; agent moteur-parente). Chaque temps
// est une médiane après chauffe, comparée au garde-fou budget × facteur (README racine, « Tests
// de performance ») ; les budgets eux-mêmes ne changent pas.
import type { Filiation, Id, Person } from '@lignee/domain';
import {
  medianTime,
  referenceTree,
  reportBudget,
  testTree,
  timeOnce,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph, type KinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { siblingsOf } from './siblings';

const PAR_01_BUDGET_MS = 200;
const TREE_OPENING_BUDGET_MS = 1000;
const PERF_TIMEOUT_MS = 60_000;

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

/**
 * Temps de chaque lien. `cold` : un seul passage par paire sur un graphe neuf, caches d'ancêtres
 * vides, comme la première question après l'ouverture de l'arbre (ce que vise PAR-01). `warm` :
 * ensuite, médiane de trois calculs par paire, caches remplis. À appeler sur un graphe jamais
 * interrogé.
 */
function pairTimes(graph: KinshipGraph, pairs: readonly (readonly [Id, Id])[]) {
  const cold = pairs.map(([a, b]) => timeOnce(() => findRelationships(graph, a, b)));
  const warm = pairs.map(
    ([a, b]) => medianTime(() => findRelationships(graph, a, b), { warmup: 0, runs: 3 }).medianMs,
  );
  return { cold, warm };
}

// Délai explicite pour chaque test (T-028) : l'arbre type et les mesures répétées dépassent les
// 5 s par défaut de Vitest sur une machine chargée.
describe('PAR-01 : temps de réponse du moteur', { timeout: PERF_TIMEOUT_MS }, () => {
  it('arbre de 5 000 personnes : chaque lien en moins de 200 ms, graphe en moins de 1 s', () => {
    // La copie de l'arbre type (environ 110 ms) est faite hors des mesures.
    const tree = referenceTree(5000);
    let graph = createKinshipGraph(tree);
    const build = medianTime(
      () => {
        graph = createKinshipGraph(tree);
      },
      { warmup: 0, runs: 3 },
    ).medianMs;

    const ids = tree.people.map((person) => person.id);
    // Paires au hasard, plus des paires proches (même famille) : les plus coûteuses, car elles
    // ont le plus de chemins de sang et d'alliance.
    // jamais une personne avec elle-même (réponse immédiate, qui fausserait la mesure).
    const close: [Id, Id][] = tree.filiations.slice(0, 150).flatMap((filiation): [Id, Id][] =>
      graph
        .childrenOf(filiation.parentId)
        .map((sibling) => sibling.childId)
        .filter((sibling) => sibling !== filiation.childId)
        .slice(0, 1)
        .map((sibling) => [filiation.childId, sibling]),
    );
    expect(close.length).toBeGreaterThan(50);
    const samples = [...pairsOf(ids, 300), ...close].filter(([a, b]) => a !== b);
    const { cold, warm } = pairTimes(graph, samples);
    const coldMax = Math.max(...cold);
    const times = warm;
    times.sort((x, y) => x - y);
    const max = times.at(-1) ?? 0;
    const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    console.info(
      `PAR-01, 5 000 personnes : graphe ${build.toFixed(1)} ms ; ${String(times.length)} liens, ` +
        `moyenne ${mean.toFixed(2)} ms, 95e centile ${p95.toFixed(2)} ms, max ${max.toFixed(2)} ms ` +
        `(à chaud) ; premier passage à froid, max ${coldMax.toFixed(2)} ms`,
    );
    // Le graphe se construit une fois, à l'ouverture de l'arbre (TRD : moins de 1 s) ; chaque
    // question « qui est-ce pour moi ? » ne paie ensuite que le calcul du lien.
    const opening = reportBudget(
      'PAR-01, graphe de 5 000 personnes',
      build,
      TREE_OPENING_BUDGET_MS,
    );
    expect(opening.measuredMs).toBeLessThan(opening.ceilingMs);
    // PAR-01 vise la première question après l'ouverture : le passage à froid (graphe neuf) fait
    // foi ; la médiane à chaud s'y ajoute.
    const slowestCold = reportBudget(
      'PAR-01, lien le plus lent sur 5 000, à froid',
      coldMax,
      PAR_01_BUDGET_MS,
    );
    expect(slowestCold.measuredMs).toBeLessThan(slowestCold.ceilingMs);
    const slowest = reportBudget(
      'PAR-01, lien le plus lent sur 5 000, à chaud (médiane)',
      max,
      PAR_01_BUDGET_MS,
    );
    expect(slowest.measuredMs).toBeLessThan(slowest.ceilingMs);
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
    const { cold, warm } = pairTimes(
      graph,
      [...pairsOf(ids, 300)].filter(([a, b]) => a !== b),
    );
    const coldMax = Math.max(...cold);
    const max = Math.max(...warm);
    console.info(
      `PAR-01, chef de famille (${String(people.length)} personnes, 8 épouses, 40 enfants) : max ${max.toFixed(2)} ms à chaud, ${coldMax.toFixed(2)} ms à froid`,
    );
    const slowestCold = reportBudget(
      'PAR-01, lien le plus lent, chef de famille, à froid',
      coldMax,
      PAR_01_BUDGET_MS,
    );
    expect(slowestCold.measuredMs).toBeLessThan(slowestCold.ceilingMs);
    const slowest = reportBudget(
      'PAR-01, lien le plus lent, chef de famille, à chaud (médiane)',
      max,
      PAR_01_BUDGET_MS,
    );
    expect(slowest.measuredMs).toBeLessThan(slowest.ceilingMs);

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

    // Fratrie de chaque enfant (T-020) : 4 frères et sœurs par la même mère, 35 demi par le père.
    let siblings: ReturnType<typeof siblingsOf> = [];
    const siblingTimes = children.map(
      (childPerson) =>
        medianTime(
          () => {
            siblings = siblingsOf(graph, childPerson.id);
          },
          { warmup: 0, runs: 1 },
        ).medianMs,
    );
    const siblingReport = reportBudget(
      'T-020, fratrie de chacun des 40 enfants (max)',
      Math.max(...siblingTimes),
      PAR_01_BUDGET_MS,
    );
    expect(siblingReport.measuredMs).toBeLessThan(siblingReport.ceilingMs);
    const kinds = siblings.map((link) =>
      link.kind === 'sibling' ? `${link.sharing}/${link.side ?? '-'}` : 'step',
    );
    expect(kinds).toHaveLength(39);
    expect(kinds.filter((entry) => entry === 'full/-')).toHaveLength(4);
    expect(kinds.filter((entry) => entry === 'half/father')).toHaveLength(35);
  });

  it('cas profond : deux lignées de 150 générations depuis un même couple', () => {
    const context = testTree();
    const treeId = context.treeId;
    const people: Person[] = [];
    const filiations: Filiation[] = [];
    const person = () => {
      const id = context.nextId();
      people.push({
        id,
        treeId,
        nature: 'known',
        gender: 'unspecified',
        vitalStatus: 'unknown',
        version: 0,
      });
      return id;
    };
    const child = (parentId: Id, childId: Id) =>
      filiations.push({
        id: context.nextId(),
        treeId,
        parentId,
        childId,
        type: 'birth',
        certainty: 'certain',
        recognitionStatus: 'unknown',
      });
    const [father, mother] = [person(), person()];
    const ends: Id[] = [];
    for (let branch = 0; branch < 2; branch += 1) {
      let current = person();
      child(father, current);
      child(mother, current);
      for (let generation = 1; generation < 150; generation += 1) {
        const next = person();
        child(current, next);
        current = next;
      }
      ends.push(current);
    }
    // Graphe neuf avant chaque mesure à froid (hors du temps compté) : le premier appel calcule
    // les ensembles d'ancêtres (cache froid) ; sur le dernier graphe, les appels suivants les
    // retrouvent en cache.
    const [a, b] = ends;
    if (a === undefined || b === undefined) throw new Error('Missing ends');
    let graph = createKinshipGraph({ people, unions: [], filiations });
    let result: ReturnType<typeof findRelationships> | undefined;
    const cold = medianTime(
      () => {
        result = findRelationships(graph, a, b);
      },
      {
        warmup: 1,
        runs: 3,
        setup: () => {
          graph = createKinshipGraph({ people, unions: [], filiations });
        },
      },
    ).medianMs;
    const warm = medianTime(
      () => {
        findRelationships(graph, a, b);
      },
      { warmup: 1, runs: 5 },
    ).medianMs;
    console.info(
      `PAR-01, cas profond (${String(people.length)} personnes) : premier appel, cache froid ` +
        `${cold.toFixed(2)} ms ; appel suivant, cache chaud ${warm.toFixed(2)} ms`,
    );
    for (const [label, measured] of [
      ['PAR-01, cas profond, cache froid', cold],
      ['PAR-01, cas profond, cache chaud', warm],
    ] as const) {
      const report = reportBudget(label, measured, PAR_01_BUDGET_MS);
      expect(report.measuredMs).toBeLessThan(report.ceilingMs);
    }
    const segment = result?.status === 'related' ? result.relationships[0]?.segments[0] : undefined;
    expect(
      segment?.kind === 'blood' && [
        segment.generationsUp,
        segment.generationsDown,
        segment.sharing,
      ],
    ).toEqual([150, 150, 'full']);
  });
});
