// Environnement local (T-003). Deux familles de tests, sans Docker :
// - les contrôles de check-local-env.ts, joués contre un faux environnement : ils doivent
//   échouer dès qu'une exigence du TRD n'est pas tenue, et ne jamais rendre un faux vert quand
//   la base ou MinIO ne répondent pas ;
// - la cohérence des fichiers versionnés : extensions créées par le script d'initialisation,
//   ports ouverts sur 127.0.0.1 seulement, images épinglées par empreinte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import {
  checkMinio,
  checkPostgres,
  refusalBlock,
  REQUIRED_EXTENSIONS,
  type CommandResult,
  type DbUser,
  type Probe,
} from './local-env.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

const ok = (stdout = ''): CommandResult => ({ status: 0, stdout, stderr: '' });
const sqlError = (stderr: string): CommandResult => ({ status: 3, stdout: '', stderr });

type SqlHandler = (user: DbUser, sql: string) => CommandResult | undefined;

/** Réponses d'un environnement conforme. */
const compliantSql: SqlHandler = (user, sql) => {
  if (sql.includes('FROM pg_extension')) return ok('fuzzystrmatch,pg_trgm,unaccent\n');
  if (sql.includes('similarity(')) return ok('t\n');
  if (sql.includes("rolname = 'lignee_app'")) return ok('f\n');
  if (sql.includes("rolname = 'lignee_migration'")) return ok('f\n');
  if (sql.includes('pg_get_userbyid')) return ok('lignee_migration,lignee_migration\n');
  if (sql.startsWith('DO $lignee_probe$')) return ok(); // refusé faute de droits
  if (sql.startsWith('INSERT INTO') && user === 'lignee_app') return ok('sonde\n');
  if (/^(CREATE|DROP) TABLE ci_probe_local_env/.test(sql) && user === 'lignee_migration') {
    return ok();
  }
  return undefined;
};

interface FakeOptions {
  /** Prioritaire sur l'environnement conforme quand il rend une réponse. */
  readonly sql?: SqlHandler;
  readonly mc?: (args: readonly string[]) => CommandResult | undefined;
  readonly httpStatus?: number;
}

function fakeProbe(options: FakeOptions = {}): Probe & { calls: string[] } {
  const calls: string[] = [];
  const objects = new Map<string, string>();
  return {
    calls,
    sql(user, sql) {
      calls.push(`${user}: ${sql}`);
      const result = options.sql?.(user, sql) ?? compliantSql(user, sql);
      return Promise.resolve(result ?? sqlError(`requête inattendue : ${sql}`));
    },
    mcAsApp(args, input = '') {
      calls.push(`mc ${args.join(' ')}`);
      const overridden = options.mc?.(args);
      if (overridden) return Promise.resolve(overridden);
      const [command, target = ''] = args;
      switch (command) {
        case 'pipe':
          objects.set(target, input);
          return Promise.resolve(ok());
        case 'cat':
          return Promise.resolve(
            objects.has(target) ? ok(objects.get(target)) : sqlError('Object does not exist'),
          );
        case 'rm':
          objects.delete(target);
          return Promise.resolve(ok(`Removed \`${target}\`.`));
        case 'mb':
          return Promise.resolve({ status: 1, stdout: '', stderr: 'Access Denied.' });
        default:
          return Promise.resolve(sqlError(`commande inattendue : ${args.join(' ')}`));
      }
    },
    anonymousHttpStatus() {
      return Promise.resolve(options.httpStatus ?? 403);
    },
  };
}

const failed = (outcomes: readonly { description: string; ok: boolean }[]): string[] =>
  outcomes.filter(({ ok: passed }) => !passed).map(({ description }) => description);

describe('checkPostgres', () => {
  it('passe sur un environnement conforme et contrôle chaque exigence', async () => {
    const outcomes = await checkPostgres(fakeProbe());
    expect(failed(outcomes)).toEqual([]);
    expect(outcomes.map(({ description }) => description)).toEqual([
      'extensions pg_trgm, unaccent et fuzzystrmatch installées',
      'extensions utilisables par lignee_app',
      'lignee_app sans attribut privilégié',
      'lignee_migration ni superutilisateur ni administrateur des rôles',
      'base lignee et schéma public à lignee_migration',
      'lignee_app ne crée pas de table',
      'lignee_app ne crée pas de table temporaire',
      'lignee_app ne crée pas de schéma',
      'lignee_migration crée une table',
      'lignee_app écrit et lit une ligne de cette table',
      'lignee_app ne modifie pas la structure de cette table',
      'lignee_app ne supprime pas cette table',
      'lignee_migration supprime la table de contrôle',
    ]);
  });

  it.each(REQUIRED_EXTENSIONS)('échoue si l’extension %s manque', async (missing) => {
    const present = REQUIRED_EXTENSIONS.filter((name) => name !== missing).join(',');
    const probe = fakeProbe({
      sql: (_user, sql) => (sql.includes('FROM pg_extension') ? ok(`${present}\n`) : undefined),
    });
    expect(failed(await checkPostgres(probe))).toEqual([
      'extensions pg_trgm, unaccent et fuzzystrmatch installées',
    ]);
  });

  it.each([
    ['CREATE TABLE ci_probe_app', 'lignee_app ne crée pas de table'],
    ['CREATE TEMPORARY TABLE', 'lignee_app ne crée pas de table temporaire'],
    ['CREATE SCHEMA', 'lignee_app ne crée pas de schéma'],
    ['ALTER TABLE', 'lignee_app ne modifie pas la structure de cette table'],
    ['DROP TABLE ci_probe_local_env', 'lignee_app ne supprime pas cette table'],
  ])('échoue si lignee_app peut faire « %s »', async (statement, description) => {
    const probe = fakeProbe({
      sql: (user, sql) =>
        user === 'lignee_app' && sql.startsWith('DO') && sql.includes(statement)
          ? sqlError("ERROR:  instruction acceptée alors qu'elle devait être refusée")
          : undefined,
    });
    expect(failed(await checkPostgres(probe))).toEqual([description]);
  });

  it('échoue si lignee_app a un attribut privilégié', async () => {
    const probe = fakeProbe({
      sql: (_user, sql) => (sql.includes("rolname = 'lignee_app'") ? ok('t\n') : undefined),
    });
    expect(failed(await checkPostgres(probe))).toEqual(['lignee_app sans attribut privilégié']);
  });

  it('ne rend aucun faux vert quand lignee_app ne peut pas se connecter', async () => {
    const probe = fakeProbe({
      sql: (user) =>
        user === 'lignee_app'
          ? {
              status: 2,
              stdout: '',
              stderr: 'FATAL:  password authentication failed for user "lignee_app"',
            }
          : undefined,
    });
    const failures = failed(await checkPostgres(probe));
    expect(failures).toContain('lignee_app ne crée pas de table');
    expect(failures).toContain('lignee_app ne crée pas de table temporaire');
    expect(failures).toContain('lignee_app ne crée pas de schéma');
    expect(failures).toContain('extensions utilisables par lignee_app');
  });

  it('supprime la table de contrôle même si une vérification échoue', async () => {
    const probe = fakeProbe({
      sql: (user, sql) =>
        user === 'lignee_app' && sql.startsWith('INSERT')
          ? sqlError('permission denied')
          : undefined,
    });
    const outcomes = await checkPostgres(probe);
    expect(failed(outcomes)).toEqual(['lignee_app écrit et lit une ligne de cette table']);
    expect(probe.calls.at(-1)).toBe('lignee_migration: DROP TABLE ci_probe_local_env');
  });
});

describe('refusalBlock', () => {
  it('ne tolère que le refus faute de droits, et échoue si l’instruction passe', () => {
    const block = refusalBlock('CREATE TABLE t (id int)');
    expect(block).toContain('  CREATE TABLE t (id int);');
    expect(block).toMatch(/RAISE EXCEPTION/);
    expect(block).toMatch(/EXCEPTION WHEN insufficient_privilege THEN\n {2}NULL;/);
    // Aucun autre gestionnaire : une erreur de connexion ou de syntaxe remonte.
    expect(block.match(/EXCEPTION WHEN/g)).toHaveLength(1);
    expect(block).not.toMatch(/WHEN OTHERS/i);
  });
});

describe('checkMinio', () => {
  const bucket = 'lignee-medias-local';

  it('passe sur un environnement conforme et supprime l’objet de contrôle', async () => {
    const probe = fakeProbe();
    const outcomes = await checkMinio(probe, bucket);
    expect(failed(outcomes)).toEqual([]);
    expect(outcomes).toHaveLength(6);
    expect(probe.calls.at(-1)).toBe(`mc rm app/${bucket}/ci-probe-local-env.txt`);
  });

  it('échoue si le compartiment est lisible sans clé', async () => {
    const failures = failed(await checkMinio(fakeProbe({ httpStatus: 200 }), bucket));
    expect(failures).toEqual([
      `aucun accès anonyme à /${bucket}/`,
      `aucun accès anonyme à /${bucket}/ci-probe-local-env.txt`,
    ]);
  });

  it('échoue si le compartiment n’existe pas (404 au lieu de 403)', async () => {
    const failures = failed(await checkMinio(fakeProbe({ httpStatus: 404 }), bucket));
    expect(failures).toHaveLength(2);
  });

  it('échoue si la clé de l’application peut créer un compartiment', async () => {
    const probe = fakeProbe({ mc: ([command]) => (command === 'mb' ? ok() : undefined) });
    expect(failed(await checkMinio(probe, bucket))).toEqual([
      "la clé de l'application ne crée pas de compartiment",
    ]);
  });

  it('échoue, sans aller plus loin, si la clé de l’application ne peut pas écrire', async () => {
    const probe = fakeProbe({
      mc: ([command]) =>
        command === 'pipe' ? { status: 1, stdout: '', stderr: 'Access Denied.' } : undefined,
    });
    const outcomes = await checkMinio(probe, bucket);
    expect(failed(outcomes)).toEqual([`la clé de l'application écrit dans ${bucket}`]);
    expect(outcomes).toHaveLength(1);
  });
});

describe('fichiers de l’environnement local', () => {
  interface ComposeService {
    image?: string;
    ports?: string[];
    build?: { dockerfile: string };
  }
  // `merge` : compose.yaml partage l'image de MinIO par une clé de fusion (`<<:`).
  const compose = parse(read('compose.yaml'), { merge: true }) as {
    services: Record<string, ComposeService>;
  };
  const services = Object.entries(compose.services);

  it('le script d’initialisation crée exactement les extensions du TRD', () => {
    const script = read('packages/db/initdb/01-roles-et-extensions.sh');
    const created = [...script.matchAll(/CREATE EXTENSION IF NOT EXISTS (\w+);/g)].map(
      (match) => match[1],
    );
    expect(created.sort()).toEqual([...REQUIRED_EXTENSIONS]);
  });

  it('n’ouvre aucun port au-delà du poste (127.0.0.1)', () => {
    const ports = services.flatMap(([, service]) => service.ports ?? []);
    expect(ports.length).toBeGreaterThan(0);
    for (const port of ports) {
      expect(port).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it('épingle chaque image téléchargée par version et par empreinte', () => {
    const images = services
      .filter(([, service]) => service.build === undefined)
      .map(([, service]) => service.image ?? '');
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
    }
    for (const [, service] of services.filter(([, s]) => s.build !== undefined)) {
      const dockerfile = read(service.build?.dockerfile ?? '');
      const bases = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((match) => match[1]);
      expect(bases.length).toBeGreaterThan(0);
      for (const base of bases) {
        expect(base).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
      }
    }
  });

  it('ne versionne que des valeurs factices et locales dans .env.example', () => {
    const example = read('.env.example');
    const secrets = [...example.matchAll(/^(\w*(?:PASSWORD|SECRET)\w*)=(.*)$/gm)];
    expect(secrets.length).toBeGreaterThan(0);
    for (const [, , value] of secrets) {
      expect(value).toMatch(/^local-only-/);
    }
  });
});
