// Ordonnanceurs des tests du calcul découpé (T-028). Une horloge simulée rend le découpage
// reproductible ; l'horloge réelle mesure la durée de chaque tranche.
import type { SliceScheduler } from '../slicing';

export interface FakeScheduler extends SliceScheduler {
  /** Nombre de fois où le calcul a rendu la main. */
  readonly yields: number;
  /** Lectures de l'horloge. */
  readonly reads: number;
}

/**
 * Horloge simulée : chaque lecture avance de `tickMs`. La main rendue ne passe que par une
 * micro-tâche : aucun délai réel. `onYield` est appelé à chaque pause (annulation en cours de
 * calcul, calcul concurrent…).
 */
export function fakeScheduler(tickMs = 1, onYield?: (count: number) => void): FakeScheduler {
  let time = 0;
  let yields = 0;
  let reads = 0;
  return {
    now: () => {
      reads += 1;
      time += tickMs;
      return time;
    },
    yield: async () => {
      yields += 1;
      onYield?.(yields);
      await Promise.resolve();
    },
    get yields() {
      return yields;
    },
    get reads() {
      return reads;
    },
  };
}

export interface MeasuringScheduler extends SliceScheduler {
  /** Durée réelle de chaque tranche terminée par une pause, en millisecondes. */
  readonly slices: number[];
  /** Démarre la mesure de la première tranche (juste avant l'appel). */
  begin(): void;
  /** Termine la mesure de la dernière tranche (juste après le résultat). */
  end(): void;
}

/** Horloge réelle (`performance.now`), main rendue par `setImmediate` ; chaque tranche mesurée. */
export function measuringScheduler(): MeasuringScheduler {
  const slices: number[] = [];
  let started = performance.now();
  return {
    slices,
    now: () => performance.now(),
    yield: () => {
      slices.push(performance.now() - started);
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          started = performance.now();
          resolve();
        });
      });
    },
    begin: () => {
      started = performance.now();
    },
    end: () => {
      slices.push(performance.now() - started);
    },
  };
}
