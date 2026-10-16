// Propriétés de base vérifiées sur des milliers d'arbres générés (TRD, Tests et qualité),
// polygamie, lévirat, sororat, implexe, places à compléter et objets masqués compris : chaque
// objet passe son schéma, une union relie deux personnes distinctes avec un rang propre à
// chacune, un enfant a au plus deux parents de naissance, et aucune filiation ne forme un cycle.
// Les vérifications sont écrites ici, indépendamment du générateur. Le contrôle de cohérence
// livré à l'app (alertes, refus du cycle) est T-007.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Filiation } from '../filiation';
import type { Id } from '../ids';
import type { Union } from '../union';
import { treeArbitrary } from '../test-support/arbitraries';
import { treeDataIssues } from '../test-support/tree-data';
import { generateTree } from '../test-support/tree-generator';

/** Un cycle de filiation, s'il y en a un (tri topologique de Kahn, tous types de filiation). */
function hasFiliationCycle(people: readonly { id: Id }[], filiations: readonly Filiation[]) {
  const incoming = new Map<Id, number>(people.map((person) => [person.id, 0]));
  const children = new Map<Id, Id[]>();
  for (const filiation of filiations) {
    incoming.set(filiation.childId, (incoming.get(filiation.childId) ?? 0) + 1);
    children.set(filiation.parentId, [
      ...(children.get(filiation.parentId) ?? []),
      filiation.childId,
    ]);
  }
  const ready = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.pop();
    if (id === undefined) break;
    visited += 1;
    for (const child of children.get(id) ?? []) {
      const count = (incoming.get(child) ?? 0) - 1;
      incoming.set(child, count);
      if (count === 0) ready.push(child);
    }
  }
  return visited !== incoming.size;
}

function birthParentCounts(filiations: readonly Filiation[]) {
  const counts = new Map<Id, number>();
  for (const filiation of filiations) {
    if (filiation.type === 'birth') {
      counts.set(filiation.childId, (counts.get(filiation.childId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Rangs d'union de chaque personne. */
function ranksByPerson(unions: readonly Union[]) {
  const ranks = new Map<Id, number[]>();
  for (const union of unions) {
    for (const spouse of union.spouses) {
      ranks.set(spouse.personId, [...(ranks.get(spouse.personId) ?? []), spouse.rank]);
    }
  }
  return ranks;
}

describe('propriétés des arbres générés', () => {
  it('chaque objet passe son schéma Zod et chaque référence existe (1 000 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 80 }), (tree) => {
        expect(treeDataIssues(tree)).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  }, 120_000);

  it('une union relie deux personnes distinctes, chacune avec son rang ; les rangs d’une personne sont 1, 2, 3… sans doublon (2 000 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 150 }), (tree) => {
        for (const union of tree.unions) {
          expect(union.spouses).toHaveLength(2);
          expect(union.spouses[0].personId).not.toBe(union.spouses[1].personId);
        }
        for (const ranks of ranksByPerson(tree.unions).values()) {
          expect([...ranks].sort((a, b) => a - b)).toEqual(ranks.map((_, index) => index + 1));
        }
      }),
      { numRuns: 2000 },
    );
  }, 120_000);

  it('un enfant a au plus deux parents de naissance ; les autres liens sont sans limite (2 000 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 150 }), (tree) => {
        for (const count of birthParentCounts(tree.filiations).values()) {
          expect(count).toBeLessThanOrEqual(2);
        }
      }),
      { numRuns: 2000 },
    );
  }, 120_000);

  it('aucun cycle de filiation, implexe et adoptions compris (2 000 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 150 }), (tree) => {
        expect(hasFiliationCycle(tree.people, tree.filiations)).toBe(false);
      }),
      { numRuns: 2000 },
    );
  }, 120_000);

  it('les mêmes propriétés tiennent sur un arbre de 5 000 personnes', () => {
    const tree = generateTree({ seed: 7, size: 5000, rates: { polygamy: 0.5, implex: 0.3 } });
    expect(hasFiliationCycle(tree.people, tree.filiations)).toBe(false);
    for (const count of birthParentCounts(tree.filiations).values())
      expect(count).toBeLessThanOrEqual(2);
    expect(treeDataIssues(tree)).toEqual([]);
  }, 60_000);
});

// Les vérifications ci-dessus échoueraient si la propriété était fausse.
describe('les vérifications détectent un arbre fautif', () => {
  const tree = generateTree({ seed: 11, size: 60, rates: { polygamy: 0.6 } });

  it('un cycle de filiation est vu', () => {
    const [first] = tree.filiations;
    if (first === undefined) throw new Error('missing filiation');
    const reversed = { ...first, id: first.id, parentId: first.childId, childId: first.parentId };
    expect(hasFiliationCycle(tree.people, [...tree.filiations, reversed])).toBe(true);
  });

  it('un troisième parent de naissance est vu', () => {
    const child = tree.filiations.find((filiation) => filiation.type === 'birth');
    const stranger = tree.people.find(
      (person) =>
        !tree.filiations.some(
          (filiation) => filiation.childId === child?.childId && filiation.parentId === person.id,
        ),
    );
    if (child === undefined || stranger === undefined) throw new Error('missing data');
    const extra: Filiation[] = [0, 1].map(() => ({ ...child, parentId: stranger.id }));
    const counts = birthParentCounts([...tree.filiations, ...extra]);
    expect(Math.max(...counts.values())).toBeGreaterThan(2);
  });

  it('un objet invalide, une référence perdue ou un identifiant pris deux fois sont signalés', () => {
    const [person] = tree.people;
    const [union] = tree.unions;
    if (person === undefined || union === undefined) throw new Error('missing data');
    expect(treeDataIssues({ ...tree, people: [...tree.people, { ...person }] })).not.toEqual([]);
    expect(
      treeDataIssues({
        ...tree,
        unions: [{ ...union, spouses: [union.spouses[0], union.spouses[0]] }],
      }),
    ).not.toEqual([]);
    expect(
      treeDataIssues({
        ...tree,
        people: tree.people.filter((other) => other.id !== union.spouses[0].personId),
      }),
    ).not.toEqual([]);
  });
});
