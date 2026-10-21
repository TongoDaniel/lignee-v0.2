// Arbres des mesures de temps (PAR-01, T-028) : un chef de famille à 8 épouses et 40 enfants
// (TRD, Performance ; agent moteur-parente), et des paires tirées avec une graine fixe. Arbres
// générés : aucune famille réelle.
import type { Filiation, Id, Person, Union } from '@lignee/domain';
import { testTree } from '@lignee/domain/test-support';

import type { KinshipGraph } from '../graph';

/** Paires tirées avec une graine fixe (reproductible). */
export function* pairsOf(ids: readonly Id[], count: number, seed = 12345): Generator<[Id, Id]> {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state;
  };
  for (let index = 0; index < count; index += 1) {
    const a = ids[next() % ids.length];
    const b = ids[next() % ids.length];
    if (a !== undefined && b !== undefined) yield [a, b];
  }
}

/**
 * Paires proches : chaque enfant des `count` premières filiations avec un frère ou une sœur. Ce
 * sont les plus coûteuses, car elles ont le plus de chemins de sang et d'alliance.
 */
export function closePairs(
  graph: KinshipGraph,
  filiations: readonly Pick<Filiation, 'parentId' | 'childId'>[],
  count: number,
): [Id, Id][] {
  return filiations.slice(0, count).flatMap((filiation): [Id, Id][] =>
    graph
      .childrenOf(filiation.parentId)
      .map((sibling) => sibling.childId)
      .filter((sibling) => sibling !== filiation.childId)
      .slice(0, 1)
      .map((sibling) => [filiation.childId, sibling]),
  );
}

export interface ChiefOfFamily {
  people: Person[];
  unions: Union[];
  filiations: Filiation[];
  head: Person;
  wives: Person[];
  children: Person[];
}

/**
 * Un chef de famille, ses 8 épouses (rangs 1 à 8) et leurs 40 enfants (5 par épouse), chacun
 * marié avec trois enfants : 169 personnes.
 */
export function chiefOfFamily(): ChiefOfFamily {
  const context = testTree();
  const treeId = context.treeId;
  const person = (gender: 'female' | 'male'): Person => ({
    id: context.nextId(),
    treeId,
    nature: 'known',
    gender,
    vitalStatus: 'unknown',
    version: 0,
  });
  const filiation = (parentId: Id, childId: Id): Filiation => ({
    id: context.nextId(),
    treeId,
    parentId,
    childId,
    type: 'birth',
    certainty: 'certain',
    recognitionStatus: 'unknown',
  });
  const union = (a: Id, rankA: number, b: Id): Union => ({
    id: context.nextId(),
    treeId,
    spouses: [
      { personId: a, rank: rankA },
      { personId: b, rank: 1 },
    ],
    type: 'customary',
  });

  const head = person('male');
  const wives = Array.from({ length: 8 }, () => person('female'));
  const people = [head, ...wives];
  const unions = wives.map((wife, index) => union(head.id, index + 1, wife.id));
  const filiations: Filiation[] = [];
  const children: Person[] = [];
  for (let index = 0; index < 40; index += 1) {
    const child = person(index % 2 === 0 ? 'male' : 'female');
    const mother = wives[index % 8];
    if (mother === undefined) throw new Error('No wife');
    children.push(child);
    people.push(child);
    filiations.push(filiation(head.id, child.id), filiation(mother.id, child.id));
    // Chaque enfant marié, avec trois enfants.
    const spouse = person(index % 2 === 0 ? 'female' : 'male');
    people.push(spouse);
    unions.push(union(child.id, 1, spouse.id));
    for (let k = 0; k < 3; k += 1) {
      const grandchild = person('male');
      people.push(grandchild);
      filiations.push(filiation(child.id, grandchild.id), filiation(spouse.id, grandchild.id));
    }
  }
  return { people, unions, filiations, head, wives, children };
}
