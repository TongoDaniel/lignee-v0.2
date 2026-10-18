// Arbres générés réellement peuplés, pour les propriétés de la présentation des liens (T-022).
// `treeArbitrary` de @lignee/domain tire chaque probabilité avec `fc.double`, qui tire sur la
// représentation binaire des flottants : presque toutes valent alors moins de 1e-10, et la
// plupart des arbres « variés » n'ont ni union ni filiation. Ici, chaque probabilité est tirée
// uniformément en valeur, entre 0 et le même plafond que dans `arbitraries.ts` (à corriger à la
// source dans un ticket du domaine). Réservé aux tests.
import {
  generateTree,
  type GeneratedTree,
  type TreeGeneratorRates,
} from '@lignee/domain/test-support';
import fc from 'fast-check';

/** Plafonds de `packages/domain/src/test-support/arbitraries.ts`. */
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

/** Probabilités uniformes en valeur ; le mariage au moins à 0,5 pour que l'arbre se peuple. */
function ratesArbitrary(): fc.Arbitrary<TreeGeneratorRates> {
  const entries = Object.entries(RATE_CEILINGS) as [keyof TreeGeneratorRates, number][];
  return fc.record(
    Object.fromEntries(
      entries.map(([key, ceiling]) => {
        const floor = key === 'marriage' ? 0.5 : 0;
        return [
          key,
          fc
            .noBias(fc.integer({ min: 0, max: 1000 }))
            .map((step) => floor + (step / 1000) * (ceiling - floor)),
        ];
      }),
    ) as Record<keyof TreeGeneratorRates, fc.Arbitrary<number>>,
  );
}

/** Arbre généré peuplé : polygamie, lévirat, sororat, implexe, liens non biologiques… */
export function populatedTreeArbitrary(
  options: { minSize?: number; maxSize?: number } = {},
): fc.Arbitrary<GeneratedTree> {
  const { minSize = 2, maxSize = 90 } = options;
  return fc
    .record({
      seed: fc.integer({ min: 0, max: 0x7fffffff }),
      size: fc.integer({ min: minSize, max: maxSize }),
      rates: ratesArbitrary(),
    })
    .map((generatorOptions) => generateTree(generatorOptions));
}
