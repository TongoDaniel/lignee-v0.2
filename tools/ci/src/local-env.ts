// Vérification de l'environnement local Docker Compose (T-003, docs/runbooks/environnement-local.md).
//
// TRD, « Choix techniques » : PostgreSQL avec pg_trgm, unaccent et fuzzystrmatch.
// TRD, « Authentification et sécurité » : « utilisateur applicatif sans droit de modifier le
// schéma, utilisateur de migration séparé ».
// TRD, « Médias et économie de données » : compartiments privés (MinIO à la place de R2).
//
// Les contrôles parlent aux conteneurs par l'interface `Probe` ; le programme en ligne de
// commande (check-local-env.ts) la branche sur `docker compose exec`, les tests sur un faux.

/** Résultat d'une commande lancée dans un conteneur. */
export interface CommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Utilisateurs de la base locale (packages/db/initdb/01-roles-et-extensions.sh). */
export type DbUser = 'postgres' | 'lignee_app' | 'lignee_migration';

/** Accès aux conteneurs démarrés par compose.yaml. */
export interface Probe {
  /**
   * Joue du SQL dans la base `lignee`, sortie brute (une valeur par ligne, colonnes séparées
   * par `|`), arrêt à la première erreur. `postgres` passe par le socket local ; les deux
   * autres par TCP avec leur mot de passe, comme l'API.
   */
  sql(user: DbUser, sql: string): Promise<CommandResult>;
  /** Commande `mc` avec l'alias `app`, c'est-à-dire la clé S3 de l'application. */
  mcAsApp(args: readonly string[], input?: string): Promise<CommandResult>;
  /** Code HTTP d'une requête GET anonyme sur MinIO (chemin commençant par `/`). */
  anonymousHttpStatus(path: string): Promise<number>;
}

export interface CheckOutcome {
  readonly description: string;
  readonly ok: boolean;
  /** Ce qui a été obtenu quand le contrôle échoue. */
  readonly detail?: string;
}

/** Extensions exigées par le TRD, dans l'ordre alphabétique. */
export const REQUIRED_EXTENSIONS = ['fuzzystrmatch', 'pg_trgm', 'unaccent'] as const;

const PROBE_TABLE = 'ci_probe_local_env';
const PROBE_CONTENT = 'sonde\n';

function describeFailure(result: CommandResult): string {
  const output = (result.stderr.trim() || result.stdout.trim()).split('\n').slice(0, 3).join(' ');
  return `code ${String(result.status)}${output ? ` : ${output}` : ''}`;
}

/** Contrôle qu'une requête réussit et rend exactement `expected`. */
async function expectValue(
  probe: Probe,
  user: DbUser,
  description: string,
  sql: string,
  expected: string,
): Promise<CheckOutcome> {
  const result = await probe.sql(user, sql);
  if (result.status !== 0) {
    return { description, ok: false, detail: describeFailure(result) };
  }
  const actual = result.stdout.trim();
  return actual === expected
    ? { description, ok: true }
    : { description, ok: false, detail: `attendu « ${expected} », obtenu « ${actual} »` };
}

/**
 * Bloc SQL qui réussit seulement si `statement` est refusé faute de droits (SQLSTATE 42501,
 * `insufficient_privilege`). Si l'instruction passe, le bloc lève une erreur ; toute autre
 * erreur (connexion, syntaxe) remonte aussi : pas de faux vert. Rien n'est conservé, le bloc
 * étant annulé dans les deux cas.
 */
export function refusalBlock(statement: string): string {
  return [
    'DO $lignee_probe$',
    'BEGIN',
    `  ${statement};`,
    "  RAISE EXCEPTION 'instruction acceptée alors qu''elle devait être refusée';",
    'EXCEPTION WHEN insufficient_privilege THEN',
    '  NULL;',
    'END',
    '$lignee_probe$;',
  ].join('\n');
}

async function expectRefused(
  probe: Probe,
  user: DbUser,
  description: string,
  statement: string,
): Promise<CheckOutcome> {
  const result = await probe.sql(user, refusalBlock(statement));
  return result.status === 0
    ? { description, ok: true }
    : { description, ok: false, detail: describeFailure(result) };
}

async function expectSuccess(
  probe: Probe,
  user: DbUser,
  description: string,
  sql: string,
): Promise<CheckOutcome> {
  const result = await probe.sql(user, sql);
  return result.status === 0
    ? { description, ok: true }
    : { description, ok: false, detail: describeFailure(result) };
}

/** Extensions, attributs des rôles et droits de l'utilisateur applicatif. */
export async function checkPostgres(probe: Probe): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = [];
  const list = REQUIRED_EXTENSIONS.map((name) => `'${name}'`).join(', ');

  outcomes.push(
    await expectValue(
      probe,
      'postgres',
      'extensions pg_trgm, unaccent et fuzzystrmatch installées',
      `SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension WHERE extname IN (${list})`,
      REQUIRED_EXTENSIONS.join(','),
    ),
    await expectValue(
      probe,
      'lignee_app',
      'extensions utilisables par lignee_app',
      "SELECT similarity('Kamga', 'Kamgha') > 0.3 AND unaccent('Nadège') = 'Nadege' " +
        "AND levenshtein('Ngo', 'Nguo') = 1",
      't',
    ),
    await expectValue(
      probe,
      'postgres',
      'lignee_app sans attribut privilégié',
      'SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls ' +
        "FROM pg_roles WHERE rolname = 'lignee_app'",
      'f',
    ),
    await expectValue(
      probe,
      'postgres',
      'lignee_migration ni superutilisateur ni administrateur des rôles',
      'SELECT rolsuper OR rolcreaterole OR rolbypassrls ' +
        "FROM pg_roles WHERE rolname = 'lignee_migration'",
      'f',
    ),
    await expectValue(
      probe,
      'postgres',
      'base lignee et schéma public à lignee_migration',
      "SELECT pg_get_userbyid(d.datdba) || ',' || pg_get_userbyid(n.nspowner) " +
        "FROM pg_database d, pg_namespace n WHERE d.datname = 'lignee' AND n.nspname = 'public'",
      'lignee_migration,lignee_migration',
    ),
    await expectRefused(
      probe,
      'lignee_app',
      'lignee_app ne crée pas de table',
      'CREATE TABLE ci_probe_app (id int)',
    ),
    await expectRefused(
      probe,
      'lignee_app',
      'lignee_app ne crée pas de table temporaire',
      'CREATE TEMPORARY TABLE ci_probe_temporary (id int)',
    ),
    await expectRefused(
      probe,
      'lignee_app',
      'lignee_app ne crée pas de schéma',
      'CREATE SCHEMA ci_probe_schema',
    ),
  );

  // Contre-épreuve : l'utilisateur de migration crée une table ; l'utilisateur applicatif en
  // lit et écrit les lignes (droits par défaut, séquence comprise), sans en changer la structure.
  const created = await expectSuccess(
    probe,
    'lignee_migration',
    'lignee_migration crée une table',
    `CREATE TABLE ${PROBE_TABLE} (id bigserial PRIMARY KEY, label text NOT NULL)`,
  );
  outcomes.push(created);
  if (created.ok) {
    try {
      outcomes.push(
        await expectValue(
          probe,
          'lignee_app',
          'lignee_app écrit et lit une ligne de cette table',
          `INSERT INTO ${PROBE_TABLE} (label) VALUES ('sonde') RETURNING label`,
          'sonde',
        ),
        await expectRefused(
          probe,
          'lignee_app',
          'lignee_app ne modifie pas la structure de cette table',
          `ALTER TABLE ${PROBE_TABLE} ADD COLUMN extra int`,
        ),
        await expectRefused(
          probe,
          'lignee_app',
          'lignee_app ne supprime pas cette table',
          `DROP TABLE ${PROBE_TABLE}`,
        ),
      );
    } finally {
      outcomes.push(
        await expectSuccess(
          probe,
          'lignee_migration',
          'lignee_migration supprime la table de contrôle',
          `DROP TABLE ${PROBE_TABLE}`,
        ),
      );
    }
  }
  return outcomes;
}

/** Compartiment privé et clé de l'application limitée à ce compartiment. */
export async function checkMinio(probe: Probe, bucket: string): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = [];
  const object = 'ci-probe-local-env.txt';
  const target = `app/${bucket}/${object}`;
  const commandOutcome = (description: string, result: CommandResult): CheckOutcome =>
    result.status === 0
      ? { description, ok: true }
      : { description, ok: false, detail: describeFailure(result) };

  const written = await probe.mcAsApp(['pipe', target], PROBE_CONTENT);
  outcomes.push(commandOutcome(`la clé de l'application écrit dans ${bucket}`, written));
  if (written.status !== 0) {
    return outcomes;
  }

  try {
    const read = await probe.mcAsApp(['cat', target]);
    const readDescription = `la clé de l'application lit dans ${bucket}`;
    if (read.status !== 0) {
      outcomes.push(commandOutcome(readDescription, read));
    } else if (read.stdout !== PROBE_CONTENT) {
      outcomes.push({
        description: readDescription,
        ok: false,
        detail: `contenu « ${read.stdout} »`,
      });
    } else {
      outcomes.push({ description: readDescription, ok: true });
    }

    for (const path of [`/${bucket}/`, `/${bucket}/${object}`]) {
      const description = `aucun accès anonyme à ${path}`;
      const status = await probe.anonymousHttpStatus(path);
      outcomes.push(
        status === 403
          ? { description, ok: true }
          : { description, ok: false, detail: `HTTP ${String(status)} au lieu de 403` },
      );
    }

    const description = "la clé de l'application ne crée pas de compartiment";
    const otherBucket = await probe.mcAsApp(['mb', 'app/ci-probe-autre-compartiment']);
    outcomes.push(
      otherBucket.status === 0
        ? { description, ok: false, detail: 'compartiment ci-probe-autre-compartiment créé' }
        : { description, ok: true },
    );
  } finally {
    const removed = await probe.mcAsApp(['rm', target]);
    outcomes.push(commandOutcome("la clé de l'application supprime l'objet de contrôle", removed));
  }
  return outcomes;
}
