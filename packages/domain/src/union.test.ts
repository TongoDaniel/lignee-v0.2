import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzzyDateFromText } from './fuzzy-date';
import { idSchema } from './ids';
import { testTree } from './test-support/fixtures';
import { simultaneityAnswerSchema, unionSchema, unionTypeSchema } from './union';

const tree = testTree();

describe('unions (UNI-05 à UNI-08)', () => {
  it('UNI-05 : seules les deux personnes sont obligatoires', () => {
    const union = unionSchema.parse({
      id: tree.nextId(),
      treeId: tree.treeId,
      spouses: [
        { personId: tree.personId('a'), rank: 1 },
        { personId: tree.personId('b'), rank: 1 },
      ],
    });
    expect(union.type).toBe('unspecified');
    expect(union.start).toBeUndefined();
  });

  it('UNI-05 : tous les champs facultatifs s’enregistrent', () => {
    const union = unionSchema.parse({
      id: tree.nextId(),
      treeId: tree.treeId,
      spouses: [
        { personId: tree.personId('a'), rank: 2 },
        { personId: tree.personId('b'), rank: 1 },
      ],
      type: 'customary',
      start: fuzzyDateFromText('vers 1975'),
      end: fuzzyDateFromText('1990'),
      endReason: 'divorce',
      declaredOption: 'polygamy',
      placeId: tree.nextId(),
      notes: 'Dot versée au village',
    });
    expect(union.spouses.map((spouse) => spouse.rank)).toEqual([2, 1]);
  });

  it('connaît les six types de l’UNI-05', () => {
    expect(unionTypeSchema.options).toEqual([
      'civil',
      'customary',
      'religious',
      'free_union',
      'civil_partnership',
      'unspecified',
    ]);
  });

  it('UNI-06 : douze unions simultanées d’une même personne s’enregistrent, quel que soit le genre', () => {
    const center = tree.personId('centre');
    const unions = Array.from({ length: 12 }, (_, index) =>
      unionSchema.parse({
        id: tree.nextId(),
        treeId: tree.treeId,
        spouses: [
          { personId: center, rank: index + 1 },
          { personId: tree.personId(`conjoint${String(index)}`), rank: 1 },
        ],
      }),
    );
    expect(unions).toHaveLength(12);
    expect(unions.map((union) => union.spouses[0].rank)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });

  it('une union relie exactement deux personnes distinctes, chacune avec un rang positif', () => {
    const spouse = (key: string, rank = 1) => ({ personId: tree.personId(key), rank });
    const base = { id: tree.nextId(), treeId: tree.treeId };
    expect(unionSchema.safeParse({ ...base, spouses: [spouse('a')] }).success).toBe(false);
    expect(
      unionSchema.safeParse({ ...base, spouses: [spouse('a'), spouse('b'), spouse('c')] }).success,
    ).toBe(false);
    expect(unionSchema.safeParse({ ...base, spouses: [spouse('a'), spouse('a')] }).success).toBe(
      false,
    );
    expect(unionSchema.safeParse({ ...base, spouses: [spouse('a', 0), spouse('b')] }).success).toBe(
      false,
    );
    expect(
      unionSchema.safeParse({ ...base, spouses: [spouse('a', 1.5), spouse('b')] }).success,
    ).toBe(false);
  });

  it('propriété : deux personnes distinctes et deux rangs positifs forment toujours une union valide', () => {
    const idArbitrary = fc.uuid({ version: 7 }).filter((id) => idSchema.safeParse(id).success);
    fc.assert(
      fc.property(
        idArbitrary,
        idArbitrary,
        fc.integer({ min: 1, max: 1_000 }),
        fc.integer({ min: 1, max: 1_000 }),
        (a, b, rankA, rankB) => {
          const result = unionSchema.safeParse({
            id: tree.nextId(),
            treeId: tree.treeId,
            spouses: [
              { personId: a, rank: rankA },
              { personId: b, rank: rankB },
            ],
          });
          expect(result.success).toBe(a !== b);
        },
      ),
    );
  });
});

describe('réponse gardée par paire d’unions (UNI-08, ADR 0012)', () => {
  const [first, second] = [tree.nextId(), tree.nextId()].sort();
  const base = { id: tree.nextId(), treeId: tree.treeId, simultaneity: 'simultaneous' };

  it('une paire de deux unions distinctes, la plus petite d’abord', () => {
    expect(simultaneityAnswerSchema.parse({ ...base, unionIds: [first, second] }).unionIds).toEqual(
      [first, second],
    );
    expect(simultaneityAnswerSchema.safeParse({ ...base, unionIds: [second, first] }).success).toBe(
      false,
    );
    expect(simultaneityAnswerSchema.safeParse({ ...base, unionIds: [first, first] }).success).toBe(
      false,
    );
    expect(
      simultaneityAnswerSchema.safeParse({
        ...base,
        unionIds: [first, second],
        simultaneity: 'unknown',
      }).success,
    ).toBe(false);
  });
});
