// « Masqué équivaut à jamais saisi » (relecture gardien-confidentialite de T-013), sur des arbres
// générés : on retire au hasard des personnes, des unions et des filiations entre personnes
// visibles, comme le ferait le filtre de visibilité (les objets qui citent une personne retirée
// restent dans l'entrée). Le graphe obtenu doit répondre exactement comme celui d'un arbre où ces
// objets n'ont jamais été saisis : rangs saisis 1, 2, 3… parmi les unions restantes, pas d'union
// d'origine vers une union absente, pas de parent candidat sans union avec un parent restant.
// Tous les accesseurs publics sont comparés, et les liens entre des paires tirées au hasard.
import type { Filiation, Id, Union } from '@lignee/domain';
import { treeArbitrary, type GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph, type KinshipGraph } from './graph';
import { findRelationships } from './kinship';

/** L'arbre tel qu'il aurait été saisi sans les objets retirés. */
function neverEntered(
  tree: GeneratedTree,
  hiddenPeople: ReadonlySet<Id>,
  hiddenUnions: ReadonlySet<Id>,
  hiddenFiliations: ReadonlySet<Id>,
) {
  const people = tree.people.filter((person) => !hiddenPeople.has(person.id));
  const kept = tree.unions.filter(
    (union) =>
      !hiddenUnions.has(union.id) &&
      union.spouses.every((spouse) => !hiddenPeople.has(spouse.personId)),
  );
  // Rangs saisis : 1, 2, 3… dans l'ordre des rangs d'origine, parmi les unions restantes.
  const rankOf = new Map<string, number>();
  const byPerson = new Map<Id, Union[]>();
  for (const union of kept) {
    for (const spouse of union.spouses) {
      byPerson.set(spouse.personId, [...(byPerson.get(spouse.personId) ?? []), union]);
    }
  }
  for (const [personId, list] of byPerson) {
    const original = (union: Union) =>
      union.spouses.find((spouse) => spouse.personId === personId)?.rank ?? 0;
    [...list]
      .sort((x, y) => original(x) - original(y) || (x.id < y.id ? -1 : 1))
      .forEach((union, index) => rankOf.set(`${union.id}:${personId}`, index + 1));
  }
  const unions = kept.map((union) => ({
    ...union,
    spouses: union.spouses.map((spouse) => ({
      ...spouse,
      rank: rankOf.get(`${union.id}:${spouse.personId}`) ?? 1,
    })) as Union['spouses'],
  }));
  const unionIds = new Set(unions.map((union) => union.id));
  const filiations: Filiation[] = tree.filiations
    .filter(
      (filiation) =>
        !hiddenFiliations.has(filiation.id) &&
        !hiddenPeople.has(filiation.parentId) &&
        !hiddenPeople.has(filiation.childId),
    )
    .map((filiation) => {
      if (filiation.originUnionId === undefined || unionIds.has(filiation.originUnionId)) {
        return filiation;
      }
      const copy: Filiation = { ...filiation };
      delete copy.originUnionId;
      return copy;
    });
  // Un parent candidat n'aurait pas été proposé sans union avec un parent restant de l'enfant.
  const spousesOf = new Map<Id, Set<Id>>();
  for (const union of unions) {
    const [a, b] = union.spouses;
    spousesOf.set(a.personId, (spousesOf.get(a.personId) ?? new Set()).add(b.personId));
    spousesOf.set(b.personId, (spousesOf.get(b.personId) ?? new Set()).add(a.personId));
  }
  const parentCandidates = tree.parentCandidates.filter(
    (candidate) =>
      !hiddenPeople.has(candidate.childId) &&
      !hiddenPeople.has(candidate.candidateId) &&
      filiations.some(
        (filiation) =>
          filiation.childId === candidate.childId &&
          (spousesOf.get(filiation.parentId)?.has(candidate.candidateId) ?? false),
      ),
  );
  return { people, unions, filiations, parentCandidates };
}

function snapshot(graph: KinshipGraph, tree: GeneratedTree, pairs: readonly [Id, Id][]) {
  const people = tree.people.map((person) => person.id).filter((id) => graph.has(id));
  return {
    people: people.map((id) => ({
      person: graph.person(id),
      unions: graph.unionsOf(id),
      parents: graph.parentsOf(id),
      children: graph.childrenOf(id),
      candidates: graph.parentCandidatesOf(id),
      ancestors: graph.ancestors(id),
    })),
    unions: tree.unions.map((union) => graph.union(union.id)),
    filiations: tree.filiations.map((filiation) => graph.filiation(filiation.id)),
    links: pairs.map(([a, b]) => findRelationships(graph, a, b)),
  };
}

describe('masqué équivaut à jamais saisi', () => {
  it('mêmes réponses sur tous les accesseurs publics et sur les liens', () => {
    fc.assert(
      fc.property(
        treeArbitrary({ minSize: 2, maxSize: 80 }),
        fc.array(fc.nat(), { maxLength: 8 }),
        fc.array(fc.nat(), { maxLength: 6 }),
        fc.array(fc.nat(), { maxLength: 8 }),
        fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 6 }),
        (tree, peoplePicks, unionPicks, filiationPicks, pairPicks) => {
          const at = <T>(items: readonly T[], index: number) => items[index % items.length];
          const hiddenPeople = new Set(
            peoplePicks.map((index) => at(tree.people, index)?.id).filter((id) => id !== undefined),
          );
          const hiddenUnions = new Set(
            tree.unions.length === 0
              ? []
              : unionPicks
                  .map((index) => at(tree.unions, index)?.id)
                  .filter((id) => id !== undefined),
          );
          const hiddenFiliations = new Set(
            tree.filiations.length === 0
              ? []
              : filiationPicks
                  .map((index) => at(tree.filiations, index)?.id)
                  .filter((id) => id !== undefined),
          );
          // Filtre de visibilité : les objets masqués disparaissent ; ceux qui citent une
          // personne masquée restent dans l'entrée (le graphe doit les ignorer).
          const filtered = createKinshipGraph({
            people: tree.people.filter((person) => !hiddenPeople.has(person.id)),
            unions: tree.unions.filter((union) => !hiddenUnions.has(union.id)),
            filiations: tree.filiations.filter((filiation) => !hiddenFiliations.has(filiation.id)),
            parentCandidates: tree.parentCandidates,
          });
          const reference = createKinshipGraph(
            neverEntered(tree, hiddenPeople, hiddenUnions, hiddenFiliations),
          );
          const pairs = pairPicks
            .map(([i, j]): [Id | undefined, Id | undefined] => [
              at(tree.people, i)?.id,
              at(tree.people, j)?.id,
            ])
            .filter((pair): pair is [Id, Id] => pair[0] !== undefined && pair[1] !== undefined);
          expect(snapshot(filtered, tree, pairs)).toEqual(snapshot(reference, tree, pairs));
        },
      ),
      { numRuns: 200 },
    );
  }, 120_000);
});
