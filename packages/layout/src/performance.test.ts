// Mesure des étapes 1 et 2 (TRD, « Disposition de l'arbre », Budget : moins de 100 ms de calcul
// pour 500 personnes visibles sur l'Android de référence). Ici, sur la machine qui lance les
// tests : la médiane de plusieurs calculs, après un calcul de chauffe, comparée au garde-fou
// budget × facteur (README racine, « Tests de performance »). La mesure sur l'Android de
// référence reste à faire avec T-012 et T-017. Les arbres sont générés avant la mesure (hors du
// temps compté).
import { generateTree, medianTime, referenceTree, reportBudget } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildTreeStructure } from './structure';
import { largestFamily } from './test-support/view-arbitrary';
import type { LayoutGraph } from './types';

/** Médiane de plusieurs calculs, après un calcul de chauffe. */
function median(graph: LayoutGraph, centerId: string, runs = 7) {
  return medianTime(() => buildTreeStructure(graph, centerId), { warmup: 1, runs }).medianMs;
}

/** Budgets : TRD pour 500 personnes visibles ; garde-fou du ticket pour l'arbre de 5 000. */
const VISIBLE_500_BUDGET_MS = 100;
const REFERENCE_5000_BUDGET_MS = 300;

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
  it('500 personnes visibles ou plus : moins de 100 ms (garde-fou × facteur)', () => {
    const { tree, centerId, visible } = connectedTree(600, 500);
    // Le budget porte sur des personnes visibles : toutes celles de la famille reliée au centre.
    expect(visible).toBeGreaterThanOrEqual(500);
    expect(buildTreeStructure(tree, centerId).rowOf.size).toBe(visible);
    const report = reportBudget(
      `disposition, ${String(visible)} personnes visibles (médiane)`,
      median(tree, centerId),
      VISIBLE_500_BUDGET_MS,
    );
    expect(report.measuredMs).toBeLessThan(report.ceilingMs);
  });

  it('arbre de référence de 5 000 personnes : moins de 300 ms (garde-fou × facteur), depuis la plus grande famille', () => {
    const tree = referenceTree(5000);
    const family = largestFamily(tree);
    const reference = reportBudget(
      `disposition, arbre de référence 5 000, plus grande famille (${String(family.length)}, médiane)`,
      median(tree, family[0] ?? '', 5),
      REFERENCE_5000_BUDGET_MS,
    );
    expect(reference.measuredMs).toBeLessThan(reference.ceilingMs);
    const dense = connectedTree(5000, 3000);
    expect(dense.visible).toBeGreaterThan(3000);
    const denseReport = reportBudget(
      `disposition, arbre dense 5 000, ${String(dense.visible)} visibles (médiane)`,
      median(dense.tree, dense.centerId, 5),
      REFERENCE_5000_BUDGET_MS,
    );
    expect(denseReport.measuredMs).toBeLessThan(denseReport.ceilingMs);
  });
});
