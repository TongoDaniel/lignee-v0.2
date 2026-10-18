import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { personSchema } from './person';
import { modelSchemas } from './schemas';
import { testTree } from './test-support/fixtures';
import { treeSchema } from './tree';

const tree = testTree();
const validTree = {
  id: tree.treeId,
  name: 'Famille Ndembo',
  language: 'fr',
  nameOrder: 'surname_first',
  ownerAccountId: tree.authorAccountId,
  settings: { mapEnabled: true },
} as const;

/** Champs interdits par la minimisation (CON-13) : ethnie, religion et leurs équivalents. */
const FORBIDDEN_FIELD = /ethni|religio|tribe|tribu|caste|^race$/i;

/** Tous les noms de champs d'un schéma JSON, à toute profondeur. */
function fieldNames(node: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) fieldNames(item, found);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'properties' && typeof value === 'object' && value !== null) {
        for (const field of Object.keys(value)) found.add(field);
      }
      fieldNames(value, found);
    }
  }
  return found;
}

function forbiddenFields(schema: z.ZodType): string[] {
  const names = new Set<string>();
  for (const io of ['input', 'output'] as const) {
    fieldNames(z.toJSONSchema(schema, { io, unrepresentable: 'any' }), names);
  }
  return [...names].filter((name) => FORBIDDEN_FIELD.test(name));
}

describe('arbre et réglages (CON-13)', () => {
  it('le propriétaire peut couper la carte pour tout l’arbre', () => {
    expect(treeSchema.parse(validTree).settings.mapEnabled).toBe(true);
    const cut = treeSchema.parse({ ...validTree, settings: { mapEnabled: false } });
    expect(cut.settings.mapEnabled).toBe(false);
    expect(treeSchema.safeParse({ ...validTree, settings: {} }).success).toBe(false);
  });

  it('l’ordre des noms est un réglage de l’arbre', () => {
    expect(treeSchema.safeParse({ ...validTree, nameOrder: 'given_first' }).success).toBe(true);
    expect(treeSchema.safeParse({ ...validTree, nameOrder: 'family' }).success).toBe(false);
  });

  it('CON-13 : aucun schéma du modèle n’a de champ ethnie ni religion', () => {
    expect(Object.keys(modelSchemas).length).toBeGreaterThan(10);
    for (const [name, schema] of Object.entries(modelSchemas)) {
      expect({ name, forbidden: forbiddenFields(schema) }).toEqual({ name, forbidden: [] });
    }
  });

  it('CON-13 : le contrôle repère bien un tel champ, et les schémas stricts le refusent', () => {
    expect(forbiddenFields(z.object({ person: z.object({ ethnicity: z.string() }) }))).toEqual([
      'ethnicity',
    ]);
    expect(forbiddenFields(z.object({ religion: z.string() }))).toEqual(['religion']);
    expect(
      personSchema.safeParse({
        id: tree.personId('x'),
        treeId: tree.treeId,
        nature: 'known',
        religion: 'x',
      }).success,
    ).toBe(false);
  });
});
