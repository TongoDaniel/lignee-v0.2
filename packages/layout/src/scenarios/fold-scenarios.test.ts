// Cas limites de T-012 (ordre, placement, repli), lus dans test/scenarios/<ID>.yaml (schéma
// strict) : CL-POL-12 (8 épouses, 40 enfants, foyers repliés hors de celui de la personne qui
// regarde) et CL-SEC-03 (le compteur d'un foyer replié ne compte jamais un enfant masqué).
import { buildScenarioTree, loadScenario } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import type { FoldChoices } from '../layout-types';
import { buildTreeStructure } from '../structure';
import {
  expectDisposition,
  expectLayoutInvariants,
  familyKeyOf,
} from '../test-support/layout-checks';
import {
  buildLayoutScenarioTree,
  expectUnits,
  layoutScenarioSchema,
  withoutPeople,
} from '../test-support/layout-scenario';
import { layoutTree, setFolded } from '../tree-layout';

describe('CL-POL-12 — chef de famille avec 8 épouses et 40 enfants', () => {
  it('depuis un enfant : son foyer ouvert, les 7 autres repliés avec leur compteur, puis un foyer déplié', () => {
    const scenario = loadScenario('CL-POL-12', layoutScenarioSchema('CL-POL-12'));
    const tree = buildLayoutScenarioTree(scenario);
    const centerId = tree.id(scenario.action.centre);
    const { attendu } = scenario;
    expectUnits(buildTreeStructure(tree.data, centerId), tree, attendu.unites);

    const layout = layoutTree(tree.data, centerId);
    expectLayoutInvariants(layout);
    if (attendu.disposition === undefined) throw new Error('CL-POL-12 attend une disposition');
    expectDisposition(layout, tree, attendu.disposition);

    let folds: FoldChoices = new Map();
    for (const family of scenario.action.deplier ?? []) {
      folds = setFolded(folds, familyKeyOf(layout.structure, tree, family), false);
    }
    const unfolded = layoutTree(tree.data, centerId, { folds });
    expectLayoutInvariants(unfolded);
    if (attendu.apres_deplier === undefined) throw new Error('CL-POL-12 attend un dépliage');
    expectDisposition(unfolded, tree, attendu.apres_deplier);
  });

  it('depuis le chef : les 8 foyers ouverts, 40 enfants, chaque fratrie sous sa mère, sans chevauchement', () => {
    const scenario = loadScenario('CL-POL-12', layoutScenarioSchema('CL-POL-12'));
    const tree = buildLayoutScenarioTree(scenario);
    const hub = tree.id('bekono');
    const layout = layoutTree(tree.data, hub);
    expectLayoutInvariants(layout);
    expect(layout.people.size).toBe(49);
    const wives = [...layout.people.values()]
      .filter((person) => person.y === 0.5)
      .sort((a, b) => a.x - b.x);
    expect(wives.map((person) => tree.keyOf(person.personId))).toEqual([
      'amina',
      'beatrice',
      'carine',
      'delphine',
      'edith',
      'florence',
      'gisele',
      'helene',
    ]);
    const children = layout.rows.get(1) ?? [];
    expect(children).toHaveLength(40);
    // Les enfants de chaque épouse se suivent, dans l'ordre des rangs : cinq par cinq.
    const mothers = children.map((id) => tree.keyOf(id)?.split('_')[0]);
    expect(mothers).toEqual(
      wives.flatMap((wife) => Array<string | undefined>(5).fill(tree.keyOf(wife.personId))),
    );
    for (const family of layout.families.values()) {
      expect(family.folded).toBe(false);
      // La fratrie est centrée sous sa mère, à une fiche près (les voisines poussent).
      const xs = family.shownChildren.map((id) => layout.people.get(id)?.x ?? NaN);
      const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
      expect(Math.abs(middle - (family.anchor?.x ?? NaN))).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('CL-SEC-03 — foyer replié contenant un enfant masqué', () => {
  it('le compteur dit 3, pas 4, et rien ne trahit l’enfant masqué', () => {
    const scenario = loadScenario('CL-SEC-03', layoutScenarioSchema('CL-SEC-03'));
    const tree = buildLayoutScenarioTree(scenario);
    const centerId = tree.id(scenario.action.centre);
    const { attendu } = scenario;
    expectUnits(buildTreeStructure(tree.data, centerId), tree, attendu.unites);
    const layout = layoutTree(tree.data, centerId);
    expectLayoutInvariants(layout);
    if (attendu.disposition === undefined) throw new Error('CL-SEC-03 attend une disposition');
    expectDisposition(layout, tree, attendu.disposition);

    // Aucune trace de la personne masquée dans le résultat.
    const masked = buildScenarioTree(scenario.arbre).id('dora');
    const serialized = JSON.stringify(layout, (_key, value: unknown) =>
      value instanceof Map ? [...(value as Map<unknown, unknown>).entries()] : value,
    );
    expect(serialized).not.toContain(masked);

    // Le même arbre sans masque compte bien 4 : le test échouerait si le compteur ignorait le
    // masquage.
    const whole = buildScenarioTree(scenario.arbre);
    const unmasked = layoutTree(whole.data, whole.id('jacques'));
    const foyer = familyKeyOf(unmasked.structure, whole, ['paul', 'mireille']);
    expect(unmasked.families.get(foyer)?.childCount).toBe(4);

    // Un filtrage qui retirerait la personne en laissant ses liens ne la ferait pas compter non
    // plus : un lien vers une personne absente du graphe est ignoré.
    const dangling = {
      ...whole.data,
      people: whole.data.people.filter((person) => person.id !== masked),
    };
    const partial = layoutTree(dangling, whole.id('jacques'));
    expect(partial.families.get(foyer)?.childCount).toBe(3);
    expect(
      layoutTree(withoutPeople(whole.data, new Set([masked])), whole.id('jacques')).families.get(
        foyer,
      )?.childCount,
    ).toBe(3);
  });
});
