// Migrations de la base du téléphone : drizzle-kit écrit le SQL dans src/local-db/migrations
// (un fichier par version, et meta/_journal.json). Le téléphone ne lit pas de fichiers : ce
// module en fait un module TypeScript (src/local-db/generated/migrations.ts), embarqué par Metro
// comme le reste du code. `local-db/schema.test.ts` vérifie que le module suit le SQL.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface JournalEntry {
  readonly idx: number;
  readonly tag: string;
}

/** Dossier écrit par drizzle-kit (`out` de drizzle.config.ts). */
export const migrationsDir = join(import.meta.dirname, '..', 'local-db', 'migrations');
/** Module produit pour le téléphone. */
export const generatedMigrationsFile = join(
  import.meta.dirname,
  '..',
  'local-db',
  'generated',
  'migrations.ts',
);

function readJournal(dir: string): JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8')) as {
    entries?: unknown;
  };
  if (!Array.isArray(journal.entries)) throw new Error('Journal drizzle-kit sans entrées');
  return journal.entries.map((entry: unknown, position) => {
    const { idx, tag } = entry as Partial<JournalEntry>;
    if (idx !== position || typeof tag !== 'string' || !/^\d{4}_[a-z0-9_]+$/.test(tag)) {
      throw new Error(`Entrée ${String(position)} du journal drizzle-kit inattendue`);
    }
    return { idx, tag };
  });
}

/** Texte du module TypeScript des migrations : version n = entrée n - 1 du journal. */
export function renderMigrationBundle(dir: string = migrationsDir): string {
  const entries = readJournal(dir).map((entry) => {
    const sql = readFileSync(join(dir, `${entry.tag}.sql`), 'utf8').replace(/\r\n/g, '\n');
    return [
      '  {',
      `    version: ${String(entry.idx + 1)},`,
      `    tag: ${JSON.stringify(entry.tag)},`,
      `    sql: ${JSON.stringify(sql)},`,
      '  },',
    ].join('\n');
  });
  return [
    '// Fichier produit par `corepack pnpm --filter @lignee/sync db:generate` à partir de',
    '// src/local-db/migrations (drizzle-kit) : ne pas le modifier à la main.',
    "import type { LocalMigration } from '../migrate';",
    '',
    'export const localMigrations: readonly LocalMigration[] = [',
    ...entries,
    '];',
    '',
  ].join('\n');
}
