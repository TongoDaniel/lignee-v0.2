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

/** Une migration laisserait des lignes qui citent un objet absent (clé étrangère rompue). */
export class LocalMigrationForeignKeyError extends Error {
  constructor(readonly tag: string) {
    super(`Migration ${tag} breaks a foreign key`);
    this.name = 'LocalMigrationForeignKeyError';
  }
}

function foreignKeysEnabled(connection: SqlConnection): boolean {
  return connection.get('PRAGMA foreign_keys')?.['foreign_keys'] === 1;
}

/**
 * Applique, dans l'ordre et chacune dans sa transaction, les migrations plus récentes que la
 * base. Renvoie les versions appliquées. Une base plus récente que le code est refusée (une
 * ancienne app ne doit pas écrire dans un schéma qu'elle ne connaît pas).
 *
 * Clés étrangères : drizzle-kit change une table SQLite en la recréant (copie, `DROP TABLE`,
 * renommage). Avec les clés étrangères actives, `DROP TABLE trees` effacerait en cascade tout
 * l'arbre ; et `PRAGMA foreign_keys` est sans effet dans une transaction. Elles sont donc
 * coupées avant la transaction, vérifiées dans la transaction (`PRAGMA foreign_key_check` : la
 * migration est annulée si une ligne cite un objet absent), puis rétablies telles qu'elles
 * étaient, même en cas d'échec (procédure de la documentation de SQLite, « ALTER TABLE »).
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
  const pending = migrations.slice(current);
  if (pending.length === 0) return [];

  const restoreForeignKeys = foreignKeysEnabled(connection);
  connection.exec('PRAGMA foreign_keys = OFF');
  const applied: number[] = [];
  try {
    for (const migration of pending) {
      connection.exec('BEGIN IMMEDIATE');
      try {
        for (const statement of statements(migration.sql)) connection.exec(statement);
        if (connection.get('PRAGMA foreign_key_check') !== undefined) {
          throw new LocalMigrationForeignKeyError(migration.tag);
        }
        connection.exec(`PRAGMA user_version = ${String(migration.version)}`);
        connection.exec('COMMIT');
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
      applied.push(migration.version);
    }
  } finally {
    if (restoreForeignKeys) connection.exec('PRAGMA foreign_keys = ON');
  }
  return applied;
}
