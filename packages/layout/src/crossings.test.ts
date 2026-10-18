// Mesure de l'étape 3 (TRD : « réduction des croisements par la méthode des barycentres ») sur des
// arbres générés, toujours les mêmes (graines fixes), tout déplié pour qu'il y ait des traits à
// croiser : nombre de croisements des traits parent-enfant entre rangées voisines, dans l'ordre de
// découverte depuis la personne centrale (avant) et après les barycentres. Relevé du 17 octobre
// 2026 : 22 089 avant, 8 863 après sur ces 40 arbres (60 % de moins).
import { generateTree } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { largestFamily } from './test-support/view-arbitrary';
import { layoutPrepared, prepareTree } from './tree-layout';

describe(
  'étape 3 : croisements avant et après la méthode des barycentres',
  { timeout: 60_000 },
  () => {
    it('40 arbres générés de 300 personnes, tout déplié : au moins 40 % de croisements en moins', () => {
      let before = 0;
      let after = 0;
      for (let seed = 0; seed < 40; seed += 1) {
        const tree = generateTree({
          seed: 500 + seed,
          size: 300,
          rates: { marriage: 0.95, withinTree: 0.6, polygamy: 0.4, unknownParent: 0.5, toPlace: 0 },
        });
        const family = largestFamily(tree);
        const prepared = prepareTree(tree, family[Math.floor(family.length / 2)] ?? '');
        const folds = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
        const { crossings } = layoutPrepared(prepared, { folds });
        expect(crossings.final).toBeLessThanOrEqual(crossings.initial);
        before += crossings.initial;
        after += crossings.final;
      }
      expect(before).toBeGreaterThan(1000);
      expect(after).toBeLessThanOrEqual(before * 0.6);
    });
  },
);
