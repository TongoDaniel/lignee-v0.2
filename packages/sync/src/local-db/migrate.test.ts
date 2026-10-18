import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { nodeDatabaseFile, temporaryDirectory } from '../test-support/node-database';
import {
  LOCAL_SCHEMA_VERSION,
  LocalDatabaseTooNewError,
  migrateLocalDatabase,
  readSchemaVersion,
  type LocalMigration,
} from './migrate';

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
