// Saisie d'une personne à la main (T-031 du plan V1) : ce que l'écran lit dans la copie locale du
// lecteur pour créer, modifier ou supprimer une fiche. Comme la fiche (read-profile.ts), rien ne
// vient du serveur et rien n'est recalculé : le lecteur est celui pour qui l'arbre a été filtré
// (`readerAccountId`), jamais un identifiant passé par l'écran.
import {
  draftFromSource,
  planPersonDeletion,
  type DeletionPlan,
  type Id,
  type NameOrder,
  type PersonDraft,
  type Place,
} from '@lignee/domain';

import {
  listLocalTrees,
  readTreeSnapshot,
  type LocalDatabase,
  type LocalTreeSnapshot,
} from '../local-db/snapshot';

export interface EntryContext {
  readonly treeId: Id;
  /** Compte du lecteur : auteur de tout ce qui est saisi. */
  readonly accountId: Id;
  readonly nameOrder: NameOrder;
  readonly treeName: string;
  /** Lieux déjà dans l'arbre, à réutiliser plutôt que recréer. */
  readonly places: readonly Place[];
}

export interface ReadEntryOptions {
  /** Arbre à lire ; sans lui, le premier arbre du téléphone (la V1 n'en ouvre qu'un). */
  readonly treeId?: Id;
}

function contextOf(snapshot: LocalTreeSnapshot): EntryContext {
  return {
    treeId: snapshot.tree.id,
    accountId: snapshot.readerAccountId,
    nameOrder: snapshot.tree.nameOrder,
    treeName: snapshot.tree.name,
    places: snapshot.places,
  };
}

function snapshotOf(db: LocalDatabase, options: ReadEntryOptions) {
  const treeId = options.treeId ?? listLocalTrees(db)[0]?.id;
  return treeId === undefined ? undefined : readTreeSnapshot(db, treeId);
}

/** De quoi créer une personne : l'arbre, le lecteur, l'ordre des noms, les lieux connus. */
export function readEntryContext(
  db: LocalDatabase,
  options: ReadEntryOptions = {},
): EntryContext | undefined {
  const snapshot = snapshotOf(db, options);
  if (snapshot === undefined) return undefined;
  return contextOf(snapshot);
}

export interface PersonEntryRead {
  readonly context: EntryContext;
  /** La fiche telle qu'elle est, à modifier. */
  readonly draft: PersonDraft;
}

/**
 * La fiche de `personId` en brouillon, ou `undefined` si elle n'est pas dans la copie du lecteur
 * (même réponse pour une personne masquée et pour une personne qui n'existe pas). L'ancien prénom
 * et la cause de décès n'y figurent que pour qui y a droit.
 */
export function readPersonDraft(
  db: LocalDatabase,
  personId: Id,
  options: ReadEntryOptions = {},
): PersonEntryRead | undefined {
  const snapshot = snapshotOf(db, options);
  if (snapshot === undefined) return undefined;
  const draft = draftFromSource(snapshot, personId, { accountId: snapshot.readerAccountId });
  if (draft === undefined) return undefined;
  return {
    context: contextOf(snapshot),
    draft,
  };
}

/**
 * Le lot qui supprime `personId` avec ses dépendants (ADR 0027), et de quoi le dire avant de
 * confirmer ; `undefined` si la personne n'est pas dans la copie du lecteur.
 */
export function readDeletionPlan(
  db: LocalDatabase,
  personId: Id,
  options: ReadEntryOptions = {},
): { readonly context: EntryContext; readonly plan: DeletionPlan } | undefined {
  const snapshot = snapshotOf(db, options);
  if (snapshot === undefined) return undefined;
  if (!snapshot.people.some((person) => person.id === personId)) return undefined;
  return {
    context: contextOf(snapshot),
    plan: planPersonDeletion(snapshot, personId),
  };
}
