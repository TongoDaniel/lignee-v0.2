// Propriétés des étapes 1 et 2 sur des arbres générés (polygamie, unions successives, lévirat,
// sororat, implexe, parents non précisés avec candidats, adoption, places à compléter), vues
// depuis une personne tirée au hasard. Les vérifications sont écrites ici, sans se fier au code
// vérifié : chaque personne une seule fois, chaque union dans un seul foyer, chaque enfant à une
// seule place, ordre des foyers conforme aux rangs et aux dates, aucune règle de genre.
import { compareFuzzyDates, fuzzyDateSortKey, type Id } from '@lignee/domain';
import type { GeneratedTree } from '@lignee/domain/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildTreeStructure } from '../structure';
import { comparableStructure, swapGenders } from '../test-support/layout-scenario';
import { treeViewArbitrary } from '../test-support/view-arbitrary';
import type { TreeStructure } from '../types';

/** Un arbre généré et une personne centrale prise dans sa plus grande famille. */
const viewArbitrary = treeViewArbitrary();

function count<T>(values: readonly T[]): Map<T, number> {
  const result = new Map<T, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function unionsById(tree: GeneratedTree) {
  return new Map(tree.unions.map((union) => [union.id, union]));
}

function dated(start: Parameters<typeof fuzzyDateSortKey>[0]): boolean {
  return start !== undefined && fuzzyDateSortKey(start).startsWith('0:');
}

// Cent arbres par propriété, certains calculés deux fois : quelques secondes sur un poste calme,
// bien plus sur une machine chargée. Délai large, pour qu'un ralentissement ne passe pas pour un
// échec.
describe('propriétés de la disposition (étapes 1 et 2)', { timeout: 60_000 }, () => {
  it('étape 1 : chaque personne a une seule rangée, par un plus court chemin cohérent', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        const placed = [...structure.rows.values()].flat();
        expect(new Set(placed).size).toBe(placed.length);
        expect(new Set([...placed, ...structure.unreachable]).size).toBe(tree.people.length);
        expect(placed.length).toBe(structure.rowOf.size);
        expect(structure.rowOf.get(centerId)).toBe(0);
        // Chaque personne (hors centre) a un voisin à une distance de moins, depuis lequel sa
        // rangée s'obtient par le lien qui les relie.
        const steps = new Map<Id, { from: Id; delta: number }[]>();
        const add = (to: Id, from: Id, delta: number) => {
          steps.set(to, [...(steps.get(to) ?? []), { from, delta }]);
        };
        for (const filiation of tree.filiations) {
          add(filiation.childId, filiation.parentId, 1);
          add(filiation.parentId, filiation.childId, -1);
        }
        for (const union of tree.unions) {
          add(union.spouses[0].personId, union.spouses[1].personId, 0);
          add(union.spouses[1].personId, union.spouses[0].personId, 0);
        }
        for (const [id, distance] of structure.distanceOf) {
          if (id === centerId) continue;
          const reached = (steps.get(id) ?? []).filter(
            ({ from }) => structure.distanceOf.get(from) === distance - 1,
          );
          expect(reached.length).toBeGreaterThan(0);
          const rows = reached.map(({ from, delta }) => (structure.rowOf.get(from) ?? 0) + delta);
          expect(rows).toContain(structure.rowOf.get(id));
          // La rangée gardée est la plus proche du centre parmi celles des plus courts chemins.
          const best = Math.min(...rows.map(Math.abs));
          expect(Math.abs(structure.rowOf.get(id) ?? 0)).toBe(best);
        }
      }),
    );
  });

  it('étape 2 : une unité par personne au plus, chaque union dans un seul foyer, chaque enfant à une seule place', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        const reachable = (id: Id) => structure.rowOf.has(id);

        const hubs = structure.units.map((unit) => unit.hubId);
        expect(new Set(hubs).size).toBe(hubs.length);
        for (const unit of structure.units) {
          expect(unit.row).toBe(structure.rowOf.get(unit.hubId));
          for (const foyer of unit.foyers) expect(foyer.hubId).toBe(unit.hubId);
        }

        const foyerKeys = structure.units.flatMap((unit) => unit.foyers.map((foyer) => foyer.key));
        expect(new Set(foyerKeys).size).toBe(foyerKeys.length);
        const reachableUnions = tree.unions.filter((union) => reachable(union.spouses[0].personId));
        expect(new Set(foyerKeys.filter((key) => !key.startsWith('parents:')))).toEqual(
          new Set(reachableUnions.map((union) => union.id)),
        );
        // Chaque union est portée par un conjoint et signalée « ailleurs » chez l'autre.
        for (const union of reachableUnions) {
          const foyer = structure.foyerOf.get(union.id);
          const spouses = union.spouses.map((spouse) => spouse.personId);
          expect(new Set([foyer?.hubId, foyer?.partnerId])).toEqual(new Set(spouses));
          const other = spouses.find((id) => id !== foyer?.hubId) as Id;
          const elsewhere = structure.unitOf.get(other)?.foyersElsewhere ?? [];
          if (structure.unitOf.has(other)) expect(elsewhere).toContain(union.id);
        }

        const occurrences = count(
          structure.units.flatMap((unit) => [
            ...unit.foyers.flatMap((foyer) => foyer.children),
            ...(unit.unspecified?.children.map((child) => child.childId) ?? []),
          ]),
        );
        const withParents = new Set(
          tree.filiations.map((filiation) => filiation.childId).filter(reachable),
        );
        for (const id of structure.rowOf.keys()) {
          expect(occurrences.get(id) ?? 0).toBe(withParents.has(id) ? 1 : 0);
        }
        expect(new Set(structure.placementOf.keys())).toEqual(withParents);
      }),
    );
  });

  it('chaque filiation range l’enfant ou reste un lien secondaire ; un trait long relie des rangées non voisines', () => {
    let longLinks = 0;
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        longLinks += structure.crossLinks.filter((link) => link.role === 'long').length;
        const used = new Set(
          [...structure.placementOf.values()].flatMap((placement) => placement.filiationIds),
        );
        const links = new Map(
          structure.crossLinks
            .filter((link) => link.kind === 'filiation')
            .map((link) => [link.id, link]),
        );
        for (const filiation of tree.filiations) {
          if (!structure.rowOf.has(filiation.childId)) continue;
          const span =
            (structure.rowOf.get(filiation.childId) ?? 0) -
            (structure.rowOf.get(filiation.parentId) ?? 0);
          const link = links.get(filiation.id);
          if (!used.has(filiation.id)) expect(link?.role).toBe('secondary');
          else if (span === 1) expect(link).toBeUndefined();
          else expect(link).toMatchObject({ role: 'long', rowSpan: span });
        }
        for (const foyer of structure.foyerOf.values()) {
          const span =
            (structure.rowOf.get(foyer.partnerId) ?? 0) - (structure.rowOf.get(foyer.hubId) ?? 0);
          const link = structure.crossLinks.find(
            (candidate) => candidate.kind === 'union' && candidate.id === foyer.unionId,
          );
          if (foyer.unionId === undefined || span === 0) expect(link).toBeUndefined();
          else expect(link).toMatchObject({ role: 'long', rowSpan: span });
        }
        // Un enfant rangé dans un foyer est l'enfant de ses deux parents.
        for (const foyer of structure.foyerOf.values()) {
          for (const child of foyer.children) {
            const parents = new Set(
              tree.filiations
                .filter((filiation) => filiation.childId === child)
                .map((filiation) => filiation.parentId),
            );
            expect(parents.has(foyer.hubId) && parents.has(foyer.partnerId)).toBe(true);
          }
        }
      }),
    );
    // Les unions entre générations de l'arbitraire produisent des traits longs : la propriété
    // les a vraiment vus.
    expect(longLinks).toBeGreaterThan(0);
  });

  it('ordre des foyers : les unions datées par date, les autres à la place de leur rang (ADR 0013)', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        const unions = unionsById(tree);
        for (const unit of structure.units) {
          const ordered = unit.foyers.flatMap((foyer) => {
            const union = foyer.unionId === undefined ? undefined : unions.get(foyer.unionId);
            return union === undefined ? [] : [{ foyer, union }];
          });
          const datedOnes = ordered.filter(({ union }) => dated(union.start));
          for (let i = 1; i < datedOnes.length; i += 1) {
            const previous = datedOnes[i - 1];
            const current = datedOnes[i];
            if (previous === undefined || current === undefined) continue;
            expect(
              compareFuzzyDates(previous.union.start, current.union.start),
            ).toBeLessThanOrEqual(0);
          }
          const undated = ordered.filter(({ union }) => !dated(union.start));
          for (let i = 1; i < undated.length; i += 1) {
            expect(undated[i - 1]?.foyer.hubRank ?? 0).toBeLessThanOrEqual(
              undated[i]?.foyer.hubRank ?? 0,
            );
          }
          // Les places des unions datées sont celles que leur donnerait le seul rang.
          const byRank = [...ordered].sort(
            (a, b) =>
              (a.foyer.hubRank ?? 0) - (b.foyer.hubRank ?? 0) ||
              compareFuzzyDates(a.union.start, b.union.start) ||
              (a.union.id < b.union.id ? -1 : 1),
          );
          expect(ordered.map(({ union }) => dated(union.start))).toEqual(
            byRank.map(({ union }) => dated(union.start)),
          );
          // Les unions sans union enregistrée viennent après.
          const firstParents = unit.foyers.findIndex((foyer) => foyer.unionId === undefined);
          if (firstParents >= 0) {
            expect(
              unit.foyers.slice(firstParents).every((foyer) => foyer.unionId === undefined),
            ).toBe(true);
          }
        }
      }),
    );
  });

  it('UNI-07 : échanger les rangs de deux unions sans date échange leurs foyers', () => {
    let exercised = 0;
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        const unions = unionsById(tree);
        for (const unit of structure.units) {
          const undated = unit.foyers.filter((foyer) => {
            const union = foyer.unionId === undefined ? undefined : unions.get(foyer.unionId);
            return union !== undefined && !dated(union.start);
          });
          const [first, second] = undated;
          if (first?.unionId === undefined || second?.unionId === undefined) continue;
          if (first.hubRank === second.hubRank) continue;
          const swapRank = (id: Id, rank: number | undefined) => {
            const union = unions.get(id);
            if (union === undefined || rank === undefined) throw new Error('missing union');
            return {
              ...union,
              spouses: union.spouses.map((spouse) =>
                spouse.personId === unit.hubId ? { ...spouse, rank } : spouse,
              ) as typeof union.spouses,
            };
          };
          const changed = tree.unions.map((union) =>
            union.id === first.unionId
              ? swapRank(first.unionId, second.hubRank)
              : union.id === second.unionId
                ? swapRank(second.unionId, first.hubRank)
                : union,
          );
          const after = buildTreeStructure({ ...tree, unions: changed }, centerId);
          const keys = after.unitOf.get(unit.hubId)?.foyers.map((foyer) => foyer.key) ?? [];
          expect(keys.indexOf(second.key)).toBeLessThan(keys.indexOf(first.key));
          exercised += 1;
          return;
        }
      }),
    );
    expect(exercised).toBeGreaterThan(10);
  });

  it('ARB-05 : préciser un parent parmi les candidats déplace l’enfant dans le foyer de ce couple', () => {
    let exercised = 0;
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        for (const unit of structure.units) {
          const column = unit.unspecified;
          for (const child of column?.children ?? []) {
            if (column === undefined) continue;
            const candidate = child.candidateIds.find((id) =>
              tree.unions.some((union) => {
                const ids = union.spouses.map((spouse) => spouse.personId);
                return ids.includes(id) && ids.includes(column.parentId);
              }),
            );
            const sample = tree.filiations.find(
              (filiation) =>
                filiation.childId === child.childId && filiation.parentId === column.parentId,
            );
            if (candidate === undefined || sample?.type !== 'birth') continue;
            const after = buildTreeStructure(
              {
                ...tree,
                filiations: [
                  ...tree.filiations,
                  { ...sample, id: `${sample.id.slice(0, -4)}ffff`, parentId: candidate },
                ],
                parentCandidates: tree.parentCandidates.filter(
                  (entry) => entry.childId !== child.childId,
                ),
              },
              centerId,
            );
            const placement = after.placementOf.get(child.childId);
            expect(placement?.kind).toBe('foyer');
            const foyer =
              placement?.kind === 'foyer' ? after.foyerOf.get(placement.foyerKey) : undefined;
            expect(new Set([foyer?.hubId, foyer?.partnerId])).toEqual(
              new Set([column.parentId, candidate]),
            );
            expect(
              after.unitOf
                .get(column.parentId)
                ?.unspecified?.children.some((entry) => entry.childId === child.childId) ?? false,
            ).toBe(false);
            exercised += 1;
            return;
          }
        }
      }),
    );
    expect(exercised).toBeGreaterThan(10);
  });

  it('aucune règle de genre : femmes et hommes inversés, même disposition', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const structure = buildTreeStructure(tree, centerId);
        const swapped = buildTreeStructure(swapGenders(tree), centerId);
        expect(comparableStructure(swapped)).toEqual(comparableStructure(structure));
      }),
      { numRuns: 50 },
    );
  });

  it('fonction pure : même graphe, même résultat, graphe inchangé', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const before = JSON.stringify(tree);
        const first: TreeStructure = buildTreeStructure(tree, centerId);
        const second = buildTreeStructure(tree, centerId);
        expect(comparableStructure(second)).toEqual(comparableStructure(first));
        expect(JSON.stringify(tree)).toBe(before);
      }),
      { numRuns: 30 },
    );
  });
});
