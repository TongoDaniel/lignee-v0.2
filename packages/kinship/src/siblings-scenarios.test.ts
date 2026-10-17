// Cas limites de la fratrie, joués depuis test/scenarios (T-020) : CL-POL-02, CL-POL-03 (lien),
// CL-GEN-07 (lien), CL-VOI-08 (lien), CL-FAM-08. Le lien attendu, écrit en mots, est ramené à sa
// structure (`siblingMeaningOfWords`) et comparé à la fratrie calculée, en attendant les
// dictionnaires (T-026, T-027).
import {
  actionScenarioSchema,
  applyExpectedPlan,
  buildScenarioTree,
  expectedLinkSchema,
  loadScenario,
  scenarioSchema,
  scenarioTreeSchema,
  stepsScenarioSchema,
  type ExpectedLink,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createKinshipGraph } from './graph';
import { siblingLink } from './siblings';
import { siblingMeaningOfResult, siblingMeaningOfWords } from './test-support/sibling-words';

function graphOf(tree: ScenarioTree) {
  const { people, unions, filiations, parentCandidates } = tree.data;
  return createKinshipGraph({ people, unions, filiations, parentCandidates });
}

/** Vérifie un lien attendu sur l'arbre : la fratrie calculée dit ce que disent les mots. */
function expectLink(tree: ScenarioTree, lien: ExpectedLink) {
  const result = siblingLink(graphOf(tree), tree.id(lien.de), tree.id(lien.vers));
  expect(siblingMeaningOfResult(result), `${lien.de} → ${lien.vers}`).toEqual(
    siblingMeaningOfWords(lien.fr, lien.en),
  );
}

/** Scénario sans dictée : un arbre et des liens attendus. */
function linksScenarioSchema(id: string) {
  return scenarioSchema(id, {
    arbre: scenarioTreeSchema,
    attendu: z.strictObject({ liens: z.array(expectedLinkSchema).min(1) }),
  });
}

describe('CL-POL-02 — enfants de deux épouses différentes', () => {
  it('demi-frère et demi-sœur, même père ; frères par la même épouse', () => {
    const scenario = loadScenario('CL-POL-02', linksScenarioSchema('CL-POL-02'));
    expect(scenario.couverture?.teste).toContain('lien');
    const tree = buildScenarioTree(scenario.arbre);
    for (const lien of scenario.attendu.liens) expectLink(tree, lien);
  });
});

describe('CL-POL-03 — enfant du grand-père, mère inconnue parmi ses épouses', () => {
  it('lien : frère ou demi-frère, puis frère ou demi-frère selon la mère précisée (PAR-03)', () => {
    const scenario = loadScenario('CL-POL-03', actionScenarioSchema('CL-POL-03'));
    expect(scenario.couverture?.teste).toContain('lien');
    const { lien, plan = [] } = scenario.attendu;
    if (lien === undefined) throw new Error('CL-POL-03 attend un lien');
    const tree = buildScenarioTree(scenario.arbre);
    const after = applyExpectedPlan(tree, plan); // copie : l'arbre de départ reste intact
    expectLink(after, lien);
    const link = siblingLink(graphOf(after), after.id(lien.de), after.id(lien.vers));
    if (link?.kind !== 'sibling') throw new Error('Expected a sibling');
    expect(link.toOtherParent).toEqual({
      status: 'unspecified',
      candidateIds: [after.id('rose'), after.id('odile')].sort(),
    });

    // La mère est précisée : Odile (mère de Joseph) donne « frère », Rose « demi-frère ».
    const odile = applyExpectedPlan(tree, [
      ...plan,
      { filiation: { parent: 'odile', enfant: 'samuel', type: 'naissance' } },
    ]);
    expectLink(odile, { ...lien, fr: 'frère', en: 'brother' });
    const rose = applyExpectedPlan(tree, [
      ...plan,
      { filiation: { parent: 'rose', enfant: 'samuel', type: 'naissance' } },
    ]);
    expectLink(rose, {
      ...lien,
      fr: 'demi-frère, même père',
      en: 'half-brother, same father',
    });
  });
});

describe('CL-GEN-07 — « ma sœur Lucienne », parents absents', () => {
  it('lien : deux parents à compléter partagés font des sœurs', () => {
    const scenario = loadScenario('CL-GEN-07', actionScenarioSchema('CL-GEN-07'));
    const { lien, plan = [] } = scenario.attendu;
    if (lien === undefined) throw new Error('CL-GEN-07 attend un lien');
    const after = applyExpectedPlan(buildScenarioTree(scenario.arbre), plan);
    expect(
      after.data.people.filter((person) => person.nature === 'placeholder').map((p) => p.id),
    ).toEqual([after.id('parent_1'), after.id('parent_2')]);
    expectLink(after, lien);
  });
});

describe('CL-VOI-08 — « mon frère de même père », puis « même père même mère »', () => {
  it('lien : demi-frère, même père ; puis frère', () => {
    const scenario = loadScenario('CL-VOI-08', stepsScenarioSchema('CL-VOI-08'));
    let tree = buildScenarioTree(scenario.arbre);
    const seen: string[] = [];
    for (const expected of scenario.attendu.etapes) {
      tree = applyExpectedPlan(tree, expected.plan ?? []);
      if (expected.lien === undefined) throw new Error('CL-VOI-08 attend un lien à chaque étape');
      expectLink(tree, expected.lien);
      seen.push(expected.lien.fr);
      if (seen.length === 1) {
        // Sans la mention « distincte d'Irène », la mère à compléter pourrait être Irène :
        // « frère ou demi-frère », rien n'est supposé (ADR 0017).
        const people = tree.data.people.map((person) => {
          const copy = { ...person };
          delete copy.distinctFrom;
          return copy;
        });
        const open = siblingLink(
          graphOf({ ...tree, data: { ...tree.data, people } }),
          tree.id(expected.lien.de),
          tree.id(expected.lien.vers),
        );
        expect(open?.kind === 'sibling' && open.sharing).toBe('full_or_half');
      }
    }
    expect(seen).toEqual(['demi-frère, même père', 'frère']);
  });
});

describe('CL-FAM-08 — deux mères ou deux pères', () => {
  it('frères par deux mères ; « même parent » quand le mot genré ne dirait pas lequel', () => {
    const scenario = loadScenario('CL-FAM-08', linksScenarioSchema('CL-FAM-08'));
    const tree = buildScenarioTree(scenario.arbre);
    for (const lien of scenario.attendu.liens) expectLink(tree, lien);
  });
});
