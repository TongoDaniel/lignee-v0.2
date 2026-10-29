// Arbre inventé pour les tests des filtres et de la vue « descendance » (ARB-11, ARB-14, T-025) :
// Pierre, ses parents et son frère, ses trois épouses, quatre générations de descendants. Aucune
// donnée réelle. Réservé aux tests : l'application ne l'importe jamais. Construit à la main avec les
// schémas de `packages/domain` (le constructeur de scénarios charge `yaml`, absent de Jest).
import {
  createUuidV7Generator,
  filiationSchema,
  nameSchema,
  personSchema,
  simultaneityAnswerSchema,
  unionPair,
  unionSchema,
  type Fact,
  type Id,
  type Name,
  type Person,
  type Tree,
} from '@lignee/domain';

import { buildPersonCards } from '../tree/personCards';
import type { TreeModel } from '../tree/treeModel';

export const PIERRE = {
  personnes: [
    'jacques/M',
    'lea/F',
    'andre/M',
    'pierre/M',
    'rose/F',
    'odile/F',
    'clarisse/F',
    'jean/M',
    'marthe/F',
    'paul/M',
    'anne/F',
    'bruno/M',
    'carla/F',
    'serge/M',
    'luc/M',
    'lise/F',
    'noe/M',
    'tom/M',
    'zoe/F',
    'ugo/M',
    'yvette/F',
    'vic/M',
  ],
  unions: [
    { conjoints: ['jacques', 'lea'] },
    { conjoints: ['pierre', 'rose'] },
    { conjoints: ['pierre', 'odile'] },
    { conjoints: ['pierre', 'clarisse'] },
    { conjoints: ['bruno', 'carla'] },
    { conjoints: ['jean', 'anne'] },
    { conjoints: ['marthe', 'serge'] },
    { conjoints: ['luc', 'zoe'] },
    { conjoints: ['ugo', 'yvette'] },
  ],
  filiations: [
    { parents: ['jacques', 'lea'], enfant: 'pierre' },
    { parents: ['jacques', 'lea'], enfant: 'andre' },
    { parents: ['bruno', 'carla'], enfant: 'anne' },
    { parents: ['pierre', 'rose'], enfant: 'jean' },
    { parents: ['pierre', 'odile'], enfant: 'marthe' },
    { parents: ['pierre', 'clarisse'], enfant: 'paul' },
    { parents: ['jean', 'anne'], enfant: 'luc' },
    { parents: ['jean', 'anne'], enfant: 'lise' },
    { parents: ['marthe', 'serge'], enfant: 'noe' },
    { parents: ['paul'], enfant: 'tom' },
    { parents: ['luc', 'zoe'], enfant: 'ugo' },
    { parents: ['ugo', 'yvette'], enfant: 'vic' },
  ],
  simultaneites: [
    {
      unions: [
        ['pierre', 'rose'],
        ['pierre', 'odile'],
        ['pierre', 'clarisse'],
      ],
      reponse: 'simultanees',
    },
  ],
};

/** Ce que les tests lisent de l'arbre inventé. */
export interface PierreScenario {
  readonly id: (key: string) => Id;
  readonly keyOf: (id: Id) => string;
  readonly data: {
    readonly tree: Pick<Tree, 'id' | 'nameOrder'>;
    readonly people: readonly Person[];
    readonly names: readonly Name[];
    readonly facts: readonly Fact[];
  };
}

function deterministicIds(): () => Id {
  let tick = 1_790_000_000_000;
  let seed = 7;
  return createUuidV7Generator({
    now: () => (tick += 1),
    fillRandom: (bytes) => {
      for (let index = 0; index < bytes.length; index += 1) {
        seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
        bytes[index] = seed % 256;
      }
      return bytes;
    },
  });
}

/** Le modèle de l'écran de l'arbre, centré sur `centerKey`, pour le scénario de Pierre. */
export function pierreModel(centerKey = 'pierre'): { model: TreeModel; scenario: PierreScenario } {
  const nextId = deterministicIds();
  const treeId = nextId();
  const authorAccountId = nextId();
  const ids = new Map<string, Id>();
  const keys = new Map<Id, string>();
  const id = (key: string): Id => {
    const known = ids.get(key);
    if (known !== undefined) return known;
    if (!PIERRE.personnes.some((line) => line.startsWith(`${key}/`))) {
      throw new Error(`Unknown person: ${key}`);
    }
    const created = nextId();
    ids.set(key, created);
    keys.set(created, key);
    return created;
  };
  const people = PIERRE.personnes.map((line) => {
    const [key = '', gender = ''] = line.split('/');
    return personSchema.parse({
      id: id(key),
      treeId,
      nature: 'known',
      gender: gender === 'M' ? 'male' : 'female',
    });
  });
  const names = PIERRE.personnes.map((line) => {
    const [key = ''] = line.split('/');
    return nameSchema.parse({
      id: nextId(),
      treeId,
      personId: id(key),
      type: 'birth',
      authorAccountId,
      givenNames: key.charAt(0).toUpperCase() + key.slice(1),
    });
  });
  const unions = PIERRE.unions.map((line) =>
    unionSchema.parse({
      id: nextId(),
      treeId,
      spouses: line.conjoints.map((key) => ({
        personId: id(key),
        rank:
          PIERRE.unions
            .filter((other) => other.conjoints.includes(key))
            .findIndex((other) => other === line) + 1,
      })),
    }),
  );
  const filiations = PIERRE.filiations.flatMap((line) =>
    line.parents.map((parent) =>
      filiationSchema.parse({
        id: nextId(),
        treeId,
        parentId: id(parent),
        childId: id(line.enfant),
        type: 'birth',
        certainty: 'certain',
      }),
    ),
  );
  const unionOf = (a: string, b: string) => {
    const wanted = new Set([id(a), id(b)]);
    const found = unions.find((union) =>
      union.spouses.every((spouse) => wanted.has(spouse.personId)),
    );
    if (found === undefined) throw new Error(`No union between ${a} and ${b}`);
    return found.id;
  };
  const simultaneityAnswers = PIERRE.simultaneites.flatMap((line) => {
    const unionIds = line.unions.map(([a, b]) => unionOf(a ?? '', b ?? ''));
    return unionIds.flatMap((first, index) =>
      unionIds.slice(index + 1).map((second) =>
        simultaneityAnswerSchema.parse({
          id: nextId(),
          treeId,
          unionIds: unionPair(first, second),
          simultaneity: 'simultaneous',
        }),
      ),
    );
  });
  const scenario: PierreScenario = {
    id,
    keyOf: (value) => keys.get(value) ?? '',
    data: { tree: { id: treeId, nameOrder: 'given_first' }, people, names, facts: [] },
  };
  const model: TreeModel = {
    treeId,
    graph: { people, unions, filiations, simultaneityAnswers },
    cards: buildPersonCards({ people, names, facts: [], nameOrder: 'given_first' }),
    centerId: id(centerKey),
    supposedFiliations: new Set(),
  };
  return { model, scenario };
}
