import { describe, expect, it } from 'vitest';

import {
  factSchema,
  multipleBirthSchema,
  projectMultipleBirth,
  titleRoleSchema,
  type FactInput,
} from './fact';
import { fuzzyDateFromText } from './fuzzy-date';
import { testTree } from './test-support/fixtures';

const tree = testTree();
const personSubject = { kind: 'person', personId: tree.personId('defunt') } as const;

function fact(fields: Partial<FactInput>): FactInput {
  return {
    id: tree.nextId(),
    treeId: tree.treeId,
    subject: personSubject,
    type: 'birth',
    authorAccountId: tree.authorAccountId,
    ...fields,
  };
}

describe('faits (UNI-01, UNI-15)', () => {
  it('UNI-01 : naissance, décès et profession avec date floue, lieu et certitude', () => {
    expect(
      factSchema.safeParse(
        fact({
          date: fuzzyDateFromText('vers 1940'),
          placeId: tree.nextId(),
          certainty: 'probable',
        }),
      ).success,
    ).toBe(true);
    expect(factSchema.safeParse(fact({ type: 'death' })).success).toBe(true);
    expect(factSchema.safeParse(fact({ type: 'occupation', value: 'Instituteur' })).success).toBe(
      true,
    );
  });

  it('UNI-15 : la cause de décès est un fait à part, avec son auteur, et exige une valeur', () => {
    const cause = factSchema.parse(fact({ type: 'death_cause', value: 'Paludisme' }));
    expect(cause.authorAccountId).toBe(tree.authorAccountId);
    expect(factSchema.safeParse(fact({ type: 'death_cause' })).success).toBe(false);
    const withoutAuthor: Partial<FactInput> = fact({ type: 'death_cause', value: 'Paludisme' });
    delete withoutAuthor.authorAccountId;
    expect(factSchema.safeParse(withoutAuthor).success).toBe(false);
  });

  it('un fait de personne ne décrit pas une union ; un fait libre peut décrire une union', () => {
    const unionSubject = { kind: 'union', unionId: tree.nextId() } as const;
    expect(
      factSchema.safeParse(fact({ subject: unionSubject, type: 'death_cause', value: 'x' }))
        .success,
    ).toBe(false);
    expect(
      factSchema.safeParse(fact({ subject: unionSubject, type: 'other', value: 'Dot versée' }))
        .success,
    ).toBe(true);
  });
});

describe('titres et rôles datés (UNI-17)', () => {
  it('enregistre un titre libre, daté, pour une personne', () => {
    const title = titleRoleSchema.parse({
      id: tree.nextId(),
      treeId: tree.treeId,
      personId: tree.personId('chef'),
      label: 'Lamido',
      start: fuzzyDateFromText('1985'),
      authorAccountId: tree.authorAccountId,
    });
    expect(title.label).toBe('Lamido');
    expect(
      titleRoleSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        personId: tree.personId('chef'),
        label: ' ',
        authorAccountId: tree.authorAccountId,
      }).success,
    ).toBe(false);
    expect(
      titleRoleSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        personId: tree.personId('chef'),
        label: 'Fon',
      }).success,
    ).toBe(false);
  });
});

describe('reconnaissance tardive (CL-FAM-13)', () => {
  it('désigne la filiation reconnue, et seul ce type de fait le fait', () => {
    const filiationId = tree.nextId();
    expect(
      factSchema.safeParse(
        fact({ type: 'recognition', date: fuzzyDateFromText('1994'), filiationId }),
      ).success,
    ).toBe(true);
    expect(factSchema.safeParse(fact({ type: 'recognition' })).success).toBe(false);
    expect(factSchema.safeParse(fact({ type: 'birth', filiationId })).success).toBe(false);
  });
});

describe('naissance multiple vue par un lecteur', () => {
  const birth = multipleBirthSchema.parse({
    id: tree.nextId(),
    treeId: tree.treeId,
    members: ['t1', 't2', 't3'].map((key) => ({ personId: tree.personId(key) })),
  });
  const hidden =
    (...keys: string[]) =>
    (id: string) =>
      !keys.some((key) => tree.personId(key) === id);

  it('retire les enfants masqués', () => {
    expect(projectMultipleBirth(birth, hidden('t3'))?.members).toEqual(birth.members.slice(0, 2));
  });

  it('disparaît s’il reste moins de deux enfants visibles : « Jumeaux » ne trahit personne', () => {
    expect(projectMultipleBirth(birth, hidden('t2', 't3'))).toBeUndefined();
    expect(projectMultipleBirth(birth, hidden('t1', 't2', 't3'))).toBeUndefined();
  });
});
