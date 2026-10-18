// Base locale de l'app : expo-sqlite compilé avec SQLCipher (plugin `expo-sqlite`,
// `useSQLCipher: true`, app.config.ts), clé dans le trousseau (expo-secure-store), Drizzle.
// L'ouverture, la clé, les migrations et le contenu sont dans @lignee/sync (T-016, ADR 0023) :
// ce fichier ne fait que les brancher sur les modules natifs.
import {
  localSchema,
  openLocalDatabase,
  type DatabaseFile,
  type KeyStore,
  type LocalDatabase,
  type OpenOutcome,
  type SqlConnection,
} from '@lignee/sync';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

/** Nom du fichier, dans le dossier par défaut d'expo-sqlite (données privées de l'app). */
export const DATABASE_NAME = 'lignee.db';

/**
 * Trousseau : la clé n'est lisible qu'après le premier déverrouillage depuis le démarrage (la
 * synchronisation en arrière-plan en a besoin) et ne quitte jamais cet appareil (ni sauvegarde
 * iCloud, ni transfert vers un nouveau téléphone).
 */
const keychainOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureKeyStore: KeyStore = {
  get: (name) => SecureStore.getItemAsync(name, keychainOptions),
  set: (name, value) => SecureStore.setItemAsync(name, value, keychainOptions),
  delete: (name) => SecureStore.deleteItemAsync(name, keychainOptions),
};

interface ExpoConnection extends SqlConnection {
  readonly native: SQLiteDatabase;
}

function expoDatabaseFile(): DatabaseFile & { open(): ExpoConnection } {
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
      try {
        deleteDatabaseSync(DATABASE_NAME);
        return true;
      } catch {
        // expo-sqlite refuse d'effacer un fichier absent.
        return false;
      }
    },
  };
}

export interface AppDatabase {
  readonly db: LocalDatabase;
  readonly outcome: OpenOutcome;
}

/** Ouvre (ou crée) la base chiffrée et applique les migrations. */
export async function openAppDatabase(): Promise<AppDatabase> {
  const opened = await openLocalDatabase({
    file: expoDatabaseFile(),
    keyStore: secureKeyStore,
    randomBytes: getRandomBytes,
  });
  const { native } = opened.connection as ExpoConnection;
  return { db: drizzle(native, { schema: localSchema }), outcome: opened.outcome };
}
