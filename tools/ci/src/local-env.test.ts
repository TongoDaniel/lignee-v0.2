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
  OTHER_BUCKET,
  refusalBlock,
  REQUIRED_EXTENSIONS,
  type CommandResult,
  type DbUser,
  type MinioAlias,
  type Probe,
} from './local-env.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

const ok = (stdout = ''): CommandResult => ({ status: 0, stdout, stderr: '' });
const sqlError = (stderr: string): CommandResult => ({ status: 3, stdout: '', stderr });

const accessDenied: CommandResult = {
  status: 1,
  stdout: '',
  stderr: 'mc: <ERROR> Unable to complete the request. Access Denied.',
};
const networkError: CommandResult = {
  status: 1,
  stdout: '',
  stderr:
    'mc: <ERROR> Unable to complete the request. dial tcp 127.0.0.1:9000: connect: connection refused',
};

type SqlHandler = (user: DbUser, sql: string, database: string) => CommandResult | undefined;

/** Réponses d'un environnement conforme. */
const compliantSql: SqlHandler = (user, sql, database) => {
  if (database !== 'lignee') {
    return user === 'postgres'
      ? ok('1\n')
      : {
          status: 2,
          stdout: '',
          stderr: `FATAL:  permission denied for database "${database}"`,
        };
  }
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
  readonly mc?: (alias: MinioAlias, args: readonly string[]) => CommandResult | undefined;
  readonly httpStatus?: number;
}

const APP_BUCKET = 'lignee-medias-local';

/**
 * Faux MinIO : l'administrateur a tous les droits ; la clé de l'application n'agit que sur les
 * objets de APP_BUCKET, comme la règle `lignee-medias-rw` de compose.yaml.
 */
function fakeMinio(): (alias: MinioAlias, args: readonly string[], input: string) => CommandResult {
  const buckets = new Set([APP_BUCKET]);
  const objects = new Map<string, string>();
  return (alias, args, input) => {
    const command = args[0];
    const target = args.at(-1) ?? '';
    const [, bucket = '', ...rest] = target.split('/');
    const key = rest.join('/');
    const allowed = alias === 'root' || (bucket === APP_BUCKET && command !== 'mb');
    if (!allowed) return accessDenied;
    switch (command) {
      case 'mb':
        buckets.add(bucket);
        return ok();
      case 'rb':
        buckets.delete(bucket);
        return ok();
      case 'pipe':
        if (!buckets.has(bucket)) return sqlError('The specified bucket does not exist');
        objects.set(`${bucket}/${key}`, input);
        return ok();
      case 'cat': {
        const content = objects.get(`${bucket}/${key}`);
        return content === undefined ? sqlError('Object does not exist') : ok(content);
      }
      case 'rm':
        objects.delete(`${bucket}/${key}`);
        return ok(`Removed \`${target}\`.`);
      default:
        return sqlError(`commande inattendue : ${args.join(' ')}`);
    }
  };
}

function fakeProbe(options: FakeOptions = {}): Probe & { calls: string[] } {
  const calls: string[] = [];
  const minio = fakeMinio();
  return {
    calls,
    sql(user, sql, database = 'lignee') {
      calls.push(`${user}@${database}: ${sql}`);
      const result = options.sql?.(user, sql, database) ?? compliantSql(user, sql, database);
      return Promise.resolve(result ?? sqlError(`requête inattendue : ${sql}`));
    },
    mc(alias, args, input = '') {
      calls.push(`mc(${alias}) ${args.join(' ')}`);
      return Promise.resolve(options.mc?.(alias, args) ?? minio(alias, args, input));
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
      'lignee_app ne se connecte pas à la base postgres',
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
    // Une connexion refusée pour une autre raison n'est pas le refus attendu sur `postgres`.
    expect(failures).toContain('lignee_app ne se connecte pas à la base postgres');
  });

  it('échoue si lignee_app peut se connecter à la base postgres', async () => {
    const probe = fakeProbe({
      sql: (_user, _sql, database) => (database === 'postgres' ? ok('1\n') : undefined),
    });
    expect(failed(await checkPostgres(probe))).toEqual([
      'lignee_app ne se connecte pas à la base postgres',
    ]);
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
    expect(probe.calls.at(-1)).toBe('lignee_migration@lignee: DROP TABLE ci_probe_local_env');
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
  const bucket = APP_BUCKET;
  const probeObject = `app/${bucket}/ci-probe-local-env.txt`;

  it('passe sur un environnement conforme et remet tout en état', async () => {
    const probe = fakeProbe();
    const outcomes = await checkMinio(probe, bucket);
    expect(failed(outcomes)).toEqual([]);
    expect(outcomes.map(({ description }) => description)).toEqual([
      `la clé de l'application écrit dans ${bucket}`,
      `la clé de l'application lit dans ${bucket}`,
      `aucun accès anonyme à /${bucket}/`,
      `aucun accès anonyme à /${bucket}/ci-probe-local-env.txt`,
      "la clé de l'application ne crée pas de compartiment",
      "la clé de l'application supprime l'objet de contrôle",
      `l'administrateur prépare le compartiment ${OTHER_BUCKET}`,
      `la clé de l'application ne lit pas dans ${OTHER_BUCKET}`,
      `la clé de l'application n'écrit pas dans ${OTHER_BUCKET}`,
      `l'administrateur supprime le compartiment ${OTHER_BUCKET}`,
    ]);
    expect(probe.calls).toContain(`mc(app) rm ${probeObject}`);
    expect(probe.calls.at(-1)).toBe(`mc(root) rb --force root/${OTHER_BUCKET}`);
  });

  it('échoue si le compartiment est lisible sans clé', async () => {
    const failures = failed(await checkMinio(fakeProbe({ httpStatus: 200 }), bucket));
    expect(failures).toEqual([
      `aucun accès anonyme à /${bucket}/`,
      `aucun accès anonyme à /${bucket}/ci-probe-local-env.txt`,
    ]);
  });

  it('échoue si le compartiment n’existe pas (404 au lieu de 403) ou si MinIO ne répond pas', async () => {
    for (const httpStatus of [404, 0]) {
      expect(failed(await checkMinio(fakeProbe({ httpStatus }), bucket))).toHaveLength(2);
    }
  });

  it('échoue si la clé de l’application peut créer un compartiment', async () => {
    const probe = fakeProbe({
      mc: (alias, [command]) => (alias === 'app' && command === 'mb' ? ok() : undefined),
    });
    expect(failed(await checkMinio(probe, bucket))).toEqual([
      "la clé de l'application ne crée pas de compartiment",
    ]);
  });

  it.each([
    ['cat', `la clé de l'application ne lit pas dans ${OTHER_BUCKET}`],
    ['pipe', `la clé de l'application n'écrit pas dans ${OTHER_BUCKET}`],
  ])(
    'échoue si la clé de l’application peut faire « mc %s » dans un autre compartiment',
    async (allowedCommand, description) => {
      const probe = fakeProbe({
        mc: (alias, args) =>
          alias === 'app' && args[0] === allowedCommand && args.at(-1)?.includes(OTHER_BUCKET)
            ? ok('sonde\n')
            : undefined,
      });
      expect(failed(await checkMinio(probe, bucket))).toEqual([description]);
    },
  );

  it('ne compte pas une erreur réseau ni un objet absent comme un refus', async () => {
    const probe = fakeProbe({
      mc: (alias, args) => {
        if (alias !== 'app') return undefined;
        if (args[0] === 'mb') return networkError;
        if (args[0] === 'cat' && args.at(-1)?.includes(OTHER_BUCKET)) {
          return sqlError('Object does not exist');
        }
        if (args[0] === 'pipe' && args.at(-1)?.includes(OTHER_BUCKET)) return networkError;
        return undefined;
      },
    });
    expect(failed(await checkMinio(probe, bucket))).toEqual([
      "la clé de l'application ne crée pas de compartiment",
      `la clé de l'application ne lit pas dans ${OTHER_BUCKET}`,
      `la clé de l'application n'écrit pas dans ${OTHER_BUCKET}`,
    ]);
  });

  it('échoue, sans aller plus loin, si la clé de l’application ne peut pas écrire', async () => {
    const probe = fakeProbe({
      mc: (alias, [command]) => (alias === 'app' && command === 'pipe' ? accessDenied : undefined),
    });
    const outcomes = await checkMinio(probe, bucket);
    expect(failed(outcomes)).toEqual([`la clé de l'application écrit dans ${bucket}`]);
    expect(outcomes).toHaveLength(1);
  });

  it('supprime le second compartiment même si un contrôle échoue', async () => {
    const probe = fakeProbe({
      mc: (alias, args) =>
        alias === 'app' && args[0] === 'cat' && args.at(-1)?.includes(OTHER_BUCKET)
          ? ok('sonde\n')
          : undefined,
    });
    await checkMinio(probe, bucket);
    expect(probe.calls.at(-1)).toBe(`mc(root) rb --force root/${OTHER_BUCKET}`);
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

  it('construit les images depuis le lockfile, sans `pnpm deploy --legacy`', () => {
    const workspace = parse(read('pnpm-workspace.yaml')) as { injectWorkspacePackages?: boolean };
    expect(workspace.injectWorkspacePackages).toBe(true);
    for (const [, service] of services.filter(([, s]) => s.build !== undefined)) {
      const dockerfile = read(service.build?.dockerfile ?? '');
      expect(dockerfile).toMatch(/deploy --prod --frozen-lockfile/);
      expect(dockerfile).not.toMatch(/--legacy/);
      expect(dockerfile).toMatch(/grep -qi 'legacy deploy'/);
    }
  });

  it('ne copie aucun fichier .env dans le contexte des images', () => {
    const ignored = read('.dockerignore').split(/\r?\n/);
    for (const pattern of ['.env', '.env.*', '**/.env', '**/.env.*', '!**/.env.example']) {
      expect(ignored).toContain(pattern);
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
