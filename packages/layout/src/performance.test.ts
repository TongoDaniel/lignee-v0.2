// Mesure des étapes 1 et 2, puis 1 à 6 (TRD, « Disposition de l'arbre », Budget : moins de 100 ms de calcul
// pour 500 personnes visibles sur l'Android de référence). Ici, sur la machine qui lance les
// tests : la médiane de plusieurs calculs, après un calcul de chauffe, comparée au garde-fou
// budget × facteur (README racine, « Tests de performance »). La mesure sur l'Android de
// référence reste à faire avec T-012 et T-017. Les arbres sont générés avant la mesure (hors du
// temps compté).
import { generateTree, medianTime, referenceTree, reportBudget } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { findDescendants, layoutDescendants } from './descendants';
import { buildTreeStructure } from './structure';
import { largestFamily } from './test-support/view-arbitrary';
import { createTreeLayoutCache, layoutPrepared, layoutTree, prepareTree } from './tree-layout';
import type { LayoutGraph } from './types';

/** Médiane de plusieurs calculs, après un calcul de chauffe. */
function median(graph: LayoutGraph, centerId: string, runs = 7) {
  return medianTime(() => buildTreeStructure(graph, centerId), { warmup: 1, runs }).medianMs;
}

/** Budgets : TRD pour 500 personnes visibles ; garde-fou du ticket pour l'arbre de 5 000. */
const VISIBLE_500_BUDGET_MS = 100;
const REFERENCE_5000_BUDGET_MS = 300;
/** Garde-fou du ticket T-012 : arbre de 5 000 personnes tout déplié (aucun budget du cahier). */
const UNFOLDED_5000_BUDGET_MS = 1000;
/** Déplier un foyer : étapes 3 à 6 seules, dans le budget du TRD pour 500 visibles. */
const UNFOLD_STEP_BUDGET_MS = 100;

/** Médiane d'un calcul quelconque, après chauffe. */
function medianOf(run: () => unknown, runs = 5) {
  return medianTime(
    () => {
      run();
    },
    { warmup: 1, runs },
  ).medianMs;
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

// Étapes 1 à 6 (T-012, T-019) : générations, foyers, ordre, placement, repli et liens, mêmes
// règles de mesure.
describe('budget de calcul de la disposition complète (étapes 1 à 6)', { timeout: 120_000 }, () => {
  it('500 personnes dessinées ou plus, tout déplié : moins de 100 ms (garde-fou × facteur)', () => {
    const { tree, centerId, visible } = connectedTree(600, 500);
    const folds = unfoldAll(tree, centerId);
    expect(layoutTree(tree, centerId, { folds }).people.size).toBe(visible);
    expect(visible).toBeGreaterThanOrEqual(500);
    const report = reportBudget(
      `disposition étapes 1 à 6, ${String(visible)} personnes dessinées (médiane)`,
      medianOf(() => layoutTree(tree, centerId, { folds }), 7),
      VISIBLE_500_BUDGET_MS,
    );
    expect(report.measuredMs).toBeLessThan(report.ceilingMs);
  });

  it('arbre de 5 000 personnes : repli par défaut moins de 300 ms, tout déplié moins de 1 s (garde-fous × facteur)', () => {
    const dense = connectedTree(5000, 3000);
    const byDefault = reportBudget(
      `disposition étapes 1 à 6, arbre dense 5 000, repli par défaut (médiane)`,
      medianOf(() => layoutTree(dense.tree, dense.centerId)),
      REFERENCE_5000_BUDGET_MS,
    );
    expect(byDefault.measuredMs).toBeLessThan(byDefault.ceilingMs);
    const folds = unfoldAll(dense.tree, dense.centerId);
    expect(layoutTree(dense.tree, dense.centerId, { folds }).people.size).toBe(dense.visible);
    const unfolded = reportBudget(
      `disposition étapes 1 à 6, arbre dense 5 000, tout déplié, ${String(dense.visible)} dessinées (médiane)`,
      medianOf(() => layoutTree(dense.tree, dense.centerId, { folds }), 3),
      UNFOLDED_5000_BUDGET_MS,
    );
    expect(unfolded.measuredMs).toBeLessThan(unfolded.ceilingMs);
    const reference = referenceTree(5000);
    const center = largestFamily(reference)[0] ?? '';
    const referenceReport = reportBudget(
      'disposition étapes 1 à 6, arbre de référence 5 000, repli par défaut (médiane)',
      medianOf(() => layoutTree(reference, center)),
      REFERENCE_5000_BUDGET_MS,
    );
    expect(referenceReport.measuredMs).toBeLessThan(referenceReport.ceilingMs);
  });

  it('cache : déplier un foyer d’un arbre de 5 000 personnes ne refait que les étapes 3 à 6', () => {
    const dense = connectedTree(5000, 3000);
    const cache = createTreeLayoutCache();
    const first = cache.layout(dense.tree, dense.centerId);
    const folded = [...first.families.values()].find((family) => family.folded);
    if (folded === undefined) throw new Error('Aucun foyer replié dans cet arbre');
    const folds = new Map([[folded.key, false]]);
    const prepared = prepareTree(dense.tree, dense.centerId);
    const steps3to5 = medianOf(() => layoutPrepared(prepared, { folds }), 7);
    const all = medianOf(() => layoutTree(dense.tree, dense.centerId, { folds }), 7);
    cache.layout(dense.tree, dense.centerId, folds);
    expect(cache.lastRecompute).toBe('layout');
    const report = reportBudget(
      'disposition, déplier un foyer (étapes 3 à 6, arbre dense 5 000, médiane)',
      steps3to5,
      UNFOLD_STEP_BUDGET_MS,
    );
    expect(report.measuredMs).toBeLessThan(report.ceilingMs);
    expect(steps3to5).toBeLessThan(all);
  });
});

// Vue « descendance » (T-019, ARB-14) : tout est déplié par défaut, liens et renvois compris.
describe('budget de la vue « descendance »', { timeout: 120_000 }, () => {
  it('arbre dense de 5 000 personnes, le fondateur qui a la plus grande descendance : moins de 1 s (garde-fou × facteur)', () => {
    const dense = connectedTree(5000, 3000);
    // Ancêtre : parmi les premières personnes générées (les fondateurs), celle dont la vue
    // dessine le plus de personnes.
    let best = { id: '', size: 0 };
    for (const person of dense.tree.people.slice(0, 20)) {
      const size = findDescendants(dense.tree, person.id).people.size;
      if (size > best.size) best = { id: person.id, size };
    }
    expect(best.size).toBeGreaterThan(500);
    expect(layoutDescendants(dense.tree, best.id).people.size).toBe(best.size);
    const report = reportBudget(
      `vue descendance, arbre dense 5 000, ${String(best.size)} dessinées (médiane)`,
      medianOf(() => layoutDescendants(dense.tree, best.id), 3),
      UNFOLDED_5000_BUDGET_MS,
    );
    expect(report.measuredMs).toBeLessThan(report.ceilingMs);
  });
});
