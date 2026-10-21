// Format des mutations et des lots (TRD, « Hors-ligne et synchronisation », point 2 ; ADR 0027).
import { describe, expect, it } from 'vitest';

import {
  MAX_BATCH_MUTATIONS,
  createdObject,
  mutationBatchSchema,
  mutationSchema,
  updatedObject,
  type MutationInput,
} from './mutation';
import { testTree } from './test-support/fixtures';

const tree = testTree();
const createdAt = '2026-10-19T08:30:00.000Z';

function createPerson(overrides: Partial<MutationInput> = {}): MutationInput {
  return {
    id: tree.nextId(),
    entity: 'person',
    entityId: tree.nextId(),
    operation: 'create',
    fields: { nature: 'known' },
    baseVersion: null,
    createdAt,
    ...overrides,
  };
}

function batch(...mutations: MutationInput[]) {
  return { id: tree.nextId(), treeId: tree.treeId, mutations };
}

function paths(input: unknown): string[] {
  const result = mutationBatchSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('mutation (enveloppe)', () => {
  it('porte identifiant, entité, opération, champs, version de départ et date', () => {
    expect(mutationSchema.safeParse(createPerson()).success).toBe(true);
    expect(
      mutationSchema.safeParse({
        id: tree.nextId(),
        entity: 'person',
        entityId: tree.nextId(),
        operation: 'update',
        fields: { gender: 'female' },
        baseVersion: 3,
        createdAt,
      }).success,
    ).toBe(true);
    expect(
      mutationSchema.safeParse({
        id: tree.nextId(),
        entity: 'union',
        entityId: tree.nextId(),
        operation: 'delete',
        baseVersion: null,
        createdAt,
      }).success,
    ).toBe(true);
  });

  it('refuse un champ inconnu de l’enveloppe, une date sans fuseau, un identifiant non UUIDv7', () => {
    expect(mutationSchema.safeParse({ ...createPerson(), author: 'x' }).success).toBe(false);
    expect(mutationSchema.safeParse(createPerson({ createdAt: '2026-10-19 08:30' })).success).toBe(
      false,
    );
    expect(
      mutationSchema.safeParse(createPerson({ entityId: '00000000-0000-4000-8000-000000000000' }))
        .success,
    ).toBe(false);
  });

  it('création sans version de départ ; suppression sans champs ; modification avec au moins un champ', () => {
    expect(mutationSchema.safeParse(createPerson({ baseVersion: 0 })).success).toBe(false);
    expect(
      mutationSchema.safeParse(createPerson({ operation: 'delete', fields: {}, baseVersion: 0 }))
        .success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse(createPerson({ operation: 'update', fields: {}, baseVersion: 0 }))
        .success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse(
        createPerson({ operation: 'update', fields: undefined, baseVersion: 0 }),
      ).success,
    ).toBe(false);
  });

  it('identifiant, arbre et version ne viennent jamais des champs ; l’auteur ne change pas', () => {
    for (const key of ['id', 'treeId', 'version']) {
      expect(
        mutationSchema.safeParse(createPerson({ fields: { nature: 'known', [key]: 0 } })).success,
      ).toBe(false);
    }
    expect(
      mutationSchema.safeParse({
        id: tree.nextId(),
        entity: 'fact',
        entityId: tree.nextId(),
        operation: 'update',
        fields: { authorAccountId: tree.nextId() },
        baseVersion: null,
        createdAt,
      }).success,
    ).toBe(false);
  });

  it('une règle de visibilité se crée ou se supprime, jamais champ par champ', () => {
    expect(
      mutationSchema.safeParse({
        id: tree.nextId(),
        entity: 'visibility_rule',
        entityId: tree.nextId(),
        operation: 'update',
        fields: { level: 'tree' },
        baseVersion: null,
        createdAt,
      }).success,
    ).toBe(false);
  });
});

describe('lot de mutations', () => {
  it('normalise les champs d’une création (espaces, valeurs par défaut)', () => {
    const personId = tree.nextId();
    const result = mutationBatchSchema.parse(
      batch(createPerson({ entityId: personId }), {
        id: tree.nextId(),
        entity: 'name',
        entityId: tree.nextId(),
        operation: 'create',
        fields: {
          personId,
          type: 'birth',
          givenNames: '  Esso  ',
          authorAccountId: tree.authorAccountId,
        },
        baseVersion: null,
        createdAt,
      }),
    );
    expect(result.mutations[0]?.fields).toEqual({
      nature: 'known',
      gender: 'unspecified',
      vitalStatus: 'unknown',
    });
    expect(result.mutations[1]?.fields).toMatchObject({ givenNames: 'Esso' });
    // Relire un lot normalisé donne le même lot.
    expect(mutationBatchSchema.parse(result)).toEqual(result);
  });

  it('normalise une modification champ par champ ; `null` retire un champ facultatif', () => {
    const result = mutationBatchSchema.parse(
      batch({
        id: tree.nextId(),
        entity: 'person',
        entityId: tree.nextId(),
        operation: 'update',
        fields: { notes: '  vit à Bafoussam ', distinctFrom: null },
        baseVersion: 2,
        createdAt,
      }),
    );
    expect(result.mutations[0]?.fields).toEqual({ notes: 'vit à Bafoussam', distinctFrom: null });
  });

  it('refuse un champ inconnu, une valeur invalide, le retrait d’un champ obligatoire', () => {
    const update = (fields: Record<string, unknown>): MutationInput => ({
      id: tree.nextId(),
      entity: 'person',
      entityId: tree.nextId(),
      operation: 'update',
      fields,
      baseVersion: 0,
      createdAt,
    });
    expect(paths(batch(update({ ethnicity: 'x' })))).toEqual(['mutations.0.fields.ethnicity']);
    expect(paths(batch(update({ gender: 'robot' })))).toEqual(['mutations.0.fields.gender']);
    expect(paths(batch(update({ nature: null })))).toEqual(['mutations.0.fields.nature']);
  });

  it('refuse une création incomplète au chemin du champ, sans valeur dans le message', () => {
    const result = mutationBatchSchema.safeParse(
      batch({
        id: tree.nextId(),
        entity: 'fact',
        entityId: tree.nextId(),
        operation: 'create',
        fields: {
          subject: { kind: 'person', personId: tree.nextId() },
          type: 'death_cause',
          authorAccountId: tree.authorAccountId,
        },
        baseVersion: null,
        createdAt,
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'mutations.0.fields.value',
    ]);
  });

  it('refuse un lot vide, trop grand, ou deux mutations au même identifiant', () => {
    expect(mutationBatchSchema.safeParse(batch()).success).toBe(false);
    const many = Array.from({ length: MAX_BATCH_MUTATIONS + 1 }, () => createPerson());
    expect(mutationBatchSchema.safeParse(batch(...many)).success).toBe(false);
    const first = createPerson();
    expect(paths(batch(first, createPerson({ id: first.id })))).toEqual(['mutations.1.id']);
  });

  it('accepte une règle de visibilité telle que le modèle la définit (aucune règle inventée)', () => {
    const result = mutationBatchSchema.safeParse(
      batch({
        id: tree.nextId(),
        entity: 'visibility_rule',
        entityId: tree.nextId(),
        operation: 'create',
        fields: {
          target: { type: 'filiation', id: tree.nextId() },
          level: 'only_me',
          authorAccountId: tree.authorAccountId,
        },
        baseVersion: null,
        createdAt,
      }),
    );
    expect(result.success).toBe(true);
    expect(
      paths(
        batch({
          id: tree.nextId(),
          entity: 'visibility_rule',
          entityId: tree.nextId(),
          operation: 'create',
          fields: {
            target: { type: 'filiation', id: tree.nextId() },
            level: 'public',
            authorAccountId: tree.authorAccountId,
          },
          baseVersion: null,
          createdAt,
        }),
      ),
    ).toEqual(['mutations.0.fields.level']);
  });
});

describe('objet créé ou modifié', () => {
  it('une modification repasse l’objet entier par son schéma', () => {
    const person = createdObject('person', tree.nextId(), tree.treeId, { nature: 'placeholder' });
    if (!person.success) throw new Error('unexpected');
    const other = tree.nextId();
    const distinct = updatedObject('person', person.data, { distinctFrom: [other] });
    expect(distinct.success && distinct.data.distinctFrom).toEqual([other]);
    // `distinctFrom` n'est permis que sur une place à compléter : contrôle qui croise deux champs.
    if (!distinct.success) throw new Error('unexpected');
    expect(updatedObject('person', distinct.data, { nature: 'known' }).success).toBe(false);
    const removed = updatedObject('person', distinct.data, { distinctFrom: null });
    expect(removed.success && 'distinctFrom' in removed.data).toBe(false);
  });
});
