// Mesure des étapes 1 et 2, puis 1 à 5 (TRD, « Disposition de l'arbre », Budget : moins de 100 ms de calcul
// pour 500 personnes visibles sur l'Android de référence). Ici, sur la machine qui lance les
// tests : la médiane de plusieurs calculs, après un calcul de chauffe. Les seuils laissent la
// marge d'un téléphone d'entrée de gamme, bien plus lent ; la mesure sur l'Android de référence
// reste à faire avec T-012 et T-017. Les arbres sont générés avant la mesure (hors du temps
// compté).
import { generateTree, referenceTree } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildTreeStructure } from './structure';
import { largestFamily } from './test-support/view-arbitrary';
import { createTreeLayoutCache, layoutPrepared, layoutTree, prepareTree } from './tree-layout';
import type { LayoutGraph } from './types';

/** Médiane de `runs` exécutions, après une exécution de chauffe. */
function medianOf(run: () => unknown, runs = 7) {
  run();
  const times: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? Infinity;
}

function median(graph: LayoutGraph, centerId: string, runs = 7) {
  return medianOf(() => buildTreeStructure(graph, centerId), runs);
}

/** Tout déplié : chaque personne reliée à la personne centrale est dessinée. */
function unfoldAll(graph: LayoutGraph, centerId: string) {
  const prepared = prepareTree(graph, centerId);
  return new Map([...prepared.families.families.keys()].map((key) => [key, false]));
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

// Étapes 1 à 5 (T-012) : générations, foyers, ordre, placement et repli. Relevé du 17 octobre
// 2026 sur le poste de développement : environ 15 ms pour 598 personnes dessinées (tout déplié),
// 180 ms pour 4 907 personnes dessinées ; repli par défaut, quelques dizaines de personnes
// dessinées, moins de 70 ms pour un arbre de 5 000 personnes, dont l'essentiel aux étapes 1 et 2.
describe('budget de calcul de la disposition complète (étapes 1 à 5)', { timeout: 120_000 }, () => {
  it('500 personnes dessinées ou plus : moins de 100 ms, étapes 1 à 5', () => {
    const { tree, centerId, visible } = connectedTree(600, 500);
    const folds = unfoldAll(tree, centerId);
    expect(layoutTree(tree, centerId, { folds }).people.size).toBe(visible);
    expect(visible).toBeGreaterThanOrEqual(500);
    expect(medianOf(() => layoutTree(tree, centerId, { folds }))).toBeLessThan(100);
  });

  it('arbre de 5 000 personnes : repli par défaut en moins de 300 ms, tout déplié en moins de 1 s', () => {
    const dense = connectedTree(5000, 3000);
    expect(medianOf(() => layoutTree(dense.tree, dense.centerId), 5)).toBeLessThan(300);
    const folds = unfoldAll(dense.tree, dense.centerId);
    expect(layoutTree(dense.tree, dense.centerId, { folds }).people.size).toBe(dense.visible);
    expect(medianOf(() => layoutTree(dense.tree, dense.centerId, { folds }), 3)).toBeLessThan(1000);
    const reference = referenceTree(5000);
    const center = largestFamily(reference)[0] ?? '';
    expect(medianOf(() => layoutTree(reference, center), 5)).toBeLessThan(300);
  });

  it('cache : déplier un foyer d’un arbre de 5 000 personnes ne refait que les étapes 3 à 5', () => {
    const dense = connectedTree(5000, 3000);
    const cache = createTreeLayoutCache();
    const first = cache.layout(dense.tree, dense.centerId);
    const folded = [...first.families.values()].find((family) => family.folded);
    if (folded === undefined) throw new Error('Aucun foyer replié dans cet arbre');
    const folds = new Map([[folded.key, false]]);
    const prepared = prepareTree(dense.tree, dense.centerId);
    const steps3to5 = medianOf(() => layoutPrepared(prepared, { folds }));
    const all = medianOf(() => layoutTree(dense.tree, dense.centerId, { folds }));
    cache.layout(dense.tree, dense.centerId, folds);
    expect(cache.lastRecompute).toBe('layout');
    expect(steps3to5).toBeLessThan(100);
    expect(steps3to5).toBeLessThan(all);
  });
});
