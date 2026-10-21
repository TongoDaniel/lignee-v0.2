// Petit arbre généré à la main pour les tests des mutations : un couple, son enfant, une place à
// compléter. Aucune donnée réelle : prénoms inventés, identifiants déterministes.
import { deterministicIds } from '@lignee/domain/test-support';

import { parseLocalTreeSnapshot, type LocalTreeSnapshot } from '../local-db/snapshot';

export function smallTree() {
  const nextId = deterministicIds(1_800_000_000_000);
  const treeId = nextId();
  const reader = nextId();
  const otherAccount = nextId();
  const father = nextId();
  const mother = nextId();
  const child = nextId();
  const placeholder = nextId();
  const unionId = nextId();
  const name = (personId: string, givenNames: string) => ({
    id: nextId(),
    treeId,
    personId,
    type: 'birth' as const,
    givenNames,
    surname: 'Ndomo',
    authorAccountId: reader,
  });
  const snapshot: LocalTreeSnapshot = parseLocalTreeSnapshot({
    readerAccountId: reader,
    tree: {
      id: treeId,
      name: 'Famille Ndomo',
      language: 'fr',
      nameOrder: 'given_first',
      ownerAccountId: reader,
      settings: { mapEnabled: false },
    },
    people: [
      { id: father, treeId, nature: 'known', gender: 'male', version: 4 },
      { id: mother, treeId, nature: 'known', gender: 'female', version: 1 },
      { id: child, treeId, nature: 'known' },
      { id: placeholder, treeId, nature: 'placeholder' },
    ],
    names: [name(father, 'Abessolo'), name(mother, 'Mengue'), name(child, 'Owono')],
    unions: [
      {
        id: unionId,
        treeId,
        spouses: [
          { personId: father, rank: 1 },
          { personId: mother, rank: 1 },
        ],
      },
    ],
    simultaneityAnswers: [],
    filiations: [
      {
        id: nextId(),
        treeId,
        parentId: father,
        childId: child,
        type: 'birth',
        certainty: 'certain',
        originUnionId: unionId,
      },
      {
        id: nextId(),
        treeId,
        parentId: mother,
        childId: child,
        type: 'birth',
        certainty: 'certain',
        originUnionId: unionId,
      },
    ],
    parentCandidates: [],
    facts: [],
    titleRoles: [],
    multipleBirths: [],
    places: [],
    toPlace: [],
  });
  return {
    nextId,
    treeId,
    reader,
    otherAccount,
    father,
    mother,
    child,
    placeholder,
    unionId,
    snapshot,
  };
}
export type SmallTree = ReturnType<typeof smallTree>;
