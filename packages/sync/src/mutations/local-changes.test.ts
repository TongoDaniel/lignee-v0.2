// Saisie locale et file de changements (T-030, plan V1 ; HOL-01, partie saisie locale ; ADR 0027).
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  eraseLocalTree,
  readTreeSnapshot,
  replaceTreeSnapshot,
  type LocalDatabase,
} from '../local-db/snapshot';
import { smallTree, type SmallTree } from '../test-support/mutation-fixtures';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import {
  InvalidMutationBatchError,
  MutationBatchRefusedError,
  applyLocalMutationBatch,
  recordLocalChanges,
  type LocalChange,
} from './local-changes';
import { countPendingMutations, listQueuedBatches, listQueuedMutations } from './queue';

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
const nextPath = () => join(tmp.dir, `changes-${String(++counter)}.db`);
const NOW = Date.UTC(2026, 9, 19, 8, 30);

async function loaded() {
  const fixture = smallTree();
  const opened = await openTestDatabase(nextPath());
  replaceTreeSnapshot(opened.db, fixture.snapshot, { now: 1 });
  return { ...opened, fixture };
}

function record(db: LocalDatabase, fixture: SmallTree, changes: LocalChange[]) {
  return recordLocalChanges(db, {
    treeId: fixture.treeId,
    authorAccountId: fixture.reader,
    changes,
    now: NOW,
    newId: fixture.nextId,
  });
}

/** Le refus d'un lot : ses constats, et la preuve que rien n'a été écrit. */
function refusal(db: LocalDatabase, fixture: SmallTree, changes: LocalChange[]) {
  const before = readTreeSnapshot(db, fixture.treeId);
  const queued = listQueuedMutations(db, own(fixture));
  let caught: unknown;
  try {
    record(db, fixture, changes);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(MutationBatchRefusedError);
  expect(readTreeSnapshot(db, fixture.treeId)).toEqual(before);
  expect(listQueuedMutations(db, own(fixture))).toEqual(queued);
  return caught as MutationBatchRefusedError;
}

const newPerson = (fixture: SmallTree, givenNames = 'Ateba'): LocalChange[] => {
  const personId = fixture.nextId();
  return [
    { entity: 'person', entityId: personId, operation: 'create', fields: { nature: 'known' } },
    {
      entity: 'name',
      entityId: fixture.nextId(),
      operation: 'create',
      fields: { personId, type: 'birth', givenNames, authorAccountId: fixture.reader },
    },
  ];
};

describe('saisie locale', () => {
  it('une fiche et son nom s’appliquent ensemble et entrent dans la file, dans l’ordre', async () => {
    const { db, connection, fixture } = await loaded();
    const changes = newPerson(fixture);
    const outcome = record(db, fixture, changes);
    expect(outcome).toMatchObject({ status: 'recorded', mutationCount: 2 });

    const tree = readTreeSnapshot(db, fixture.treeId);
    const personId = changes[0]?.entityId;
    expect(tree?.people.at(-1)).toEqual({
      id: personId,
      treeId: fixture.treeId,
      nature: 'known',
      gender: 'unspecified',
      vitalStatus: 'unknown',
      version: 0,
    });
    expect(tree?.names.at(-1)).toMatchObject({ personId, givenNames: 'Ateba' });

    const queued = listQueuedMutations(db, own(fixture));
    expect(queued.map((entry) => [entry.mutation.entity, entry.status])).toEqual([
      ['person', 'pending'],
      ['name', 'pending'],
    ]);
    expect(queued[0]?.seq).toBeLessThan(queued[1]?.seq ?? 0);
    expect(new Set(queued.map((entry) => entry.batchId)).size).toBe(1);
    expect(queued[0]?.mutation).toMatchObject({
      operation: 'create',
      baseVersion: null,
      createdAt: '2026-10-19T08:30:00.000Z',
    });
    expect(queued[0]?.authorAccountId).toBe(fixture.reader);
    expect(countPendingMutations(db, own(fixture))).toBe(2);
    connection.close();
  });

  it('la file survit au redémarrage de l’app (base fermée puis rouverte)', async () => {
    const fixture = smallTree();
    const path = nextPath();
    const first = await openTestDatabase(path);
    replaceTreeSnapshot(first.db, fixture.snapshot, { now: 1 });
    record(first.db, fixture, newPerson(fixture));
    record(first.db, fixture, [
      {
        entity: 'person',
        entityId: fixture.child,
        operation: 'update',
        fields: { notes: 'Née pendant la saison des pluies' },
      },
    ]);
    const queued = listQueuedBatches(first.db, own(fixture));
    const tree = readTreeSnapshot(first.db, fixture.treeId);
    first.connection.close();

    const second = await openTestDatabase(path, first.keyStore);
    expect(second.opened.outcome).toBe('opened');
    expect(listQueuedBatches(second.db, own(fixture))).toEqual(queued);
    expect(queued).toHaveLength(2);
    expect(readTreeSnapshot(second.db, fixture.treeId)).toEqual(tree);
    second.connection.close();
  });

  it('une modification ne garde que les champs changés ; la version de départ est celle de la fiche', async () => {
    const { db, connection, fixture } = await loaded();
    record(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.father,
        operation: 'update',
        // Le formulaire renvoie toute la fiche : seul le statut vital a changé.
        fields: { nature: 'known', gender: 'male', vitalStatus: 'deceased' },
      },
    ]);
    const [entry] = listQueuedMutations(db, own(fixture));
    expect(entry?.mutation.fields).toEqual({ vitalStatus: 'deceased' });
    expect(entry?.mutation.baseVersion).toBe(4);
    const father = readTreeSnapshot(db, fixture.treeId)?.people[0];
    // La fiche reste à sa place, et sa version reste celle du serveur.
    expect(father).toMatchObject({ id: fixture.father, vitalStatus: 'deceased', version: 4 });

    expect(
      record(db, fixture, [
        {
          entity: 'person',
          entityId: fixture.father,
          operation: 'update',
          fields: { gender: 'male' },
        },
      ]),
    ).toEqual({ status: 'no_change' });
    expect(countPendingMutations(db, own(fixture))).toBe(1);
    connection.close();
  });

  it('un champ retiré (`null`) disparaît de l’objet', async () => {
    const { db, connection, fixture } = await loaded();
    record(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.placeholder,
        operation: 'update',
        fields: { distinctFrom: [fixture.child] },
      },
    ]);
    record(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.placeholder,
        operation: 'update',
        fields: { distinctFrom: null },
      },
    ]);
    const placeholder = readTreeSnapshot(db, fixture.treeId)?.people[3];
    expect(placeholder).toEqual({
      id: fixture.placeholder,
      treeId: fixture.treeId,
      nature: 'placeholder',
      gender: 'unspecified',
      vitalStatus: 'unknown',
      version: 0,
    });
    connection.close();
  });

  it('supprimer une fiche demande de supprimer aussi ce qui la cite, dans le même lot', async () => {
    const { db, connection, fixture } = await loaded();
    const issues = refusal(db, fixture, [
      { entity: 'person', entityId: fixture.child, operation: 'delete' },
    ]).issues;
    expect(issues).toEqual([{ code: 'dangling_reference', path: 'mutations[0].entityId' }]);

    const before = readTreeSnapshot(db, fixture.treeId);
    if (before === undefined) throw new Error('tree');
    const dependents: LocalChange[] = [
      ...before.filiations.map((filiation) => ({
        entity: 'filiation' as const,
        entityId: filiation.id,
        operation: 'delete' as const,
      })),
      ...before.names
        .filter((name) => name.personId === fixture.child)
        .map((name) => ({
          entity: 'name' as const,
          entityId: name.id,
          operation: 'delete' as const,
        })),
    ];
    record(db, fixture, [
      ...dependents,
      { entity: 'person', entityId: fixture.child, operation: 'delete' },
    ]);
    const after = readTreeSnapshot(db, fixture.treeId);
    expect(after?.people.map((person) => person.id)).not.toContain(fixture.child);
    expect(after?.filiations).toEqual([]);
    connection.close();
  });

  it('un lot mal formé est refusé avant toute écriture, sans valeur dans l’erreur', async () => {
    const { db, connection, fixture } = await loaded();
    const before = readTreeSnapshot(db, fixture.treeId);
    let caught: unknown;
    try {
      record(db, fixture, [
        ...newPerson(fixture),
        {
          entity: 'union',
          entityId: fixture.nextId(),
          operation: 'create',
          fields: { spouses: [{ personId: fixture.father, rank: 2 }] },
        },
      ]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidMutationBatchError);
    expect((caught as InvalidMutationBatchError).paths).toEqual(['mutations[2].fields.spouses']);
    expect((caught as Error).message).not.toMatch(/Ateba|[0-9a-f]{8}-/);
    expect(readTreeSnapshot(db, fixture.treeId)).toEqual(before);
    expect(countPendingMutations(db, own(fixture))).toBe(0);
    connection.close();
  });
});

describe('contrôles avant écriture : le lot entier est refusé', () => {
  it('troisième parent de naissance, même si la fiche du parent est créée dans le lot', async () => {
    const { db, connection, fixture } = await loaded();
    const extra = newPerson(fixture, 'Nkolo');
    const parentId = extra[0]?.entityId as string;
    const { issues } = refusal(db, fixture, [
      ...extra,
      {
        entity: 'filiation',
        entityId: fixture.nextId(),
        operation: 'create',
        fields: { parentId, childId: fixture.child, type: 'birth', certainty: 'certain' },
      },
    ]);
    expect(issues).toEqual([
      { code: 'coherence_refusal', path: 'mutations[2]', coherenceCode: 'third_birth_parent' },
    ]);
    connection.close();
  });

  it('cycle de filiation', async () => {
    const { db, connection, fixture } = await loaded();
    const { issues } = refusal(db, fixture, [
      {
        entity: 'filiation',
        entityId: fixture.nextId(),
        operation: 'create',
        fields: {
          parentId: fixture.child,
          childId: fixture.father,
          type: 'raised',
          certainty: 'certain',
        },
      },
    ]);
    expect(issues).toEqual([
      { code: 'coherence_refusal', path: 'mutations[0]', coherenceCode: 'filiation_cycle' },
    ]);
    connection.close();
  });

  it('« distincte de » ne cite qu’une personne présente dans la copie du rédacteur (ADR 0017)', async () => {
    const { db, connection, fixture } = await loaded();
    // Une personne que la copie ne contient pas : inexistante ou masquée, c'est pareil.
    const absent = fixture.nextId();
    const error = refusal(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.placeholder,
        operation: 'update',
        fields: { distinctFrom: [fixture.child, absent] },
      },
    ]);
    expect(error.issues).toEqual([
      { code: 'dangling_reference', path: 'mutations[0].fields.distinctFrom[1]' },
    ]);
    expect(error.message).not.toContain(absent);
    expect(JSON.stringify(error.issues)).not.toContain(absent);
    connection.close();
  });

  it('une fiche connue garde un nom autre qu’un ancien prénom', async () => {
    const { db, connection, fixture } = await loaded();
    const { issues } = refusal(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.nextId(),
        operation: 'create',
        fields: { nature: 'known' },
      },
    ]);
    expect(issues).toEqual([{ code: 'person_without_name', path: 'mutations[0]' }]);
    connection.close();
  });

  it('on ne crée rien au nom d’un autre compte ; aucune source tant qu’elles ne sont pas synchronisées', async () => {
    const { db, connection, fixture } = await loaded();
    expect(
      refusal(db, fixture, [
        {
          entity: 'fact',
          entityId: fixture.nextId(),
          operation: 'create',
          fields: {
            subject: { kind: 'person', personId: fixture.father },
            type: 'death_cause',
            value: 'Paludisme',
            authorAccountId: fixture.otherAccount,
          },
        },
      ]).issues,
    ).toEqual([{ code: 'author_mismatch', path: 'mutations[0].fields.authorAccountId' }]);
    expect(
      refusal(db, fixture, [
        {
          entity: 'filiation',
          entityId: (fixture.snapshot.filiations[0] as { id: string }).id,
          operation: 'update',
          fields: { sourceId: fixture.nextId() },
        },
      ]).issues,
    ).toEqual([{ code: 'unsupported_reference', path: 'mutations[0].fields.sourceId' }]);
    connection.close();
  });

  it('modifier ou supprimer un objet absent de la copie : refusé comme inexistant', async () => {
    const { db, connection, fixture } = await loaded();
    expect(
      refusal(db, fixture, [
        {
          entity: 'union',
          entityId: fixture.nextId(),
          operation: 'update',
          fields: { type: 'civil' },
        },
      ]).issues,
    ).toEqual([{ code: 'unknown_object', path: 'mutations[0].entityId' }]);
    expect(
      refusal(db, fixture, [{ entity: 'name', entityId: fixture.nextId(), operation: 'delete' }])
        .issues,
    ).toEqual([{ code: 'unknown_object', path: 'mutations[0].entityId' }]);
    connection.close();
  });

  it('seul le lecteur de la copie y écrit ; un arbre absent est refusé', async () => {
    const { db, connection, fixture } = await loaded();
    expect(() =>
      recordLocalChanges(db, {
        treeId: fixture.treeId,
        authorAccountId: fixture.otherAccount,
        changes: newPerson(fixture),
        now: NOW,
        newId: fixture.nextId,
      }),
    ).toThrow(MutationBatchRefusedError);
    expect(() =>
      recordLocalChanges(db, {
        treeId: fixture.nextId(),
        authorAccountId: fixture.reader,
        changes: newPerson(fixture),
        now: NOW,
        newId: fixture.nextId,
      }),
    ).toThrow(MutationBatchRefusedError);
    expect(countPendingMutations(db, own(fixture))).toBe(0);
    connection.close();
  });
});

describe('règles de visibilité dans un lot', () => {
  it('« moi seul » sur un lien de donneur créé dans le même lot : dans la file, pas dans l’arbre', async () => {
    const { db, connection, fixture } = await loaded();
    const filiationId = fixture.nextId();
    const donor = newPerson(fixture, 'Essomba');
    record(db, fixture, [
      ...donor,
      {
        entity: 'filiation',
        entityId: filiationId,
        operation: 'create',
        fields: {
          parentId: donor[0]?.entityId,
          childId: fixture.child,
          type: 'donor',
          certainty: 'certain',
        },
      },
      {
        entity: 'visibility_rule',
        entityId: fixture.nextId(),
        operation: 'create',
        fields: {
          target: { type: 'filiation', id: filiationId },
          level: 'only_me',
          authorAccountId: fixture.reader,
        },
      },
    ]);
    const queued = listQueuedMutations(db, own(fixture)).map((entry) => entry.mutation.entity);
    expect(queued).toEqual(['person', 'name', 'filiation', 'visibility_rule']);
    // L'instantané local ne porte jamais de règle (ADR 0023) : la seconde barrière l'accepte.
    expect(readTreeSnapshot(db, fixture.treeId)).not.toHaveProperty('visibilityRules');
    connection.close();
  });

  it('une règle sur un objet absent, au nom d’un autre, ou deux règles sur le même objet', async () => {
    const { db, connection, fixture } = await loaded();
    const rule = (target: string, authorAccountId: string): LocalChange => ({
      entity: 'visibility_rule',
      entityId: fixture.nextId(),
      operation: 'create',
      fields: { target: { type: 'person', id: target }, level: 'only_me', authorAccountId },
    });
    expect(refusal(db, fixture, [rule(fixture.nextId(), fixture.reader)]).issues).toEqual([
      { code: 'dangling_reference', path: 'mutations[0].fields.target.id' },
    ]);
    expect(refusal(db, fixture, [rule(fixture.child, fixture.otherAccount)]).issues).toEqual([
      { code: 'author_mismatch', path: 'mutations[0].fields.authorAccountId' },
    ]);
    expect(
      refusal(db, fixture, [
        rule(fixture.child, fixture.reader),
        rule(fixture.child, fixture.reader),
      ]).issues,
    ).toEqual([{ code: 'duplicate_visibility_rule', path: 'mutations[1].fields.target' }]);
    connection.close();
  });
});

describe('lot déjà formé', () => {
  function batchFor(fixture: SmallTree, baseVersion: number) {
    return {
      id: fixture.nextId(),
      treeId: fixture.treeId,
      mutations: [
        {
          id: fixture.nextId(),
          entity: 'person',
          entityId: fixture.mother,
          operation: 'update',
          fields: { notes: 'Commerçante au marché central' },
          baseVersion,
          createdAt: '2026-10-19T08:30:00.000Z',
        },
      ],
    };
  }

  it('rejouer le même lot ne l’applique qu’une fois', async () => {
    const { db, connection, fixture } = await loaded();
    const batch = batchFor(fixture, 1);
    const options = { authorAccountId: fixture.reader };
    expect(applyLocalMutationBatch(db, batch, options)).toMatchObject({ status: 'recorded' });
    const tree = readTreeSnapshot(db, fixture.treeId);
    expect(applyLocalMutationBatch(db, batch, options)).toEqual({
      status: 'already_recorded',
      batchId: batch.id,
    });
    expect(readTreeSnapshot(db, fixture.treeId)).toEqual(tree);
    expect(countPendingMutations(db, own(fixture))).toBe(1);
    // Une mutation déjà dans la file, sous un autre lot : refusée.
    expect(() => applyLocalMutationBatch(db, { ...batch, id: fixture.nextId() }, options)).toThrow(
      MutationBatchRefusedError,
    );
    connection.close();
  });

  it('un lot préparé sur une version plus ancienne de la fiche est refusé', async () => {
    const { db, connection, fixture } = await loaded();
    let caught: unknown;
    try {
      applyLocalMutationBatch(db, batchFor(fixture, 0), { authorAccountId: fixture.reader });
    } catch (error) {
      caught = error;
    }
    expect((caught as MutationBatchRefusedError).issues).toEqual([
      { code: 'base_version_mismatch', path: 'mutations[0].baseVersion' },
    ]);
    connection.close();
  });
});

describe('file et vie de l’arbre', () => {
  it('recharger l’instantané garde la file ; effacer l’arbre la vide (CL-SEC-08)', async () => {
    const { db, connection, fixture } = await loaded();
    record(db, fixture, newPerson(fixture));
    replaceTreeSnapshot(db, fixture.snapshot, { now: 2 });
    expect(countPendingMutations(db, own(fixture))).toBe(2);
    eraseLocalTree(db, fixture.treeId);
    expect(listQueuedMutations(db, own(fixture))).toEqual([]);
    expect(
      connection.raw.prepare('SELECT count(*) AS n FROM mutation_queue').get() as { n: number },
    ).toEqual({ n: 0 });
    connection.close();
  });

  it('aucune valeur saisie hors du corps JSON de la file', async () => {
    const { db, connection, fixture } = await loaded();
    record(db, fixture, newPerson(fixture, 'Zanguetsin'));
    const rows = connection.raw
      .prepare(
        'SELECT seq, id, batch_id, tree_id, author_account_id, entity_id, status, refusal_code FROM mutation_queue',
      )
      .all();
    expect(JSON.stringify(rows)).not.toContain('Zanguetsin');
    connection.close();
  });
});

describe('corrections après relecture', () => {
  it('un changement sans effet retiré ne décale pas le rang des constats', async () => {
    const { db, connection, fixture } = await loaded();
    const { issues } = refusal(db, fixture, [
      // Sans effet (le père est déjà un homme) : retiré avant l'application.
      {
        entity: 'person',
        entityId: fixture.father,
        operation: 'update',
        fields: { gender: 'male' },
      },
      {
        entity: 'union',
        entityId: fixture.nextId(),
        operation: 'update',
        fields: { type: 'civil' },
      },
    ]);
    expect(issues).toEqual([{ code: 'unknown_object', path: 'mutations[1].entityId' }]);
    connection.close();
  });

  it('une écriture qui échoue en cours de route annule tout le lot, arbre compris', async () => {
    const { db, connection, fixture } = await loaded();
    record(db, fixture, newPerson(fixture));
    const taken = listQueuedMutations(db, own(fixture))[0]?.mutation.id;
    if (taken === undefined) throw new Error('queue');
    // Le générateur renvoie, pour la mutation, un identifiant déjà dans la file : l'arbre est
    // écrit, puis l'insertion dans la file échoue.
    let calls = 0;
    const newId = () => (++calls === 2 ? taken : fixture.nextId());
    const before = readTreeSnapshot(db, fixture.treeId);
    const queued = listQueuedMutations(db, own(fixture));
    let caught: unknown;
    try {
      recordLocalChanges(db, {
        treeId: fixture.treeId,
        authorAccountId: fixture.reader,
        changes: [
          {
            entity: 'person',
            entityId: fixture.child,
            operation: 'update',
            fields: { notes: 'Écrite puis annulée' },
          },
        ],
        now: NOW,
        newId,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MutationBatchRefusedError);
    expect((caught as MutationBatchRefusedError).issues).toEqual([
      { code: 'duplicate_mutation', path: 'mutations' },
    ]);
    expect(readTreeSnapshot(db, fixture.treeId)).toEqual(before);
    expect(listQueuedMutations(db, own(fixture))).toEqual(queued);
    connection.close();
  });

  it('la seconde barrière arrête une copie abîmée hors de ce paquet (privacy_barrier)', async () => {
    const { db, connection, fixture } = await loaded();
    // Une cause de décès d'un autre auteur écrite directement dans la base (ancienne version).
    const fact = {
      id: fixture.nextId(),
      treeId: fixture.treeId,
      subject: { kind: 'person', personId: fixture.father },
      type: 'death_cause',
      value: 'Accident',
      authorAccountId: fixture.otherAccount,
    };
    connection.raw
      .prepare(
        'INSERT INTO facts (id, tree_id, person_id, union_id, body) VALUES (?, ?, ?, NULL, ?)',
      )
      .run(fact.id, fixture.treeId, fixture.father, JSON.stringify(fact));
    const error = refusal(db, fixture, newPerson(fixture));
    expect(error.issues).toEqual([{ code: 'privacy_barrier', path: 'facts[0]' }]);
    expect(JSON.stringify(error.issues)).not.toContain('Accident');
    connection.close();
  });

  it('une place à compléter ne devient pas connue sans nom', async () => {
    const { db, connection, fixture } = await loaded();
    expect(
      refusal(db, fixture, [
        {
          entity: 'person',
          entityId: fixture.placeholder,
          operation: 'update',
          fields: { nature: 'known' },
        },
      ]).issues,
    ).toEqual([{ code: 'person_without_name', path: 'mutations[0]' }]);
    record(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.placeholder,
        operation: 'update',
        fields: { nature: 'known' },
      },
      {
        entity: 'name',
        entityId: fixture.nextId(),
        operation: 'create',
        fields: {
          personId: fixture.placeholder,
          type: 'birth',
          givenNames: 'Biloa',
          authorAccountId: fixture.reader,
        },
      },
    ]);
    expect(readTreeSnapshot(db, fixture.treeId)?.people[3]?.nature).toBe('known');
    connection.close();
  });

  it('deux comptes sur un même téléphone : chacun sa file ; changer de lecteur vide celle de l’autre', async () => {
    const { db, connection, fixture } = await loaded();
    record(db, fixture, newPerson(fixture, 'Mvondo'));
    const other = { treeId: fixture.treeId, authorAccountId: fixture.otherAccount };
    expect(countPendingMutations(db, own(fixture))).toBe(2);
    expect(countPendingMutations(db, other)).toBe(0);
    expect(listQueuedMutations(db, other)).toEqual([]);
    expect(listQueuedBatches(db, other)).toEqual([]);

    // Le même arbre, rechargé pour l'autre compte.
    replaceTreeSnapshot(
      db,
      { ...fixture.snapshot, readerAccountId: fixture.otherAccount },
      { now: 2 },
    );
    expect(countPendingMutations(db, own(fixture))).toBe(0);
    const raw = () =>
      connection.raw
        .prepare('SELECT author_account_id AS author, body FROM mutation_queue')
        .all() as {
        author: string;
        body: string;
      }[];
    expect(raw()).toEqual([]);

    recordLocalChanges(db, {
      treeId: fixture.treeId,
      authorAccountId: fixture.otherAccount,
      changes: [
        {
          entity: 'person',
          entityId: fixture.child,
          operation: 'update',
          fields: { notes: 'Saisie du second compte' },
        },
      ],
      now: NOW,
      newId: fixture.nextId,
    });
    expect(countPendingMutations(db, other)).toBe(1);
    expect(countPendingMutations(db, own(fixture))).toBe(0);
    expect(raw().map((row) => row.author)).toEqual([fixture.otherAccount]);
    expect(raw().some((row) => row.body.includes('Mvondo'))).toBe(false);
    connection.close();
  });

  it('un autre compte n’apprend rien de la file : le contrôle d’auteur passe avant l’idempotence', async () => {
    const { db, connection, fixture } = await loaded();
    const batch = {
      id: fixture.nextId(),
      treeId: fixture.treeId,
      mutations: [
        {
          id: fixture.nextId(),
          entity: 'person',
          entityId: fixture.mother,
          operation: 'update',
          fields: { notes: 'Note du lecteur' },
          baseVersion: 1,
          createdAt: '2026-10-19T08:30:00.000Z',
        },
      ],
    };
    applyLocalMutationBatch(db, batch, { authorAccountId: fixture.reader });
    let caught: unknown;
    try {
      applyLocalMutationBatch(db, batch, { authorAccountId: fixture.otherAccount });
    } catch (error) {
      caught = error;
    }
    expect((caught as MutationBatchRefusedError).issues).toEqual([
      { code: 'foreign_author', path: 'authorAccountId' },
    ]);
    connection.close();
  });
});

describe('rang de la mutation fautive quand le même objet est modifié plus loin dans le lot', () => {
  // Contre-exemple trouvé par la CI (graine 928809746) : la mutation fautive écrit `distinctFrom`,
  // une mutation valide plus loin modifie les notes de la même fiche. Le constat désignait la
  // dernière mutation qui avait touché l'objet (rang 2) au lieu de celle qui a écrit le champ.
  it('« distincte de » vers une personne absente, puis les notes de la même fiche : rang 0', async () => {
    const { db, connection, fixture } = await loaded();
    const { issues } = refusal(db, fixture, [
      {
        entity: 'person',
        entityId: fixture.placeholder,
        operation: 'update',
        fields: { distinctFrom: [fixture.nextId()] },
      },
      {
        entity: 'person',
        entityId: fixture.nextId(),
        operation: 'create',
        fields: { nature: 'placeholder' },
      },
      {
        entity: 'person',
        entityId: fixture.placeholder,
        operation: 'update',
        fields: { notes: 'Note ajoutée hors-ligne' },
      },
    ]);
    expect(issues).toEqual([
      { code: 'dangling_reference', path: 'mutations[0].fields.distinctFrom[0]' },
    ]);
    connection.close();
  });

  it('un lien créé vers une personne absente, puis sa certitude modifiée : rang de la création', async () => {
    const { db, connection, fixture } = await loaded();
    const filiationId = fixture.nextId();
    const { issues } = refusal(db, fixture, [
      {
        entity: 'filiation',
        entityId: filiationId,
        operation: 'create',
        fields: {
          parentId: fixture.nextId(),
          childId: fixture.child,
          type: 'raised',
          certainty: 'certain',
        },
      },
      {
        entity: 'filiation',
        entityId: filiationId,
        operation: 'update',
        fields: { certainty: 'probable' },
      },
    ]);
    expect(issues).toEqual([{ code: 'dangling_reference', path: 'mutations[0].fields.parentId' }]);
    connection.close();
  });
});
