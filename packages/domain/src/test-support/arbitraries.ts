// Arbitraires fast-check : des arbres générés pour les tests de propriétés (TRD, Tests et
// qualité). fast-check tire la graine, la taille et les probabilités ; le générateur fait le
// reste. Un échec se réduit vers un arbre plus petit et des probabilités plus simples, et se
// rejoue avec la graine affichée par fast-check.
import fc from 'fast-check';

import {
  DEFAULT_TREE_GENERATOR_RATES,
  generateTree,
  type GeneratedTree,
  type TreeGeneratorOptions,
  type TreeGeneratorRates,
} from './tree-generator';

export interface TreeArbitraryOptions {
  minSize?: number;
  maxSize?: number;
  /**
   * `default` : probabilités par défaut. `varied` : chaque probabilité tirée entre 0 et une
   * valeur haute, pour forcer polygamie, lévirat, sororat, implexe, places à compléter, objets
   * masqués… dans de petits arbres.
   */
  rates?: 'default' | 'varied';
}

const RATE_CEILINGS: Record<keyof TreeGeneratorRates, number> = {
  marriage: 1,
  polygamy: 0.8,
  sororate: 0.9,
  implex: 0.6,
  withinTree: 0.8,
  levirate: 1,
  remarriage: 1,
  unknownParent: 1,
  placeholder: 0.6,
  adoption: 0.5,
  twins: 0.4,
  hidden: 0.6,
  toPlace: 0.1,
  distinctFrom: 1,
};

/** Probabilités tirées au hasard, chacune entre 0 et son plafond. */
export function treeRatesArbitrary(): fc.Arbitrary<TreeGeneratorRates> {
  const entries = Object.entries(RATE_CEILINGS) as [keyof TreeGeneratorRates, number][];
  return fc.record(
    Object.fromEntries(
      entries.map(([key, ceiling]) => [
        key,
        fc.double({ min: 0, max: ceiling, noNaN: true, noDefaultInfinity: true }),
      ]),
    ) as Record<keyof TreeGeneratorRates, fc.Arbitrary<number>>,
  );
}

/** Options du générateur : graine, taille, probabilités. */
export function treeOptionsArbitrary(
  options: TreeArbitraryOptions = {},
): fc.Arbitrary<TreeGeneratorOptions> {
  const { minSize = 1, maxSize = 120, rates = 'varied' } = options;
  return fc.record({
    seed: fc.integer({ min: 0, max: 0x7fffffff }),
    size: fc.integer({ min: minSize, max: maxSize }),
    rates:
      rates === 'varied'
        ? treeRatesArbitrary()
        : fc.constant<TreeGeneratorRates>({ ...DEFAULT_TREE_GENERATOR_RATES }),
  });
}

/** Arbre généré. */
export function treeArbitrary(options: TreeArbitraryOptions = {}): fc.Arbitrary<GeneratedTree> {
  return treeOptionsArbitrary(options).map((generatorOptions) => generateTree(generatorOptions));
}
