// Probabilités uniformes pour les arbitraires fast-check. `fc.double` tire sur la représentation
// binaire des flottants : entre 0 et 1, la moitié des valeurs vaut moins de 1e-150, et presque
// aucune ne dépasse 0,01. Une probabilité tirée ainsi vaut pratiquement toujours 0. Ici, un
// entier tiré sans biais sur une échelle fine est ramené dans l'intervalle ; la réduction d'un
// échec va vers la borne basse. Réservé aux tests.
import fc from 'fast-check';

/** Nombre de pas de l'échelle (2^30) : un pas vaut moins de 1e-9. */
export const PROBABILITY_STEPS = 2 ** 30;

export interface ProbabilityArbitraryOptions {
  /** Exclut la borne haute (tirage d'un jour possible dans un intervalle, par exemple). */
  maxExcluded?: boolean;
}

/** Nombre tiré uniformément entre `min` et `max` (bornes comprises, sauf `maxExcluded`). */
export function probabilityArbitrary(
  min = 0,
  max = 1,
  options: ProbabilityArbitraryOptions = {},
): fc.Arbitrary<number> {
  if (!(min <= max)) throw new RangeError(`Intervalle vide : [${String(min)}, ${String(max)}]`);
  const last = options.maxExcluded === true ? PROBABILITY_STEPS - 1 : PROBABILITY_STEPS;
  // `noBias` : sans lui, fast-check tire souvent les petits entiers (environ 15 % des tirages
  // collés à la borne basse). La réduction d'un échec reste active.
  return fc
    .noBias(fc.integer({ min: 0, max: last }))
    .map((step) => min + ((max - min) * step) / PROBABILITY_STEPS);
}
