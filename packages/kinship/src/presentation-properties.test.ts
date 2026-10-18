// Propriétés de la présentation des liens (T-022, ADR 0021) sur des arbres générés (polygamie,
// lévirat, sororat, implexe, places à compléter, filiations non biologiques), avec des
// certitudes tirées au hasard sur les filiations :
// - l'ordre est stable : le lien de B vers A est exactement l'inverse de celui de A vers B, dans
//   le même ordre, et le résultat ne dépend pas de l'ordre des objets ;
// - aucune confusion : la base est « naissance » si et seulement si toutes les filiations du lien
//   affiché sont de naissance, les filiations non biologiques sont exactement celles du lien
//   affiché, le côté porte le type de la filiation par laquelle A monte, une fratrie « de
//   naissance » ne compte que des filiations de naissance ;
// - la certitude affichée est la plus faible des filiations du lien affiché (calculée ici) ;
// - aucun chemin perdu ni dédoublé : chaque chemin de `findRelationships` est dans une seule
//   entrée, dans l'ordre, les chemins de fratrie tous dans l'entrée de fratrie ;
// - lévirat et sororat : demi-frère d'abord, et aussi cousin par l'autre parent (UNI-21) ;
// - masqué équivaut à jamais saisi, sur la présentation (PAR-09).
// Arbres peuplés (`populatedTreeArbitrary`) : chaque propriété vérifie aussi qu'elle a exercé
// ce qu'elle vise.
import type { Certainty, Id } from '@lignee/domain';
import type { GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createAllianceContext } from './alliance';
import { CERTAINTY_ORDER, createKinshipGraph, type KinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { invertPresentedLink, presentRelationships, type PresentedLink } from './presentation';
import { relationshipKey, type FiliationLink, type Relationship } from './relationship';
import { neverEntered } from './test-support/never-entered';
import { populatedTreeArbitrary } from './test-support/populated-trees';

const RUNS = 250;
const TIMEOUT = 120_000;

const CERTAINTIES: readonly Certainty[] = ['certain', 'probable', 'hypothetical'];

/** Arbre généré, certitudes des filiations tirées au hasard (cycliquement). */
const trees = fc
  .tuple(
    populatedTreeArbitrary({ minSize: 2, maxSize: 90 }),
    fc.array(fc.constantFrom(...CERTAINTIES), { minLength: 1, maxLength: 30 }),
  )
  .map(([tree, certainties]): GeneratedTree => ({
    ...tree,
    filiations: tree.filiations.map((filiation, index) => ({
      ...filiation,
      certainty: certainties[index % certainties.length] ?? filiation.certainty,
    })),
  }));

const pairPicks = fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 6 });

function graphOf(tree: GeneratedTree, reverse = false): KinshipGraph {
  const order = <T>(items: readonly T[]) => (reverse ? [...items].reverse() : [...items]);
  return createKinshipGraph({
    people: order(tree.people),
    unions: order(tree.unions),
    filiations: order(tree.filiations),
    parentCandidates: order(tree.parentCandidates),
  });
}

/**
 * Paires à examiner : tirées au hasard, plus, pour la première personne tirée, ses proches
 * (enfants de ses parents et de ses grands-parents, conjoints de ses parents), et l'enfant d'une
 * filiation non biologique avec les autres enfants de ce parent : des fratries, cousins,
 * alliances et liens non biologiques, pas seulement des inconnus.
 */
function pairsOf(graph: KinshipGraph, tree: GeneratedTree, picks: readonly [number, number][]) {
  const at = (index: number) => tree.people[index % tree.people.length]?.id;
  const pairs: [Id, Id][] = [];
  for (const [i, j] of picks) {
    const a = at(i);
    const b = at(j);
    if (a !== undefined && b !== undefined) pairs.push([a, b]);
  }
  const first = pairs[0]?.[0];
  if (first === undefined) return pairs;
  const near = new Set<Id>();
  for (const parent of graph.parentsOf(first)) {
    for (const child of graph.childrenOf(parent.parentId)) near.add(child.childId);
    for (const union of graph.unionsOf(parent.parentId)) {
      for (const spouse of union.spouses) near.add(spouse.personId);
    }
    for (const grand of graph.parentsOf(parent.parentId)) {
      for (const uncle of graph.childrenOf(grand.parentId)) {
        for (const cousin of graph.childrenOf(uncle.childId)) near.add(cousin.childId);
      }
    }
  }
  for (const b of [...near].sort().slice(0, 12)) pairs.push([first, b]);
  // Une filiation non biologique tirée : son enfant et les autres enfants de ce parent.
  const nonBirth = tree.filiations.filter((filiation) => filiation.type !== 'birth');
  const chosen = nonBirth[(picks[0]?.[1] ?? 0) % Math.max(1, nonBirth.length)];
  if (chosen !== undefined && graph.has(chosen.childId)) {
    for (const child of graph.childrenOf(chosen.parentId).slice(0, 6)) {
      pairs.push([chosen.childId, child.childId]);
    }
  }
  return pairs;
}

/** Toutes les filiations d'un chemin, lues ici dans ses segments. */
function pathFiliations(relationship: Relationship): FiliationLink[] {
  const links: FiliationLink[] = [];
  for (const segment of relationship.segments) {
    if (segment.kind === 'union') continue;
    links.push(...segment.ascent, ...segment.descent);
    for (const ancestor of segment.commonAncestors) {
      if (ancestor.fromSide !== undefined) links.push(ancestor.fromSide);
      if (ancestor.toSide !== undefined) links.push(ancestor.toSide);
    }
  }
  return links;
}

/** Filiations du lien affiché : le chemin, ou les parents communs comptés d'une fratrie. */
function displayed(link: PresentedLink): FiliationLink[] {
  if (link.sibling === undefined) {
    const [only] = link.relationships;
    return only === undefined ? [] : pathFiliations(only);
  }
  return [...link.sibling.link.sharedParents, ...link.sibling.adoptiveParents].flatMap((shared) => [
    shared.fromLink,
    shared.toLink,
  ]);
}

function isSiblingPath(relationship: Relationship): boolean {
  const [segment] = relationship.segments;
  return (
    relationship.kind === 'blood' &&
    segment?.kind === 'blood' &&
    segment.generationsUp === 1 &&
    segment.generationsDown === 1
  );
}

describe('propriétés de la présentation des liens sur des arbres générés', () => {
  it(
    'ordre stable : B vers A est l’inverse de A vers B, indépendant de l’ordre des objets',
    () => {
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          const graph = graphOf(tree);
          const reversed = graphOf(tree, true);
          const allianceContext = createAllianceContext(tree);
          for (const [a, b] of pairsOf(graph, tree, picks)) {
            const forward = presentRelationships(graph, a, b, { allianceContext });
            const backward = presentRelationships(graph, b, a, { allianceContext });
            expect(presentRelationships(reversed, a, b, { allianceContext })).toEqual(forward);
            if (forward.status !== 'related' || backward.status !== 'related') {
              expect(backward.status).toBe(forward.status);
              continue;
            }
            expect(backward.truncated).toBe(forward.truncated);
            expect(backward.links).toEqual(forward.links.map(invertPresentedLink));
            expect(forward.links.map((link) => link.rank)).toEqual(
              forward.links.map((_, index) => (index === 0 ? 'main' : 'also')),
            );
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'aucune confusion naissance / non biologique ; certitude = la plus faible du lien affiché',
    () => {
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          const graph = graphOf(tree);
          for (const [a, b] of pairsOf(graph, tree, picks)) {
            const result = presentRelationships(graph, a, b);
            if (result.status !== 'related') continue;
            for (const link of result.links) {
              const shown = displayed(link);
              const nonBirth = shown.filter((filiation) => filiation.type !== 'birth');
              expect(link.basis).toBe(nonBirth.length === 0 ? 'birth' : 'other');
              expect(link.nonBirth.map((filiation) => filiation.filiationId)).toEqual(
                [...new Set(nonBirth.map((filiation) => filiation.filiationId))].sort(),
              );
              expect(new Set(link.nonBirthTypes)).toEqual(
                new Set(nonBirth.map((filiation) => filiation.type)),
              );
              const weakest = shown.reduce<Certainty>(
                (min, filiation) =>
                  CERTAINTY_ORDER[filiation.certainty] > CERTAINTY_ORDER[min]
                    ? filiation.certainty
                    : min,
                'certain',
              );
              expect(link.certainty).toBe(weakest);
              // Le côté : une filiation affichée de A vers ce parent, de ce type.
              if (link.fromSide !== undefined) {
                const { parentId, type } = link.fromSide;
                expect(
                  shown.some(
                    (filiation) =>
                      filiation.childId === a &&
                      filiation.parentId === parentId &&
                      filiation.type === type,
                  ),
                ).toBe(true);
              }
              if (link.toSide !== undefined) {
                const { parentId, type } = link.toSide;
                expect(
                  shown.some(
                    (filiation) =>
                      filiation.childId === b &&
                      filiation.parentId === parentId &&
                      filiation.type === type,
                  ),
                ).toBe(true);
              }
              // Une fratrie « de naissance » ne compte que des filiations de naissance ; une
              // fratrie qui n'en a pas n'est jamais dite « de naissance ».
              if (link.sibling !== undefined) {
                const { kind } = link.sibling;
                expect(kind === 'birth').toBe(link.basis === 'birth');
                if (kind === 'adoption' || kind === 'other') {
                  expect(link.sibling.link.basis).toBe('other');
                }
                if (kind === 'adoption') {
                  expect(shown.every((f) => f.type === 'birth' || f.type === 'adoptive')).toBe(
                    true,
                  );
                }
              }
              const [first] = link.relationships;
              expect(link.nature).toBe(first?.kind);
            }
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'aucun chemin perdu ni dédoublé, le plus proche d’abord, la fratrie réunie',
    () => {
      // Ce que les arbres générés ont réellement exercé (vérifié à la fin).
      const seen = {
        also: 0,
        nonBirth: 0,
        uncertain: 0,
        siblingOther: 0,
        alliance: 0,
      };
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          const graph = graphOf(tree);
          for (const [a, b] of pairsOf(graph, tree, picks)) {
            const paths = findRelationships(graph, a, b);
            const result = presentRelationships(graph, a, b);
            if (paths.status !== 'related' || result.status !== 'related') {
              expect(result.status).toBe(paths.status);
              continue;
            }
            const presented = result.links.flatMap((link) => link.relationships);
            expect(presented.map(relationshipKey).sort()).toEqual(
              paths.relationships.map(relationshipKey).sort(),
            );
            expect(result.links[0]?.relationships[0]).toEqual(paths.relationships[0]);
            const siblingEntries = result.links.filter((link) => link.sibling !== undefined);
            expect(siblingEntries.length).toBe(paths.relationships.some(isSiblingPath) ? 1 : 0);
            for (const link of result.links) {
              expect(link.relationships.every(isSiblingPath)).toBe(link.sibling !== undefined);
              if (link.rank === 'also') seen.also += 1;
              if (link.basis === 'other') seen.nonBirth += 1;
              if (link.certainty !== 'certain') seen.uncertain += 1;
              if (link.sibling !== undefined && link.sibling.kind !== 'birth') {
                seen.siblingOther += 1;
              }
              if (link.nature === 'alliance') seen.alliance += 1;
            }
          }
        }),
        { numRuns: RUNS },
      );
      for (const [feature, count] of Object.entries(seen)) {
        expect(count, `${feature} ${JSON.stringify(seen)}`).toBeGreaterThan(0);
      }
    },
    TIMEOUT,
  );

  it(
    'UNI-21 — lévirat, sororat : demi-frère d’abord, et aussi cousin par l’autre parent',
    () => {
      let found = 0;
      fc.assert(
        fc.property(trees, (tree) => {
          const graph = graphOf(tree);
          const birthParents = (id: Id) =>
            graph
              .parentsOf(id)
              .filter((filiation) => filiation.type === 'birth')
              .map((filiation) => filiation.parentId);
          // A et B : un parent de naissance commun P, et leurs autres parents de naissance X et Y,
          // différents, enfants de naissance d'un même G (frères ou sœurs : lévirat, sororat).
          for (const person of tree.people) {
            const a = person.id;
            for (const p of birthParents(a)) {
              for (const child of graph.childrenOf(p)) {
                const b = child.childId;
                if (b === a || child.type !== 'birth') continue;
                for (const x of birthParents(a).filter((id) => id !== p)) {
                  for (const y of birthParents(b).filter((id) => id !== p && id !== x)) {
                    const common = birthParents(x).filter(
                      (g) => birthParents(y).includes(g) && ![a, b, p].includes(g),
                    );
                    if (common.length === 0 || birthParents(b).includes(x)) continue;
                    const result = presentRelationships(graph, a, b);
                    if (result.status !== 'related' || result.truncated) continue;
                    found += 1;
                    const [main, ...also] = result.links;
                    expect(main?.sibling?.kind).toBe('birth');
                    expect(main?.sibling?.link.sharedParents.map((s) => s.personId)).toContain(p);
                    expect(
                      also.some((link) => {
                        const segment = link.relationships[0]?.segments[0];
                        return (
                          link.nature === 'blood' &&
                          segment?.kind === 'blood' &&
                          segment.generationsUp === 2 &&
                          segment.generationsDown === 2 &&
                          link.fromSide?.parentId === x &&
                          link.toSide?.parentId === y
                        );
                      }),
                    ).toBe(true);
                  }
                }
              }
            }
          }
        }),
        { numRuns: RUNS },
      );
      expect(found).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'PAR-09 — masqué équivaut à jamais saisi, sur la présentation',
    () => {
      fc.assert(
        fc.property(
          trees,
          fc.array(fc.nat(), { maxLength: 6 }),
          fc.array(fc.nat(), { maxLength: 4 }),
          fc.array(fc.nat(), { maxLength: 6 }),
          pairPicks,
          (tree, peoplePicks, unionPicks, filiationPicks, picks) => {
            const at = <T>(items: readonly T[], index: number) =>
              items.length === 0 ? undefined : items[index % items.length];
            const ids = (items: readonly { id: Id }[], chosen: readonly number[]) =>
              new Set(chosen.map((index) => at(items, index)?.id).filter((id) => id !== undefined));
            const hiddenPeople = ids(tree.people, peoplePicks);
            const hiddenUnions = ids(tree.unions, unionPicks);
            const hiddenFiliations = ids(tree.filiations, filiationPicks);
            // Filtre : les objets masqués disparaissent ; ceux qui citent une personne masquée
            // restent dans l'entrée, le graphe doit les ignorer.
            const filteredData = {
              ...tree,
              people: tree.people.filter((person) => !hiddenPeople.has(person.id)),
              unions: tree.unions.filter((union) => !hiddenUnions.has(union.id)),
              filiations: tree.filiations.filter((f) => !hiddenFiliations.has(f.id)),
            };
            const never = neverEntered(tree, hiddenPeople, hiddenUnions, hiddenFiliations);
            const filtered = createKinshipGraph(filteredData);
            const reference = createKinshipGraph(never);
            // Contexte de l'alliance non filtré : le moteur ne doit jamais lire ce qui est masqué.
            const leaky = createAllianceContext(tree);
            const clean = createAllianceContext(never);
            for (const [a, b] of pairsOf(createKinshipGraph(tree), tree, picks)) {
              expect(presentRelationships(filtered, a, b, { allianceContext: leaky })).toEqual(
                presentRelationships(reference, a, b, { allianceContext: clean }),
              );
            }
          },
        ),
        { numRuns: 150 },
      );
    },
    TIMEOUT,
  );
});
