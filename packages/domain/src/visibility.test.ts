import { describe, expect, it } from 'vitest';

import { testTree } from './test-support/fixtures';
import { visibilityRuleSchema, visibilityRuleSetSchema } from './visibility';

const tree = testTree();
const target = { type: 'union', id: tree.nextId() } as const;
const base = () => ({
  id: tree.nextId(),
  treeId: tree.treeId,
  target,
  authorAccountId: tree.authorAccountId,
});

describe('règles de visibilité, données seules (CON-02, CON-03)', () => {
  it('accepte les quatre niveaux avec leurs précisions', () => {
    expect(visibilityRuleSchema.safeParse({ ...base(), level: 'tree' }).success).toBe(true);
    expect(
      visibilityRuleSchema.safeParse({
        ...base(),
        level: 'branch',
        branchRootPersonId: tree.personId('racine'),
      }).success,
    ).toBe(true);
    expect(
      visibilityRuleSchema.safeParse({
        ...base(),
        level: 'chosen_people',
        accountIds: [tree.nextId()],
      }).success,
    ).toBe(true);
    expect(visibilityRuleSchema.safeParse({ ...base(), level: 'only_me' }).success).toBe(true);
  });

  it('refuse une branche sans racine, des personnes choisies sans compte, un niveau inconnu', () => {
    expect(visibilityRuleSchema.safeParse({ ...base(), level: 'branch' }).success).toBe(false);
    expect(
      visibilityRuleSchema.safeParse({ ...base(), level: 'chosen_people', accountIds: [] }).success,
    ).toBe(false);
    expect(visibilityRuleSchema.safeParse({ ...base(), level: 'public' }).success).toBe(false);
    expect(
      visibilityRuleSchema.safeParse({
        ...base(),
        level: 'tree',
        branchRootPersonId: tree.personId('racine'),
      }).success,
    ).toBe(false);
  });

  it('vise une personne, une union, une filiation, un fait ou un nom', () => {
    for (const type of ['person', 'union', 'filiation', 'fact', 'name']) {
      expect(
        visibilityRuleSchema.safeParse({
          ...base(),
          target: { type, id: tree.nextId() },
          level: 'only_me',
        }).success,
      ).toBe(true);
    }
  });

  it('une règle par objet', () => {
    const first = { ...base(), level: 'tree' as const };
    const second = { ...base(), level: 'only_me' as const };
    expect(visibilityRuleSetSchema.safeParse([first]).success).toBe(true);
    expect(visibilityRuleSetSchema.safeParse([first, second]).success).toBe(false);
    expect(
      visibilityRuleSetSchema.safeParse([
        first,
        { ...second, target: { type: 'person', id: target.id } },
      ]).success,
    ).toBe(true);
  });
});
