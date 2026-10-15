// Vérifie l'environnement local démarré par `docker compose up -d`
// (docs/runbooks/environnement-local.md) : `corepack pnpm check:local-env`.
// Codes de sortie : 0 tout est conforme ; 1 un contrôle échoue ; 2 environnement non prêt
// (pas de fichier .env, Docker absent ou arrêté, conteneurs non démarrés).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

import {
  checkMinio,
  checkPostgres,
  type CheckOutcome,
  type CommandResult,
  type DbUser,
  type Probe,
} from './local-env.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const inGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';

/** L'environnement n'est pas prêt : rien n'a pu être contrôlé. */
class NotReadyError extends Error {}

/** `docker compose …` depuis la racine du dépôt ; les secrets passent par l'environnement. */
function compose(
  args: readonly string[],
  input = '',
  extraEnv: Record<string, string> = {},
): CommandResult {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    input,
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    throw new NotReadyError(`Impossible de lancer docker compose : ${result.error.message}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function readEnvFile(): NodeJS.Dict<string> {
  try {
    return parseEnv(readFileSync(join(repoRoot, '.env'), 'utf8'));
  } catch {
    throw new NotReadyError(
      'Fichier .env introuvable à la racine du dépôt : copiez .env.example en .env.',
    );
  }
}

function assertServicesRunning(): void {
  const result = compose(['ps', '--status', 'running', '--services']);
  if (result.status !== 0) {
    throw new NotReadyError(`Docker ne répond pas : ${result.stderr.trim()}`);
  }
  const running = new Set(result.stdout.split(/\r?\n/));
  const missing = ['postgres', 'minio'].filter((service) => !running.has(service));
  if (missing.length > 0) {
    throw new NotReadyError(
      `Service(s) arrêté(s) : ${missing.join(', ')}. Démarrez l'environnement : docker compose up -d`,
    );
  }
}

const psqlOptions = [
  'psql',
  '--no-psqlrc',
  '--quiet',
  '--tuples-only',
  '--no-align',
  '--set=ON_ERROR_STOP=1',
  '--dbname=lignee',
];

function createProbe(env: NodeJS.Dict<string>): { probe: Probe; bucket: string } {
  const required = (name: string): string => {
    const value = env[name];
    if (value === undefined || value === '') {
      throw new NotReadyError(`${name} manque dans .env : reprenez la ligne de .env.example.`);
    }
    return value;
  };
  const passwords: Record<Exclude<DbUser, 'postgres'>, string> = {
    lignee_app: required('LIGNEE_DB_APP_PASSWORD'),
    lignee_migration: required('LIGNEE_DB_MIGRATION_PASSWORD'),
  };
  const minioPort = env['LIGNEE_MINIO_PORT'] ?? '9000';
  // Vu depuis le conteneur de MinIO : son propre port, pas celui publié sur le poste.
  const appS3Host =
    `http://${encodeURIComponent(required('LIGNEE_S3_ACCESS_KEY_ID'))}:` +
    `${encodeURIComponent(required('LIGNEE_S3_SECRET_ACCESS_KEY'))}@127.0.0.1:9000`;

  const probe: Probe = {
    sql(user, sql) {
      if (user === 'postgres') {
        return Promise.resolve(
          compose(['exec', '-T', 'postgres', ...psqlOptions, '--username=postgres'], sql),
        );
      }
      return Promise.resolve(
        compose(
          [
            'exec',
            '-T',
            '-e',
            'PGPASSWORD',
            'postgres',
            ...psqlOptions,
            '--host=127.0.0.1',
            `--username=${user}`,
          ],
          sql,
          { PGPASSWORD: passwords[user] },
        ),
      );
    },
    mcAsApp(args, input = '') {
      return Promise.resolve(
        compose(['exec', '-T', '-e', 'MC_HOST_app', 'minio', 'mc', '--quiet', ...args], input, {
          MC_HOST_app: appS3Host,
        }),
      );
    },
    async anonymousHttpStatus(path) {
      try {
        const response = await fetch(`http://127.0.0.1:${minioPort}${path}`);
        await response.body?.cancel();
        return response.status;
      } catch {
        return 0; // MinIO injoignable depuis le poste : le contrôle échoue.
      }
    },
  };
  return { probe, bucket: required('LIGNEE_S3_BUCKET') };
}

function report(section: string, outcomes: readonly CheckOutcome[]): boolean {
  console.log(section);
  for (const { description, ok, detail } of outcomes) {
    if (ok) {
      console.log(`  ok - ${description}`);
    } else {
      console.log(`  échec - ${description} (${detail ?? 'sans détail'})`);
      if (inGitHubActions) {
        console.log(`::error title=Environnement local::${description} : ${detail ?? ''}`);
      }
    }
  }
  return outcomes.every(({ ok }) => ok);
}

async function main(): Promise<number> {
  try {
    const { probe, bucket } = createProbe(readEnvFile());
    assertServicesRunning();
    const postgresOk = report('PostgreSQL', await checkPostgres(probe));
    const minioOk = report('MinIO', await checkMinio(probe, bucket));
    return postgresOk && minioOk ? 0 : 1;
  } catch (error) {
    if (error instanceof NotReadyError) {
      console.log(`Environnement local non prêt. ${error.message}`);
      if (inGitHubActions) {
        console.log(`::error title=Environnement local non prêt::${error.message}`);
      }
      return 2;
    }
    throw error;
  }
}

// `exitCode` plutôt que `process.exit()` : laisse Node vider les sorties avant de quitter.
process.exitCode = await main();
