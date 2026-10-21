// Pointillés du dessin (T-017, 06-arbre.md) : un lien supposé est en pointillés, une adoption est
// un lien plein. La décision se prend par filiation (parent, enfant), jamais pour l'enfant en
// bloc : un enfant dont la naissance est probable et l'adoption certaine a un trait en
// pointillés vers sa famille de naissance et un trait plein vers l'autre.
import { loadScenario } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildLayoutScenarioTree, layoutScenarioSchema } from '../test-support/layout-scenario';
import { referenceSpec } from '../test-support/scene-checks';
import { layoutTree } from '../tree-layout';
import { buildScene, supposedKey } from './scene';

function setup() {
  // CL-POL-12 : le chef a 8 épouses ; vu depuis Carine_2, le foyer de Carine est déplié.
  const scenario = loadScenario('CL-POL-12', layoutScenarioSchema('CL-POL-12'));
  const tree = buildLayoutScenarioTree(scenario);
  const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
  return { tree, layout };
}

describe('pointillés par filiation', () => {
  it('seule la filiation incertaine de la famille met son trait en pointillés', () => {
    const { tree, layout } = setup();
    const bekono = tree.id('bekono');
    const carine = tree.id('carine');
    const child = tree.id('carine_1');
    const other = tree.id('carine_2');
    const scene = buildScene(layout, referenceSpec(), {
      supposedFiliations: new Set([supposedKey(bekono, child)]),
    });
    const legs = scene.edges.filter((edge) => edge.kind === 'leg');
    expect(legs.find((edge) => edge.childId === child)?.supposed).toBe(true);
    expect(legs.find((edge) => edge.childId === other)?.supposed).toBe(false);
    // Une filiation incertaine d'une autre personne vers cet enfant ne change rien ici.
    const unrelated = buildScene(layout, referenceSpec(), {
      supposedFiliations: new Set([supposedKey(tree.id('amina'), child)]),
    });
    expect(
      unrelated.edges.filter((edge) => edge.kind === 'leg').every((edge) => !edge.supposed),
    ).toBe(true);
    // La mère aussi est un parent de la famille.
    const byMother = buildScene(layout, referenceSpec(), {
      supposedFiliations: new Set([supposedKey(carine, child)]),
    });
    expect(
      byMother.edges.find((edge) => edge.kind === 'leg' && edge.childId === child)?.supposed,
    ).toBe(true);
  });

  it('sans filiation incertaine, aucun trait n’est en pointillés', () => {
    const { layout } = setup();
    const scene = buildScene(layout, referenceSpec());
    expect(scene.edges.some((edge) => edge.supposed)).toBe(false);
  });

  it('un lien de couple ou d’union n’est jamais en pointillés à cause d’une filiation', () => {
    const { tree, layout } = setup();
    const every = new Set(
      [...layout.people.keys()].flatMap((parent) =>
        [...layout.people.keys()].map((child) => supposedKey(parent, child)),
      ),
    );
    const scene = buildScene(layout, referenceSpec(), { supposedFiliations: every });
    for (const edge of scene.edges) {
      if (edge.kind === 'union' || edge.kind === 'trunk' || edge.kind === 'bus') {
        expect(edge.supposed).toBe(false);
      }
    }
    expect(tree.id('bekono')).toBeDefined();
  });
});

describe('liens hors des foyers (CL-FAM-10)', () => {
  it('le lien de couple n’est jamais en pointillés, une filiation vers un enfant relié par un lien l’est', () => {
    const scenario = loadScenario('CL-FAM-10', layoutScenarioSchema('CL-FAM-10'));
    const tree = buildLayoutScenarioTree(scenario);
    const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
    const everyone = [...layout.people.keys()];
    const every = new Set(
      everyone.flatMap((parent) => everyone.map((child) => supposedKey(parent, child))),
    );
    const scene = buildScene(layout, referenceSpec(), { supposedFiliations: every });
    const lines = layout.links.filter((link) => link.drawing === 'line');
    const edges = scene.edges.filter((edge) => edge.kind === 'link');
    expect(edges).toHaveLength(lines.length);
    lines.forEach((link, index) => {
      expect(edges[index]?.supposed, link.nature).toBe(link.nature !== 'couple');
    });
    expect(lines.some((link) => link.nature === 'couple')).toBe(true);
    const plain = buildScene(layout, referenceSpec());
    expect(plain.edges.some((edge) => edge.supposed)).toBe(false);
  });
});
