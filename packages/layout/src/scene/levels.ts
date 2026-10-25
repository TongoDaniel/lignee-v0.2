// Niveaux de zoom et boutons « + » et « − » (T-017 ; PRD, ARB-02 et ACC-06). Trois niveaux de
// détail suivent le zoom (TRD) : vue d'ensemble (points colorés), standard (photo et prénom),
// détail (nom complet et années). Fonctions pures.
import type { ZoomSpec } from './spec';

export type ZoomLevel = 'overview' | 'standard' | 'detail';

/** Niveau de détail pour une échelle. */
export function zoomLevelFor(scale: number, zoom: ZoomSpec): ZoomLevel {
  if (scale < zoom.overviewBelow) return 'overview';
  if (scale >= zoom.detailFrom) return 'detail';
  return 'standard';
}

/** Échelle ramenée dans les butées. */
export function clampScale(scale: number, zoom: ZoomSpec): number {
  return Math.min(zoom.max, Math.max(zoom.min, scale));
}

const EPSILON = 1e-6;

/**
 * Cran suivant (`direction` 1, bouton « + ») ou précédent (−1, bouton « − »). Au bout, l'échelle
 * ne change pas. Les crans sont les tailles d'avatar de la charte : un bouton mène toujours à un
 * rendu prévu par la charte.
 */
export function zoomStep(scale: number, direction: 1 | -1, zoom: ZoomSpec): number {
  const stops = zoom.stops;
  if (direction === 1) {
    return stops.find((stop) => stop > scale + EPSILON) ?? clampScale(scale, zoom);
  }
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const stop = stops[index] ?? scale;
    if (stop < scale - EPSILON) return stop;
  }
  return clampScale(scale, zoom);
}

/** Les boutons sont inactifs aux butées. */
export function canZoom(scale: number, direction: 1 | -1, zoom: ZoomSpec): boolean {
  return Math.abs(zoomStep(scale, direction, zoom) - scale) > EPSILON;
}
