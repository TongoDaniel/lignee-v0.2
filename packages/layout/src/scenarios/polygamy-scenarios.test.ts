// Cas limites de polygamie cités par T-008, joués pour la disposition (étapes 1 et 2) : chaque
// scénario est lu dans test/scenarios/<ID>.yaml (schéma strict), son arbre construit en objets
// du modèle, puis la structure calculée est comparée à l'attendu ; l'ordre, le placement et le
// repli par défaut (T-012) le sont à `attendu.disposition`. La revue visuelle reste à T-017
// (champ `couverture` de chaque YAML).
import { checkUnion, findCoherenceIssues } from '@lignee/domain';
import { loadScenario } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { buildTreeStructure } from '../structure';
import { expectDisposition, expectLayoutInvariants } from '../test-support/layout-checks';
import { layoutTree } from '../tree-layout';
import {
  applyLayoutSteps,
  buildLayoutScenarioTree,
  comparableStructure,
  expectUnits,
  layoutScenarioSchema,
  swapGenders,
} from '../test-support/layout-scenario';

const SCENARIOS = [
  ['CL-POL-01', 'trois épouses en même temps : foyers dans l’ordre, enfants sous leur mère'],
  ['CL-POL-04', 'rang saisi sans date de mariage, puis rang changé à la main (UNI-07)'],
  ['CL-POL-06', 'première épouse décédée, puis nouvelle épouse : affichage successif'],
  ['CL-POL-13', 'femme avec plusieurs maris successifs, sans règle de genre'],
  ['CL-POL-14', 'polyandrie : acceptée sans avertissement, sans règle de genre'],
  ['CL-POL-18', 'polygamie sur deux générations : foyers imbriqués, vus de deux personnes'],
] as const;

describe.each(SCENARIOS)('%s — disposition', (id, title) => {
  it(title, () => {
    const scenario = loadScenario(id, layoutScenarioSchema(id));
    const tree = buildLayoutScenarioTree(scenario);
    const centerId = tree.id(scenario.action.centre);
    const structure = buildTreeStructure(tree.data, centerId);
    const { attendu } = scenario;

    expect(structure.unreachable).toEqual([]);
    for (const [key, row] of Object.entries(attendu.generations ?? {})) {
      expect(structure.rowOf.get(tree.id(key)), `rangée de ${key}`).toBe(row);
    }
    expectUnits(structure, tree, attendu.unites);
    // Dates ou réponses gardées suffisent : aucune question de simultanéité en attente.
    expect(structure.units.filter((unit) => unit.simultaneityPending)).toEqual([]);
    // Aucun trait long ni lien secondaire dans ces familles : tout tient dans les foyers.
    expect(structure.crossLinks).toEqual([]);

    if (attendu.sans_avertissement === true) {
      // Plusieurs maris en même temps : accepté sans avertissement (CL-POL-14).
      expect(findCoherenceIssues(tree.data)).toEqual([]);
      for (const union of tree.data.unions) expect(checkUnion(union)).toEqual([]);
    }

    const layout = layoutTree(tree.data, centerId);
    expectLayoutInvariants(layout);
    if (attendu.disposition === undefined) throw new Error(`${id} attend une disposition (T-012)`);
    expectDisposition(layout, tree, attendu.disposition);

    if (attendu.sans_regle_de_genre === true) {
      const swapped = buildTreeStructure(swapGenders(tree.data), centerId);
      expect(comparableStructure(swapped)).toEqual(comparableStructure(structure));
      // Même placement, genres inversés.
      const swappedLayout = layoutTree(swapGenders(tree.data), centerId);
      expect([...swappedLayout.people.values()]).toEqual([...layout.people.values()]);
    }

    for (const [centre, expected] of Object.entries(attendu.vers_centre_depuis ?? {})) {
      const other = buildTreeStructure(tree.data, tree.id(centre));
      const leading = other.units.flatMap((unit) =>
        unit.foyers
          .filter((foyer) => foyer.leadsToCenter)
          .map((foyer) => [tree.keyOf(foyer.hubId), tree.keyOf(foyer.partnerId)]),
      );
      expect(leading, `foyers qui mènent à ${centre}`).toEqual(expected);
    }
    expect(Object.keys(attendu.vers_centre_depuis ?? {})).toEqual(
      scenario.action.autres_centres ?? [],
    );

    const steps = scenario.action.puis;
    expect(steps === undefined).toBe(attendu.apres === undefined);
    if (steps !== undefined && attendu.apres !== undefined) {
      applyLayoutSteps(tree, steps);
      expectUnits(buildTreeStructure(tree.data, centerId), tree, attendu.apres.unites);
    }
  });
});
