// Adresses du formulaire d'une personne (T-031 du plan V1). L'arbre (T-018), la fiche et la
// recherche ouvrent le formulaire par `router.push(newPersonRoute())` ou
// `router.push(editPersonRoute(personId))`.
import type { Id } from '@lignee/domain';

const query = (treeId: Id | undefined): string =>
  treeId === undefined ? '' : `?treeId=${encodeURIComponent(treeId)}`;

/** Ajouter une personne. `treeId` n'est utile que s'il y a plusieurs arbres sur le téléphone. */
export function newPersonRoute(treeId?: Id): `/person/new${string}` {
  return `/person/new${query(treeId)}`;
}

/** Modifier (ou supprimer) la fiche d'une personne. */
export function editPersonRoute(personId: Id, treeId?: Id): `/person/edit/${string}` {
  return `/person/edit/${encodeURIComponent(personId)}${query(treeId)}`;
}
