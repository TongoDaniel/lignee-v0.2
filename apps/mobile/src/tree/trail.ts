// Fil d'Ariane de l'arbre (ARB-09) : les personnes sur lesquelles on a recentré, de « Vous » à la
// personne actuelle. Toucher l'une d'elles y revient ; « Vous » est toujours la première.
import type { Id } from '@lignee/domain';

/** Nombre de personnes gardées après « Vous » : le fil reste lisible sur un petit écran. */
export const MAX_TRAIL_AFTER_YOU = 4;

export function startTrail(you: Id): readonly Id[] {
  return [you];
}

/**
 * Fil après un recentrage sur `target`. Revenir à une personne déjà dans le fil le raccourcit
 * jusqu'à elle ; sinon elle s'ajoute, et les plus anciennes (hors « Vous ») tombent au-delà du
 * maximum.
 */
export function recenterTrail(trail: readonly Id[], target: Id, you: Id): readonly Id[] {
  if (target === you) return [you];
  const at = trail.indexOf(target);
  if (at >= 0) return trail.slice(0, at + 1);
  const rest = [...trail.filter((id) => id !== you), target].slice(-MAX_TRAIL_AFTER_YOU);
  return [you, ...rest];
}
