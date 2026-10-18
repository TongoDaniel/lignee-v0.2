// Propriétés de l'étape 6 et de la vue « descendance » (T-019) sur des arbres générés
// (polygamie, lévirat, sororat, implexe, unions entre générations, parents non précisés) : une
// seule fiche par personne dans la vue ordinaire tout dépliée (ascendants compris) comme dans la
// descendance ; l'implexe passe par un lien ou un renvoi, jamais par une seconde fiche ; ordre
// stable ; rien de masqué dans les liens ni dans la descendance.
import type { Id } from '@lignee/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { findDescendants, layoutDescendants, prepareDescendants } from '../descendants';
import type { TreeLayout } from '../layout-types';
import { expectLayoutInvariants } from '../test-support/layout-checks';
import { neverEntered, withoutObjects, withoutPeople } from '../test-support/layout-scenario';
import { treeViewArbitrary } from '../test-support/view-arbitrary';
import { layoutPrepared, layoutTree, prepareTree } from '../tree-layout';
import type { LayoutGraph } from '../types';

const viewArbitrary = treeViewArbitrary();

function unfoldedLayout(graph: LayoutGraph, centerId: Id): TreeLayout {
  const prepared = prepareTree(graph, centerId);
  const folds = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
  return layoutPrepared(prepared, { folds });
}

function serialized(layout: TreeLayout): string {
  return JSON.stringify({
    people: [...layout.people.values()],
    families: [...layout.families.values()],
    blocks: layout.blocks,
    links: layout.links,
  });
}

describe('propriétés de l’implexe et de la descendance (T-019)', { timeout: 120_000 }, () => {
  it('vue ordinaire tout dépliée et descendance : une fiche par personne, chaque lien présent', () => {
    // Compteurs : les arbres générés doivent produire de l'implexe et des renvois.
    const seen = { elsewhere: 0, long: 0, couple: 0, secondary: 0, seeAlso: 0 };
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const layout = unfoldedLayout(tree, centerId);
        expectLayoutInvariants(layout);
        const descendance = layoutDescendants(tree, centerId);
        expectLayoutInvariants(descendance);
        for (const link of [...layout.links, ...descendance.links]) {
          seen[link.nature] += 1;
          if (link.drawing === 'seeAlso') seen.seeAlso += 1;
        }
      }),
      { numRuns: 80 },
    );
    expect(seen.elsewhere).toBeGreaterThan(0);
    expect(seen.long).toBeGreaterThan(0);
    expect(seen.couple).toBeGreaterThan(0);
    expect(seen.secondary).toBeGreaterThan(0);
    expect(seen.seeAlso).toBeGreaterThan(0);
  });

  it('descendance : tous les descendants, dépliés, leurs foyers entiers, et personne d’autre', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const set = findDescendants(tree, centerId);
        const layout = layoutDescendants(tree, centerId);
        expect(new Set(layout.people.keys())).toEqual(set.people);
        expect(layout.people.get(centerId)?.x).toBe(0);
        for (const family of layout.families.values()) {
          expect(family.folded).toBe(false);
          expect(family.foldedByDefault).toBe(false);
          // Chaque enfant d'une famille de la vue est un descendant, et il est dessiné.
          for (const child of family.shownChildren) expect(set.descendants.has(child)).toBe(true);
          expect(family.shownChildren.length).toBe(family.childCount);
        }
        // Les descendants sont recalculés ici depuis la vue ordinaire : enfants des familles
        // dont un parent descend de l'ancêtre.
        const ordinary = prepareTree(tree, centerId);
        const expected = new Set<Id>([centerId]);
        const queue: Id[] = [centerId];
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          for (const key of ordinary.families.asParent.get(id) ?? []) {
            for (const child of ordinary.families.families.get(key)?.children ?? []) {
              if (!expected.has(child)) {
                expected.add(child);
                queue.push(child);
              }
            }
          }
        }
        expect(new Set(set.descendants)).toEqual(expected);
      }),
      { numRuns: 80 },
    );
  });

  it('ordre stable : même entrée, même résultat ; frères, sœurs et unions dans le même ordre que la vue ordinaire', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const first = layoutDescendants(tree, centerId);
        const second = layoutDescendants(tree, centerId);
        expect(serialized(second)).toBe(serialized(first));
        expect(layoutTree(tree, centerId).links).toEqual(layoutTree(tree, centerId).links);

        const ordinary = prepareTree(tree, centerId);
        const descendance = prepareDescendants(tree, centerId);
        for (const [key, family] of descendance.families.families) {
          const same = ordinary.families.families.get(key);
          if (same === undefined) continue;
          const kept = new Set(family.children);
          expect(family.children).toEqual(same.children.filter((id) => kept.has(id)));
        }
        expect(descendance.structure.unionOrderOf.get(centerId)).toEqual(
          ordinary.structure.unionOrderOf.get(centerId),
        );
      }),
      { numRuns: 60 },
    );
  });

  it('non-fuite : aucun lien ni aucune fiche de la descendance ne désigne une personne masquée', () => {
    fc.assert(
      fc.property(
        viewArbitrary,
        fc.array(fc.nat(), { minLength: 1, maxLength: 8 }),
        ({ tree, centerId }, picks) => {
          const candidates = tree.people.map((person) => person.id).filter((id) => id !== centerId);
          if (candidates.length === 0) return;
          const masked = new Set<Id>(picks.map((at) => candidates[at % candidates.length] as Id));
          const reader = withoutPeople(tree, masked);
          for (const layout of [
            unfoldedLayout(reader, centerId),
            layoutDescendants(reader, centerId),
          ]) {
            expectLayoutInvariants(layout);
            const text = serialized(layout);
            for (const id of masked) expect(text).not.toContain(id);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it('unions ou filiations masquées seules : même vue tout dépliée et même descendance que si elles n’avaient jamais été saisies', () => {
    fc.assert(
      fc.property(
        viewArbitrary,
        fc.array(fc.nat(), { maxLength: 4 }),
        fc.array(fc.nat(), { maxLength: 6 }),
        ({ tree, centerId }, unionPicks, filiationPicks) => {
          const pick = (list: readonly { id: Id }[], picks: readonly number[]) =>
            new Set(
              list.length === 0 ? [] : picks.map((at) => (list[at % list.length] as { id: Id }).id),
            );
          const masked = {
            unions: pick(tree.unions, unionPicks),
            filiations: pick(tree.filiations, filiationPicks),
            facts: new Set<Id>(),
          };
          const reader = withoutObjects(tree, masked);
          const clean = neverEntered(tree, masked);
          const views = [
            [unfoldedLayout(reader, centerId), unfoldedLayout(clean, centerId)],
            [layoutDescendants(reader, centerId), layoutDescendants(clean, centerId)],
          ] as const;
          for (const [seen, never] of views) {
            expect(serialized(seen)).toBe(serialized(never));
            for (const id of [...masked.unions, ...masked.filiations]) {
              expect(serialized(seen)).not.toContain(id);
            }
          }
        },
      ),
      { numRuns: 80 },
    );
  });
});
