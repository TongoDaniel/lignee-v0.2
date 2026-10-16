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

export type MinioAlias = 'app' | 'root';

/** Accès aux conteneurs démarrés par compose.yaml. */
export interface Probe {
  /**
   * Joue du SQL dans une base (`lignee` par défaut), sortie brute (une valeur par ligne,
   * colonnes séparées par `|`), arrêt à la première erreur. `postgres` passe par le socket
   * local ; les deux autres par TCP avec leur mot de passe, comme l'API.
   */
  sql(user: DbUser, sql: string, database?: string): Promise<CommandResult>;
  /**
   * Commande `mc` dans le conteneur de MinIO, avec l'alias `app` (clé S3 de l'application)
   * ou `root` (administrateur, pour préparer les contrôles seulement).
   */
  mc(alias: MinioAlias, args: readonly string[], input?: string): Promise<CommandResult>;
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

/** Compartiment créé par l'administrateur, hors de portée de la clé de l'application. */
export const OTHER_BUCKET = 'ci-probe-autre-compartiment';

/**
 * Messages de `mc` quand une clé n'a pas le droit (code S3 `AccessDenied`) : « Access Denied »
 * pour la création d'un compartiment, « Insufficient permissions to access this path » pour la
 * lecture ou l'écriture d'un objet (relevé dans le job environnement-local). Un contrôle
 * négatif exige l'un d'eux : une erreur réseau ou un objet absent ne comptent pas comme un refus.
 */
export const REFUSAL_MESSAGES = [
  'Access Denied',
  'Insufficient permissions to access this path',
] as const;

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

  // La base `postgres` existe dans toute installation : lignee_app ne doit pas s'y connecter
  // pour y créer des tables temporaires ou des objets.
  const otherDatabase = await probe.sql('lignee_app', 'SELECT 1', 'postgres');
  const otherDescription = 'lignee_app ne se connecte pas à la base postgres';
  outcomes.push(
    otherDatabase.status !== 0 &&
      `${otherDatabase.stderr}${otherDatabase.stdout}`.includes('permission denied for database')
      ? { description: otherDescription, ok: true }
      : {
          description: otherDescription,
          ok: false,
          detail:
            otherDatabase.status === 0 ? 'connexion acceptée' : describeFailure(otherDatabase),
        },
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

function commandOutcome(description: string, result: CommandResult): CheckOutcome {
  return result.status === 0
    ? { description, ok: true }
    : { description, ok: false, detail: describeFailure(result) };
}

/** Réussit seulement si la commande échoue avec un message de refus de droits. */
function deniedOutcome(description: string, result: CommandResult): CheckOutcome {
  if (result.status === 0) {
    return { description, ok: false, detail: 'commande acceptée' };
  }
  const output = `${result.stderr}${result.stdout}`;
  return REFUSAL_MESSAGES.some((message) => output.includes(message))
    ? { description, ok: true }
    : {
        description,
        ok: false,
        detail: `refus de droits attendu, obtenu ${describeFailure(result)}`,
      };
}

/**
 * Compartiment privé, et clé de l'application limitée à ce compartiment : elle n'en crée pas
 * d'autre, et ne lit ni n'écrit dans un compartiment créé par l'administrateur.
 */
export async function checkMinio(probe: Probe, bucket: string): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = [];
  const object = 'ci-probe-local-env.txt';
  const target = `app/${bucket}/${object}`;

  const written = await probe.mc('app', ['pipe', target], PROBE_CONTENT);
  outcomes.push(commandOutcome(`la clé de l'application écrit dans ${bucket}`, written));
  if (written.status !== 0) {
    return outcomes;
  }

  try {
    const read = await probe.mc('app', ['cat', target]);
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

    outcomes.push(
      deniedOutcome(
        "la clé de l'application ne crée pas de compartiment",
        await probe.mc('app', ['mb', 'app/ci-probe-compartiment-refuse']),
      ),
    );
  } finally {
    outcomes.push(
      commandOutcome(
        "la clé de l'application supprime l'objet de contrôle",
        await probe.mc('app', ['rm', target]),
      ),
    );
  }

  // Second compartiment, avec un objet, créé par l'administrateur.
  const otherObject = `${OTHER_BUCKET}/${object}`;
  const prepared = await probe.mc('root', ['mb', '--ignore-existing', `root/${OTHER_BUCKET}`]);
  const seeded =
    prepared.status === 0
      ? await probe.mc('root', ['pipe', `root/${otherObject}`], PROBE_CONTENT)
      : prepared;
  outcomes.push(commandOutcome(`l'administrateur prépare le compartiment ${OTHER_BUCKET}`, seeded));
  if (seeded.status !== 0) {
    return outcomes;
  }
  try {
    outcomes.push(
      deniedOutcome(
        `la clé de l'application ne lit pas dans ${OTHER_BUCKET}`,
        await probe.mc('app', ['cat', `app/${otherObject}`]),
      ),
      deniedOutcome(
        `la clé de l'application n'écrit pas dans ${OTHER_BUCKET}`,
        await probe.mc('app', ['pipe', `app/${OTHER_BUCKET}/ecrit-par-app.txt`], PROBE_CONTENT),
      ),
    );
  } finally {
    outcomes.push(
      commandOutcome(
        `l'administrateur supprime le compartiment ${OTHER_BUCKET}`,
        await probe.mc('root', ['rb', '--force', `root/${OTHER_BUCKET}`]),
      ),
    );
  }
  return outcomes;
}
