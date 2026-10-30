// Budgets de l'Android de référence ramenés au poste (T-028, ADR 0026). Le facteur de
// ralentissement est partagé avec les autres paquets (`@lignee/domain/test-support`,
// reference-device.ts) ; seule la tranche du calcul découpé est propre au moteur de parenté.
import { deviceSlowdown } from '@lignee/domain/test-support';

import { DEFAULT_SLICE_MS } from '../slicing';

export {
  deviceSlowdown,
  ESTIMATED_DEVICE_SLOWDOWN,
  onThisMachine,
} from '@lignee/domain/test-support';

/**
 * Tranche visée sur le poste pour reproduire la tranche par défaut du téléphone (8 ms) : le
 * découpage est alors celui du téléphone, à l'échelle du poste.
 */
export function emulatedSliceMs(slowdown = deviceSlowdown()): number {
  return DEFAULT_SLICE_MS / slowdown;
}
