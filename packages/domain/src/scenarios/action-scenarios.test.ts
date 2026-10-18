// Scénarios avec action (format du TRD, Tests et qualité), joués pour leur partie lecture : le
// scénario est chargé en schéma strict, son arbre de départ construit en objets valides du
// modèle, et le plan attendu appliqué à cet arbre. Le comportement (questions, plan produit par
// la voix, lien calculé) reste aux tickets listés dans le champ `couverture` de chaque YAML.
import { describe, expect, it } from 'vitest';

import { loadScenario } from '../test-support/scenario';
import { actionScenarioSchema, applyExpectedPlan } from '../test-support/scenario-format';
import { buildScenarioTree } from '../test-support/scenario-tree';
import { treeDataIssues } from '../test-support/tree-data';

describe('CL-POL-03 — enfant du grand-père, mère inconnue parmi ses épouses', () => {
  it('lecture : l’arbre de départ et l’arbre après le plan attendu sont des objets valides du modèle', () => {
    const scenario = loadScenario('CL-POL-03', actionScenarioSchema('CL-POL-03'));
    expect(scenario.couverture?.teste).toContain('lecture');

    const tree = buildScenarioTree(scenario.arbre);
    const { data, id } = tree;
    expect(treeDataIssues(data)).toEqual([]);

    // Pierre a deux unions, de rangs 1 et 2 ; Rose, sans rang écrit, a le rang suivant : 1.
    const unionsOf = (key: string) =>
      data.unions.flatMap((union) =>
        union.spouses.filter((spouse) => spouse.personId === id(key)).map((spouse) => spouse.rank),
      );
    expect(unionsOf('pierre')).toEqual([1, 2]);
    expect(unionsOf('rose')).toEqual([1]);
    expect(unionsOf('odile')).toEqual([1]);

    const birthParents = (key: string) =>
      data.filiations
        .filter((filiation) => filiation.childId === id(key) && filiation.type === 'birth')
        .map((filiation) => tree.keyOf(filiation.parentId));
    expect(birthParents('joseph')).toEqual(['pierre', 'odile']);
    expect(birthParents('comfort')).toEqual(['joseph']);

    // L'action et l'attendu sont bien formés et ne visent que des personnes connues ou créées.
    expect(tree.has(scenario.action.locuteur)).toBe(true);
    const { plan, lien } = scenario.attendu;
    if (plan === undefined || lien === undefined)
      throw new Error('CL-POL-03 expects a plan and a link');
    const before = structuredClone(data);
    const after = applyExpectedPlan(tree, plan);
    expect(treeDataIssues(after.data)).toEqual([]);
    expect(after.id(lien.de)).toBe(id('joseph'));
    const samuel = after.id(lien.vers);
    expect(after.keyOf(samuel)).toBe('samuel');
    // Samuel est créé homme : « un fils » ; le lien attendu est « frère ou demi-frère ».
    expect(after.data.people.find((person) => person.id === samuel)?.gender).toBe('male');
    expect(
      after.data.filiations
        .filter((filiation) => filiation.childId === samuel)
        .map((filiation) => filiation.parentId),
    ).toEqual([id('pierre')]);
    expect(
      after.data.parentCandidates
        .filter((candidate) => candidate.childId === samuel)
        .map((candidate) => candidate.candidateId),
    ).toEqual([id('rose'), id('odile')]);

    // L'arbre de départ est intact, et le plan se rejoue sur lui.
    expect(data).toEqual(before);
    expect(tree.has('samuel')).toBe(false);
    const again = applyExpectedPlan(tree, plan);
    expect(again.id('samuel')).toBe(samuel);
    expect(again.data.people).toHaveLength(after.data.people.length);
    expect(treeDataIssues(again.data)).toEqual([]);
  });
});
