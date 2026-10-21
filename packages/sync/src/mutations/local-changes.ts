// Saisie locale (HOL-01, partie saisie locale : « En mode avion, les parcours de la V1 passent ») :
// chaque modification s'applique d'abord à la copie du téléphone et entre dans la file de
// changements, dans la même transaction (TRD, « Hors-ligne et synchronisation » ; ADR 0027).
// Un lot refusé ne laisse aucune trace : ni dans l'arbre, ni dans la file.
//
// Deux entrées :
// - `recordLocalChanges` : des changements décrits par l'écran (T-031 à T-033) ou par le plan
//   vocal validé (T-079) ; identifiants, dates et versions de départ sont posés ici ;
// - `applyLocalMutationBatch` : un lot déjà formé ailleurs (tests, outils) ; idempotent.
// Le rejeu des saisies en attente sur un nouvel instantané (T-063, T-067) ne passe pas par
// `applyLocalMutationBatch` : il aura sa propre fonction, qui garde la seconde barrière et ne
// rejoue que les mutations du lecteur.
import {
  mutationBatchSchema,
  type Id,
  type MutationBatch,
  type MutationEntity,
  type MutationOperation,
} from '@lignee/domain';
import { and, eq, inArray } from 'drizzle-orm';

import { mutationQueue, people, trees } from '../local-db/schema';
import {
  COLLECTION_TABLES,
  readTreeSnapshot,
  snapshotPrivacyIssues,
  type LocalDatabase,
} from '../local-db/snapshot';
import {
  applyMutationBatch,
  dropUnchangedFields,
  formatIssuePath,
  remapIssue,
  treeObjectsOf,
  type MutationIssue,
  type ObjectChange,
  type TreeObjects,
} from './apply';

/** Lot mal formé (schéma) : seuls les chemins des erreurs sont gardés, jamais les valeurs. */
export class InvalidMutationBatchError extends Error {
  constructor(readonly paths: readonly string[]) {
    super(`Invalid mutation batch (${String(paths.length)} issue(s))`);
    this.name = 'InvalidMutationBatchError';
  }
}

/** Lot refusé : rien n'est écrit. Les constats ne portent qu'un code et un chemin. */
export class MutationBatchRefusedError extends Error {
  constructor(readonly issues: readonly MutationIssue[]) {
    super(`Mutation batch refused (${String(issues.length)} issue(s))`);
    this.name = 'MutationBatchRefusedError';
  }
}

export type LocalBatchOutcome =
  | { readonly status: 'recorded'; readonly batchId: Id; readonly mutationCount: number }
  /** Ce lot est déjà dans la file : rien n'est rejoué (même identifiant, mêmes mutations). */
  | { readonly status: 'already_recorded'; readonly batchId: Id }
  /** Aucun changement réel : rien n'est écrit, rien n'entre dans la file. */
  | { readonly status: 'no_change' };

/** Un changement décrit par l'écran ou par le plan vocal, avant d'être une mutation. */
export interface LocalChange {
  readonly entity: MutationEntity;
  readonly entityId: Id;
  readonly operation: MutationOperation;
  /** Création : l'objet sans `id` ni `treeId` ; modification : les champs modifiés. */
  readonly fields?: Record<string, unknown>;
}

export interface RecordLocalChangesInput {
  readonly treeId: Id;
  /** Compte connecté : doit être le lecteur pour lequel la copie a été filtrée. */
  readonly authorAccountId: Id;
  readonly changes: readonly LocalChange[];
  /** Moment de la saisie, en millisecondes depuis 1970 (aucune horloge lue ici). */
  readonly now: number;
  /** Générateur d'UUIDv7 (`createId` de @lignee/domain sur le téléphone). */
  readonly newId: () => Id;
}

function parseBatch(input: unknown): MutationBatch {
  const result = mutationBatchSchema.safeParse(input);
  if (!result.success) {
    throw new InvalidMutationBatchError(
      result.error.issues.map((issue) => formatIssuePath(issue.path)),
    );
  }
  return result.data;
}

/** La copie locale de l'arbre, pour ce compte ; sinon le lot est refusé. */
function readOwnTree(db: LocalDatabase, treeId: Id, authorAccountId: Id): TreeObjects {
  const row = db
    .select({ readerAccountId: trees.readerAccountId })
    .from(trees)
    .where(eq(trees.id, treeId))
    .get();
  if (row === undefined) {
    throw new MutationBatchRefusedError([{ code: 'unknown_tree', path: 'treeId' }]);
  }
  // La copie a été filtrée pour un compte : un autre compte n'y écrit jamais (ADR 0023).
  if (row.readerAccountId !== authorAccountId) {
    throw new MutationBatchRefusedError([{ code: 'foreign_author', path: 'authorAccountId' }]);
  }
  const snapshot = readTreeSnapshot(db, treeId);
  if (snapshot === undefined) {
    throw new MutationBatchRefusedError([{ code: 'unknown_tree', path: 'treeId' }]);
  }
  return treeObjectsOf(snapshot);
}

function writeChange(db: LocalDatabase, treeId: Id, change: ObjectChange): void {
  const { table, row } = COLLECTION_TABLES[change.collection] as unknown as {
    table: typeof people;
    row: (object: unknown) => Record<string, unknown>;
  };
  if (change.kind === 'delete') {
    db.delete(table).where(eq(table.id, change.id)).run();
    return;
  }
  const values = { ...row(change.object), body: change.object };
  if (change.kind === 'insert') {
    db.insert(table)
      .values({ id: change.object.id, treeId, ...values })
      .run();
  } else {
    // Mise à jour en place : la ligne garde son rang (l'ordre de relecture ne change pas).
    db.update(table).set(values).where(eq(table.id, change.object.id)).run();
  }
}

/** Une mutation dont l'identifiant est déjà dans la file (contrainte d'unicité de SQLite). */
function isDuplicateQueueId(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Drizzle enveloppe l'erreur du pilote : son message est dans `cause`.
  const cause = error.cause instanceof Error ? error.cause.message : '';
  const message = `${error.message} ${cause}`;
  return /UNIQUE constraint failed: mutation_queue\.id/.test(message);
}

/**
 * Applique un lot validé à la copie locale et l'ajoute à la file (transaction en cours).
 * `origins` remet les constats au rang qu'avait chaque mutation dans les changements reçus.
 */
function applyAndEnqueue(
  db: LocalDatabase,
  tree: TreeObjects,
  batch: MutationBatch,
  authorAccountId: Id,
  origins?: readonly number[],
): LocalBatchOutcome {
  const refuse = (issues: readonly MutationIssue[]) =>
    new MutationBatchRefusedError(
      origins === undefined ? issues : issues.map((issue) => remapIssue(issue, origins)),
    );
  const result = applyMutationBatch(tree, batch, {
    authorAccountId,
    requireCurrentBaseVersion: true,
  });
  if (!result.ok) throw refuse(result.issues);
  // Seconde barrière (ADR 0023) : la copie reste ce qu'un lecteur peut voir, après le lot aussi.
  // Les contrôles du lot couvrent déjà ce qu'elle vérifie pour les objets touchés : elle n'arrête
  // qu'une copie déjà abîmée (ligne écrite hors de ce paquet, version plus ancienne de l'app).
  // Ses chemins désignent l'instantané (`facts[3]`), pas une mutation.
  const barrier = snapshotPrivacyIssues({ readerAccountId: authorAccountId, ...result.tree });
  if (barrier.length > 0) {
    throw new MutationBatchRefusedError(
      barrier.map((issue) => ({ code: 'privacy_barrier', path: issue.path })),
    );
  }
  // Les écritures se font dans la transaction de l'appelant : toute erreur l'annule entière.
  for (const change of result.changes) writeChange(db, batch.treeId, change);
  try {
    db.insert(mutationQueue)
      .values(
        batch.mutations.map((mutation) => ({
          id: mutation.id,
          batchId: batch.id,
          treeId: batch.treeId,
          authorAccountId,
          entityId: mutation.entityId,
          status: 'pending' as const,
          body: mutation,
        })),
      )
      .run();
  } catch (error) {
    // Identifiant de mutation déjà pris : refus du lot, arbre compris (la transaction l'annule).
    if (isDuplicateQueueId(error)) {
      throw new MutationBatchRefusedError([{ code: 'duplicate_mutation', path: 'mutations' }]);
    }
    throw error;
  }
  return { status: 'recorded', batchId: batch.id, mutationCount: batch.mutations.length };
}

/**
 * Applique un lot déjà formé à la copie locale, d'un seul bloc, et l'ajoute à la file. Chaque
 * `baseVersion` doit être la version connue sur le téléphone. Rejouer un lot déjà dans la file
 * ne change rien (`already_recorded`) ; une mutation déjà dans la file sous un autre lot est
 * refusée.
 */
export function applyLocalMutationBatch(
  db: LocalDatabase,
  input: unknown,
  options: { readonly authorAccountId: Id },
): LocalBatchOutcome {
  const batch = parseBatch(input);
  return db.transaction((tx) => {
    const local = tx as unknown as LocalDatabase;
    // Le contrôle d'auteur passe d'abord : un autre compte n'apprend rien de la file.
    const tree = readOwnTree(local, batch.treeId, options.authorAccountId);
    const ids = batch.mutations.map((mutation) => mutation.id);
    const known = local
      .select({ id: mutationQueue.id, batchId: mutationQueue.batchId })
      .from(mutationQueue)
      .where(
        and(
          inArray(mutationQueue.id, ids),
          eq(mutationQueue.treeId, batch.treeId),
          eq(mutationQueue.authorAccountId, options.authorAccountId),
        ),
      )
      .all();
    if (known.length > 0) {
      const sameBatch =
        known.length === ids.length && known.every((row) => row.batchId === batch.id);
      if (sameBatch) return { status: 'already_recorded', batchId: batch.id } as const;
      throw new MutationBatchRefusedError([{ code: 'duplicate_mutation', path: 'mutations' }]);
    }
    return applyAndEnqueue(local, tree, batch, options.authorAccountId);
  });
}

/**
 * Version de départ de chaque changement, d'après la copie locale : la version de la fiche pour
 * une personne (0 pour une fiche créée plus tôt dans le même lot), `null` pour une création et
 * pour les objets que le modèle ne versionne pas (ADR 0027).
 */
function baseVersions(tree: TreeObjects, changes: readonly LocalChange[]): (number | null)[] {
  const versions = new Map(tree.people.map((person) => [person.id, person.version]));
  return changes.map((change) => {
    if (change.entity !== 'person') return null;
    if (change.operation === 'create') {
      versions.set(change.entityId, 0);
      return null;
    }
    const version = versions.get(change.entityId) ?? null;
    if (change.operation === 'delete') versions.delete(change.entityId);
    return version;
  });
}

/**
 * Enregistre des changements saisis sur le téléphone : un lot, appliqué d'un seul bloc à la copie
 * locale, puis ajouté à la file. Les champs non modifiés sont retirés des modifications (la file
 * ne garde que ce que l'auteur a changé) ; s'il ne reste rien, rien n'est écrit.
 */
export function recordLocalChanges(
  db: LocalDatabase,
  input: RecordLocalChangesInput,
): LocalBatchOutcome {
  return db.transaction((tx) => {
    const local = tx as unknown as LocalDatabase;
    const tree = readOwnTree(local, input.treeId, input.authorAccountId);
    const createdAt = new Date(input.now).toISOString();
    const versions = baseVersions(tree, input.changes);
    const batch = parseBatch({
      id: input.newId(),
      treeId: input.treeId,
      mutations: input.changes.map((change, index) => ({
        id: input.newId(),
        entity: change.entity,
        entityId: change.entityId,
        operation: change.operation,
        ...(change.fields === undefined ? {} : { fields: change.fields }),
        baseVersion: versions[index] ?? null,
        createdAt,
      })),
    });
    const trimmed = dropUnchangedFields(tree, batch);
    if (trimmed.batch.mutations.length === 0) return { status: 'no_change' } as const;
    return applyAndEnqueue(local, tree, trimmed.batch, input.authorAccountId, trimmed.origins);
  });
}
