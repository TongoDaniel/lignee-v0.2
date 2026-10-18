// « Masqué équivaut à jamais saisi » (relecture gardien-confidentialite de T-013), sur des arbres
// générés : on retire au hasard des personnes, des unions et des filiations entre personnes
// visibles, comme le ferait le filtre de visibilité (les objets qui citent une personne retirée
// restent dans l'entrée). Le graphe obtenu doit répondre exactement comme celui d'un arbre où ces
// objets n'ont jamais été saisis : rangs saisis 1, 2, 3… parmi les unions restantes, pas d'union
// d'origine vers une union absente, pas de parent candidat sans union avec un parent restant.
// Tous les accesseurs publics sont comparés, la fratrie de chacun (T-020), et les liens et la
// fratrie entre des paires tirées au hasard, et l'alliance nommée (T-021) avec les réponses et
// les faits des objets masqués laissés dans son contexte. Les mentions « distincte de » vers une
// personne masquée disparaissent (ADR 0017).
import type { Id } from '@lignee/domain';
import { treeArbitrary, type GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createAllianceContext, type AllianceContext } from './alliance';
import { createKinshipGraph, type KinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { siblingLink, siblingsOf } from './siblings';
import { neverEntered } from './test-support/never-entered';

function snapshot(
  graph: KinshipGraph,
  tree: GeneratedTree,
  pairs: readonly [Id, Id][],
  allianceContext: AllianceContext,
) {
  const people = tree.people.map((person) => person.id).filter((id) => graph.has(id));
  return {
    people: people.map((id) => ({
      person: graph.person(id),
      unions: graph.unionsOf(id),
      parents: graph.parentsOf(id),
      children: graph.childrenOf(id),
      candidates: graph.parentCandidatesOf(id),
      ancestors: graph.ancestors(id),
      siblings: siblingsOf(graph, id),
    })),
    unions: tree.unions.map((union) => graph.union(union.id)),
    filiations: tree.filiations.map((filiation) => graph.filiation(filiation.id)),
    links: pairs.map(([a, b]) => findRelationships(graph, a, b)),
    // Alliance nommée (T-021) : décès et réponses lus dans l'arbre, jamais pour une union absente.
    allianceLinks: pairs.map(([a, b]) => findRelationships(graph, a, b, { allianceContext })),
    siblingLinks: pairs.map(([a, b]) => siblingLink(graph, a, b)),
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
          const never = neverEntered(tree, hiddenPeople, hiddenUnions, hiddenFiliations);
          const reference = createKinshipGraph(never);
          const pairs = pairPicks
            .map(([i, j]): [Id | undefined, Id | undefined] => [
              at(tree.people, i)?.id,
              at(tree.people, j)?.id,
            ])
            .filter((pair): pair is [Id, Id] => pair[0] !== undefined && pair[1] !== undefined);
          // Le contexte de l'alliance garde ici les réponses et les faits des objets masqués : le
          // moteur ne doit jamais les lire (défense en profondeur ; le filtre les retire aussi).
          expect(snapshot(filtered, tree, pairs, createAllianceContext(tree))).toEqual(
            snapshot(reference, tree, pairs, createAllianceContext(never)),
          );
        },
      ),
      { numRuns: 200 },
    );
  }, 120_000);
});
