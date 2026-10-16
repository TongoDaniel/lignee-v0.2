import { describe, expect, it } from 'vitest';

import {
  filiationSchema,
  filiationTypeSchema,
  parentCandidateSchema,
  proposesOnlyMeByDefault,
} from './filiation';
import { testTree } from './test-support/fixtures';

const tree = testTree();
const base = () => ({
  id: tree.nextId(),
  treeId: tree.treeId,
  parentId: tree.personId('parent'),
  childId: tree.personId('enfant'),
});

describe('filiations (UNI-09, UNI-10)', () => {
  it('connaît les sept types de l’UNI-09', () => {
    expect(filiationTypeSchema.options).toEqual([
      'birth',
      'adoptive',
      'raised',
      'fostered',
      'guardian',
      'donor',
      'surrogacy',
    ]);
    for (const type of filiationTypeSchema.options) {
      expect(filiationSchema.safeParse({ ...base(), type, certainty: 'certain' }).success).toBe(
        true,
      );
    }
  });

  it('UNI-10 : certitude certain, probable ou hypothétique, source facultative', () => {
    for (const certainty of ['certain', 'probable', 'hypothetical']) {
      expect(filiationSchema.safeParse({ ...base(), type: 'birth', certainty }).success).toBe(true);
    }
    expect(
      filiationSchema.safeParse({ ...base(), type: 'birth', certainty: 'possible' }).success,
    ).toBe(false);
    expect(
      filiationSchema.safeParse({
        ...base(),
        type: 'birth',
        certainty: 'probable',
        sourceId: tree.nextId(),
        originUnionId: tree.nextId(),
      }).success,
    ).toBe(true);
  });

  it('relie un parent et un enfant distincts, jamais un couple', () => {
    const person = tree.personId('seul');
    expect(
      filiationSchema.safeParse({
        ...base(),
        parentId: person,
        childId: person,
        type: 'birth',
        certainty: 'certain',
      }).success,
    ).toBe(false);
    expect(
      filiationSchema.safeParse({
        ...base(),
        parentIds: [tree.personId('a'), tree.personId('b')],
        type: 'birth',
        certainty: 'certain',
      }).success,
    ).toBe(false);
  });
});

describe('paternité non officielle et « moi seul » proposé (CON-04)', () => {
  it('la reconnaissance est distincte de la certitude, inconnue par défaut', () => {
    const certainButUnofficial = filiationSchema.parse({
      ...base(),
      type: 'birth',
      certainty: 'certain',
      recognitionStatus: 'unofficial',
    });
    expect(certainButUnofficial.recognitionStatus).toBe('unofficial');
    expect(
      filiationSchema.parse({ ...base(), type: 'birth', certainty: 'certain' }).recognitionStatus,
    ).toBe('unknown');
    expect(
      filiationSchema.safeParse({
        ...base(),
        type: 'birth',
        certainty: 'certain',
        recognitionStatus: 'secret',
      }).success,
    ).toBe(false);
  });

  it('propose « moi seul » pour donneur, GPA, adoption et paternité non officielle, et seulement eux', () => {
    const proposed = filiationTypeSchema.options.filter((type) =>
      proposesOnlyMeByDefault({ type, recognitionStatus: 'official' }),
    );
    expect(proposed).toEqual(['adoptive', 'donor', 'surrogacy']);
    expect(proposesOnlyMeByDefault({ type: 'birth', recognitionStatus: 'unofficial' })).toBe(true);
    expect(proposesOnlyMeByDefault({ type: 'birth', recognitionStatus: 'unknown' })).toBe(false);
    expect(proposesOnlyMeByDefault({ type: 'raised', recognitionStatus: 'official' })).toBe(false);
  });
});

describe('candidats parent (UNI-11)', () => {
  it('note un candidat pour un enfant, distinct de lui', () => {
    const child = tree.personId('enfant');
    expect(
      parentCandidateSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        childId: child,
        candidateId: tree.personId('epouse1'),
      }).success,
    ).toBe(true);
    expect(
      parentCandidateSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        childId: child,
        candidateId: child,
      }).success,
    ).toBe(false);
  });
});
