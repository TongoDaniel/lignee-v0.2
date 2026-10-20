// Instantané d'un arbre dans la base du téléphone : aller-retour, remplacement, effacement, et
// seconde barrière contre ce que le lecteur ne doit pas voir (ADR 0017, ADR 0023).
import { join } from 'node:path';

import { generateTree } from '@lignee/domain/tree-generator';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';

import { devReaderSnapshot } from '../dev-seed/projection';
import { enteredTexts, generatedSnapshot } from '../test-support/generated-snapshot';
import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import {
  InvalidSnapshotError,
  SnapshotPrivacyError,
  eraseLocalTree,
  listLocalTrees,
  parseLocalTreeSnapshot,
  readTreeSnapshot,
  replaceTreeSnapshot,
  snapshotPrivacyIssues,
  type LocalTreeSnapshot,
} from './snapshot';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});
let counter = 0;
const nextPath = () => join(tmp.dir, `snapshot-${String(++counter)}.db`);

function codes(snapshot: LocalTreeSnapshot): string[] {
  return snapshotPrivacyIssues(snapshot).map((issue) => issue.code);
}

// Arbres générés de 300 personnes écrits dans une base chiffrée : le délai par défaut de vitest
// (5 s) est trop court sous la charge de la CI.
describe('instantané dans la base locale', { timeout: 30_000 }, () => {
  it('se relit à l’identique (arbre généré de 300 personnes)', async () => {
    const { snapshot } = generatedSnapshot(300, 300);
    const { db, connection } = await openTestDatabase(nextPath());
    const counts = replaceTreeSnapshot(db, snapshot, { now: 1_800_000_000_000 });
    expect(counts.people).toBe(snapshot.people.length);
    expect(counts.people).toBeGreaterThan(200);
    expect(readTreeSnapshot(db, snapshot.tree.id)).toEqual(snapshot);
    expect(listLocalTrees(db)).toEqual([
      { id: snapshot.tree.id, readerAccountId: snapshot.readerAccountId },
    ]);
    connection.close();
  });

  it('se relit à l’identique sur des arbres générés au hasard (propriété)', async () => {
    const { db, connection } = await openTestDatabase(nextPath());
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 80 }), (seed, size) => {
        const { snapshot } = generatedSnapshot(seed, size);
        replaceTreeSnapshot(db, snapshot, { now: 1 });
        expect(readTreeSnapshot(db, snapshot.tree.id)).toEqual(snapshot);
        eraseLocalTree(db, snapshot.tree.id);
      }),
      { numRuns: 25 },
    );
    connection.close();
  });

  it('un nouveau chargement remplace l’ancien sans en laisser de trace', async () => {
    const first = generatedSnapshot(1, 80).snapshot;
    const { db, connection } = await openTestDatabase(nextPath());
    replaceTreeSnapshot(db, first, { now: 1 });
    // Même arbre, moitié moins de personnes visibles (un lien retiré, une exclusion partielle).
    const keptPeople = new Set(first.people.slice(0, 40).map((person) => person.id));
    const smaller = parseLocalTreeSnapshot({
      ...first,
      people: first.people
        .filter((person) => keptPeople.has(person.id))
        .map((person) => {
          if (person.distinctFrom === undefined) return person;
          const { distinctFrom, ...rest } = person;
          const kept = distinctFrom.filter((id) => keptPeople.has(id));
          return kept.length === 0 ? rest : { ...rest, distinctFrom: kept };
        }),
      names: first.names.filter((name) => keptPeople.has(name.personId)),
      unions: [],
      simultaneityAnswers: [],
      filiations: [],
      parentCandidates: [],
      facts: first.facts
        .filter((fact) => fact.subject.kind === 'person' && keptPeople.has(fact.subject.personId))
        .map((fact) => {
          const { filiationId, ...rest } = fact;
          return filiationId === undefined ? fact : rest;
        })
        .filter((fact) => fact.type !== 'recognition'),
      titleRoles: first.titleRoles.filter((title) => keptPeople.has(title.personId)),
      multipleBirths: [],
      toPlace: [],
      places: first.places,
    });
    replaceTreeSnapshot(db, smaller, { now: 2 });
    expect(readTreeSnapshot(db, first.tree.id)).toEqual(smaller);
    const removed = first.people.find((person) => !keptPeople.has(person.id));
    expect(removed).toBeDefined();
    const leftover = connection.raw
      .prepare('SELECT count(*) AS n FROM people WHERE id = ?')
      .get(removed?.id) as { n: number };
    expect(leftover.n).toBe(0);
    connection.close();
  });

  it('effacer un arbre retire toutes ses lignes et garde les autres arbres', async () => {
    const a = generatedSnapshot(2, 50).snapshot;
    const b = generatedSnapshot(3, 50).snapshot;
    const { db, connection } = await openTestDatabase(nextPath());
    replaceTreeSnapshot(db, a, { now: 1 });
    replaceTreeSnapshot(db, b, { now: 1 });
    eraseLocalTree(db, a.tree.id);
    expect(readTreeSnapshot(db, a.tree.id)).toBeUndefined();
    expect(readTreeSnapshot(db, b.tree.id)).toEqual(b);
    const tables = (
      connection.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'trees'")
        .all() as { name: string }[]
    ).map((row) => row.name);
    for (const table of tables) {
      const row = connection.raw
        .prepare(`SELECT count(*) AS n FROM ${table} WHERE tree_id = ?`)
        .get(a.tree.id) as { n: number };
      expect(row.n, table).toBe(0);
    }
    connection.close();
  });

  it('un instantané refusé n’écrit rien, et l’erreur ne contient aucune valeur saisie', async () => {
    const { snapshot } = generatedSnapshot(4, 60);
    const { db, connection } = await openTestDatabase(nextPath());
    const person = snapshot.people[0];
    if (person === undefined) throw new Error('empty tree');
    const leaking = {
      ...snapshot,
      names: [
        ...snapshot.names,
        {
          id: '01999999-0000-7000-8000-000000000001',
          treeId: snapshot.tree.id,
          personId: '01999999-0000-7000-8000-0000000000ff',
          type: 'birth' as const,
          givenNames: 'Nomcache',
          authorAccountId: snapshot.readerAccountId,
        },
      ],
    };
    let error: unknown;
    try {
      replaceTreeSnapshot(db, leaking, { now: 1 });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SnapshotPrivacyError);
    expect(JSON.stringify((error as SnapshotPrivacyError).issues)).not.toMatch(/Nomcache|01999999/);
    expect((error as Error).message).not.toMatch(/Nomcache|01999999/);
    expect(listLocalTrees(db)).toEqual([]);
    for (const text of enteredTexts(snapshot).slice(0, 5)) {
      expect((error as Error).message).not.toContain(text);
    }
    connection.close();
  });
});

describe('seconde barrière : rien de ce que le lecteur ne voit pas', () => {
  const { generated, snapshot } = generatedSnapshot(5, 200);
  const otherAccount = generated.accounts.find(
    (account) => account.accountId !== snapshot.readerAccountId,
  )?.accountId;
  const [p0, p1] = snapshot.people;
  if (p0 === undefined || p1 === undefined || otherAccount === undefined) {
    throw new Error('Generated tree too small');
  }
  const absentId = '01999999-0000-7000-8000-0000000000aa';

  it('l’instantané projeté passe', () => {
    expect(snapshotPrivacyIssues(snapshot)).toEqual([]);
  });

  it('refuse un arbre brut qui porte des règles de visibilité', () => {
    expect(generated.visibilityRules.length).toBeGreaterThan(0);
    const raw: Partial<typeof generated> = { ...generated };
    delete raw.accounts;
    delete raw.features;
    delete raw.seed;
    expect(() =>
      parseLocalTreeSnapshot({ readerAccountId: snapshot.readerAccountId, ...raw }),
    ).toThrow(InvalidSnapshotError);
  });

  it('refuse une mention « distincte de » vers une personne absente (ADR 0017)', () => {
    const placeholder = {
      id: '01999999-0000-7000-8000-0000000000bb',
      treeId: snapshot.tree.id,
      nature: 'placeholder' as const,
      gender: 'female' as const,
      vitalStatus: 'unknown' as const,
      version: 0,
      distinctFrom: [absentId],
    };
    expect(codes({ ...snapshot, people: [...snapshot.people, placeholder] })).toEqual([
      'dangling_reference',
    ]);
  });

  it('refuse une filiation, une union ou un fait qui cite une personne absente', () => {
    const filiation = {
      id: '01999999-0000-7000-8000-0000000000c1',
      treeId: snapshot.tree.id,
      parentId: absentId,
      childId: p0.id,
      type: 'birth' as const,
      certainty: 'certain' as const,
      recognitionStatus: 'unknown' as const,
    };
    expect(codes({ ...snapshot, filiations: [...snapshot.filiations, filiation] })).toEqual([
      'dangling_reference',
    ]);
    const union = {
      id: '01999999-0000-7000-8000-0000000000c2',
      treeId: snapshot.tree.id,
      spouses: [
        { personId: p0.id, rank: 9 },
        { personId: absentId, rank: 1 },
      ] as [{ personId: string; rank: number }, { personId: string; rank: number }],
      type: 'unspecified' as const,
    };
    expect(codes({ ...snapshot, unions: [...snapshot.unions, union] })).toEqual([
      'dangling_reference',
    ]);
  });

  it('refuse la cause de décès saisie par un autre compte (auteur seul, UNI-15)', () => {
    const fact = {
      id: '01999999-0000-7000-8000-0000000000d1',
      treeId: snapshot.tree.id,
      subject: { kind: 'person' as const, personId: p0.id },
      type: 'death_cause' as const,
      value: 'Cause inventée',
      authorAccountId: otherAccount,
    };
    expect(codes({ ...snapshot, facts: [...snapshot.facts, fact] })).toEqual([
      'death_cause_of_another_author',
    ]);
    expect(
      codes({
        ...snapshot,
        facts: [...snapshot.facts, { ...fact, authorAccountId: snapshot.readerAccountId }],
      }),
    ).toEqual([]);
  });

  it('refuse l’ancien prénom saisi par un autre compte (UNI-22)', () => {
    const name = {
      id: '01999999-0000-7000-8000-0000000000e1',
      treeId: snapshot.tree.id,
      personId: p1.id,
      type: 'former' as const,
      givenNames: 'Ancien',
      authorAccountId: otherAccount,
    };
    expect(codes({ ...snapshot, names: [...snapshot.names, name] })).toEqual([
      'former_name_of_another_author',
    ]);
  });

  it('refuse un objet d’un autre arbre, un identifiant en double et une source', () => {
    expect(codes({ ...snapshot, people: [...snapshot.people, { ...p0 }] })).toEqual([
      'duplicate_id',
    ]);
    expect(
      codes({
        ...snapshot,
        people: [
          ...snapshot.people,
          { ...p0, id: '01999999-0000-7000-8000-0000000000f1', treeId: absentId },
        ],
      }),
    ).toEqual(['foreign_tree']);
    const filiation = snapshot.filiations[0];
    if (filiation === undefined) throw new Error('no filiation');
    expect(
      codes({
        ...snapshot,
        filiations: [{ ...filiation, sourceId: absentId }, ...snapshot.filiations.slice(1)],
      }),
    ).toEqual(['unsupported_reference']);
  });
});

describe(
  'arbres générés : la projection de développement ne garde rien de masqué',
  { timeout: 30_000 },
  () => {
    it('aucun objet sous règle restreinte, aucune référence pendante (propriété)', () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer({ min: 1, max: 150 }), (seed, size) => {
          const generated = generateTree({ seed, size, rates: { hidden: 0.3 } });
          const reader = generated.accounts[0];
          if (reader === undefined) throw new Error('no account');
          const projected = devReaderSnapshot(generated, reader.accountId);
          const restricted = generated.visibilityRules
            .filter((rule) => rule.level !== 'tree')
            .map((rule) => rule.target.id);
          const present = new Set<string>(
            [
              ...projected.people,
              ...projected.unions,
              ...projected.filiations,
              ...projected.facts,
              ...projected.names,
            ].map((object) => object.id),
          );
          for (const id of restricted) expect(present.has(id)).toBe(false);
          expect(snapshotPrivacyIssues(projected)).toEqual([]);
          expect(() => parseLocalTreeSnapshot(projected)).not.toThrow();
        }),
        { numRuns: 60 },
      );
    });
  },
);
