// File de changements du téléphone (TRD, « Hors-ligne et synchronisation », point 2 ; ADR 0027) :
// lecture dans l'ordre de saisie, nombre de changements en attente (HOL-02 : « 3 changements en
// attente »), et suivi de l'état de chaque mutation (en attente, envoyée, refusée). L'envoi
// lui-même est T-067 ; la réponse du serveur est T-060.
//
// La file vit dans la base chiffrée (dossier `SQLite`, exclu des sauvegardes Android par
// `apps/mobile/plugins/withLocalDataBackupRules.ts`). Erreurs : codes et nombres seulement.
import { mutationSchema, type Id, type Mutation } from '@lignee/domain';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { mutationQueue, type QueueStatus } from '../local-db/schema';
import type { LocalDatabase } from '../local-db/snapshot';

/** Une mutation de la file, avec son rang et son état. */
export interface QueuedMutation {
  readonly seq: number;
  readonly batchId: Id;
  readonly treeId: Id;
  readonly authorAccountId: Id;
  readonly status: QueueStatus;
  /** Code stable du refus du serveur, pour une mutation refusée. */
  readonly refusalCode?: string;
  readonly mutation: Mutation;
}

/** Un lot de la file : ses mutations dans l'ordre, toutes du même auteur et du même arbre. */
export interface QueuedBatch {
  readonly id: Id;
  readonly treeId: Id;
  readonly authorAccountId: Id;
  readonly entries: readonly QueuedMutation[];
}

/**
 * Quelle file lire : un arbre et un compte, toujours. On ne lit, ne compte et n'envoie que les
 * saisies du compte connecté (T-067) ; celles d'un autre compte ne sortent jamais d'ici.
 */
export interface QueueScope {
  readonly treeId: Id;
  readonly authorAccountId: Id;
  readonly status?: QueueStatus;
}

function where(scope: QueueScope) {
  return and(
    eq(mutationQueue.treeId, scope.treeId),
    eq(mutationQueue.authorAccountId, scope.authorAccountId),
    scope.status === undefined ? undefined : eq(mutationQueue.status, scope.status),
  );
}

/**
 * Mutations de la file d'un arbre, dans l'ordre de saisie. Chaque mutation repasse par son
 * schéma (une base écrite par une autre version de l'app ne donne jamais de mutation invalide).
 */
export function listQueuedMutations(db: LocalDatabase, scope: QueueScope): QueuedMutation[] {
  return db
    .select({
      seq: mutationQueue.seq,
      batchId: mutationQueue.batchId,
      treeId: mutationQueue.treeId,
      authorAccountId: mutationQueue.authorAccountId,
      status: mutationQueue.status,
      refusalCode: mutationQueue.refusalCode,
      body: sql<string>`${mutationQueue.body}`,
    })
    .from(mutationQueue)
    .where(where(scope))
    .orderBy(asc(mutationQueue.seq))
    .all()
    .map((row) => ({
      seq: row.seq,
      batchId: row.batchId,
      treeId: row.treeId,
      authorAccountId: row.authorAccountId,
      status: row.status,
      ...(row.refusalCode === null ? {} : { refusalCode: row.refusalCode }),
      mutation: mutationSchema.parse(JSON.parse(row.body)),
    }));
}

/** Les lots de la file, dans l'ordre de leur première mutation. */
export function listQueuedBatches(db: LocalDatabase, scope: QueueScope): QueuedBatch[] {
  const batches = new Map<Id, QueuedMutation[]>();
  for (const entry of listQueuedMutations(db, scope)) {
    const entries = batches.get(entry.batchId) ?? [];
    entries.push(entry);
    batches.set(entry.batchId, entries);
  }
  return [...batches].map(([id, entries]) => {
    const first = entries[0] as QueuedMutation;
    return { id, treeId: first.treeId, authorAccountId: first.authorAccountId, entries };
  });
}

/** Nombre de changements de ce compte pas encore envoyés (indicateur discret, HOL-02). */
export function countPendingMutations(
  db: LocalDatabase,
  scope: Omit<QueueScope, 'status'>,
): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(mutationQueue)
    .where(where({ ...scope, status: 'pending' }))
    .get();
  return row?.count ?? 0;
}

/** Changement d'état impossible, ou mutation absente de la file. Aucun identifiant ici. */
export class QueueTransitionError extends Error {
  constructor(readonly count: number) {
    super(`Queue update refused (${String(count)} mutation(s))`);
    this.name = 'QueueTransitionError';
  }
}

/** Code de refus : un mot stable (`third_birth_parent`), jamais un texte ni une valeur. */
const REFUSAL_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export type QueueOutcome =
  | { readonly id: Id; readonly status: 'sent' }
  | { readonly id: Id; readonly status: 'refused'; readonly code: string };

/**
 * Note la réponse du serveur pour des mutations de la file, en une transaction. Seule une
 * mutation en attente change d'état ; noter deux fois la même réponse, dans deux appels, ne
 * change rien (un envoi répété reçoit la même réponse). Toute autre transition, une mutation
 * absente, ou deux réponses pour la même mutation dans un appel : refus, sans rien écrire.
 */
export function recordQueueOutcomes(db: LocalDatabase, outcomes: readonly QueueOutcome[]): void {
  const distinct = new Set(outcomes.map((outcome) => outcome.id));
  if (distinct.size !== outcomes.length) throw new QueueTransitionError(outcomes.length);
  for (const outcome of outcomes) {
    if (outcome.status === 'refused' && !REFUSAL_CODE.test(outcome.code)) {
      throw new QueueTransitionError(outcomes.length);
    }
  }
  if (outcomes.length === 0) return;
  db.transaction((tx) => {
    const ids = outcomes.map((outcome) => outcome.id);
    const rows = new Map(
      tx
        .select({
          id: mutationQueue.id,
          status: mutationQueue.status,
          refusalCode: mutationQueue.refusalCode,
        })
        .from(mutationQueue)
        .where(inArray(mutationQueue.id, ids))
        .all()
        .map((row) => [row.id, row]),
    );
    let invalid = 0;
    for (const outcome of outcomes) {
      const row = rows.get(outcome.id);
      const code = outcome.status === 'refused' ? outcome.code : null;
      if (row === undefined) invalid += 1;
      else if (row.status === 'pending') {
        tx.update(mutationQueue)
          .set({ status: outcome.status, refusalCode: code })
          .where(eq(mutationQueue.id, outcome.id))
          .run();
      } else if (row.status !== outcome.status || row.refusalCode !== code) invalid += 1;
    }
    if (invalid > 0) throw new QueueTransitionError(invalid);
  });
}
