// Application pure d'un lot (ADR 0027) : point d'extension de la visibilité du rédacteur
// (ADR 0017), et propriétés sur des arbres générés : appliquer un lot puis relire donne l'état
// attendu ; un lot invalide laisse la base inchangée.
import { join } from 'node:path';

import { mutationBatchSchema, type Id } from '@lignee/domain';
import { deterministicIds } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';

import { eraseLocalTree, readTreeSnapshot, replaceTreeSnapshot } from '../local-db/snapshot';
import { generatedSnapshot } from '../test-support/generated-snapshot';
import { smallTree } from '../test-support/mutation-fixtures';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import { applyMutationBatch, treeObjectsOf } from './apply';
import { recordLocalChanges, type LocalChange } from './local-changes';
import { countPendingMutations, listQueuedMutations } from './queue';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;
const nextPath = () => join(tmp.dir, `apply-${String(++counter)}.db`);
const createdAt = '2026-10-19T08:30:00.000Z';

describe('visibilité du rédacteur (point d’extension, ADR 0017)', () => {
  const fixture = smallTree();
  const tree = treeObjectsOf(fixture.snapshot);
  const distinctFrom = (target: Id) =>
    mutationBatchSchema.parse({
      id: fixture.nextId(),
      treeId: fixture.treeId,
      mutations: [
        {
          id: fixture.nextId(),
          entity: 'person',
          entityId: fixture.placeholder,
          operation: 'update',
          fields: { distinctFrom: [target] },
          baseVersion: 0,
          createdAt,
        },
      ],
    });

  it('une personne masquée au rédacteur reçoit la même réponse qu’une personne inexistante', () => {
    const hidden = applyMutationBatch(tree, distinctFrom(fixture.child), {
      authorAccountId: fixture.reader,
      canWriterSee: (object) => object.id !== fixture.child,
    });
    const absent = applyMutationBatch(tree, distinctFrom(fixture.nextId()), {
      authorAccountId: fixture.reader,
    });
    expect(hidden.ok).toBe(false);
    expect(hidden).toEqual(absent);
    expect(hidden).toEqual({
      ok: false,
      issues: [{ code: 'dangling_reference', path: 'mutations[0].fields.distinctFrom[0]' }],
    });
  });

  it('une personne visible est acceptée ; l’arbre reçu n’est pas modifié', () => {
    const before = structuredClone(tree);
    const result = applyMutationBatch(tree, distinctFrom(fixture.child), {
      authorAccountId: fixture.reader,
    });
    expect(result.ok).toBe(true);
    expect(tree).toEqual(before);
  });

  it('modifier un objet masqué au rédacteur : refusé comme inexistant', () => {
    const result = applyMutationBatch(tree, distinctFrom(fixture.child), {
      authorAccountId: fixture.reader,
      canWriterSee: (object) => object.id !== fixture.placeholder,
    });
    expect(result).toEqual({
      ok: false,
      issues: [{ code: 'unknown_object', path: 'mutations[0].entityId' }],
    });
  });
});

/** Une saisie valide tirée au hasard, et son effet attendu, calculé à part. */
type Edit =
  | { kind: 'person'; givenNames: string }
  | { kind: 'notes'; at: number; notes: string }
  | { kind: 'union'; a: number; b: number };

const editArbitrary: fc.Arbitrary<Edit> = fc.oneof(
  fc.record({
    kind: fc.constant('person' as const),
    givenNames: fc.constantFrom('Ateba', 'Mbarga', 'Ngono', 'Fouda'),
  }),
  fc.record({
    kind: fc.constant('notes' as const),
    at: fc.nat(),
    notes: fc.constantFrom('Cultivateur', 'Vit à Ebolowa', 'Chef de quartier'),
  }),
  fc.record({ kind: fc.constant('union' as const), a: fc.nat(), b: fc.nat() }),
);

describe('propriétés sur des arbres générés', () => {
  it('appliquer un lot puis relire donne l’état attendu, et la file a une mutation par changement', async () => {
    const { db, connection } = await openTestDatabase(nextPath());
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 2, max: 40 }),
        fc.array(editArbitrary, { minLength: 1, maxLength: 8 }),
        (seed, size, edits) => {
          const { snapshot } = generatedSnapshot(seed, size);
          replaceTreeSnapshot(db, snapshot, { now: 1 });
          const ids = deterministicIds(1_900_000_000_000 + Math.abs(seed % 1000) * 1000);
          const expected = structuredClone(snapshot);
          const changes: LocalChange[] = [];
          for (const edit of edits) {
            if (edit.kind === 'person') {
              const personId = ids();
              const nameId = ids();
              changes.push(
                {
                  entity: 'person',
                  entityId: personId,
                  operation: 'create',
                  fields: { nature: 'known' },
                },
                {
                  entity: 'name',
                  entityId: nameId,
                  operation: 'create',
                  fields: {
                    personId,
                    type: 'birth',
                    givenNames: edit.givenNames,
                    authorAccountId: snapshot.readerAccountId,
                  },
                },
              );
              expected.people.push({
                id: personId,
                treeId: snapshot.tree.id,
                nature: 'known',
                gender: 'unspecified',
                vitalStatus: 'unknown',
                version: 0,
              });
              expected.names.push({
                id: nameId,
                treeId: snapshot.tree.id,
                personId,
                type: 'birth',
                givenNames: edit.givenNames,
                authorAccountId: snapshot.readerAccountId,
              });
            } else if (edit.kind === 'notes') {
              const person = expected.people[edit.at % expected.people.length];
              if (person === undefined || person.notes === edit.notes) continue;
              changes.push({
                entity: 'person',
                entityId: person.id,
                operation: 'update',
                fields: { notes: edit.notes },
              });
              person.notes = edit.notes;
            } else {
              const a = expected.people[edit.a % expected.people.length];
              const b = expected.people[edit.b % expected.people.length];
              if (a === undefined || b === undefined || a.id === b.id) continue;
              const unionId = ids();
              const spouses: [{ personId: Id; rank: number }, { personId: Id; rank: number }] = [
                { personId: a.id, rank: 1 },
                { personId: b.id, rank: 1 },
              ];
              changes.push({
                entity: 'union',
                entityId: unionId,
                operation: 'create',
                fields: { spouses },
              });
              expected.unions.push({
                id: unionId,
                treeId: snapshot.tree.id,
                spouses,
                type: 'unspecified',
              });
            }
          }
          fc.pre(changes.length > 0);
          const outcome = recordLocalChanges(db, {
            treeId: snapshot.tree.id,
            authorAccountId: snapshot.readerAccountId,
            changes,
            now: Date.UTC(2026, 9, 19),
            newId: ids,
          });
          expect(outcome).toMatchObject({ status: 'recorded', mutationCount: changes.length });
          expect(readTreeSnapshot(db, snapshot.tree.id)).toEqual(expected);
          expect(countPendingMutations(db, snapshot.tree.id)).toBe(changes.length);
          eraseLocalTree(db, snapshot.tree.id);
        },
      ),
      { numRuns: 25 },
    );
    connection.close();
  }, 60_000);

  it('un lot qui contient une mutation invalide laisse la base et la file inchangées', async () => {
    const { db, connection } = await openTestDatabase(nextPath());
    const invalidKinds = ['dangling', 'unknown', 'distinct', 'cycle', 'author'] as const;
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 3, max: 40 }),
        fc.constantFrom(...invalidKinds),
        fc.nat({ max: 3 }),
        (seed, size, kind, position) => {
          const { snapshot } = generatedSnapshot(seed, size);
          replaceTreeSnapshot(db, snapshot, { now: 1 });
          const ids = deterministicIds(2_000_000_000_000 + Math.abs(seed % 1000) * 1000);
          const reader = snapshot.readerAccountId;
          const someone = snapshot.people[0];
          fc.pre(someone !== undefined);
          const placeholder = snapshot.people.find((person) => person.nature === 'placeholder');
          const filiation = snapshot.filiations[0];
          let invalid: LocalChange;
          switch (kind) {
            case 'dangling':
              invalid = {
                entity: 'filiation',
                entityId: ids(),
                operation: 'create',
                fields: {
                  parentId: ids(),
                  childId: someone.id,
                  type: 'raised',
                  certainty: 'certain',
                },
              };
              break;
            case 'unknown':
              invalid = {
                entity: 'person',
                entityId: ids(),
                operation: 'update',
                fields: { notes: 'Inconnue' },
              };
              break;
            case 'distinct':
              fc.pre(placeholder !== undefined);
              invalid = {
                entity: 'person',
                entityId: placeholder.id,
                operation: 'update',
                fields: { distinctFrom: [ids()] },
              };
              break;
            case 'cycle':
              fc.pre(filiation !== undefined);
              invalid = {
                entity: 'filiation',
                entityId: ids(),
                operation: 'create',
                fields: {
                  parentId: filiation.childId,
                  childId: filiation.parentId,
                  type: 'raised',
                  certainty: 'certain',
                },
              };
              break;
            case 'author':
              invalid = {
                entity: 'fact',
                entityId: ids(),
                operation: 'create',
                fields: {
                  subject: { kind: 'person', personId: someone.id },
                  type: 'occupation',
                  value: 'Forgeron',
                  authorAccountId: ids(),
                },
              };
              break;
          }
          const personId = ids();
          const valid: LocalChange[] = [
            {
              entity: 'person',
              entityId: personId,
              operation: 'create',
              fields: { nature: 'placeholder' },
            },
            {
              entity: 'person',
              entityId: someone.id,
              operation: 'update',
              fields: { notes: 'Note ajoutée hors-ligne' },
            },
          ];
          const changes = [...valid];
          changes.splice(Math.min(position, changes.length), 0, invalid);
          const before = readTreeSnapshot(db, snapshot.tree.id);
          const queued = listQueuedMutations(db, snapshot.tree.id);
          expect(() =>
            recordLocalChanges(db, {
              treeId: snapshot.tree.id,
              authorAccountId: reader,
              changes,
              now: Date.UTC(2026, 9, 19),
              newId: ids,
            }),
          ).toThrow();
          expect(readTreeSnapshot(db, snapshot.tree.id)).toEqual(before);
          expect(listQueuedMutations(db, snapshot.tree.id)).toEqual(queued);
          eraseLocalTree(db, snapshot.tree.id);
        },
      ),
      { numRuns: 40 },
    );
    connection.close();
  }, 60_000);
});
