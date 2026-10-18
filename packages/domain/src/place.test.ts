import { describe, expect, it } from 'vitest';

import { placeSchema, toPlaceSchema, usageNameSchema } from './place';
import { testTree } from './test-support/fixtures';

const tree = testTree();

describe('lieux', () => {
  it('un nom suffit ; nom actuel, anciens noms, pays et coordonnées sont facultatifs', () => {
    const place = placeSchema.parse({ id: tree.nextId(), treeId: tree.treeId, name: 'Nkolbisson' });
    expect(place.formerNames).toEqual([]);
    expect(
      placeSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        name: 'Port-Ancien',
        currentName: 'Port-Nouveau',
        formerNames: ['Port-Ancien'],
        country: 'CM',
        coordinates: { latitude: 4.02, longitude: 9.2 },
      }).success,
    ).toBe(true);
    expect(
      placeSchema.safeParse({
        id: tree.nextId(),
        treeId: tree.treeId,
        name: 'X',
        coordinates: { latitude: 120, longitude: 0 },
      }).success,
    ).toBe(false);
  });
});

describe('à placer (UNI-04)', () => {
  it('« grand-mère de Nora, côté inconnu » : référence, chemin, côté, statut', () => {
    const entry = toPlaceSchema.parse({
      id: tree.nextId(),
      treeId: tree.treeId,
      personId: tree.personId('grand-mere'),
      referencePersonId: tree.personId('nora'),
      path: ['parent', 'parent'],
    });
    expect(entry.side).toBe('unknown');
    expect(entry.status).toBe('open');
    expect(toPlaceSchema.safeParse({ ...entry, id: tree.nextId(), path: [] }).success).toBe(false);
  });
});

describe('noms d’usage', () => {
  it('portée moi seul ou famille, rien d’autre', () => {
    const base = {
      id: tree.nextId(),
      treeId: tree.treeId,
      authorAccountId: tree.authorAccountId,
      personId: tree.personId('coepouse'),
      label: 'Maman Hortense',
    };
    expect(usageNameSchema.safeParse({ ...base, scope: 'only_me' }).success).toBe(true);
    expect(usageNameSchema.safeParse({ ...base, scope: 'family' }).success).toBe(true);
    expect(usageNameSchema.safeParse({ ...base, scope: 'tree' }).success).toBe(false);
  });
});
