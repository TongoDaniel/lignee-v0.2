// Fiche d'une personne lue dans la copie locale du téléphone (T-024 du plan V1). La fiche ne lit
// que la base locale, filtrée pour le lecteur de l'instantané (TRD, « Hors-ligne et
// synchronisation » : « les mêmes tables, limitées à ce que l'utilisateur peut voir ») : aucun
// appel au serveur, aucun recalcul de visibilité. Le lecteur est celui pour qui l'arbre a été
// filtré (`readerAccountId`), jamais un identifiant passé par l'écran.
import { buildProfile, type CalendarDay, type Id, type Profile } from '@lignee/domain';

import { listLocalTrees, readTreeSnapshot, type LocalDatabase } from '../local-db/snapshot';

export interface ReadProfileOptions {
  /** Arbre à lire ; sans lui, le premier arbre du téléphone (la V1 n'en ouvre qu'un). */
  readonly treeId?: Id;
  /** Jour de référence pour « présumée vivante » : l'écran lit l'horloge, pas le calcul. */
  readonly today: CalendarDay;
}

export interface ReadProfileResult {
  readonly profile: Profile;
  /** Nom de l'arbre, pour la mention « Visible par l'arbre … ». */
  readonly treeName: string;
}

/**
 * La fiche de `personId`, ou `undefined` si l'arbre ou la personne n'est pas sur le téléphone.
 * Une personne masquée pour le lecteur n'est pas dans sa copie : même réponse que pour une
 * personne qui n'existe pas.
 */
export function readProfile(
  db: LocalDatabase,
  personId: Id,
  options: ReadProfileOptions,
): ReadProfileResult | undefined {
  const treeId = options.treeId ?? listLocalTrees(db)[0]?.id;
  if (treeId === undefined) return undefined;
  const snapshot = readTreeSnapshot(db, treeId);
  if (snapshot === undefined) return undefined;
  const profile = buildProfile(snapshot, personId, {
    viewer: { accountId: snapshot.readerAccountId },
    today: options.today,
  });
  return profile === undefined ? undefined : { profile, treeName: snapshot.tree.name };
}
