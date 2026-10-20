// Calcul découpé (T-028, ADR 0026) : le moteur rend la main entre deux tranches, et le résultat
// est exactement celui du calcul direct. Horloge simulée (`fakeScheduler`) : chaque lecture
// avance d'un pas, le découpage est reproductible et ne dépend pas de la machine.
// - même résultat que le calcul direct (graphe, chemins, liens présentés), sur des arbres
//   générés avec polygamie, lévirat, sororat, implexe et places à compléter, quel que soit le pas ;
// - déterminisme : même horloge, mêmes pauses, même résultat ;
// - annulation : avant le calcul ou pendant, rejet par `KinshipCancelledError`, sans résultat, et
//   le graphe reste juste pour les calculs suivants ;
// - deux calculs entrelacés sur le même graphe : chacun le sien ;
// - tranches valides : plus de 0, au plus 50 ms (TRD, Performance).
import { referenceTree, type GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createAllianceContext } from './alliance';
import { createKinshipGraph, createKinshipGraphInSlices, type KinshipGraphInput } from './graph';
import { findRelationships, findRelationshipsInSlices } from './kinship';
import { presentRelationships, presentRelationshipsInSlices } from './presentation';
import {
  CLOCK_EVERY,
  DEFAULT_SLICE_MS,
  KinshipCancelledError,
  MAX_SLICE_MS,
  runInSlices,
  sliceDuration,
  type Pacer,
  type Steps,
} from './slicing';
import { pairsOf } from './test-support/perf-trees';
import { populatedTreeArbitrary } from './test-support/populated-trees';
import { fakeScheduler } from './test-support/schedulers';

const RUNS = 120;
const TIMEOUT = 120_000;

function inputOf(tree: GeneratedTree): KinshipGraphInput {
  return {
    people: tree.people,
    unions: tree.unions,
    filiations: tree.filiations,
    parentCandidates: tree.parentCandidates,
  };
}

/** Un calcul qui compte ses points de pause et rend la main quand la tranche est écoulée. */
function* counting(total: number, pacer: Pacer): Steps<number> {
  let done = 0;
  for (let index = 0; index < total; index += 1) {
    if (pacer.due()) yield;
    done += 1;
  }
  return done;
}

describe('runInSlices', () => {
  it('rend la main quand la tranche est écoulée, et seulement alors', async () => {
    // Pas de 1 ms, tranche de 8 ms : l'horloge est lue tous les 16 points de pause, la tranche
    // finit à la 8e lecture, soit après 128 points.
    const scheduler = fakeScheduler(1);
    const total = 10_000;
    const result = await runInSlices((pacer) => counting(total, pacer), { scheduler });
    expect(result).toBe(total);
    const perSlice = CLOCK_EVERY * DEFAULT_SLICE_MS;
    expect(scheduler.yields).toBe(Math.floor((total - 1) / perSlice));
  });

  it('tranche plus courte, plus de pauses ; tranche plus longue que le calcul, aucune', async () => {
    const short = fakeScheduler(1);
    await runInSlices((pacer) => counting(10_000, pacer), { scheduler: short, sliceMs: 1 });
    const long = fakeScheduler(1);
    await runInSlices((pacer) => counting(10_000, pacer), { scheduler: long, sliceMs: 50 });
    expect(short.yields).toBeGreaterThan(long.yields);
    const none = fakeScheduler(0);
    await runInSlices((pacer) => counting(10_000, pacer), { scheduler: none });
    expect(none.yields).toBe(0);
  });

  it('refuse une tranche nulle, négative, non finie ou de plus de 50 ms', () => {
    expect(sliceDuration(undefined)).toBe(DEFAULT_SLICE_MS);
    expect(sliceDuration(MAX_SLICE_MS)).toBe(50);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 50.5]) {
      expect(() => sliceDuration(bad)).toThrow(RangeError);
    }
  });

  it('une tranche invalide rejette la promesse, sans rien calculer', async () => {
    const scheduler = fakeScheduler(1);
    await expect(
      runInSlices((pacer) => counting(10, pacer), { scheduler, sliceMs: 0 }),
    ).rejects.toThrow(RangeError);
    expect(scheduler.reads).toBe(0);
  });
});

describe('calcul découpé : même résultat que le calcul direct', () => {
  it(
    'graphe, chemins et liens présentés, quel que soit le pas de l’horloge',
    async () => {
      let paused = 0;
      await fc.assert(
        fc.asyncProperty(
          populatedTreeArbitrary({ minSize: 2, maxSize: 70 }),
          fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 4 }),
          fc.constantFrom(0.05, 0.5, 4),
          fc.constantFrom(1, 8, 50),
          async (tree, picks, tickMs, sliceMs) => {
            const input = inputOf(tree);
            const direct = createKinshipGraph(input);
            const scheduler = fakeScheduler(tickMs);
            const sliced = await createKinshipGraphInSlices(input, { scheduler, sliceMs });
            expect(sliced).toEqual(direct);
            const allianceContext = createAllianceContext(tree);
            const ids = tree.people.map((person) => person.id);
            for (const [i, j] of picks) {
              const a = ids[i % ids.length];
              const b = ids[j % ids.length];
              if (a === undefined || b === undefined) continue;
              // Graphe neuf pour le calcul découpé : ses caches d'ancêtres se remplissent pendant
              // les pauses, sans rien changer au résultat.
              const fresh = await createKinshipGraphInSlices(input, { scheduler, sliceMs });
              const options = { allianceContext, scheduler, sliceMs };
              expect(await findRelationshipsInSlices(fresh, a, b, options)).toEqual(
                findRelationships(direct, a, b, { allianceContext }),
              );
              expect(await presentRelationshipsInSlices(fresh, a, b, options)).toEqual(
                presentRelationships(direct, a, b, { allianceContext }),
              );
            }
            if (scheduler.yields > 0) paused += 1;
          },
        ),
        { numRuns: RUNS },
      );
      // La propriété a bien exercé des calculs interrompus.
      expect(paused).toBeGreaterThan(RUNS / 4);
    },
    TIMEOUT,
  );

  it(
    'arbre type de 5 000 personnes : graphe et liens identiques, calcul réellement découpé',
    async () => {
      const tree = referenceTree(5000);
      const input = inputOf(tree);
      const direct = createKinshipGraph(input);
      const scheduler = fakeScheduler(0.25);
      const sliced = await createKinshipGraphInSlices(input, { scheduler, sliceMs: 1 });
      expect(sliced).toEqual(direct);
      expect(scheduler.yields).toBeGreaterThan(10);
      const allianceContext = createAllianceContext(tree);
      const ids = tree.people.map((person) => person.id);
      let paused = 0;
      for (const [a, b] of pairsOf(ids, 40)) {
        const before = scheduler.yields;
        const options = { allianceContext, scheduler, sliceMs: 1 };
        expect(await presentRelationshipsInSlices(sliced, a, b, options)).toEqual(
          presentRelationships(direct, a, b, { allianceContext }),
        );
        if (scheduler.yields > before) paused += 1;
      }
      expect(paused).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});

describe('calcul découpé : déterminisme', () => {
  it('même horloge simulée : mêmes pauses, même résultat', async () => {
    const tree = referenceTree(1000);
    const input = inputOf(tree);
    const ids = tree.people.map((person) => person.id);
    const pairs = [...pairsOf(ids, 30, 7)];
    const run = async () => {
      const scheduler = fakeScheduler(0.1);
      const graph = await createKinshipGraphInSlices(input, { scheduler, sliceMs: 2 });
      const results = [];
      for (const [a, b] of pairs) {
        results.push(await findRelationshipsInSlices(graph, a, b, { scheduler, sliceMs: 2 }));
      }
      return { yields: scheduler.yields, reads: scheduler.reads, results };
    };
    const first = await run();
    const second = await run();
    expect(first.yields).toBeGreaterThan(0);
    expect(second).toEqual(first);
  }, 60_000);
});

describe('calcul découpé : annulation', () => {
  const tree = referenceTree(1000);
  const input = inputOf(tree);

  it('annulé avant le début : rejet, rien de calculé, la main jamais rendue', async () => {
    const scheduler = fakeScheduler(1);
    const signal = { aborted: true };
    await expect(createKinshipGraphInSlices(input, { scheduler, signal })).rejects.toBeInstanceOf(
      KinshipCancelledError,
    );
    const graph = createKinshipGraph(input);
    const [a, b] = [tree.people[0]?.id ?? '', tree.people[1]?.id ?? ''];
    await expect(
      findRelationshipsInSlices(graph, a, b, { scheduler, signal }),
    ).rejects.toBeInstanceOf(KinshipCancelledError);
    await expect(
      presentRelationshipsInSlices(graph, a, b, { scheduler, signal }),
    ).rejects.toBeInstanceOf(KinshipCancelledError);
    expect(scheduler.yields).toBe(0);
    expect(scheduler.reads).toBe(0);
  });

  it('annulé pendant la construction du graphe : rejet à la reprise suivante', async () => {
    const signal = { aborted: false };
    let resumedAfterCancel = 0;
    const scheduler = fakeScheduler(1, (count) => {
      if (count === 3) signal.aborted = true;
      if (count > 3) resumedAfterCancel += 1;
    });
    await expect(
      createKinshipGraphInSlices(input, { scheduler, signal, sliceMs: 1 }),
    ).rejects.toBeInstanceOf(KinshipCancelledError);
    expect(scheduler.yields).toBe(3);
    expect(resumedAfterCancel).toBe(0);
  });

  it(
    'annulé pendant un lien : rejet, puis le même graphe donne les bons liens',
    async () => {
      const graph = createKinshipGraph(input);
      const reference = createKinshipGraph(input);
      const allianceContext = createAllianceContext(tree);
      const ids = tree.people.map((person) => person.id);
      let cancelled = 0;
      for (const [a, b] of pairsOf(ids, 60, 99)) {
        const signal = { aborted: false };
        const scheduler = fakeScheduler(1, () => {
          signal.aborted = true;
        });
        // Tranche de 1 ms et pas de 1 ms : une pause tous les 16 points ; la première annule.
        const outcome = await findRelationshipsInSlices(graph, a, b, {
          allianceContext,
          scheduler,
          signal,
          sliceMs: 1,
        }).then(
          () => 'done',
          (error: unknown) => (error instanceof KinshipCancelledError ? 'cancelled' : 'error'),
        );
        expect(outcome).not.toBe('error');
        if (outcome === 'cancelled') cancelled += 1;
        // Après l'annulation, le graphe (et ses caches) reste juste.
        expect(findRelationships(graph, a, b, { allianceContext })).toEqual(
          findRelationships(reference, a, b, { allianceContext }),
        );
      }
      expect(cancelled).toBeGreaterThan(5);
    },
    TIMEOUT,
  );

  it('l’erreur d’annulation porte son nom', () => {
    const error = new KinshipCancelledError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('KinshipCancelledError');
  });
});

describe('calcul découpé : calculs entrelacés', () => {
  it(
    'deux questions en même temps sur le même graphe : chacune sa réponse',
    async () => {
      const tree = referenceTree(1000);
      const input = inputOf(tree);
      const graph = createKinshipGraph(input);
      const reference = createKinshipGraph(input);
      const ids = tree.people.map((person) => person.id);
      const pairs = [...pairsOf(ids, 40, 5)];
      const scheduler = fakeScheduler(1);
      const results = await Promise.all(
        pairs.map(([a, b]) => presentRelationshipsInSlices(graph, a, b, { scheduler, sliceMs: 1 })),
      );
      expect(scheduler.yields).toBeGreaterThan(0);
      results.forEach((result, index) => {
        const [a, b] = pairs[index] ?? ['', ''];
        expect(result).toEqual(presentRelationships(reference, a, b));
      });
    },
    TIMEOUT,
  );
});
