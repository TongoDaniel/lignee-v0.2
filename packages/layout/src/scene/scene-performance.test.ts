// Budgets du dessin mesurables sans téléphone (T-017) : ARB-01 (« s'ouvre en moins de 1 s pour 500
// personnes ») et TRD (« moins de 100 ms de calcul pour 500 personnes visibles »), et le nombre
// d'éléments réellement dessinés après culling (ARB-02 : seul ce qui est à l'écran et sa marge).
// Ici, sur la machine qui lance les tests : garde-fou budget × facteur. La mesure sur l'Android de
// référence reste à faire (issue #34, T-105).
import { generateTree, medianTime, reportBudget } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { referenceSpec } from '../test-support/scene-checks';
import { largestFamily } from '../test-support/view-arbitrary';
import { layoutPrepared, layoutTree, prepareTree } from '../tree-layout';
import { buildScene } from './scene';
import { cullScene, drawnCount, indexScene } from './scene-index';
import { visibleRect } from './viewport';

const SCENE_500_BUDGET_MS = 100;
const OPEN_500_BUDGET_MS = 1000;

function denseTree() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const tree = generateTree({
      seed: 8_000 + 600 + attempt,
      size: 600,
      rates: { marriage: 0.95, withinTree: 0.6, polygamy: 0.4, unknownParent: 0.5, toPlace: 0 },
    });
    const family = largestFamily(tree);
    if (family.length >= 500) {
      return { tree, centerId: family[Math.floor(family.length / 2)] ?? '' };
    }
  }
  throw new Error('No generated tree with 500 connected people');
}

describe('budget du dessin pour 500 personnes', { timeout: 120_000 }, () => {
  const { tree, centerId } = denseTree();
  const prepared = prepareTree(tree, centerId);
  const unfolded = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
  const spec = referenceSpec();

  it('scène, index et culling : moins de 100 ms (garde-fou × facteur), tout déplié', () => {
    const layout = layoutPrepared(prepared, { folds: unfolded });
    expect(layout.people.size).toBeGreaterThanOrEqual(500);
    const report = reportBudget(
      `scène + index + culling, ${String(layout.people.size)} personnes (médiane)`,
      medianTime(
        () => {
          const scene = buildScene(layout, spec);
          const index = indexScene(scene);
          cullScene(index, visibleRect({ scale: 1, x: 0, y: 0 }, { width: 360, height: 800 }, 1));
        },
        { warmup: 1, runs: 7 },
      ).medianMs,
      SCENE_500_BUDGET_MS,
    );
    expect(report.measuredMs).toBeLessThan(report.ceilingMs);
  });

  it('ouverture complète (disposition + scène + index) : moins de 1 s (garde-fou × facteur)', () => {
    const report = reportBudget(
      'ouverture de l’arbre, 500 personnes, calcul seul (médiane)',
      medianTime(
        () => {
          const layout = layoutTree(tree, centerId, { folds: unfolded });
          indexScene(buildScene(layout, spec));
        },
        { warmup: 1, runs: 5 },
      ).medianMs,
      OPEN_500_BUDGET_MS,
    );
    expect(report.measuredMs).toBeLessThan(report.ceilingMs);
  });

  it('seul ce qui est à l’écran et sa marge est dessiné', () => {
    const layout = layoutPrepared(prepared, { folds: unfolded });
    const scene = buildScene(layout, spec);
    const index = indexScene(scene);
    const total = drawnCount(cullScene(index, scene.bounds));
    expect(total).toBeGreaterThan(900);
    const size = { width: 360, height: 800 };
    const focus = scene.personById.get(centerId);
    const viewport = { scale: 1, x: 180 - (focus?.x ?? 0), y: 600 - (focus?.y ?? 0) };
    const screen = drawnCount(cullScene(index, visibleRect(viewport, size)));
    const margin = drawnCount(cullScene(index, visibleRect(viewport, size, 1)));
    expect(screen).toBeLessThan(total / 5);
    expect(screen).toBeLessThanOrEqual(margin);
    expect(margin).toBeLessThan(total);
    console.info(
      `[perf] éléments dessinés : ${String(screen)} à l'écran, ${String(margin)} avec marge, ${String(total)} au total`,
    );
  });
});
