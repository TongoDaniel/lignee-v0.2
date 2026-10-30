// Saisie à la main d'une personne (T-031 du plan V1) : les formulaires des cas limites CL-POL-15,
// CL-DON-01, CL-DON-02, CL-FAM-12, CL-FAM-17, CL-FAM-18 et CL-FAM-19 sont enregistrés pour de
// bon par `recordLocalChanges` (base chiffrée sur le poste, file comprise), puis relus.
import { join } from 'node:path';

import {
  buildProfile,
  createUuidV7Generator,
  fuzzyDateSchema,
  planPersonChanges,
  validatePersonDraft,
  type FuzzyDate,
  type Id,
  type Name,
} from '@lignee/domain';
import {
  buildScenarioTree,
  entryScenarioSchema,
  fuzzyDateInputFromScenario,
  loadScenario,
  personDraftFromEntry,
  requireScenarioParts,
  scenarioNameTypes,
  scenarioSchema,
  scenarioTreeSchema,
  type EntryResult,
} from '@lignee/domain/test-support';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  parseLocalTreeSnapshot,
  SNAPSHOT_COLLECTIONS,
  readTreeSnapshot,
  replaceTreeSnapshot,
  type LocalTreeSnapshot,
} from '../local-db/snapshot';
import { previewCoherence, recordLocalChanges } from '../mutations/local-changes';
import { listQueuedBatches } from '../mutations/queue';
import { smallTree } from '../test-support/mutation-fixtures';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;
const NOW = Date.UTC(2026, 9, 29, 9, 0);
const TODAY = { year: 2026, month: 10, day: 29 };
const newId = createUuidV7Generator();

const expectedDate = (line: Parameters<typeof fuzzyDateInputFromScenario>[0]): FuzzyDate =>
  fuzzyDateSchema.parse(fuzzyDateInputFromScenario(line));

/** La base du scénario : son arbre s'il en a un, sinon le petit arbre des tests de mutations. */
async function openWith(snapshot: LocalTreeSnapshot) {
  counter += 1;
  const opened = await openTestDatabase(join(tmp.dir, `entry-${String(counter)}.db`));
  replaceTreeSnapshot(opened.db, snapshot, { now: 1 });
  return opened;
}

function scenarioSnapshot(
  arbre: z.infer<typeof scenarioTreeSchema> | undefined,
): LocalTreeSnapshot {
  if (arbre === undefined) return smallTree().snapshot;
  const built = buildScenarioTree(arbre);
  // L'instantané du lecteur ne porte aucune règle de visibilité (ADR 0023).
  const objects = Object.fromEntries(
    ['tree', ...SNAPSHOT_COLLECTIONS].map((key) => [
      key,
      built.data[key as keyof typeof built.data],
    ]),
  );
  return parseLocalTreeSnapshot({ readerAccountId: built.context.authorAccountId, ...objects });
}

/** Ce que la copie locale garde d'une personne, dans les mots du scénario. */
function stored(snapshot: LocalTreeSnapshot, personId: Id) {
  const person = snapshot.people.find((candidate) => candidate.id === personId);
  if (person === undefined) throw new Error('person not recorded');
  const fact = (type: string) =>
    snapshot.facts.find(
      (entry) =>
        entry.type === type &&
        entry.subject.kind === 'person' &&
        entry.subject.personId === personId,
    );
  const placeOf = (placeId: Id | undefined) =>
    snapshot.places.find((place) => place.id === placeId)?.name;
  const event = (type: string) => {
    const entry = fact(type);
    if (entry === undefined) return undefined;
    return { date: entry.date, place: placeOf(entry.placeId) };
  };
  const nameKey = (name: Name) =>
    (Object.keys(scenarioNameTypes) as (keyof typeof scenarioNameTypes)[]).find(
      (key) => scenarioNameTypes[key] === name.type,
    );
  return {
    person,
    names: snapshot.names
      .filter((name) => name.personId === personId)
      .map((name) => ({
        type: nameKey(name),
        prenoms: name.givenNames,
        nom: name.surname,
        forme: name.displayForm,
        debut: name.start,
        fin: name.end,
      })),
    titles: snapshot.titleRoles
      .filter((title) => title.personId === personId)
      .map((title) => ({ libelle: title.label, debut: title.start, fin: title.end })),
    birth: event('birth'),
    death: event('death'),
    cause: fact('death_cause'),
  };
}

/** Ne garde que les clés présentes, pour comparer à une ligne de scénario. */
const defined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;

function expectedNames(result: EntryResult) {
  return (result.noms ?? []).map((name) =>
    defined({
      type: name.type,
      prenoms: name.prenoms,
      nom: name.nom,
      forme: name.forme,
      debut: name.debut === undefined ? undefined : expectedDate(name.debut),
      fin: name.fin === undefined ? undefined : expectedDate(name.fin),
    }),
  );
}

const IDS = [
  'CL-POL-15',
  'CL-DON-01',
  'CL-DON-02',
  'CL-FAM-12',
  'CL-FAM-17',
  'CL-FAM-18',
  'CL-FAM-19',
] as const;

describe.each(IDS)('%s — saisie à la main', (id) => {
  const schema = scenarioSchema(id, {
    arbre: scenarioTreeSchema.optional(),
    attendu: z.looseObject({ saisie: entryScenarioSchema }),
  }).superRefine(requireScenarioParts('saisie', ['fiche']));

  it('saisie : chaque formulaire est enregistré, en un lot, et relu tel que le scénario l’attend', async () => {
    const scenario = loadScenario(id, schema);
    const { personnes = [] } = scenario.attendu.saisie;
    expect(personnes.length).toBeGreaterThan(0);
    const snapshot = scenarioSnapshot(scenario.arbre);
    const { db, connection } = await openWith(snapshot);
    try {
      const reader = snapshot.readerAccountId;
      const namesBefore = snapshot.names.map((name) => name.id).sort();

      for (const { formulaire, resultat } of personnes) {
        const draft = personDraftFromEntry(formulaire);
        expect(validatePersonDraft(draft)).toEqual([]);
        const personId = newId();
        const plan = planPersonChanges({
          draft,
          personId,
          authorAccountId: reader,
          places: readTreeSnapshot(db, snapshot.tree.id)?.places ?? [],
          newId,
        });
        const input = {
          treeId: snapshot.tree.id,
          authorAccountId: reader,
          changes: plan.changes,
          now: NOW,
          newId,
        };
        if (resultat.alertes !== undefined) {
          const alerts = previewCoherence(db, { ...input, personId, today: TODAY });
          expect(alerts.map((alert) => alert.code)).toEqual(resultat.alertes);
        }
        const batchesBefore = listQueuedBatches(db, {
          treeId: snapshot.tree.id,
          authorAccountId: reader,
        }).length;
        expect(recordLocalChanges(db, input).status).toBe('recorded');
        // Une saisie : un lot dans la file, quelle que soit sa taille.
        const batches = listQueuedBatches(db, {
          treeId: snapshot.tree.id,
          authorAccountId: reader,
        });
        expect(batches).toHaveLength(batchesBefore + 1);
        expect(batches.at(-1)?.entries).toHaveLength(plan.changes.length);

        const after = readTreeSnapshot(db, snapshot.tree.id);
        if (after === undefined) throw new Error('tree lost');
        const result = stored(after, personId);
        expect(result.person.nature).toBe(resultat.nature === 'connue' ? 'known' : 'placeholder');
        expect(result.names.map(defined)).toEqual(expectedNames(resultat));
        if (resultat.titres !== undefined) {
          expect(result.titles.map(defined)).toEqual(
            resultat.titres.map((title) =>
              defined({
                libelle: title.libelle,
                debut: title.debut === undefined ? undefined : expectedDate(title.debut),
                fin: title.fin === undefined ? undefined : expectedDate(title.fin),
              }),
            ),
          );
        }
        for (const key of ['naissance', 'deces'] as const) {
          const wanted = resultat[key];
          if (wanted === undefined) continue;
          const actual = key === 'naissance' ? result.birth : result.death;
          expect(actual?.date).toEqual(
            wanted.date === undefined ? undefined : expectedDate(wanted.date),
          );
          expect(actual?.place).toBe(wanted.lieu);
        }
        if (resultat.statut !== undefined) {
          const status = { vivante: 'living', decedee: 'deceased', inconnu: 'unknown' } as const;
          expect(result.person.vitalStatus).toBe(status[resultat.statut]);
        }
        if (resultat.cause_de_deces !== undefined) {
          // UNI-15 : un fait du rédacteur seul, et la fiche ne l'affiche jamais.
          expect(result.cause?.value).toBe(resultat.cause_de_deces);
          expect(result.cause?.authorAccountId).toBe(reader);
          const profile = buildProfile(after, personId, {
            viewer: { accountId: reader },
            today: TODAY,
          });
          expect(JSON.stringify(profile)).not.toContain(resultat.cause_de_deces);
        }
      }

      // CL-POL-15 : rien n'est recopié d'un parent ; les noms déjà là n'ont pas bougé.
      const final = readTreeSnapshot(db, snapshot.tree.id);
      const previous = new Set(namesBefore);
      const untouched = final?.names.filter((name) => previous.has(name.id)) ?? [];
      expect(untouched.map((name) => name.id).sort()).toEqual(namesBefore);
      expect(untouched).toEqual(snapshot.names.filter((name) => previous.has(name.id)));
    } finally {
      connection.close();
    }
  }, 30_000);
});
