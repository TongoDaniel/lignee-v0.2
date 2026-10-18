// Distribution des arbitraires : les probabilités sont tirées uniformément, et les arbres
// « variés » contiennent vraiment des unions, des filiations et les structures familiales
// difficiles. Avant ce test, `fc.double` tirait presque toujours des probabilités d'environ
// 1e-200 : la plupart des arbres variés n'avaient ni union ni filiation, et les propriétés de
// tout le dépôt testaient surtout des arbres vides.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { treeArbitrary, treeRatesArbitrary } from './arbitraries';
import { probabilityArbitrary } from './probability';
import type { TreeFeatures, TreeGeneratorRates } from './tree-generator';

/** Graine fixe : le test mesure une distribution, il ne doit pas dépendre du tirage. */
const SEED = 20_261_018;

describe('probabilités uniformes', () => {
  it('chaque quart de l’intervalle reçoit à peu près un quart des 4 000 tirages, bornes respectées', () => {
    const values = fc.sample(probabilityArbitrary(0.2, 0.8), { numRuns: 4000, seed: SEED });
    const quarters = [0, 0, 0, 0];
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0.2);
      expect(value).toBeLessThanOrEqual(0.8);
      const index = Math.min(3, Math.floor(((value - 0.2) / 0.6) * 4));
      quarters[index] = (quarters[index] ?? 0) + 1;
    }
    // Uniforme : chaque quart entre 22 et 28 % (écart type d'environ 0,7 %).
    for (const count of quarters) {
      expect(count).toBeGreaterThan(880);
      expect(count).toBeLessThan(1120);
    }
    // Plus aucune valeur collée à la borne basse (le défaut de `fc.double`).
    const nearMin = values.filter((value) => value < 0.2 + 1e-6).length;
    expect(nearMin).toBeLessThan(values.length / 100);
  });

  it('borne haute exclue sur demande', () => {
    const values = fc.sample(probabilityArbitrary(0, 1, { maxExcluded: true }), {
      numRuns: 2000,
      seed: SEED,
    });
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(() => probabilityArbitrary(1, 0)).toThrow(RangeError);
  });

  it('les probabilités des arbres variés ont une médiane proche de la moitié de leur plafond', () => {
    const draws = fc.sample(treeRatesArbitrary(), { numRuns: 1000, seed: SEED });
    const keys = Object.keys(draws[0] ?? {}) as (keyof TreeGeneratorRates)[];
    for (const key of keys) {
      const sorted = draws.map((rates) => rates[key]).sort((a, b) => a - b);
      const ceiling = Math.max(...sorted);
      const median = sorted[sorted.length / 2] ?? 0;
      expect(median, key).toBeGreaterThan(ceiling * 0.3);
      expect(median, key).toBeLessThan(ceiling * 0.7);
    }
  });
});

describe('arbres variés', () => {
  it('sur 200 arbres, au moins la moitié ont des unions et des filiations, et chaque structure difficile apparaît', () => {
    const trees = fc.sample(treeArbitrary({ maxSize: 120, rates: 'varied' }), {
      numRuns: 200,
      seed: SEED,
    });
    const withUnions = trees.filter((tree) => tree.unions.length > 0).length;
    const withFiliations = trees.filter((tree) => tree.filiations.length > 0).length;
    expect(withUnions).toBeGreaterThanOrEqual(100);
    expect(withFiliations).toBeGreaterThanOrEqual(100);

    // Compteur des structures rencontrées : nombre d'arbres où chacune apparaît.
    const counter: Record<keyof TreeFeatures, number> = {
      polygamousPeople: 0,
      successiveUnions: 0,
      levirate: 0,
      sororate: 0,
      implex: 0,
      placeholders: 0,
      unknownParentChildren: 0,
      nonBirthFiliations: 0,
      multipleBirths: 0,
      hiddenObjects: 0,
      toPlace: 0,
    };
    for (const tree of trees) {
      for (const key of Object.keys(counter) as (keyof TreeFeatures)[]) {
        if (tree.features[key] > 0) counter[key] += 1;
      }
    }
    // Chaque structure se retrouve dans au moins 5 % des arbres (10 sur 200).
    for (const [key, count] of Object.entries(counter)) {
      expect(count, key).toBeGreaterThanOrEqual(10);
    }
  });
});
