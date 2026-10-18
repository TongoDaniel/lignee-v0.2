// Migrations versionnées de la base du téléphone (TRD : « migrations Drizzle versionnées »).
// Le SQL est écrit par drizzle-kit à partir de schema.ts ; la version appliquée est gardée dans
// l'en-tête du fichier (`PRAGMA user_version`), modifiée dans la même transaction que la
// migration : une migration interrompue (app tuée, batterie vide) n'est jamais à moitié appliquée.
import type { SqlConnection } from './connection';
import { localMigrations } from './generated/migrations';

export interface LocalMigration {
  /** 1, 2, 3… sans trou : la version de la base après cette migration. */
  readonly version: number;
  /** Nom du fichier drizzle-kit (`0000_initial`). */
  readonly tag: string;
  readonly sql: string;
}

/** Version de la base la plus récente connue de ce code. */
export const LOCAL_SCHEMA_VERSION = localMigrations.length;

/** La base vient d'une version plus récente de l'app : ce code ne sait pas la lire. */
export class LocalDatabaseTooNewError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(`Local database version ${String(found)} is newer than ${String(supported)}`);
    this.name = 'LocalDatabaseTooNewError';
  }
}

export function readSchemaVersion(connection: SqlConnection): number {
  const row = connection.get('PRAGMA user_version');
  const version = row?.['user_version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new Error('Unreadable local database version');
  }
  return version;
}

function statements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

/**
 * Applique, dans l'ordre et chacune dans sa transaction, les migrations plus récentes que la
 * base. Renvoie les versions appliquées. Une base plus récente que le code est refusée (une
 * ancienne app ne doit pas écrire dans un schéma qu'elle ne connaît pas).
 */
export function migrateLocalDatabase(
  connection: SqlConnection,
  migrations: readonly LocalMigration[] = localMigrations,
): number[] {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`Migration ${migration.tag} has version ${String(migration.version)}`);
    }
  });
  const current = readSchemaVersion(connection);
  if (current > migrations.length) {
    throw new LocalDatabaseTooNewError(current, migrations.length);
  }
  const applied: number[] = [];
  for (const migration of migrations.slice(current)) {
    connection.exec('BEGIN IMMEDIATE');
    try {
      for (const statement of statements(migration.sql)) connection.exec(statement);
      connection.exec(`PRAGMA user_version = ${String(migration.version)}`);
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
    applied.push(migration.version);
  }
  return applied;
}
