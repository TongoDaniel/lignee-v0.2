// Propriétés des étapes 3 à 5 (T-012) sur des arbres générés (polygamie, unions successives,
// lévirat, sororat, implexe, parents non précisés, adoption, unions entre générations), vus depuis
// une personne tirée au hasard, avec des replis tirés au hasard : aucun chevauchement, groupes de
// conjoints et fratries jamais coupés, compteurs limités au graphe reçu, aucune règle de genre,
// fonction pure, cache cohérent, croisements jamais augmentés par l'étape 3.
import type { Id } from '@lignee/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { FoldChoices, TreeLayout } from '../layout-types';
import { expectLayoutInvariants } from '../test-support/layout-checks';
import { swapGenders, withoutPeople } from '../test-support/layout-scenario';
import { treeViewArbitrary } from '../test-support/view-arbitrary';
import {
  createTreeLayoutCache,
  layoutPrepared,
  layoutTree,
  prepareTree,
  toggleFamily,
} from '../tree-layout';

const viewArbitrary = treeViewArbitrary();

/** Choix de repli tirés au hasard : une part des familles de l'arbre, dépliées ou repliées. */
const foldsArbitrary = fc.array(fc.tuple(fc.nat(), fc.boolean()), { maxLength: 12 });

function foldsFor(keys: readonly string[], draws: readonly (readonly [number, boolean])[]) {
  const folds = new Map<string, boolean>();
  if (keys.length === 0) return folds;
  for (const [at, folded] of draws) folds.set(keys[at % keys.length] as string, folded);
  return folds;
}

/** Forme comparable d'une disposition (les cartes ne se comparent pas avec `toEqual`). */
function comparable(layout: TreeLayout) {
  return {
    people: [...layout.people.values()],
    families: [...layout.families.values()],
    blocks: layout.blocks,
    crossings: layout.crossings,
  };
}

describe('propriétés de la disposition (étapes 3 à 5)', { timeout: 120_000 }, () => {
  it('aucun chevauchement, foyers et fratries jamais coupés, repli cohérent (replis par défaut et au hasard)', () => {
    fc.assert(
      fc.property(viewArbitrary, foldsArbitrary, ({ tree, centerId }, draws) => {
        const prepared = prepareTree(tree, centerId);
        const byDefault = layoutPrepared(prepared);
        expectLayoutInvariants(byDefault);
        const folds = foldsFor([...prepared.families.families.keys()], draws);
        const chosen = layoutPrepared(prepared, { folds });
        expectLayoutInvariants(chosen);
        for (const [key, folded] of folds) {
          const family = chosen.families.get(key);
          if (family !== undefined) expect(family.folded).toBe(folded);
        }
      }),
    );
  });

  it('tout déplié : chaque personne reliée est dessinée, sans chevauchement', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const prepared = prepareTree(tree, centerId);
        const folds = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
        const layout = layoutPrepared(prepared, { folds });
        expectLayoutInvariants(layout);
        expect(layout.people.size).toBe(prepared.structure.rowOf.size);
      }),
      { numRuns: 60 },
    );
  });

  it('repli par défaut : ouvert sur la ligne de la personne centrale seulement, jusqu’à 3 générations', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const layout = layoutTree(tree, centerId);
        const { structure } = layout;
        const row = (id: Id) => structure.rowOf.get(id) ?? 0;
        // Descendants de la personne centrale, recalculés ici depuis les foyers et colonnes.
        const childrenOf = new Map<Id, Id[]>();
        const add = (parent: Id, child: Id) =>
          childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
        for (const foyer of structure.foyerOf.values()) {
          for (const child of foyer.children) {
            add(foyer.hubId, child);
            add(foyer.partnerId, child);
          }
        }
        for (const unit of structure.units) {
          for (const child of unit.unspecified?.children ?? []) add(unit.hubId, child.childId);
        }
        const line = new Set<Id>([centerId]);
        const stack = [centerId];
        for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
          for (const child of childrenOf.get(id) ?? []) {
            if (!line.has(child)) {
              line.add(child);
              stack.push(child);
            }
          }
        }
        for (const family of layout.families.values()) {
          const leads =
            structure.foyerOf.get(family.key)?.leadsToCenter ??
            structure.unitOf.get(family.parentIds[0] ?? '')?.unspecified?.leadsToCenter ??
            false;
          const rows = family.parentIds.map(row);
          const open =
            (leads && Math.min(...rows) >= -3) ||
            (family.parentIds.some((id) => line.has(id)) && Math.max(...rows) <= 2);
          expect(family.foldedByDefault, family.key).toBe(!open);
          expect(family.folded).toBe(family.foldedByDefault);
        }
        // Les parents de la personne centrale sont toujours dessinés s'ils existent.
        expect(layout.people.get(centerId)?.foldedParentsKey).toBeUndefined();
        for (const person of layout.people.values()) {
          expect(person.row).toBeGreaterThanOrEqual(-4);
        }
      }),
    );
  });

  it('le compteur ne compte que les enfants du graphe reçu ; aucune personne masquée n’apparaît (CL-SEC-03)', () => {
    fc.assert(
      fc.property(
        viewArbitrary,
        fc.array(fc.nat(), { minLength: 1, maxLength: 8 }),
        ({ tree, centerId }, picks) => {
          const candidates = tree.people.map((person) => person.id).filter((id) => id !== centerId);
          if (candidates.length === 0) return;
          const masked = new Set<Id>(picks.map((at) => candidates[at % candidates.length] as Id));
          const seen = withoutPeople(tree, masked);
          const prepared = prepareTree(seen, centerId);
          const folds = new Map([...prepared.families.families.keys()].map((key) => [key, true]));
          const layout = layoutPrepared(prepared, { folds });
          for (const family of layout.families.values()) {
            // Enfants de la famille dans le graphe reçu : les filiations qui y restent.
            const parents = new Set(family.parentIds);
            const children = new Set(
              seen.filiations
                .filter((filiation) => parents.has(filiation.parentId))
                .map((filiation) => filiation.childId),
            );
            expect(family.childCount).toBeLessThanOrEqual(children.size);
          }
          const serialized = JSON.stringify(comparable(layout));
          for (const id of masked) expect(serialized).not.toContain(id);
        },
      ),
    );
  });

  it('aucune règle de genre : genres inversés, même disposition', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const layout = layoutTree(tree, centerId);
        const swapped = layoutTree({ ...tree, ...swapGenders(tree) }, centerId);
        expect(comparable(swapped)).toEqual(comparable(layout));
      }),
      { numRuns: 60 },
    );
  });

  it('fonction pure : le graphe reçu n’est pas modifié, même entrée, même résultat', () => {
    fc.assert(
      fc.property(viewArbitrary, foldsArbitrary, ({ tree, centerId }, draws) => {
        const before = JSON.stringify(tree);
        const prepared = prepareTree(tree, centerId);
        const folds = foldsFor([...prepared.families.families.keys()], draws);
        const first = layoutTree(tree, centerId, { folds });
        const second = layoutTree(tree, centerId, { folds });
        expect(comparable(second)).toEqual(comparable(first));
        expect(JSON.stringify(tree)).toBe(before);
      }),
      { numRuns: 60 },
    );
  });

  it('cache : un repli ne refait pas les étapes 1 et 2, les mêmes choix rendent le même résultat', () => {
    fc.assert(
      fc.property(viewArbitrary, fc.nat(), ({ tree, centerId }, pick) => {
        const cache = createTreeLayoutCache();
        const first = cache.layout(tree, centerId);
        expect(cache.lastRecompute).toBe('all');
        expect(cache.layout(tree, centerId, new Map())).toBe(first);
        expect(cache.lastRecompute).toBe('none');
        const keys = [...first.families.keys()];
        if (keys.length === 0) return;
        const key = keys[pick % keys.length] as string;
        const folds: FoldChoices = toggleFamily(first, key);
        const next = cache.layout(tree, centerId, folds);
        expect(cache.lastRecompute).toBe('layout');
        expect(next.structure).toBe(first.structure);
        expect(next.families.get(key)?.folded).toBe(!(first.families.get(key)?.folded ?? true));
        expectLayoutInvariants(next);
        // Déplier une famille dont un parent est dessiné montre tous ses enfants.
        const family = next.families.get(key);
        if (family !== undefined && !family.folded && family.anchor !== undefined) {
          for (const child of next.structure.foyerOf.get(key)?.children ?? []) {
            expect(next.people.has(child)).toBe(true);
          }
        }
        // Graphe modifié (nouvel objet) : tout est recalculé.
        cache.layout({ ...tree }, centerId, folds);
        expect(cache.lastRecompute).toBe('all');
      }),
      { numRuns: 60 },
    );
  });

  it('étape 3 : la méthode des barycentres n’augmente jamais les croisements', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const prepared = prepareTree(tree, centerId);
        const folds = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
        const layout = layoutPrepared(prepared, { folds });
        expect(layout.crossings.final).toBeLessThanOrEqual(layout.crossings.initial);
      }),
    );
  });
});
