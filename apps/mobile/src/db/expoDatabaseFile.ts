// Fichier de la base locale sur le téléphone, pour `openLocalDatabase` (@lignee/sync) :
// ouverture par expo-sqlite (compilé avec SQLCipher), effacement du fichier et de ses fichiers
// annexes.
import type { DatabaseFile, SqlConnection } from '@lignee/sync';
import { File } from 'expo-file-system';
import {
  defaultDatabaseDirectory,
  deleteDatabaseSync,
  openDatabaseSync,
  type SQLiteDatabase,
} from 'expo-sqlite';

/** Nom du fichier, dans le dossier par défaut d'expo-sqlite (données privées de l'app). */
export const DATABASE_NAME = 'lignee.db';

/** Fichiers annexes de SQLite : journal WAL, mémoire partagée du WAL, journal d'annulation. */
export const DATABASE_SIDE_FILES = ['-wal', '-shm', '-journal'] as const;

export interface ExpoConnection extends SqlConnection {
  readonly native: SQLiteDatabase;
}

/** Accès minimal au système de fichiers, remplacé dans les tests. */
export interface DatabaseFileSystem {
  exists(path: string): boolean;
  remove(path: string): void;
}

const expoFileSystem: DatabaseFileSystem = {
  exists: (path) => new File(`file://${path}`).exists,
  remove: (path) => {
    new File(`file://${path}`).delete();
  },
};

/**
 * Efface la base et ses fichiers annexes. Renvoie vrai si le fichier de la base existait, faux
 * seulement s'il était absent. Toute autre erreur remonte : en particulier, expo-sqlite refuse
 * d'effacer une base dont une connexion est encore ouverte. `deleteDatabaseSync` n'efface pas
 * les fichiers annexes : ils le sont ici, même sans fichier principal (journal resté après un
 * arrêt brutal).
 */
export function deleteDatabaseFiles(
  fileSystem: DatabaseFileSystem,
  deleteDatabase: (name: string) => void,
  directory: string,
  name: string = DATABASE_NAME,
): boolean {
  const path = `${directory}/${name}`;
  const existed = fileSystem.exists(path);
  if (existed) deleteDatabase(name);
  for (const suffix of DATABASE_SIDE_FILES) {
    if (fileSystem.exists(path + suffix)) fileSystem.remove(path + suffix);
  }
  return existed;
}

export function expoDatabaseFile(
  fileSystem: DatabaseFileSystem = expoFileSystem,
): DatabaseFile & { open(): ExpoConnection } {
  return {
    open() {
      const native = openDatabaseSync(DATABASE_NAME);
      return {
        native,
        exec: (sql) => {
          native.execSync(sql);
        },
        get: (sql) => native.getFirstSync<Record<string, unknown>>(sql) ?? undefined,
        close: () => {
          native.closeSync();
        },
      };
    },
    deleteIfExists() {
      return deleteDatabaseFiles(
        fileSystem,
        (name) => {
          deleteDatabaseSync(name);
        },
        String(defaultDatabaseDirectory),
      );
    },
  };
}
