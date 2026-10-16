// Aléa reproductible pour les arbres générés : une graine donne toujours le même arbre.
import { createUuidV7Generator, type Id } from '../ids';

export interface Random {
  /** Nombre dans [0, 1). */
  next(): number;
  /** Entier dans [min, max], bornes comprises. */
  int(min: number, max: number): number;
  /** Vrai avec la probabilité `probability`. */
  chance(probability: number): boolean;
  /** Un élément d'une liste non vide. */
  pick<T>(items: readonly T[]): T;
}

/** Générateur mulberry32 : rapide, 32 bits d'état, suffisant pour des données de test. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('Cannot pick from an empty list');
      return item;
    },
  };
}

/** Identifiants UUIDv7 reproductibles : horloge fictive et octets tirés de `random`. */
export function seededIds(random: Random, start = 1_790_000_000_000): () => Id {
  let tick = start;
  return createUuidV7Generator({
    now: () => (tick += 1),
    fillRandom: (bytes) => {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = random.int(0, 255);
      return bytes;
    },
  });
}
