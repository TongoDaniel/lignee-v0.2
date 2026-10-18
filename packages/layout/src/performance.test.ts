// Mesure des étapes 1 et 2 (TRD, « Disposition de l'arbre », Budget : moins de 100 ms de calcul
// pour 500 personnes visibles sur l'Android de référence). Ici, sur la machine qui lance les
// tests : la médiane de plusieurs calculs, après un calcul de chauffe. Les seuils laissent la
// marge d'un téléphone d'entrée de gamme, bien plus lent ; la mesure sur l'Android de référence
// reste à faire avec T-012 et T-017. Les arbres sont générés avant la mesure (hors du temps
// compté).
import { generateTree, referenceTree } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildTreeStructure } from './structure';
import { largestFamily } from './test-support/view-arbitrary';
import type { LayoutGraph } from './types';

function median(graph: LayoutGraph, centerId: string, runs = 7) {
  buildTreeStructure(graph, centerId);
  const times: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const start = performance.now();
    buildTreeStructure(graph, centerId);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? Infinity;
}

/**
 * Arbre dont la plus grande famille reliée compte au moins `minVisible` personnes : tout y est
 * visible depuis la personne centrale. Les graines sont essayées dans l'ordre : le résultat est
 * reproductible.
 */
function connectedTree(size: number, minVisible: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const tree = generateTree({
      seed: 8_000 + size + attempt,
      size,
      rates: { marriage: 0.95, withinTree: 0.6, polygamy: 0.4, unknownParent: 0.5, toPlace: 0 },
    });
    const family = largestFamily(tree);
    if (family.length >= minVisible) {
      return {
        tree,
        centerId: family[Math.floor(family.length / 2)] ?? '',
        visible: family.length,
      };
    }
  }
  throw new Error(`No generated tree with ${String(minVisible)} connected people`);
}

// large, pour que la génération ne fasse pas échouer la mesure.
describe('budget de calcul des générations et des foyers', { timeout: 60_000 }, () => {
  it('500 personnes visibles ou plus : moins de 100 ms', () => {
    const { tree, centerId, visible } = connectedTree(600, 500);
    // Le budget porte sur des personnes visibles : toutes celles de la famille reliée au centre.
    expect(visible).toBeGreaterThanOrEqual(500);
    expect(buildTreeStructure(tree, centerId).rowOf.size).toBe(visible);
    const time = median(tree, centerId);
    expect(time).toBeLessThan(100);
  });

  it('arbre de référence de 5 000 personnes : moins de 300 ms, depuis la plus grande famille', () => {
    const tree = referenceTree(5000);
    const family = largestFamily(tree);
    const time = median(tree, family[0] ?? '', 5);
    expect(time).toBeLessThan(300);
    const dense = connectedTree(5000, 3000);
    expect(dense.visible).toBeGreaterThan(3000);
    expect(median(dense.tree, dense.centerId, 5)).toBeLessThan(300);
  });
});
