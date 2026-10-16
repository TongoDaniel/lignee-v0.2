import { describe, expect, it } from 'vitest';

import { filiationSchema, filiationTypeSchema, parentCandidateSchema } from './filiation';
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
