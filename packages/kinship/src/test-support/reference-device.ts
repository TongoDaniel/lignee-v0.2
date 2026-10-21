// Budgets de l'Android de référence, ramenés au poste ou au runner qui fait tourner les tests
// (T-028, ADR 0026). Le TRD fixe les budgets sur le téléphone (2 Go de mémoire, Android 10, Hermes
// sans compilation à la volée) ; Vitest tourne sur Node (V8, avec compilation à la volée) sur une
// machine bien plus rapide. Un budget du téléphone se compare donc à la mesure du poste multipliée
// par un facteur de ralentissement estimé, puis au garde-fou habituel (`reportBudget` : × 1,5 sur
// un poste, × 3 en CI). Le facteur se remplace par la valeur mesurée sur le téléphone (T-105) ;
// `LIGNEE_DEVICE_SLOWDOWN` le change sans toucher au code.
import { DEFAULT_SLICE_MS } from '../slicing';

/**
 * Ralentissement estimé de l'Android de référence face au poste de développement : 30. Il
 * combine deux écarts : Hermes interprète le code sans compilation à la volée (5 à 10 fois plus
 * lent que V8 sur ce genre de calcul, qui manipule des tableaux, des Map et des chaînes), et un
 * processeur d'entrée de gamme (quatre ou huit Cortex-A53 ou A55 vers 1,6 à 2 GHz) est 3 à 6 fois
 * plus lent qu'un cœur de poste récent. Valeur prudente, dans le haut de la fourchette 15 à 60 ;
 * à remplacer par la mesure (issue #34, T-105).
 */
export const ESTIMATED_DEVICE_SLOWDOWN = 30;

/** Facteur de ralentissement : `LIGNEE_DEVICE_SLOWDOWN` s'il est défini, sinon l'estimation. */
export function deviceSlowdown(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.LIGNEE_DEVICE_SLOWDOWN?.trim();
  if (raw === undefined || raw === '') return ESTIMATED_DEVICE_SLOWDOWN;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`LIGNEE_DEVICE_SLOWDOWN must be a positive number, got "${raw}"`);
  }
  return value;
}

/** Budget du téléphone, ramené au poste : budget ÷ ralentissement. */
export function onThisMachine(deviceBudgetMs: number, slowdown = deviceSlowdown()): number {
  return deviceBudgetMs / slowdown;
}

/**
 * Tranche visée sur le poste pour reproduire la tranche par défaut du téléphone (8 ms) : le
 * découpage est alors celui du téléphone, à l'échelle du poste.
 */
export function emulatedSliceMs(slowdown = deviceSlowdown()): number {
  return DEFAULT_SLICE_MS / slowdown;
}
