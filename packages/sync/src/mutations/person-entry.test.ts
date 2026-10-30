// Saisie à la main d'une personne (T-031 du plan V1) : enregistrement, refus affichés sur le bon
// champ, modification, suppression avec ses dépendants en un seul lot, lieux réutilisés. Noms
// générés, aucune donnée réelle.
import { join } from 'node:path';

import {
  createUuidV7Generator,
  emptyDateDraft,
  emptyFactDraft,
  emptyNameDraft,
  emptyPersonDraft,
  entryFieldForIssue,
  planPersonChanges,
  type PersonDraft,
} from '@lignee/domain';
import { afterAll, describe, expect, it } from 'vitest';

import { readTreeSnapshot, replaceTreeSnapshot } from '../local-db/snapshot';
import { readDeletionPlan, readPersonDraft } from '../profile/read-entry';
import { smallTree } from '../test-support/mutation-fixtures';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import {
  InvalidMutationBatchError,
  MutationBatchRefusedError,
  previewCoherence,
  recordLocalChanges,
} from './local-changes';
import { listQueuedBatches, listQueuedMutations } from './queue';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;
const NOW = Date.UTC(2026, 9, 29, 9, 0);
const newId = createUuidV7Generator();

async function loaded() {
  const fixture = smallTree();
  counter += 1;
  const opened = await openTestDatabase(join(tmp.dir, `person-entry-${String(counter)}.db`));
  replaceTreeSnapshot(opened.db, fixture.snapshot, { now: 1 });
  const scope = { treeId: fixture.treeId, authorAccountId: fixture.reader };
  return { ...opened, fixture, scope };
}

function named(givenNames: string, surname = ''): PersonDraft {
  return {
    ...emptyPersonDraft(),
    names: [{ ...emptyNameDraft('birth'), givenNames, surname }],
  };
}

describe('refus de l’enregistrement affichés sur le bon champ', () => {
  it('un nom manquant (UNI-01) : la fiche seule n’est pas enregistrée, le constat désigne le nom', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      // Le formulaire l'empêche avant ; on contourne sa validation pour voir la seconde barrière.
      const draft: PersonDraft = {
        ...emptyPersonDraft(),
        names: [{ ...emptyNameDraft('former'), givenNames: 'Jo' }],
      };
      const plan = planPersonChanges({
        draft,
        personId: newId(),
        authorAccountId: fixture.reader,
        places: [],
        newId,
      });
      let caught: unknown;
      try {
        recordLocalChanges(db, { ...scope, changes: plan.changes, now: NOW, newId });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(MutationBatchRefusedError);
      const issues = (caught as MutationBatchRefusedError).issues;
      expect(issues.map((issue) => issue.code)).toEqual(['person_without_name']);
      expect(entryFieldForIssue(plan, issues[0] as never)).toBe('names.0.givenNames');
      // Rien n'est resté : ni arbre, ni file.
      expect(readTreeSnapshot(db, fixture.treeId)?.people).toHaveLength(4);
      expect(listQueuedMutations(db, scope)).toEqual([]);
    } finally {
      connection.close();
    }
  });

  it('un champ du modèle refusé : le chemin désigne le champ de l’écran, sans valeur', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      const draft: PersonDraft = {
        ...named('Awa'),
        // Une profession sans texte : le formulaire la signale, le modèle la refuserait aussi.
        occupations: [{ ...emptyFactDraft(), place: 'Douala' }],
      };
      const plan = planPersonChanges({
        draft,
        personId: newId(),
        authorAccountId: fixture.reader,
        places: [],
        newId,
      });
      let caught: unknown;
      try {
        recordLocalChanges(db, { ...scope, changes: plan.changes, now: NOW, newId });
      } catch (error) {
        caught = error;
      }
      const paths =
        caught instanceof InvalidMutationBatchError
          ? caught.paths
          : caught instanceof MutationBatchRefusedError
            ? caught.issues.map((issue) => issue.path)
            : [];
      expect(paths.length).toBeGreaterThan(0);
      expect(
        paths.map((path) => entryFieldForIssue(plan, { code: 'invalid_object', path })),
      ).toEqual(['occupations.0.value']);
      expect(String(caught)).not.toContain('Douala');
    } finally {
      connection.close();
    }
  });
});

describe('modification d’une fiche existante', () => {
  it('ne met dans la file que le champ changé, sur la version connue', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      const read = readPersonDraft(db, fixture.father);
      if (read === undefined) throw new Error('missing');
      const [first] = read.draft.names;
      if (first === undefined) throw new Error('missing name');
      const draft: PersonDraft = {
        ...read.draft,
        gender: 'male',
        notes: 'Tailleur à Bafoussam',
        names: [{ ...first, givenNames: 'Abessolo-Paul' }],
      };
      const plan = planPersonChanges({
        draft,
        original: read.draft,
        personId: fixture.father,
        authorAccountId: read.context.accountId,
        places: read.context.places,
        newId,
      });
      recordLocalChanges(db, { ...scope, changes: plan.changes, now: NOW, newId });
      const queued = listQueuedMutations(db, scope).map((entry) => entry.mutation);
      expect(
        queued.map((mutation) => [mutation.entity, mutation.operation, mutation.fields]),
      ).toEqual([
        ['person', 'update', { notes: 'Tailleur à Bafoussam' }],
        ['name', 'update', { givenNames: 'Abessolo-Paul' }],
      ]);
      expect(queued[0]?.baseVersion).toBe(4);
      expect(queued[1]?.baseVersion).toBeNull();
    } finally {
      connection.close();
    }
  });

  it('un lieu déjà dans l’arbre est réutilisé, quelle que soit la casse (CAR-01)', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      const withBirthPlace = (place: string): PersonDraft => ({
        ...named('Ines'),
        birth: { date: emptyDateDraft(), place },
      });
      for (const place of ['Bafoussam', ' bafoussam ', 'BAFOUSSAM']) {
        const places = readTreeSnapshot(db, fixture.treeId)?.places ?? [];
        const plan = planPersonChanges({
          draft: withBirthPlace(place),
          personId: newId(),
          authorAccountId: fixture.reader,
          places,
          newId,
        });
        recordLocalChanges(db, { ...scope, changes: plan.changes, now: NOW, newId });
      }
      const after = readTreeSnapshot(db, fixture.treeId);
      expect(after?.places.map((entry) => entry.name)).toEqual(['Bafoussam']);
      const placeIds = new Set(after?.facts.map((fact) => fact.placeId));
      expect(placeIds.size).toBe(1);
    } finally {
      connection.close();
    }
  });
});

describe('suppression d’une personne (ADR 0027)', () => {
  it('un seul lot : la fiche et tout ce qui la cite, sans toucher aux autres', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      const read = readDeletionPlan(db, fixture.father);
      if (read === undefined) throw new Error('missing');
      // Un nom, une union, un lien de filiation (avec l'enfant), plus la fiche.
      expect(read.plan.summary).toEqual({ names: 1, facts: 0, titles: 0, links: 1, unions: 1 });
      const batchesBefore = listQueuedBatches(db, scope).length;
      recordLocalChanges(db, { ...scope, changes: read.plan.changes, now: NOW, newId });
      const batches = listQueuedBatches(db, scope);
      expect(batches).toHaveLength(batchesBefore + 1);
      expect(batches.at(-1)?.entries).toHaveLength(read.plan.changes.length);
      const after = readTreeSnapshot(db, fixture.treeId);
      expect(after?.people.map((person) => person.id)).not.toContain(fixture.father);
      expect(after?.unions).toEqual([]);
      expect(after?.names.map((name) => name.personId)).not.toContain(fixture.father);
      // La mère, l'enfant et leur lien restent.
      expect(after?.people.map((person) => person.id)).toEqual(
        expect.arrayContaining([fixture.mother, fixture.child]),
      );
      expect(after?.filiations.map((link) => link.parentId)).toEqual([fixture.mother]);
    } finally {
      connection.close();
    }
  });

  it('sans ses dépendants, la suppression seule est refusée et rien ne bouge', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      const before = readTreeSnapshot(db, fixture.treeId);
      expect(() =>
        recordLocalChanges(db, {
          ...scope,
          changes: [{ entity: 'person', entityId: fixture.father, operation: 'delete' }],
          now: NOW,
          newId,
        }),
      ).toThrow(MutationBatchRefusedError);
      expect(readTreeSnapshot(db, fixture.treeId)).toEqual(before);
      expect(listQueuedMutations(db, scope)).toEqual([]);
    } finally {
      connection.close();
    }
  });
});

describe('alertes de cohérence avant d’écrire (UNI-18)', () => {
  it('un décès avant la naissance est signalé sans rien écrire, et passe outre à l’enregistrement', async () => {
    const { db, connection, fixture, scope } = await loaded();
    try {
      const year = (value: string) => ({ year: value, month: '', day: '' });
      const draft: PersonDraft = {
        ...named('Awa'),
        vitalStatus: 'deceased',
        birth: { date: { ...emptyDateDraft(), mode: 'exact', from: year('1990') }, place: '' },
        death: { date: { ...emptyDateDraft(), mode: 'exact', from: year('1980') }, place: '' },
      };
      const personId = newId();
      const plan = planPersonChanges({
        draft,
        personId,
        authorAccountId: fixture.reader,
        places: [],
        newId,
      });
      const input = { ...scope, changes: plan.changes, now: NOW, newId };
      const alerts = previewCoherence(db, {
        ...input,
        personId,
        today: { year: 2026, month: 10, day: 29 },
      });
      expect(alerts.map((alert) => alert.code)).toEqual(['death_before_birth']);
      expect(alerts.every((alert) => alert.severity === 'warning')).toBe(true);
      expect(listQueuedMutations(db, scope)).toEqual([]);
      // Une alerte ne bloque pas : la personne peut passer outre.
      expect(recordLocalChanges(db, input).status).toBe('recorded');
    } finally {
      connection.close();
    }
  });
});
