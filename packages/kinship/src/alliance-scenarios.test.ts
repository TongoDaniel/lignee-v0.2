// Cas limites de l'alliance, joués depuis test/scenarios (T-021) : CL-FAM-01 et CL-POL-08. Le
// lien attendu, écrit en mots, est ramené à sa structure (`allianceMeaningOfWords`) et comparé au
// lien le plus proche calculé ; ses mots français sont exactement ceux du dictionnaire (T-026),
// l'anglais reste à T-027. La simultanéité est
// lue sur l'arbre du scénario (dates des unions, réponses gardées) par `createAllianceContext`.
import type { TreeData } from '@lignee/domain/test-support';
import {
  buildScenarioTree,
  expectedLinkSchema,
  loadScenario,
  scenarioSchema,
  scenarioTreeSchema,
  type ExpectedLink,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createAllianceContext } from './alliance';
import { createKinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { siblingLink } from './siblings';
import { frenchShortWords } from './test-support/french-words';
import {
  allianceMeaningOfResult,
  allianceMeaningOfWords,
  knownAlliancePhrases,
} from './test-support/alliance-words';

function linksScenarioSchema(id: string) {
  return scenarioSchema(id, {
    arbre: scenarioTreeSchema,
    attendu: z.strictObject({ liens: z.array(expectedLinkSchema).min(1) }),
  });
}

function engineOf(data: TreeData) {
  const graph = createKinshipGraph(data);
  const allianceContext = createAllianceContext(data);
  return {
    graph,
    find: (a: string, b: string) => findRelationships(graph, a, b, { allianceContext }),
  };
}

/** Vérifie un lien attendu : le lien le plus proche calculé dit ce que disent les mots. */
function expectLink(tree: ScenarioTree, data: TreeData, lien: ExpectedLink) {
  const engine = engineOf(data);
  const result = engine.find(tree.id(lien.de), tree.id(lien.vers));
  expect(allianceMeaningOfResult(engine.graph, result), `${lien.de} → ${lien.vers}`).toEqual(
    allianceMeaningOfWords(lien.fr, lien.en),
  );
  const words = frenchShortWords(data, tree.id(lien.de), tree.id(lien.vers));
  expect(words, `${lien.de} → ${lien.vers} (fr)`).toEqual([lien.fr]);
}

describe('PAR-04 — aucun « belle-mère » ni « beau-père » pour le conjoint d’un parent', () => {
  it('le tableau des mots des scénarios n’en contient aucun', () => {
    for (const phrase of knownAlliancePhrases()) {
      expect(phrase).not.toMatch(/belle-mère|beau-père/);
    }
  });
});

describe('CL-FAM-01 — enfant du conjoint d’un parent (famille recomposée)', () => {
  const scenario = loadScenario('CL-FAM-01', linksScenarioSchema('CL-FAM-01'));
  const tree = buildScenarioTree(scenario.arbre);

  it('les liens attendus, du côté de chacun', () => {
    expect(scenario.couverture?.teste).toContain('lien');
    for (const lien of scenario.attendu.liens) expectLink(tree, tree.data, lien);
  });

  it('jamais « demi-frère » : aucun chemin de sang, la fratrie est celle d’un enfant du conjoint', () => {
    const engine = engineOf(tree.data);
    const result = engine.find(tree.id('emma'), tree.id('luc'));
    if (result.status !== 'related') throw new Error('Expected a link');
    expect(result.relationships.every((relationship) => relationship.kind === 'alliance')).toBe(
      true,
    );
    expect(siblingLink(engine.graph, tree.id('emma'), tree.id('luc'))?.kind).toBe('step_sibling');
    // L'union de Paul et Carine vient après son divorce d'avec Anne (dates) ; celle de Carine et
    // Paul après sa séparation d'avec Marc.
    const [crossing] = result.relationships[0]?.alliance?.crossings ?? [];
    expect(crossing?.fromChild?.timing).toBe('successive');
    expect(crossing?.toChild?.timing).toBe('successive');
    expect(crossing?.unions.map((union) => union.ending)).toEqual([{ status: 'no_end_known' }]);
  });
});

describe('CL-POL-08 — « la co-épouse de ma mère »', () => {
  const scenario = loadScenario('CL-POL-08', linksScenarioSchema('CL-POL-08'));
  const tree = buildScenarioTree(scenario.arbre);

  it('« épouse de votre père », « co-épouse » entre les deux épouses, unions simultanées', () => {
    expect(scenario.couverture?.teste).toContain('lien');
    expect(tree.data.simultaneityAnswers).toHaveLength(1);
    for (const lien of scenario.attendu.liens) expectLink(tree, tree.data, lien);
    // L'union de Moussa et Fatou est simultanée avec celle de Moussa et Mariam, mère d'Aïcha.
    const result = engineOf(tree.data).find(tree.id('aicha'), tree.id('fatou'));
    if (result.status !== 'related') throw new Error('Expected a link');
    const [crossing] = result.relationships[0]?.alliance?.crossings ?? [];
    expect(crossing?.fromChild).toMatchObject({
      childId: tree.id('aicha'),
      parentId: tree.id('moussa'),
      timing: 'simultaneous',
    });
  });

  it('unions successives, ou rien ne le dit : jamais « co-épouse »', () => {
    const successive: TreeData = {
      ...tree.data,
      simultaneityAnswers: tree.data.simultaneityAnswers.map((answer) => ({
        ...answer,
        simultaneity: 'successive',
      })),
    };
    const unknown: TreeData = { ...tree.data, simultaneityAnswers: [] };
    for (const [data, timing] of [
      [successive, 'successive'],
      [unknown, 'unknown'],
    ] as const) {
      expectLink(tree, data, {
        de: 'mariam',
        vers: 'fatou',
        fr: 'autre épouse de votre mari',
        en: "your husband's other wife",
      });
      // Pour Aïcha, Fatou reste « épouse de votre père » ; l'union est dite successive ou
      // inconnue, jamais supposée.
      expectLink(tree, data, {
        de: 'aicha',
        vers: 'fatou',
        fr: 'épouse de votre père',
        en: "your father's wife",
      });
      const result = engineOf(data).find(tree.id('mariam'), tree.id('fatou'));
      if (result.status !== 'related') throw new Error('Expected a link');
      expect(result.relationships[0]?.alliance?.sharedSpouse?.timing).toBe(timing);
    }
  });
});
