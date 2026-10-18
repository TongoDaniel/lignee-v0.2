// Base chiffrée sur le poste, pour les tests : better-sqlite3-multiple-ciphers (SQLite3MultipleCiphers)
// réglé sur le format SQLCipher 4, celui d'expo-sqlite compilé avec SQLCipher. Même clé brute,
// même PRAGMA key et PRAGMA rekey que sur le téléphone ; seul ce fichier connaît Node.
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { DatabaseFile, SqlConnection } from '../local-db/connection';
import { openLocalDatabase } from '../local-db/open';
import type { KeyStore, RandomBytes } from '../local-db/key';
import { localSchema } from '../local-db/schema';
import type { LocalDatabase } from '../local-db/snapshot';

// Le paquet publie ses types sans les déclarer dans `exports` : TypeScript ne les trouve pas. Son
// API est celle de better-sqlite3, dont il est une variante ; on le charge avec ces types.
const Database = createRequire(import.meta.url)(
  'better-sqlite3-multiple-ciphers',
) as typeof BetterSqlite3;

export interface NodeConnection extends SqlConnection {
  readonly raw: BetterSqlite3.Database;
}

/** Fichier de base dans un dossier temporaire, chiffré au format SQLCipher 4. */
export interface NodeDatabaseFile extends DatabaseFile {
  open(): NodeConnection;
}

export function nodeDatabaseFile(path: string): NodeDatabaseFile {
  return {
    open() {
      const raw = new Database(path);
      // SQLite3MultipleCiphers : chiffrement SQLCipher, réglages par défaut de la version 4.
      raw.pragma(`cipher = 'sqlcipher'`);
      raw.pragma('legacy = 4');
      return {
        raw,
        exec: (sql) => {
          raw.exec(sql);
        },
        get: (sql) => raw.prepare(sql).get() as Record<string, unknown> | undefined,
        close: () => {
          if (raw.open) raw.close();
        },
      };
    },
    deleteIfExists() {
      const existed = existsSync(path);
      for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(path + suffix, { force: true });
      return existed;
    },
  };
}

/** Drizzle sur une connexion de test (même API synchrone que sur expo-sqlite). */
export function nodeDrizzle(connection: NodeConnection): LocalDatabase {
  return drizzle(connection.raw, { schema: localSchema });
}

export const nodeRandomBytesSource: RandomBytes = (length) =>
  new Uint8Array(nodeRandomBytes(length));

/** Trousseau en mémoire ; `failOn` simule une coupure (app tuée) avant une écriture donnée. */
export class MemoryKeyStore implements KeyStore {
  readonly entries = new Map<string, string>();
  failOn: ((operation: 'set' | 'delete', name: string) => boolean) | undefined;

  get(name: string): Promise<string | null> {
    return Promise.resolve(this.entries.get(name) ?? null);
  }

  set(name: string, value: string): Promise<void> {
    if (this.failOn?.('set', name) === true) return Promise.reject(new Error('interrupted'));
    this.entries.set(name, value);
    return Promise.resolve();
  }

  delete(name: string): Promise<void> {
    if (this.failOn?.('delete', name) === true) return Promise.reject(new Error('interrupted'));
    this.entries.delete(name);
    return Promise.resolve();
  }
}

/** Dossier temporaire propre à un test, effacé par `cleanup`. */
export function temporaryDirectory(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'lignee-sync-'));
  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Base de test ouverte par le même code que sur le téléphone (`openLocalDatabase`). */
export async function openTestDatabase(path: string, keyStore = new MemoryKeyStore()) {
  const file = nodeDatabaseFile(path);
  const opened = await openLocalDatabase({ file, keyStore, randomBytes: nodeRandomBytesSource });
  const connection = opened.connection as NodeConnection;
  return { file, keyStore, opened, connection, db: nodeDrizzle(connection) };
}
