// Ouverture de la base chiffrée du téléphone, rotation de sa clé et effacement (CL-SEC-14 ;
// CL-SEC-08 s'en servira). Même code sur le téléphone et dans les tests : seul `DatabaseFile`
// change. ADR 0023.
import { isNotADatabaseError, type DatabaseFile, type SqlConnection } from './connection';
import {
  DATABASE_KEY_ENTRY,
  NEXT_DATABASE_KEY_ENTRY,
  generateDatabaseKey,
  keyPragma,
  readStoredKey,
  rekeyPragma,
  type DatabaseKey,
  type KeyStore,
  type RandomBytes,
} from './key';
import { migrateLocalDatabase } from './migrate';

/**
 * Ce qui s'est passé à l'ouverture. Aucune donnée de l'arbre : l'app peut le journaliser.
 * - `opened` : base existante, clé en service ;
 * - `rotation_completed` : une rotation interrompue après le rechiffrement a été terminée ;
 * - `created` : premier lancement, nouvelle clé ;
 * - `reset_key_missing` : un fichier existait sans clé dans le trousseau (sauvegarde restaurée,
 *   trousseau effacé) : illisible, il est effacé et la base recréée ;
 * - `reset_unreadable` : aucune clé du trousseau ne déchiffre le fichier : même traitement.
 * Après une remise à zéro, la copie de l'arbre revient du serveur, qui fait autorité ; les
 * saisies qui n'étaient pas encore parties sont perdues (ADR 0023).
 */
export type OpenOutcome =
  'opened' | 'rotation_completed' | 'created' | 'reset_key_missing' | 'reset_unreadable';

export interface OpenedLocalDatabase {
  readonly connection: SqlConnection;
  readonly outcome: OpenOutcome;
  /** Versions de schéma appliquées pendant cette ouverture. */
  readonly migrated: readonly number[];
}

export interface OpenLocalDatabaseOptions {
  readonly file: DatabaseFile;
  readonly keyStore: KeyStore;
  readonly randomBytes: RandomBytes;
}

/**
 * Ouvre le fichier avec `key` et vérifie qu'elle le déchiffre (lecture de sqlite_master).
 * Renvoie `undefined` si la clé ne convient pas ; toute autre erreur remonte.
 */
function tryOpen(file: DatabaseFile, key: DatabaseKey): SqlConnection | undefined {
  const connection = file.open();
  try {
    connection.exec(keyPragma(key));
    connection.get('SELECT count(*) AS tables FROM sqlite_master');
    return connection;
  } catch (error) {
    connection.close();
    if (isNotADatabaseError(error)) return undefined;
    throw error;
  }
}

/** Réglages appliqués à chaque ouverture, après la clé. */
function configure(connection: SqlConnection): void {
  connection.exec('PRAGMA foreign_keys = ON');
  // Fichiers temporaires (tris, index provisoires) en mémoire : rien sur le disque hors de la
  // base et de son journal, tous deux chiffrés.
  connection.exec('PRAGMA temp_store = MEMORY');
  connection.exec('PRAGMA journal_mode = WAL');
}

function finish(connection: SqlConnection, outcome: OpenOutcome): OpenedLocalDatabase {
  try {
    configure(connection);
    const migrated = migrateLocalDatabase(connection);
    return { connection, outcome, migrated };
  } catch (error) {
    connection.close();
    throw error;
  }
}

async function createFresh(
  options: OpenLocalDatabaseOptions,
  reason: 'no_key' | 'unreadable',
): Promise<OpenedLocalDatabase> {
  const { file, keyStore, randomBytes } = options;
  const existed = file.deleteIfExists();
  const key = generateDatabaseKey(randomBytes);
  // La clé est dans le trousseau avant que le fichier existe : jamais de fichier sans clé.
  await keyStore.set(DATABASE_KEY_ENTRY, key);
  await keyStore.delete(NEXT_DATABASE_KEY_ENTRY);
  const connection = tryOpen(file, key);
  if (connection === undefined) throw new Error('New local database cannot be opened');
  const outcome: OpenOutcome =
    reason === 'unreadable' ? 'reset_unreadable' : existed ? 'reset_key_missing' : 'created';
  return finish(connection, outcome);
}

/**
 * Ouvre la base du téléphone : clé du trousseau, réglages, migrations. Sans clé, ou si aucune clé
 * ne déchiffre le fichier, la base est recréée vide (voir `OpenOutcome`).
 */
export async function openLocalDatabase(
  options: OpenLocalDatabaseOptions,
): Promise<OpenedLocalDatabase> {
  const { file, keyStore } = options;
  const current = await readStoredKey(keyStore, DATABASE_KEY_ENTRY);
  const next = await readStoredKey(keyStore, NEXT_DATABASE_KEY_ENTRY);

  if (current === null && next === null) return createFresh(options, 'no_key');

  if (current !== null) {
    const connection = tryOpen(file, current);
    if (connection !== undefined) {
      // Rotation commencée mais pas appliquée : la clé suivante n'a jamais servi.
      if (next !== null) await keyStore.delete(NEXT_DATABASE_KEY_ENTRY);
      return finish(connection, 'opened');
    }
  }

  if (next !== null) {
    const connection = tryOpen(file, next);
    if (connection !== undefined) {
      // Rotation appliquée au fichier, interrompue avant la mise à jour du trousseau.
      await keyStore.set(DATABASE_KEY_ENTRY, next);
      await keyStore.delete(NEXT_DATABASE_KEY_ENTRY);
      return finish(connection, 'rotation_completed');
    }
  }

  return createFresh(options, 'unreadable');
}

/**
 * Change la clé de la base ouverte (`PRAGMA rekey`). La nouvelle clé est écrite dans le trousseau
 * avant le rechiffrement, puis promue : une interruption à n'importe quelle étape laisse une clé
 * du trousseau qui ouvre le fichier (voir `openLocalDatabase`).
 */
export async function rotateDatabaseKey(
  connection: SqlConnection,
  keyStore: KeyStore,
  randomBytes: RandomBytes,
): Promise<void> {
  const next = generateDatabaseKey(randomBytes);
  await keyStore.set(NEXT_DATABASE_KEY_ENTRY, next);
  // Le rechiffrement se fait hors du mode WAL : tout le contenu repasse d'abord dans le fichier
  // principal, et aucun journal ne garde de pages sous l'ancienne clé.
  connection.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  connection.exec('PRAGMA journal_mode = DELETE');
  connection.exec(rekeyPragma(next));
  connection.exec('PRAGMA journal_mode = WAL');
  await keyStore.set(DATABASE_KEY_ENTRY, next);
  await keyStore.delete(NEXT_DATABASE_KEY_ENTRY);
}

/**
 * Efface la base et ses clés (déconnexion, compte supprimé, exclusion : CL-SEC-08, T-054). La
 * connexion, si elle est ouverte, est fermée d'abord.
 */
export async function destroyLocalDatabase(
  file: DatabaseFile,
  keyStore: KeyStore,
  connection?: SqlConnection,
): Promise<void> {
  connection?.close();
  file.deleteIfExists();
  await keyStore.delete(DATABASE_KEY_ENTRY);
  await keyStore.delete(NEXT_DATABASE_KEY_ENTRY);
}
