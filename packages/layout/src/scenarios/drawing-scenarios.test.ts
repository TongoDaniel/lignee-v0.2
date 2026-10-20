// Cas limites du dessin de l'arbre (T-017) : la scène à peindre, en pixels, et le parcours
// accessible, joués sur les scénarios de test/scenarios/ (partie `dessin` de `attendu`). La revue
// visuelle sur l'Android de référence reste à Daniel (issue #34).
import { loadScenario } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildScene } from '../scene/scene';
import { buildLayoutScenarioTree, layoutScenarioSchema } from '../test-support/layout-scenario';
import { expectDrawing, expectSceneInvariants, referenceSpec } from '../test-support/scene-checks';
import { layoutTree } from '../tree-layout';

const SCENARIOS = [
  ['CL-POL-01', 'trois épouses en même temps : trois traits d’union, deux pastilles « + 2 »'],
  [
    'CL-POL-12',
    'chef de famille à 8 épouses : sept pastilles « + 5 », tous les enfants atteignables',
  ],
  ['CL-POL-18', 'polygamie sur deux générations : foyers imbriqués dessinés l’un sous l’autre'],
] as const;

describe.each(SCENARIOS)('%s — dessin', (id, title) => {
  it(title, () => {
    const scenario = loadScenario(id, layoutScenarioSchema(id));
    const tree = buildLayoutScenarioTree(scenario);
    const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
    const expected = scenario.attendu.dessin;
    if (expected === undefined) throw new Error(`${id} attend un dessin (T-017)`);
    const scene = buildScene(layout, referenceSpec());
    expectSceneInvariants(layout, scene);
    expectDrawing(layout, scene, tree, expected);
  });

  it('texte à 200 % et mode Aînés : mêmes éléments, aucun chevauchement', () => {
    const scenario = loadScenario(id, layoutScenarioSchema(id));
    const tree = buildLayoutScenarioTree(scenario);
    const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
    const expected = scenario.attendu.dessin;
    if (expected === undefined) throw new Error(`${id} attend un dessin (T-017)`);
    for (const textScale of [1.3, 2, 2.6]) {
      const scene = buildScene(layout, referenceSpec({ textScale, touchTarget: 56 }));
      expectSceneInvariants(layout, scene);
      expectDrawing(layout, scene, tree, expected);
    }
  });
});

describe('CL-POL-12 — lisible au niveau « branche »', () => {
  it('les 8 épouses tiennent sur une rangée de 15 fiches ; chacune garde sa pastille à portée du doigt', () => {
    const scenario = loadScenario('CL-POL-12', layoutScenarioSchema('CL-POL-12'));
    const tree = buildLayoutScenarioTree(scenario);
    const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
    const scene = buildScene(layout, referenceSpec());
    const spec = scene.spec;
    // 15 fiches de large au plus (ADR 0016) : la scène fait au plus 15 unités.
    expect((scene.bounds.right - scene.bounds.left) / spec.unitX).toBeLessThanOrEqual(15 + 0.001);
    // Les sept pastilles sont assez éloignées pour qu'une zone de 48 les distingue.
    const xs = scene.counters.map((counter) => counter.x).sort((a, b) => a - b);
    for (let index = 1; index < xs.length; index += 1) {
      expect((xs[index] ?? 0) - (xs[index - 1] ?? 0)).toBeGreaterThanOrEqual(spec.touchTarget);
    }
  });
});
