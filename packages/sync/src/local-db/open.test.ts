// Ouverture, rotation et effacement de la base chiffrée (CL-SEC-14), sur le format SQLCipher 4.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { generatedSnapshot } from '../test-support/generated-snapshot';
import {
  MemoryKeyStore,
  nodeDatabaseFile,
  nodeDrizzle,
  nodeRandomBytesSource,
  openTestDatabase,
  temporaryDirectory,
  type NodeConnection,
} from '../test-support/node-database';
import { DATABASE_KEY_ENTRY, NEXT_DATABASE_KEY_ENTRY } from './key';
import { LOCAL_SCHEMA_VERSION } from './migrate';
import { destroyLocalDatabase, openLocalDatabase, rotateDatabaseKey } from './open';
import { readTreeSnapshot, replaceTreeSnapshot } from './snapshot';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;
const nextPath = () => join(tmp.dir, `open-${String(++counter)}.db`);

const { snapshot } = generatedSnapshot(16, 60);

async function seeded() {
  const path = nextPath();
  const opened = await openTestDatabase(path);
  replaceTreeSnapshot(opened.db, snapshot, { now: 1 });
  return { path, ...opened };
}

async function reopen(path: string, keyStore: MemoryKeyStore) {
  return openLocalDatabase({
    file: nodeDatabaseFile(path),
    keyStore,
    randomBytes: nodeRandomBytesSource,
  });
}

function treeOf(connection: NodeConnection) {
  return readTreeSnapshot(nodeDrizzle(connection), snapshot.tree.id);
}

describe('ouverture de la base locale', () => {
  it('au premier lancement : clé créée dans le trousseau avant le fichier, base migrée', async () => {
    const path = nextPath();
    const { opened, keyStore, connection } = await openTestDatabase(path);
    expect(opened.outcome).toBe('created');
    expect(opened.migrated).toHaveLength(LOCAL_SCHEMA_VERSION);
    expect(keyStore.entries.get(DATABASE_KEY_ENTRY)).toMatch(/^[0-9a-f]{64}$/);
    expect(keyStore.entries.has(NEXT_DATABASE_KEY_ENTRY)).toBe(false);
    expect(connection.get('PRAGMA journal_mode')).toEqual({ journal_mode: 'wal' });
    expect(connection.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    connection.close();
    expect(existsSync(path)).toBe(true);
  });

  it('rouvre la base avec la clé du trousseau, données intactes', async () => {
    const { path, keyStore, connection } = await seeded();
    connection.close();
    const again = await reopen(path, keyStore);
    expect(again.outcome).toBe('opened');
    expect(again.migrated).toEqual([]);
    expect(treeOf(again.connection as NodeConnection)).toEqual(snapshot);
    again.connection.close();
  });

  it('sans clé dans le trousseau, un fichier existant est effacé et la base recréée vide', async () => {
    const { path, keyStore, connection } = await seeded();
    connection.close();
    keyStore.entries.clear();
    const again = await reopen(path, keyStore);
    expect(again.outcome).toBe('reset_key_missing');
    expect(treeOf(again.connection as NodeConnection)).toBeUndefined();
    again.connection.close();
  });

  it('avec une clé qui ne déchiffre pas le fichier : remise à zéro, nouvelle clé', async () => {
    const { path, keyStore, connection } = await seeded();
    connection.close();
    const old = keyStore.entries.get(DATABASE_KEY_ENTRY);
    keyStore.entries.set(DATABASE_KEY_ENTRY, 'cd'.repeat(32));
    const again = await reopen(path, keyStore);
    expect(again.outcome).toBe('reset_unreadable');
    expect(keyStore.entries.get(DATABASE_KEY_ENTRY)).not.toBe(old);
    expect(treeOf(again.connection as NodeConnection)).toBeUndefined();
    again.connection.close();
  });
});

describe('rotation de la clé', () => {
  it('rechiffre la base : l’ancienne clé ne l’ouvre plus, la nouvelle donne le même arbre', async () => {
    const { path, keyStore, connection } = await seeded();
    const old = keyStore.entries.get(DATABASE_KEY_ENTRY);
    await rotateDatabaseKey(connection, keyStore, nodeRandomBytesSource);
    const next = keyStore.entries.get(DATABASE_KEY_ENTRY);
    expect(next).not.toBe(old);
    expect(keyStore.entries.has(NEXT_DATABASE_KEY_ENTRY)).toBe(false);
    expect(treeOf(connection)).toEqual(snapshot);
    connection.close();

    const withOld = new MemoryKeyStore();
    withOld.entries.set(DATABASE_KEY_ENTRY, old ?? '');
    const reader = nodeDatabaseFile(path).open();
    reader.exec(`PRAGMA key = "x'${old ?? ''}'"`);
    expect(() => reader.get('SELECT count(*) FROM sqlite_master')).toThrow(/not a database/);
    reader.close();

    const again = await reopen(path, keyStore);
    expect(again.outcome).toBe('opened');
    expect(treeOf(again.connection as NodeConnection)).toEqual(snapshot);
    again.connection.close();
  });

  it('interrompue avant le rechiffrement : la clé en service ouvre toujours, la suivante est oubliée', async () => {
    const { path, keyStore, connection } = await seeded();
    const old = keyStore.entries.get(DATABASE_KEY_ENTRY);
    // La clé suivante est écrite, puis l'app meurt avant le PRAGMA rekey.
    keyStore.entries.set(NEXT_DATABASE_KEY_ENTRY, 'ef'.repeat(32));
    connection.close();
    const again = await reopen(path, keyStore);
    expect(again.outcome).toBe('opened');
    expect(keyStore.entries.get(DATABASE_KEY_ENTRY)).toBe(old);
    expect(keyStore.entries.has(NEXT_DATABASE_KEY_ENTRY)).toBe(false);
    expect(treeOf(again.connection as NodeConnection)).toEqual(snapshot);
    again.connection.close();
  });

  it('interrompue après le rechiffrement : l’ouverture suivante termine la rotation', async () => {
    const { path, keyStore, connection } = await seeded();
    keyStore.failOn = (operation, name) => operation === 'set' && name === DATABASE_KEY_ENTRY;
    await expect(rotateDatabaseKey(connection, keyStore, nodeRandomBytesSource)).rejects.toThrow(
      'interrupted',
    );
    keyStore.failOn = undefined;
    connection.close();
    const pending = keyStore.entries.get(NEXT_DATABASE_KEY_ENTRY);
    expect(pending).toMatch(/^[0-9a-f]{64}$/);

    const again = await reopen(path, keyStore);
    expect(again.outcome).toBe('rotation_completed');
    expect(keyStore.entries.get(DATABASE_KEY_ENTRY)).toBe(pending);
    expect(keyStore.entries.has(NEXT_DATABASE_KEY_ENTRY)).toBe(false);
    expect(treeOf(again.connection as NodeConnection)).toEqual(snapshot);
    again.connection.close();
  });
});

describe('effacement de la base', () => {
  it('ferme la connexion, efface le fichier, son journal et les deux clés', async () => {
    const { path, keyStore, connection, file } = await seeded();
    keyStore.entries.set(NEXT_DATABASE_KEY_ENTRY, 'ef'.repeat(32));
    await destroyLocalDatabase(file, keyStore, connection);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(keyStore.entries.size).toBe(0);
  });
});
