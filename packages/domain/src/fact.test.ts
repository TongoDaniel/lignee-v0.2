import { describe, expect, it } from 'vitest';

import { factSchema, titleRoleSchema, type FactInput } from './fact';
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
    });
    expect(title.label).toBe('Lamido');
    expect(
      titleRoleSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        personId: tree.personId('chef'),
        label: ' ',
      }).success,
    ).toBe(false);
  });
});
