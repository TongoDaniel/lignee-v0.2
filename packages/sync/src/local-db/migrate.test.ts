import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { generatedSnapshot } from '../test-support/generated-snapshot';
import {
  nodeDatabaseFile,
  nodeDrizzle,
  openTestDatabase,
  temporaryDirectory,
  type NodeConnection,
} from '../test-support/node-database';
import { localMigrations } from './generated/migrations';
import {
  LOCAL_SCHEMA_VERSION,
  LocalDatabaseTooNewError,
  migrateLocalDatabase,
  readSchemaVersion,
  type LocalMigration,
} from './migrate';
import { readTreeSnapshot, replaceTreeSnapshot } from './snapshot';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function freshConnection() {
  const tmp = temporaryDirectory();
  cleanup = tmp.cleanup;
  const connection = nodeDatabaseFile(join(tmp.dir, 'local.db')).open();
  connection.exec(`PRAGMA key = "x'${'1f'.repeat(32)}'"`);
  return connection;
}

function tableNames(connection: ReturnType<typeof freshConnection>): string[] {
  return (
    connection.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
  ).map((row) => row.name);
}

describe('migrations de la base locale', () => {
  it('amènent une base vide à la dernière version, une seule fois', () => {
    const connection = freshConnection();
    expect(readSchemaVersion(connection)).toBe(0);
    expect(migrateLocalDatabase(connection)).toEqual(
      Array.from({ length: LOCAL_SCHEMA_VERSION }, (_, index) => index + 1),
    );
    expect(readSchemaVersion(connection)).toBe(LOCAL_SCHEMA_VERSION);
    expect(tableNames(connection)).toEqual([
      'facts',
      'filiations',
      'multiple_births',
      'mutation_queue',
      'names',
      'parent_candidates',
      'people',
      'places',
      'simultaneity_answers',
      'title_roles',
      'to_place',
      'trees',
      'unions',
    ]);
    expect(migrateLocalDatabase(connection)).toEqual([]);
    connection.close();
  });

  it('appliquent seulement les versions manquantes, dans l’ordre', () => {
    const connection = freshConnection();
    const migrations: LocalMigration[] = [
      { version: 1, tag: '0000_a', sql: 'CREATE TABLE a (id text)' },
      {
        version: 2,
        tag: '0001_b',
        sql: 'CREATE TABLE b (id text);--> statement-breakpoint\nCREATE INDEX b_idx ON b (id);',
      },
    ];
    expect(migrateLocalDatabase(connection, migrations.slice(0, 1))).toEqual([1]);
    expect(migrateLocalDatabase(connection, migrations)).toEqual([2]);
    expect(tableNames(connection)).toEqual(['a', 'b']);
    connection.close();
  });

  it('n’appliquent jamais une migration à moitié : la version et les tables reviennent en arrière', () => {
    const connection = freshConnection();
    const broken: LocalMigration[] = [
      {
        version: 1,
        tag: '0000_broken',
        sql: 'CREATE TABLE a (id text);--> statement-breakpoint\nCREATE TABLE a (id text);',
      },
    ];
    expect(() => migrateLocalDatabase(connection, broken)).toThrow();
    expect(readSchemaVersion(connection)).toBe(0);
    expect(tableNames(connection)).toEqual([]);
    connection.close();
  });

  it('refusent une base écrite par une version plus récente de l’app', () => {
    const connection = freshConnection();
    connection.exec(`PRAGMA user_version = ${String(LOCAL_SCHEMA_VERSION + 1)}`);
    expect(() => migrateLocalDatabase(connection)).toThrow(LocalDatabaseTooNewError);
    connection.close();
  });

  it('refusent une liste de migrations avec un trou de version', () => {
    const connection = freshConnection();
    expect(() =>
      migrateLocalDatabase(connection, [{ version: 2, tag: '0001_x', sql: 'SELECT 1' }]),
    ).toThrow(/version/);
    connection.close();
  });
});

describe('migrations et clés étrangères', () => {
  // Migration écrite comme drizzle-kit le fait pour changer une table SQLite : nouvelle table,
  // copie, DROP TABLE de l'ancienne, renommage. Avec les clés étrangères actives, le DROP TABLE
  // effacerait en cascade toutes les lignes qui citent l'arbre.
  const recreateTrees: LocalMigration = {
    version: LOCAL_SCHEMA_VERSION + 1,
    tag: '9999_recreate_trees',
    sql: [
      'PRAGMA foreign_keys=OFF;',
      'CREATE TABLE `__new_trees` (`id` text PRIMARY KEY NOT NULL, `reader_account_id` text NOT NULL, `loaded_at` integer NOT NULL, `body` text NOT NULL);',
      'INSERT INTO `__new_trees`("id", "reader_account_id", "loaded_at", "body") SELECT "id", "reader_account_id", "loaded_at", "body" FROM `trees`;',
      'DROP TABLE `trees`;',
      'ALTER TABLE `__new_trees` RENAME TO `trees`;',
      'PRAGMA foreign_keys=ON;',
    ].join('--> statement-breakpoint\n'),
  };

  function counts(connection: NodeConnection): Record<string, number> {
    return Object.fromEntries(
      ['trees', 'people', 'names', 'unions', 'filiations', 'facts'].map((table) => [
        table,
        (connection.raw.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n,
      ]),
    );
  }

  it('une migration qui recrée `trees` laisse intactes les lignes qui la citent', async () => {
    const tmp = temporaryDirectory();
    cleanup = tmp.cleanup;
    const { db, connection } = await openTestDatabase(join(tmp.dir, 'fk.db'));
    replaceTreeSnapshot(db, generatedSnapshot(43, 60).snapshot, { now: 1 });
    expect(connection.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    const before = counts(connection);
    expect(before['people']).toBeGreaterThan(0);

    expect(migrateLocalDatabase(connection, [...localMigrations, recreateTrees])).toEqual([
      LOCAL_SCHEMA_VERSION + 1,
    ]);
    expect(counts(connection)).toEqual(before);
    // Les clés étrangères sont rétablies après la migration.
    expect(connection.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    connection.close();
  });

  it('refuse, sans rien garder, une migration qui laisse une ligne orpheline', async () => {
    const tmp = temporaryDirectory();
    cleanup = tmp.cleanup;
    const { db, connection } = await openTestDatabase(join(tmp.dir, 'orphan.db'));
    replaceTreeSnapshot(db, generatedSnapshot(44, 20).snapshot, { now: 1 });
    const before = counts(connection);
    const orphan: LocalMigration = {
      version: LOCAL_SCHEMA_VERSION + 1,
      tag: '9999_orphan',
      sql: 'DELETE FROM `trees`;',
    };
    expect(() => migrateLocalDatabase(connection, [...localMigrations, orphan])).toThrow(
      /foreign key/i,
    );
    expect(readSchemaVersion(connection)).toBe(LOCAL_SCHEMA_VERSION);
    expect(counts(connection)).toEqual(before);
    expect(connection.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    connection.close();
  });
});

describe('migration 2 : file de changements (T-030)', () => {
  it('s’applique à une base remplie en version 1 sans toucher à l’arbre', () => {
    const tmp = temporaryDirectory();
    cleanup = tmp.cleanup;
    const connection = nodeDatabaseFile(join(tmp.dir, 'v1.db')).open();
    connection.exec(`PRAGMA key = "x'${'2e'.repeat(32)}'"`);
    expect(migrateLocalDatabase(connection, localMigrations.slice(0, 1))).toEqual([1]);
    connection.exec('PRAGMA foreign_keys = ON');
    const db = nodeDrizzle(connection);
    const { snapshot } = generatedSnapshot(45, 120);
    replaceTreeSnapshot(db, snapshot, { now: 1 });
    expect(tableNames(connection)).not.toContain('mutation_queue');

    expect(migrateLocalDatabase(connection)).toEqual([2]);
    expect(readSchemaVersion(connection)).toBe(2);
    expect(tableNames(connection)).toContain('mutation_queue');
    expect(readTreeSnapshot(db, snapshot.tree.id)).toEqual(snapshot);
    expect(connection.get('PRAGMA foreign_key_check')).toBeUndefined();
    expect(connection.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    expect(connection.raw.prepare('SELECT count(*) AS n FROM mutation_queue').get()).toEqual({
      n: 0,
    });
    connection.close();
  }, 30_000);
});
