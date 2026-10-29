// Changements saisis sur ce téléphone (T-031 du plan V1) : une saisie enregistrée dans la base
// locale le dit aux écrans qui affichent l'arbre ou une fiche, pour qu'ils relisent la copie. Les
// onglets restent montés derrière une fiche : sans ce signal, l'arbre garderait l'ancien dessin.
import { createUuidV7Generator, type Id } from '@lignee/domain';
import { getRandomBytes } from 'expo-crypto';
import { useSyncExternalStore } from 'react';

let version = 0;
const listeners = new Set<() => void>();

/** À appeler après chaque saisie enregistrée (ou refusée après écriture partielle : jamais). */
export function notifyLocalChange(): void {
  version += 1;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Numéro de la dernière saisie : à mettre dans les dépendances d'une lecture de la copie. */
export function useLocalChangeVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}

/** Identifiants des objets créés sur le téléphone : UUIDv7, aléa du système (expo-crypto). */
export const createLocalId: () => Id = createUuidV7Generator({
  now: () => Date.now(),
  fillRandom: (bytes) => {
    bytes.set(getRandomBytes(bytes.length));
    return bytes;
  },
});
