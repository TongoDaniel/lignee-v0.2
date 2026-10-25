// Retour de la liste au dessin (T-017, ACC-06) : une personne qui n'est pas dessinée (foyer ou
// branche replié) a toujours une voisine dessinée où recentrer le dessin.
import { loadScenario } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildLayoutScenarioTree, layoutScenarioSchema } from '../test-support/layout-scenario';
import { layoutTree } from '../tree-layout';
import { buildOutline, nearestDrawn } from './outline';

describe('nearestDrawn', () => {
  it('CL-POL-01 : un enfant d’un foyer replié mène à l’un de ses parents dessinés', () => {
    const scenario = loadScenario('CL-POL-01', layoutScenarioSchema('CL-POL-01'));
    const tree = buildLayoutScenarioTree(scenario);
    const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
    const outline = buildOutline(layout);
    const ali = tree.id('ali');
    expect(outline.get(ali)?.drawn).toBe(false);
    const near = nearestDrawn(outline, ali);
    expect(near).toBeDefined();
    expect(['moussa', 'awa']).toContain(tree.keyOf(near ?? ''));
    expect(outline.get(near ?? '')?.drawn).toBe(true);
  });
  it('une personne dessinée est sa propre voisine, une inconnue n’en a pas', () => {
    const scenario = loadScenario('CL-POL-01', layoutScenarioSchema('CL-POL-01'));
    const tree = buildLayoutScenarioTree(scenario);
    const layout = layoutTree(tree.data, tree.id(scenario.action.centre));
    const outline = buildOutline(layout);
    expect(nearestDrawn(outline, tree.id('oumar'))).toBe(tree.id('oumar'));
    expect(nearestDrawn(outline, 'inconnue')).toBeUndefined();
  });
});
