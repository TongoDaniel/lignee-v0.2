// Suppression d'une personne (T-031, ADR 0027) sur une vraie base : unions polygames, réponse de
// simultanéité, union d'origine d'une filiation, naissance multiple, « n'est pas » d'une place à
// compléter, place « À placer », faits d'union. Le lot construit par `planPersonDeletion` doit
// passer toutes les vérifications de `recordLocalChanges` et ne laisser aucune référence pendante.
import { join } from 'node:path';

import { createUuidV7Generator, factSchema, toPlaceSchema } from '@lignee/domain';
import { buildScenarioTree, scenarioTreeSchema } from '@lignee/domain/test-support';
import { afterAll, describe, expect, it } from 'vitest';

import {
  SNAPSHOT_COLLECTIONS,
  parseLocalTreeSnapshot,
  readTreeSnapshot,
  replaceTreeSnapshot,
} from '../local-db/snapshot';
import { readDeletionPlan } from '../profile/read-entry';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import { recordLocalChanges } from './local-changes';
import { listQueuedBatches } from './queue';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
const newId = createUuidV7Generator();

function fixture() {
  const built = buildScenarioTree(
    scenarioTreeSchema.parse({
      personnes: ['a/M', 'b/F', 'c/F', 'd/M', 'e/F', 'f/M', 'g/M', 'h/F', 'ph/F'],
      a_completer: ['ph'],
      distinctes: [{ place: 'ph', de: ['a', 'b'] }],
      unions: [{ conjoints: ['a', 'b'] }, { conjoints: ['a', 'c'] }],
      simultaneites: [
        {
          unions: [
            ['a', 'b'],
            ['a', 'c'],
          ],
          reponse: 'simultanees',
        },
      ],
      filiations: [
        { parents: ['a', 'b'], enfant: 'd' },
        { parents: ['a', 'c'], enfant: 'e' },
      ],
      candidats: [{ enfant: 'h', candidates: ['a', 'b'] }],
      naissances_multiples: [{ enfants: ['a', 'f', 'g'] }, { enfants: ['e', 'h'] }],
      titres: [{ personne: 'a', libelle: 'Chef' }],
      faits: [{ personne: 'a', type: 'naissance', date: { qualificatif: 'exacte', date: '1950' } }],
    }),
  );
  const { data, context } = built;
  const [unionAB, unionAC] = data.unions;
  if (unionAB === undefined || unionAC === undefined) throw new Error('unions');
  // La filiation (b, d) vient de l'union (a, b) ; un fait cite l'union ; une place « À placer ».
  data.filiations = data.filiations.map((link) =>
    link.parentId === built.id('b') && link.childId === built.id('d')
      ? { ...link, originUnionId: unionAB.id }
      : link,
  );
  data.facts.push(
    factSchema.parse({
      id: newId(),
      treeId: data.tree.id,
      subject: { kind: 'union', unionId: unionAC.id },
      type: 'other',
      value: 'Mariage',
      authorAccountId: context.authorAccountId,
    }),
  );
  data.toPlace.push(
    toPlaceSchema.parse({
      id: newId(),
      treeId: data.tree.id,
      personId: built.id('ph'),
      referencePersonId: built.id('a'),
      path: ['parent'],
    }),
  );
  const objects = Object.fromEntries(
    ['tree', ...SNAPSHOT_COLLECTIONS].map((key) => [key, data[key as keyof typeof data]]),
  );
  const snapshot = parseLocalTreeSnapshot({ readerAccountId: context.authorAccountId, ...objects });
  return { built, snapshot };
}

describe('suppression sur une vraie base (ADR 0027)', () => {
  it('un seul lot supprime la fiche et tout ce qui la cite, et corrige ce qui cite aussi les autres', async () => {
    const { built, snapshot } = fixture();
    const opened = await openTestDatabase(join(tmp.dir, 'deletion.db'));
    try {
      const { db } = opened;
      replaceTreeSnapshot(db, snapshot, { now: 1 });
      const read = readDeletionPlan(db, built.id('a'));
      if (read === undefined) throw new Error('missing');
      expect(read.plan.summary).toEqual({ names: 1, facts: 2, titles: 1, links: 3, unions: 2 });

      const scope = { treeId: snapshot.tree.id, authorAccountId: snapshot.readerAccountId };
      recordLocalChanges(db, { ...scope, changes: read.plan.changes, now: 2, newId });
      const batches = listQueuedBatches(db, scope);
      expect(batches).toHaveLength(1);
      expect(batches[0]?.entries).toHaveLength(read.plan.changes.length);

      const after = readTreeSnapshot(db, snapshot.tree.id);
      if (after === undefined) throw new Error('tree lost');
      const a = built.id('a');
      expect(after.people.map((person) => person.id)).not.toContain(a);
      expect(after.people).toHaveLength(snapshot.people.length - 1);
      expect(after.unions).toEqual([]);
      expect(after.simultaneityAnswers).toEqual([]);
      expect(after.toPlace).toEqual([]);
      expect(after.titleRoles).toEqual([]);
      expect(after.parentCandidates.filter((entry) => entry.candidateId === a)).toEqual([]);
      expect(after.facts).toEqual([]);
      // Les liens des autres restent, sans l'union d'origine supprimée.
      expect(after.filiations.map((link) => [link.parentId, link.childId])).toEqual([
        [built.id('b'), built.id('d')],
        [built.id('c'), built.id('e')],
      ]);
      expect(after.filiations.every((link) => link.originUnionId === undefined)).toBe(true);
      // Triplés devenus jumeaux ; l'autre naissance multiple n'a pas bougé.
      expect(after.multipleBirths.map((birth) => birth.members.map((m) => m.personId))).toEqual([
        [built.id('f'), built.id('g')],
        [built.id('e'), built.id('h')],
      ]);
      // « N'est pas » : la mention de la personne supprimée disparaît, l'autre reste.
      const placeholder = after.people.find((person) => person.id === built.id('ph'));
      expect(placeholder?.distinctFrom).toEqual([built.id('b')]);
      // Rien des autres personnes n'a été supprimé.
      expect(after.names.map((name) => name.personId)).not.toContain(a);
      expect(after.names).toHaveLength(snapshot.names.length - 1);
    } finally {
      opened.connection.close();
    }
  }, 30_000);

  it('une personne sans filiation, union ni fait : la fiche et son nom seulement', async () => {
    const { built, snapshot } = fixture();
    const opened = await openTestDatabase(join(tmp.dir, 'deletion-leaf.db'));
    try {
      const { db } = opened;
      replaceTreeSnapshot(db, snapshot, { now: 1 });
      const read = readDeletionPlan(db, built.id('g'));
      if (read === undefined) throw new Error('missing');
      expect(read.plan.summary).toEqual({ names: 1, facts: 0, titles: 0, links: 0, unions: 0 });
      const scope = { treeId: snapshot.tree.id, authorAccountId: snapshot.readerAccountId };
      recordLocalChanges(db, { ...scope, changes: read.plan.changes, now: 2, newId });
      const after = readTreeSnapshot(db, snapshot.tree.id);
      expect(after?.people.map((person) => person.id)).not.toContain(built.id('g'));
      // Les triplés n'ont plus que deux membres : la naissance multiple reste, avec f et a.
      expect(after?.multipleBirths[0]?.members.map((m) => m.personId)).toEqual([
        built.id('a'),
        built.id('f'),
      ]);
    } finally {
      opened.connection.close();
    }
  }, 30_000);
});
