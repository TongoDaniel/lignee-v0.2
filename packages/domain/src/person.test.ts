import { describe, expect, it } from 'vitest';

import { fuzzyDateFromText } from './fuzzy-date';
import {
  formatName,
  nameSchema,
  nameTypeSchema,
  personRecordSchema,
  personSchema,
  type NameInput,
} from './person';
import { testTree } from './test-support/fixtures';

const tree = testTree();
const personId = tree.personId('nadege');

function name(fields: Partial<NameInput>): NameInput {
  return {
    id: tree.nextId(),
    treeId: tree.treeId,
    personId,
    type: 'birth',
    authorAccountId: tree.authorAccountId,
    ...fields,
  };
}

describe('personnes (UNI-01, UNI-02)', () => {
  it('UNI-01 : une personne connue avec un seul nom suffit ; le reste prend « non renseigné »', () => {
    const record = personRecordSchema.parse({
      person: { id: personId, treeId: tree.treeId, nature: 'known' },
      names: [name({ givenNames: 'Nadège' })],
    });
    expect(record.person.gender).toBe('unspecified');
    expect(record.person.vitalStatus).toBe('unknown');
  });

  it('UNI-01 : une personne connue sans aucun nom est refusée', () => {
    const result = personRecordSchema.safeParse({
      person: { id: personId, treeId: tree.treeId, nature: 'known' },
      names: [],
    });
    expect(result.success).toBe(false);
  });

  it('UNI-01, UNI-02 : « Inconnu » est une personne à compléter, sans nom enregistré', () => {
    const record = personRecordSchema.parse({
      person: { id: personId, treeId: tree.treeId, nature: 'placeholder' },
      names: [],
    });
    expect(record.person.nature).toBe('placeholder');
    expect(record.names).toEqual([]);
  });

  it('refuse un nom vide ou fait d’espaces', () => {
    expect(nameSchema.safeParse(name({})).success).toBe(false);
    expect(nameSchema.safeParse(name({ givenNames: '   ' })).success).toBe(false);
  });

  it('refuse un nom qui appartient à une autre personne', () => {
    const result = personRecordSchema.safeParse({
      person: { id: personId, treeId: tree.treeId, nature: 'known' },
      names: [name({ givenNames: 'Nadège', personId: tree.personId('autre') })],
    });
    expect(result.success).toBe(false);
  });

  it('accepte les quatre genres et refuse les autres valeurs', () => {
    for (const gender of ['female', 'male', 'other', 'unspecified']) {
      expect(
        personSchema.safeParse({ id: personId, treeId: tree.treeId, nature: 'known', gender })
          .success,
      ).toBe(true);
    }
    expect(
      personSchema.safeParse({ id: personId, treeId: tree.treeId, nature: 'known', gender: 'x' })
        .success,
    ).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    expect(
      personSchema.safeParse({ id: personId, treeId: tree.treeId, nature: 'known', label: 'x' })
        .success,
    ).toBe(false);
  });
});

describe('noms', () => {
  it('connaît les six types du TRD', () => {
    expect(nameTypeSchema.options).toEqual([
      'birth',
      'usage',
      'nickname',
      'title',
      'variant',
      'former',
    ]);
  });

  it('UNI-22 : un ancien prénom est un nom à part, avec ses dates', () => {
    const former = nameSchema.parse(
      name({ type: 'former', givenNames: 'Daniel', end: fuzzyDateFromText('2019') }),
    );
    expect(former.type).toBe('former');
  });

  it('la forme d’affichage l’emporte sur prénoms et nom', () => {
    expect(
      formatName(
        { givenNames: 'Hortense', surname: 'Mbolang', displayForm: 'Mama Hortense' },
        'given_first',
      ),
    ).toBe('Mama Hortense');
  });
});
