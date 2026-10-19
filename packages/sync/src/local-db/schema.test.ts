// Le schéma Drizzle, le SQL de drizzle-kit et le module embarqué disent la même chose ; et aucune
// valeur saisie n'est dans une colonne ni dans un index (ADR 0023).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api';
import { afterAll, describe, expect, it } from 'vitest';

import {
  generatedMigrationsFile,
  migrationsDir,
  renderMigrationBundle,
} from '../tooling/migration-bundle';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import * as schema from './schema';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});

describe('migrations et schéma Drizzle', () => {
  it('le dernier instantané de drizzle-kit correspond au schéma : aucune migration oubliée', async () => {
    const snapshots = readdirSync(join(migrationsDir, 'meta'))
      .filter((name) => name.endsWith('_snapshot.json'))
      .sort();
    const last = snapshots.at(-1);
    if (last === undefined) throw new Error('No drizzle-kit snapshot');
    // Les types de drizzle-kit/api s'appuient sur sa propre copie de Zod, que TypeScript ne
    // résout pas ici : l'instantané est manipulé comme un objet JSON.
    const previous = JSON.parse(readFileSync(join(migrationsDir, 'meta', last), 'utf8')) as {
      id: string;
    };
    const current: unknown = await generateSQLiteDrizzleJson({ ...schema }, previous.id);
    expect(await generateSQLiteMigration(previous as never, current as never)).toEqual([]);
  });

  it('le module embarqué par le téléphone reprend le SQL de drizzle-kit', () => {
    expect(readFileSync(generatedMigrationsFile, 'utf8').replace(/\r\n/g, '\n')).toBe(
      renderMigrationBundle(),
    );
  });
});

describe('colonnes et index de la base migrée', () => {
  it('hors du corps JSON, seulement des identifiants (aucune valeur saisie en colonne)', async () => {
    const { connection } = await openTestDatabase(join(tmp.dir, 'columns.db'));
    const tables = (
      connection.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[]
    ).map((row) => row.name);
    for (const table of tables) {
      const columns = (connection.raw.pragma(`table_info(${table})`) as { name: string }[]).map(
        (column) => column.name,
      );
      expect(columns).toContain('body');
      for (const column of columns) {
        const allowed =
          column === 'id' ||
          column === 'body' ||
          column.endsWith('_id') ||
          (table === 'trees' && column === 'loaded_at');
        expect(allowed, `${table}.${column}`).toBe(true);
      }
    }
    connection.close();
  });

  it('aucun index ne porte sur le corps : la cause de décès n’est jamais indexée', async () => {
    const { connection } = await openTestDatabase(join(tmp.dir, 'indexes.db'));
    const indexes = connection.raw
      .prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'")
      .all() as { name: string; tbl_name: string }[];
    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) {
      const columns = (
        connection.raw.pragma(`index_info(${index.name})`) as { name: string }[]
      ).map((column) => column.name);
      for (const column of columns) {
        expect(column === 'id' || column.endsWith('_id'), `${index.name}.${column}`).toBe(true);
      }
    }
    const factColumns = (connection.raw.pragma('table_info(facts)') as { name: string }[]).map(
      (column) => column.name,
    );
    expect(factColumns).not.toContain('value');
    expect(factColumns).not.toContain('type');
    connection.close();
  });
});
