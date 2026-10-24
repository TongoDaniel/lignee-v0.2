// Point d'entrée de la fiche d'une personne (T-024 du plan V1) : la route `/person/<identifiant>`
// de src/app/person/[personId].tsx. L'arbre (T-017), la recherche (T-038) et « Qui est-ce pour
// moi ? » (T-029) ouvrent une fiche par `router.push(profileRoute(personId))`.
import type { Id } from '@lignee/domain';

/**
 * Adresse de la fiche. `treeId` n'est utile que s'il y a plusieurs arbres sur le téléphone ;
 * sans lui, la fiche s'ouvre dans le premier arbre (la V1 n'en ouvre qu'un).
 */
export function profileRoute(personId: Id, treeId?: Id): `/person/${string}` {
  const query = treeId === undefined ? '' : `?treeId=${encodeURIComponent(treeId)}`;
  return `/person/${encodeURIComponent(personId)}${query}`;
}
