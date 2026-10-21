// Cas limites de T-019 (implexe, union entre générations, descendance), lus dans
// test/scenarios/<ID>.yaml (schéma strict) : CL-FAM-09 (mariage entre cousins germains : chaque
// ancêtre une seule fois, tous les liens affichés, aussi dans la vue « descendance ») et CL-FAM-10
// (union entre deux générations : la rangée la plus proche, l'autre lien en trait long).
import { loadScenario } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { layoutDescendants } from '../descendants';
import type { FoldChoices, TreeLayout } from '../layout-types';
import { MAX_LINE_CROSSINGS, MAX_LINE_ROW_SPAN } from '../links';
import { buildTreeStructure } from '../structure';
import {
  expectDisposition,
  expectLayoutInvariants,
  expectLinkInvariants,
  familyKeyOf,
} from '../test-support/layout-checks';
import {
  buildLayoutScenarioTree,
  expectUnits,
  layoutScenarioSchema,
} from '../test-support/layout-scenario';
import { layoutTree, setFolded } from '../tree-layout';

function expectAll(layout: TreeLayout) {
  expectLayoutInvariants(layout);
  expectLinkInvariants(layout, MAX_LINE_ROW_SPAN, MAX_LINE_CROSSINGS);
}

// Dispositions avec implexe et descendance (plusieurs secondes sous charge) : le délai par défaut
// de vitest (5 s) est trop court sous la charge de la CI.
describe('CL-FAM-09 — mariage entre cousins germains', { timeout: 30_000 }, () => {
  it('chaque ancêtre une seule fois, le couple relié aux deux branches, aussi dans la descendance', () => {
    const scenario = loadScenario('CL-FAM-09', layoutScenarioSchema('CL-FAM-09'));
    const tree = buildLayoutScenarioTree(scenario);
    const centerId = tree.id(scenario.action.centre);
    const { attendu } = scenario;
    const structure = buildTreeStructure(tree.data, centerId);
    for (const [key, row] of Object.entries(attendu.generations ?? {})) {
      expect(structure.rowOf.get(tree.id(key)), `rangée de ${key}`).toBe(row);
    }
    expectUnits(structure, tree, attendu.unites);

    const layout = layoutTree(tree.data, centerId);
    expectAll(layout);
    if (attendu.disposition === undefined) throw new Error('CL-FAM-09 attend une disposition');
    expectDisposition(layout, tree, attendu.disposition);
    // Aucune fiche en double : Gaspard et Honorine, arrière-grands-parents par les deux branches.
    const ids = [...layout.rows.values()].flat();
    expect(ids.filter((id) => id === tree.id('gaspard'))).toHaveLength(1);
    expect(ids.filter((id) => id === tree.id('honorine'))).toHaveLength(1);
    // Tous les liens : Marie est reliée à ses parents, même rangée dans la fratrie de Paul.
    const marie = layout.families.get(familyKeyOf(structure, tree, ['colette', 'denis']));
    expect(marie?.shownChildren).toEqual([tree.id('marie')]);

    const ancestor = scenario.action.descendance_de;
    if (ancestor === undefined || attendu.descendance === undefined) {
      throw new Error('CL-FAM-09 attend une vue « descendance »');
    }
    const descendance = layoutDescendants(tree.data, tree.id(ancestor));
    expectAll(descendance);
    expectDisposition(descendance, tree, attendu.descendance);
    expect([...descendance.families.values()].every((family) => !family.folded)).toBe(true);
  });
});

describe('CL-FAM-10 — union entre deux générations', { timeout: 30_000 }, () => {
  it('Nadia garde la rangée de sa sœur, son union avec Gaston devient un trait long', () => {
    const scenario = loadScenario('CL-FAM-10', layoutScenarioSchema('CL-FAM-10'));
    const tree = buildLayoutScenarioTree(scenario);
    const centerId = tree.id(scenario.action.centre);
    const { attendu } = scenario;
    const structure = buildTreeStructure(tree.data, centerId);
    for (const [key, row] of Object.entries(attendu.generations ?? {})) {
      expect(structure.rowOf.get(tree.id(key)), `rangée de ${key}`).toBe(row);
    }
    expectUnits(structure, tree, attendu.unites);
    // Étape 1 : l'union de Gaston et Nadia est un trait long de la structure.
    expect(
      structure.crossLinks
        .filter((link) => link.kind === 'union')
        .map((link) => [tree.keyOf(link.fromId), tree.keyOf(link.toId), link.rowSpan]),
    ).toEqual([['gaston', 'nadia', 1]]);

    const layout = layoutTree(tree.data, centerId);
    expectAll(layout);
    if (attendu.disposition === undefined) throw new Error('CL-FAM-10 attend une disposition');
    expectDisposition(layout, tree, attendu.disposition);

    let folds: FoldChoices = new Map();
    for (const family of scenario.action.deplier ?? []) {
      folds = setFolded(folds, familyKeyOf(layout.structure, tree, family), false);
    }
    const unfolded = layoutTree(tree.data, centerId, { folds });
    expectAll(unfolded);
    if (attendu.apres_deplier === undefined) throw new Error('CL-FAM-10 attend un dépliage');
    expectDisposition(unfolded, tree, attendu.apres_deplier);
    // Eric pend sous Gaston, à la rangée de son demi-frère Paul.
    expect(unfolded.people.get(tree.id('eric'))?.row).toBe(-1);
  });
});
