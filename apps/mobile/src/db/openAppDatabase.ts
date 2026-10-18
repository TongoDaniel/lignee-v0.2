// Base locale de l'app : expo-sqlite compilé avec SQLCipher (plugin `expo-sqlite`,
// `useSQLCipher: true`, app.config.ts), clé dans le trousseau (expo-secure-store), Drizzle.
// L'ouverture, la clé, les migrations et le contenu sont dans @lignee/sync (T-016, ADR 0023) :
// ce fichier ne fait que les brancher sur les modules natifs.
import {
  localSchema,
  openLocalDatabase,
  type KeyStore,
  type LocalDatabase,
  type OpenOutcome,
} from '@lignee/sync';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { expoDatabaseFile, type ExpoConnection } from './expoDatabaseFile';

export { DATABASE_NAME } from './expoDatabaseFile';

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

export interface AppDatabase {
  readonly db: LocalDatabase;
  readonly outcome: OpenOutcome;
  /** Ferme la connexion ; la prochaine demande rouvre la base. */
  close(): void;
}

let opening: Promise<AppDatabase> | undefined;

async function open(): Promise<AppDatabase> {
  const opened = await openLocalDatabase({
    file: expoDatabaseFile(),
    keyStore: secureKeyStore,
    randomBytes: getRandomBytes,
  });
  const connection = opened.connection as ExpoConnection;
  return {
    db: drizzle(connection.native, { schema: localSchema }),
    outcome: opened.outcome,
    close: () => {
      if (opening !== undefined) opening = undefined;
      connection.close();
    },
  };
}

/**
 * Ouvre (ou crée) la base chiffrée et applique les migrations, une seule fois : tous les appels
 * reçoivent la même promesse, jusqu'à `close()`. Un échec n'est pas gardé : l'appel suivant
 * réessaie.
 */
export function openAppDatabase(): Promise<AppDatabase> {
  if (opening === undefined) {
    const attempt = open();
    opening = attempt;
    attempt.catch(() => {
      if (opening === attempt) opening = undefined;
    });
  }
  return opening;
}
