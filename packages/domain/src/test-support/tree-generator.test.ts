// Générateur d'arbres : reproductible, à la taille demandée, valide selon les schémas, avec les
// structures familiales qu'il annonce (vérifiées par des oracles écrits ici, pas par le
// générateur), et assez rapide pour les arbres types de 100, 1 000 et 5 000 personnes.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Id } from '../ids';
import { treeArbitrary } from './arbitraries';
import { treeDataIssues, type TreeData } from './tree-data';
import {
  generateTree,
  referenceTree,
  REFERENCE_TREE_SIZES,
  type TreeFeatures,
} from './tree-generator';

/** Structures familiales retrouvées dans un arbre, sans rien savoir du générateur. */
function observeStructures(data: TreeData) {
  const birthParents = new Map<Id, Id[]>();
  for (const filiation of data.filiations) {
    if (filiation.type !== 'birth') continue;
    birthParents.set(filiation.childId, [
      ...(birthParents.get(filiation.childId) ?? []),
      filiation.parentId,
    ]);
  }
  const parentsOf = (id: Id) => birthParents.get(id) ?? [];
  const siblings = (a: Id, b: Id) =>
    a !== b && parentsOf(a).some((parent) => parentsOf(b).includes(parent));
  const grandParents = (id: Id) => parentsOf(id).flatMap(parentsOf);
  const firstCousins = (a: Id, b: Id) =>
    !siblings(a, b) && grandParents(a).some((grandParent) => grandParents(b).includes(grandParent));
  const unionsOf = new Map<Id, typeof data.unions>();
  for (const union of data.unions) {
    for (const spouse of union.spouses) {
      unionsOf.set(spouse.personId, [...(unionsOf.get(spouse.personId) ?? []), union]);
    }
  }
  const other = (union: (typeof data.unions)[number], id: Id) =>
    union.spouses[0].personId === id ? union.spouses[1].personId : union.spouses[0].personId;
  const gender = new Map(data.people.map((person) => [person.id, person.gender]));

  let levirate = 0;
  let sororate = 0;
  let implex = 0;
  for (const union of data.unions) {
    const [a, b] = union.spouses.map((spouse) => spouse.personId) as [Id, Id];
    if (firstCousins(a, b)) implex += 1;
  }
  for (const [personId, own] of unionsOf) {
    // Lévirat : une femme dont une union s'est terminée par le décès du mari, puis une union
    // avec un frère de ce mari.
    if (gender.get(personId) === 'female') {
      for (const ended of own.filter((union) => union.endReason === 'death')) {
        const late = other(ended, personId);
        if (own.some((union) => union !== ended && siblings(other(union, personId), late)))
          levirate += 1;
      }
    }
    // Sororat : un homme uni à deux sœurs.
    if (gender.get(personId) === 'male') {
      const wives = own.map((union) => other(union, personId));
      wives.forEach((wife, index) => {
        if (wives.slice(index + 1).some((second) => siblings(wife, second))) sororate += 1;
      });
    }
  }
  const polygamous = [...unionsOf.values()].filter(
    (own) => own.filter((union) => union.simultaneity === 'simultaneous').length >= 2,
  ).length;
  const unknownParent = new Set(
    data.parentCandidates
      .filter((candidate) => parentsOf(candidate.childId).length === 1)
      .map((candidate) => candidate.childId),
  ).size;
  return {
    levirate,
    sororate,
    implex,
    polygamous,
    unknownParent,
    placeholders: data.people.filter((person) => person.nature === 'placeholder').length,
    nonBirthFiliations: data.filiations.filter((filiation) =>
      ['adoptive', 'raised', 'fostered', 'guardian'].includes(filiation.type),
    ).length,
    multipleBirths: data.multipleBirths.length,
    hidden: data.visibilityRules.filter((rule) => rule.level !== 'tree').length,
    toPlace: data.toPlace.length,
  };
}

/** Chaque structure annoncée par le générateur se retrouve au moins autant dans l'arbre. */
function expectAnnouncedStructures(data: TreeData, features: TreeFeatures) {
  const seen = observeStructures(data);
  expect(seen.levirate).toBeGreaterThanOrEqual(features.levirate);
  expect(seen.implex).toBeGreaterThanOrEqual(features.implex);
  expect(seen.unknownParent).toBe(features.unknownParentChildren);
  expect(seen.placeholders).toBe(features.placeholders);
  expect(seen.nonBirthFiliations).toBe(features.nonBirthFiliations);
  expect(seen.multipleBirths).toBe(features.multipleBirths);
  expect(seen.hidden).toBe(features.hiddenObjects);
  expect(seen.toPlace).toBe(features.toPlace);
  expect(seen.sororate).toBeGreaterThanOrEqual(features.sororate);
  expect(seen.polygamous).toBeGreaterThanOrEqual(features.polygamousPeople);
}

describe('générateur d’arbres', () => {
  it('donne le même arbre pour la même graine, et un autre pour une autre graine', () => {
    const first = generateTree({ seed: 42, size: 300 });
    expect(generateTree({ seed: 42, size: 300 })).toEqual(first);
    expect(generateTree({ seed: 43, size: 300 }).people[0]?.id).not.toBe(first.people[0]?.id);
  });

  it('produit exactement le nombre de personnes demandé', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 400 }), fc.integer(), (size, seed) => {
        expect(generateTree({ seed, size }).people).toHaveLength(size);
      }),
      { numRuns: 200 },
    );
  });

  it('un arbre type est une copie : le modifier ne change pas celui des tests suivants', () => {
    const first = referenceTree(100);
    const person = first.people[0];
    if (person === undefined) throw new Error('missing person');
    person.vitalStatus = 'deceased';
    first.people.pop();
    const second = referenceTree(100);
    expect(second.people).toHaveLength(100);
    expect(second).toEqual(generateTree({ seed: 20_260_100, size: 100 }));
  });

  it('refuse un arbre vide', () => {
    expect(() => generateTree({ seed: 1, size: 0 })).toThrow(RangeError);
  });

  it('contient les structures qu’il annonce, sur des arbres variés', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 200 }), (tree) => {
        expectAnnouncedStructures(tree, tree.features);
      }),
      { numRuns: 300 },
    );
  });

  it('noms générés : jamais « Inconnu », toujours une forme lisible', () => {
    const tree = referenceTree(1000);
    for (const name of tree.names) {
      for (const part of [name.givenNames, name.surname, name.displayForm]) {
        if (part === undefined) continue;
        expect(part).toMatch(/^[A-ZÀ-Ý][\p{L}' -]*$/u);
        expect(part.toLowerCase()).not.toContain('inconnu');
      }
    }
    // Une place à compléter n'a pas de nom (UNI-02).
    const placeholders = new Set(
      tree.people.filter((person) => person.nature === 'placeholder').map((person) => person.id),
    );
    expect(tree.names.some((name) => placeholders.has(name.personId))).toBe(false);
  });
});

describe('arbres types de 100, 1 000 et 5 000 personnes', () => {
  // Mesure faite sur le poste de développement : voir le rapport du ticket. Le budget de 3 s
  // garde une marge large pour la CI ; le TRD demande « moins de quelques secondes ».
  const BUDGET_MS = 3000;

  for (const size of REFERENCE_TREE_SIZES) {
    it(`${String(size)} personnes : générées en moins de ${String(BUDGET_MS)} ms, valides, avec polygamie, lévirat, sororat et implexe`, () => {
      const started = performance.now();
      const tree = generateTree({ seed: 20_260_000 + size, size });
      const elapsed = performance.now() - started;
      console.info(
        `arbre type ${String(size)} : généré en ${elapsed.toFixed(0)} ms ; ${String(tree.unions.length)} unions, ${String(tree.filiations.length)} filiations ; ${JSON.stringify(tree.features)}`,
      );
      expect(elapsed).toBeLessThan(BUDGET_MS);
      expect(tree).toEqual(referenceTree(size));
      expect(tree.people).toHaveLength(size);
      expect(treeDataIssues(tree)).toEqual([]);
      expectAnnouncedStructures(tree, tree.features);
      const { features } = tree;
      expect(features.polygamousPeople).toBeGreaterThan(0);
      expect(features.placeholders).toBeGreaterThan(0);
      expect(features.unknownParentChildren).toBeGreaterThan(0);
      expect(features.hiddenObjects).toBeGreaterThan(0);
      if (size >= 1000) {
        expect(features.levirate).toBeGreaterThan(0);
        expect(features.sororate).toBeGreaterThan(0);
        expect(features.implex).toBeGreaterThan(0);
        expect(features.successiveUnions).toBeGreaterThan(0);
        expect(features.nonBirthFiliations).toBeGreaterThan(0);
        expect(features.multipleBirths).toBeGreaterThan(0);
      }
    }, 30_000);
  }
});
