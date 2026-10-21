// États de la file de changements : en attente, envoyée, refusée (ADR 0027).
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { replaceTreeSnapshot } from '../local-db/snapshot';
import { smallTree } from '../test-support/mutation-fixtures';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import { recordLocalChanges } from './local-changes';
import {
  QueueTransitionError,
  countPendingMutations,
  listQueuedBatches,
  listQueuedMutations,
  recordQueueOutcomes,
} from './queue';

/** La file du lecteur de la copie. */
const own = (fixture: { treeId: string; reader: string }) => ({
  treeId: fixture.treeId,
  authorAccountId: fixture.reader,
});

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;

async function withQueue() {
  const fixture = smallTree();
  const opened = await openTestDatabase(join(tmp.dir, `queue-${String(++counter)}.db`));
  replaceTreeSnapshot(opened.db, fixture.snapshot, { now: 1 });
  for (const notes of ['Première note', 'Deuxième note', 'Troisième note']) {
    recordLocalChanges(opened.db, {
      treeId: fixture.treeId,
      authorAccountId: fixture.reader,
      changes: [
        { entity: 'person', entityId: fixture.child, operation: 'update', fields: { notes } },
      ],
      now: Date.UTC(2026, 9, 19),
      newId: fixture.nextId,
    });
  }
  const ids = listQueuedMutations(opened.db, own(fixture)).map((entry) => entry.mutation.id);
  return { ...opened, fixture, ids };
}

describe('file de changements', () => {
  it('trois lots en attente, dans l’ordre de saisie (« 3 changements en attente »)', async () => {
    const { db, connection, fixture } = await withQueue();
    expect(countPendingMutations(db, own(fixture))).toBe(3);
    const batches = listQueuedBatches(db, own(fixture));
    expect(batches.map((batch) => batch.entries[0]?.mutation.fields)).toEqual([
      { notes: 'Première note' },
      { notes: 'Deuxième note' },
      { notes: 'Troisième note' },
    ]);
    expect(
      listQueuedBatches(db, { treeId: fixture.treeId, authorAccountId: fixture.otherAccount }),
    ).toEqual([]);
    connection.close();
  });

  it('envoyée, refusée avec un code ; noter deux fois la même réponse ne change rien', async () => {
    const { db, connection, fixture, ids } = await withQueue();
    const [first, second] = ids as [string, string, string];
    recordQueueOutcomes(db, [
      { id: first, status: 'sent' },
      { id: second, status: 'refused', code: 'third_birth_parent' },
    ]);
    recordQueueOutcomes(db, [{ id: first, status: 'sent' }]);
    const entries = listQueuedMutations(db, own(fixture));
    expect(entries.map((entry) => [entry.status, entry.refusalCode])).toEqual([
      ['sent', undefined],
      ['refused', 'third_birth_parent'],
      ['pending', undefined],
    ]);
    expect(countPendingMutations(db, own(fixture))).toBe(1);
    expect(listQueuedMutations(db, { ...own(fixture), status: 'pending' })).toHaveLength(1);
    connection.close();
  });

  it('une transition impossible, un code libre ou une mutation absente : rien n’est écrit', async () => {
    const { db, connection, fixture, ids } = await withQueue();
    const [first, , third] = ids as [string, string, string];
    recordQueueOutcomes(db, [{ id: first, status: 'sent' }]);
    const before = listQueuedMutations(db, own(fixture));
    expect(() => {
      recordQueueOutcomes(db, [
        { id: third, status: 'sent' },
        { id: first, status: 'refused', code: 'cycle' },
      ]);
    }).toThrow(QueueTransitionError);
    expect(() => {
      recordQueueOutcomes(db, [{ id: third, status: 'refused', code: 'Refusé : Owono' }]);
    }).toThrow(QueueTransitionError);
    expect(() => {
      recordQueueOutcomes(db, [{ id: fixture.nextId(), status: 'sent' }]);
    }).toThrow(QueueTransitionError);
    expect(listQueuedMutations(db, own(fixture))).toEqual(before);
    connection.close();
  });
});

describe('réponses du serveur en double', () => {
  it('deux réponses pour la même mutation dans un appel : refus, rien n’est écrit', async () => {
    const { db, connection, fixture, ids } = await withQueue();
    const [first] = ids as [string];
    expect(() => {
      recordQueueOutcomes(db, [
        { id: first, status: 'sent' },
        { id: first, status: 'refused', code: 'cycle' },
      ]);
    }).toThrow(QueueTransitionError);
    expect(listQueuedMutations(db, own(fixture)).map((entry) => entry.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
    connection.close();
  });
});
