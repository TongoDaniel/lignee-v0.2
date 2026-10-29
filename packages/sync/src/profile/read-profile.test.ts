// La fiche ne lit que la copie locale filtrée du lecteur (T-024 du plan V1) : arbre généré écrit
// dans une base chiffrée, puis relu par `readProfile`.
import { join } from 'node:path';

import { buildProfile, factSchema, nameSchema, type Id } from '@lignee/domain';
import { deterministicIds } from '@lignee/domain/test-support';
import { afterAll, describe, expect, it } from 'vitest';

import {
  replaceTreeSnapshot,
  type LocalDatabase,
  type LocalTreeSnapshot,
} from '../local-db/snapshot';
import { generatedSnapshot } from '../test-support/generated-snapshot';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import { readProfile } from './read-profile';

const TODAY = { year: 2026, month: 10, day: 25 };
const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;
const nextPath = () => join(tmp.dir, `profile-${String(++counter)}.db`);
const nextId = deterministicIds(1_800_000_000_000);

/** Base ouverte pour le temps d'un test, fermée ensuite (Windows ne supprime pas un fichier ouvert). */
async function withDatabase(run: (db: LocalDatabase) => void): Promise<void> {
  const { db, connection } = await openTestDatabase(nextPath());
  try {
    run(db);
  } finally {
    connection.close();
  }
}

const SECRET_CAUSE = 'cause-générée-secrète';
const FORMER_NAME = 'Ancienprénomgénéré';

/** Instantané généré, plus une cause de décès et un ancien prénom saisis par le lecteur. */
function snapshotWithSecrets(): { snapshot: LocalTreeSnapshot; personId: Id } {
  const { snapshot } = generatedSnapshot(24, 40);
  const person = snapshot.people.find((candidate) => candidate.nature === 'known');
  if (person === undefined) throw new Error('Generated tree without a known person');
  const cause = factSchema.parse({
    id: nextId(),
    treeId: snapshot.tree.id,
    subject: { kind: 'person', personId: person.id },
    type: 'death_cause',
    value: SECRET_CAUSE,
    authorAccountId: snapshot.readerAccountId,
  });
  const former = nameSchema.parse({
    id: nextId(),
    treeId: snapshot.tree.id,
    personId: person.id,
    type: 'former',
    givenNames: FORMER_NAME,
    authorAccountId: snapshot.readerAccountId,
  });
  return {
    snapshot: {
      ...snapshot,
      facts: [...snapshot.facts, cause],
      names: [...snapshot.names, former],
    },
    personId: person.id,
  };
}

describe('readProfile', { timeout: 30_000 }, () => {
  it('relit la fiche dans la base locale chiffrée, avec le nom de l’arbre', async () => {
    const { snapshot, personId } = snapshotWithSecrets();
    await withDatabase((db) => {
      replaceTreeSnapshot(db, snapshot, { now: 1 });
      const result = readProfile(db, personId, { today: TODAY });
      expect(result?.treeName).toBe(snapshot.tree.name);
      expect(result?.profile).toEqual(
        buildProfile(snapshot, personId, {
          viewer: { accountId: snapshot.readerAccountId },
          today: TODAY,
        }),
      );
    });
  });

  it('montre au lecteur l’ancien prénom qu’il a saisi, jamais la cause de décès', async () => {
    const { snapshot, personId } = snapshotWithSecrets();
    await withDatabase((db) => {
      replaceTreeSnapshot(db, snapshot, { now: 1 });
      const result = readProfile(db, personId, { today: TODAY });
      expect(result?.profile.formerNames.map((name) => name.text)).toEqual([FORMER_NAME]);
      // La cause de décès, que le lecteur a pourtant saisie, ne sort d'aucune fiche de l'arbre.
      for (const person of snapshot.people) {
        const other = readProfile(db, person.id, { today: TODAY });
        expect(JSON.stringify(other)).not.toContain(SECRET_CAUSE);
      }
    });
  });

  it('ne trahit pas une personne absente de la copie : même réponse que pour une inconnue', async () => {
    const { snapshot, personId } = snapshotWithSecrets();
    await withDatabase((db) => {
      replaceTreeSnapshot(db, snapshot, { now: 1 });
      expect(readProfile(db, nextId(), { today: TODAY })).toBeUndefined();
      expect(readProfile(db, personId, { today: TODAY, treeId: nextId() })).toBeUndefined();
    });
  });

  it('sans arbre sur le téléphone, il n’y a pas de fiche', async () => {
    await withDatabase((db) => {
      expect(readProfile(db, nextId(), { today: TODAY })).toBeUndefined();
    });
  });
});
