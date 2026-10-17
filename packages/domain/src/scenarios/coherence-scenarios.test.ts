// Cas limites cités par T-007, joués pour ce qui relève du modèle : contrôles de cohérence
// (UNI-18), invariants (UNI-09) et simultanéité des unions (UNI-08). Chaque scénario est lu dans
// test/scenarios/<ID>.yaml (schéma strict) et son arbre construit en objets du modèle ; ce qui
// reste à jouer ailleurs est listé dans le champ `couverture`.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  coherenceCodeSchema,
  findCoherenceIssues,
  checkNewFiliation,
  hasRefusal,
  type CoherenceIssue,
} from '../coherence';
import { filiationSchema, type Filiation } from '../filiation';
import type { Id } from '../ids';
import {
  answerSimultaneity,
  resolveSimultaneity,
  simultaneityQuestions,
} from '../union-simultaneity';
import {
  loadScenario,
  scenarioFiliationTypes,
  scenarioFuzzyDateSchema,
  scenarioSchema,
} from '../test-support/scenario';
import {
  buildScenarioTree,
  factFromScenario,
  scenarioTreeSchema,
  type ScenarioTree,
} from '../test-support/scenario-tree';
import { treeDataIssues } from '../test-support/tree-data';

const severities = { alerte: 'warning', refus: 'refusal' } as const;
const severitySchema = z.enum(['alerte', 'refus']);
const filiationTypeKey = z.enum(
  Object.keys(scenarioFiliationTypes) as [keyof typeof scenarioFiliationTypes],
);

const expectedAlertSchema = z.strictObject({
  code: coherenceCodeSchema,
  severite: severitySchema,
  personnes: z.array(z.string()).min(1),
});

/** Personnes en cause dans une alerte, par nom court, dans l'ordre de l'alerte. */
function peopleOf(tree: ScenarioTree, issue: CoherenceIssue): (string | undefined)[] {
  return issue.objects
    .filter((object) => object.type === 'person')
    .map((object) => tree.keyOf(object.id));
}

/** Une alerte telle que l'écrit le scénario. */
function asScenarioAlert(tree: ScenarioTree, issue: CoherenceIssue) {
  const severite = issue.severity === 'warning' ? 'alerte' : 'refus';
  return { code: issue.code, severite, personnes: peopleOf(tree, issue) };
}

/** Une filiation nouvelle, d'un parent vers un enfant du scénario. */
function newFiliation(
  tree: ScenarioTree,
  parent: string,
  child: string,
  type: keyof typeof scenarioFiliationTypes = 'naissance',
): Filiation {
  return filiationSchema.parse({
    id: tree.context.nextId(),
    treeId: tree.context.treeId,
    parentId: tree.id(parent),
    childId: tree.id(child),
    type: scenarioFiliationTypes[type],
    certainty: 'certain',
  });
}

describe('CL-DON-08 — mère plus jeune que sa fille', () => {
  const schema = scenarioSchema('CL-DON-08', {
    arbre: scenarioTreeSchema,
    attendu: z.strictObject({
      alertes: z.array(expectedAlertSchema).min(1),
      variantes: z
        .array(
          z.strictObject({
            parent: scenarioFuzzyDateSchema,
            enfant: scenarioFuzzyDateSchema,
            alertes: z.array(coherenceCodeSchema),
          }),
        )
        .min(1),
    }),
  });

  it('modèle : une alerte expliquée, qu’on peut passer outre, qui nomme la mère, la fille, le lien et les dates', () => {
    const scenario = loadScenario('CL-DON-08', schema);
    const tree = buildScenarioTree(scenario.arbre);
    expect(treeDataIssues(tree.data)).toEqual([]);
    const issues = findCoherenceIssues(tree.data);
    expect(issues.map((issue) => asScenarioAlert(tree, issue))).toEqual(scenario.attendu.alertes);
    expect(hasRefusal(issues)).toBe(false);
    const [issue] = issues;
    const types = issue?.objects.map((object) => object.type);
    expect(types).toEqual(['person', 'person', 'filiation', 'fact', 'fact']);
    // La même filiation, saisie maintenant, donne la même alerte, sans refus.
    const [filiation] = tree.data.filiations;
    if (filiation === undefined) throw new Error('missing filiation');
    const check = checkNewFiliation(tree.data, filiation);
    expect(check.map((found) => found.code)).toEqual(['parent_younger_than_child']);
    expect(hasRefusal(check)).toBe(false);
  });

  it('modèle : avec des dates floues, l’alerte ne part que si elle est certaine', () => {
    const scenario = loadScenario('CL-DON-08', schema);
    const tree = buildScenarioTree(scenario.arbre);
    for (const variant of scenario.attendu.variantes) {
      const facts = [
        factFromScenario(tree.context, {
          personne: 'esso',
          type: 'naissance',
          date: variant.parent,
        }),
        factFromScenario(tree.context, {
          personne: 'kanga',
          type: 'naissance',
          date: variant.enfant,
        }),
      ];
      const codes = findCoherenceIssues({ ...tree.data, facts }).map((issue) => issue.code);
      expect({ variant, codes }).toEqual({ variant, codes: variant.alertes });
    }
  });
});

describe('CL-DON-09 — enfant né deux ans après la mort de son père', () => {
  const schema = scenarioSchema('CL-DON-09', {
    arbre: scenarioTreeSchema,
    attendu: z.strictObject({
      alertes: z.array(expectedAlertSchema).min(1),
      variantes: z
        .array(
          z.strictObject({
            parent: z.string(),
            deces: scenarioFuzzyDateSchema,
            naissance: scenarioFuzzyDateSchema,
            alertes: z.array(coherenceCodeSchema),
          }),
        )
        .min(1),
    }),
  });

  it('modèle : une alerte expliquée, qu’on peut passer outre', () => {
    const scenario = loadScenario('CL-DON-09', schema);
    const tree = buildScenarioTree(scenario.arbre);
    expect(treeDataIssues(tree.data)).toEqual([]);
    const issues = findCoherenceIssues(tree.data);
    expect(issues.map((issue) => asScenarioAlert(tree, issue))).toEqual(scenario.attendu.alertes);
    expect(hasRefusal(issues)).toBe(false);
  });

  it('modèle : naissance posthume dans les 10 mois, mort de la mère, dates floues', () => {
    const scenario = loadScenario('CL-DON-09', schema);
    const tree = buildScenarioTree(scenario.arbre);
    for (const variant of scenario.attendu.variantes) {
      const facts = [
        factFromScenario(tree.context, {
          personne: variant.parent,
          type: 'deces',
          date: variant.deces,
        }),
        factFromScenario(tree.context, {
          personne: 'ebai',
          type: 'naissance',
          date: variant.naissance,
        }),
      ];
      const codes = findCoherenceIssues({ ...tree.data, facts }).map((issue) => issue.code);
      expect({ variant, codes }).toEqual({ variant, codes: variant.alertes });
    }
  });
});

const addedFiliationSchema = z.strictObject({
  parent: z.string(),
  enfant: z.string(),
  type: filiationTypeKey.optional(),
});

describe('CL-DON-10 — personne qui deviendrait son propre ancêtre', () => {
  const schema = scenarioSchema('CL-DON-10', {
    arbre: scenarioTreeSchema,
    action: z.strictObject({ ajout_filiation: addedFiliationSchema }),
    attendu: z.strictObject({
      refus: z.strictObject({
        code: z.literal('filiation_cycle'),
        severite: z.literal('refus'),
        chemin: z.array(z.string()).min(2),
      }),
      types_refuses: z.array(filiationTypeKey).min(1),
      accepte: addedFiliationSchema,
    }),
  });

  it('modèle : refus, avec le chemin qui reviendrait sur la personne, quel que soit le type', () => {
    const scenario = loadScenario('CL-DON-10', schema);
    const tree = buildScenarioTree(scenario.arbre);
    expect(findCoherenceIssues(tree.data)).toEqual([]);
    const { parent, enfant } = scenario.action.ajout_filiation;
    const { refus } = scenario.attendu;
    for (const type of scenario.attendu.types_refuses) {
      const added = newFiliation(tree, parent, enfant, type);
      const issues = checkNewFiliation(tree.data, added);
      expect(hasRefusal(issues)).toBe(true);
      const [issue] = issues.filter((found) => found.code === refus.code);
      if (issue === undefined) throw new Error(`no cycle refusal for ${type}`);
      expect(issue.severity).toBe(severities[refus.severite]);
      // Le chemin : personne, lien, personne… et le nouveau lien qui revient sur la première.
      expect(peopleOf(tree, issue)).toEqual(refus.chemin.slice(0, -1));
      expect(refus.chemin.at(-1)).toBe(refus.chemin[0]);
      expect(issue.objects.at(-1)).toEqual({ type: 'filiation', id: added.id });
      expect(issue.objects.map((object) => object.type)).toEqual(
        refus.chemin.slice(0, -1).flatMap(() => ['person', 'filiation']),
      );
    }
  });

  it('modèle : enregistré malgré tout, le cycle est retrouvé dans l’arbre entier ; l’autre sens est accepté', () => {
    const scenario = loadScenario('CL-DON-10', schema);
    const tree = buildScenarioTree(scenario.arbre);
    const { parent, enfant } = scenario.action.ajout_filiation;
    const added = newFiliation(tree, parent, enfant);
    const issues = findCoherenceIssues({
      ...tree.data,
      filiations: [...tree.data.filiations, added],
    });
    expect(issues.map((issue) => [issue.code, issue.severity])).toEqual([
      ['filiation_cycle', 'refusal'],
    ]);
    expect(new Set(peopleOf(tree, issues[0] as CoherenceIssue))).toEqual(
      new Set(scenario.attendu.refus.chemin),
    );
    const accepted = scenario.attendu.accepte;
    expect(
      checkNewFiliation(
        tree.data,
        newFiliation(tree, accepted.parent, accepted.enfant, accepted.type),
      ),
    ).toEqual([]);
  });
});

describe('CL-DON-11 — troisième parent « de naissance »', () => {
  const schema = scenarioSchema('CL-DON-11', {
    arbre: scenarioTreeSchema,
    action: z.strictObject({ ajout_filiation: addedFiliationSchema }),
    attendu: z.strictObject({
      refus: z.strictObject({
        code: z.literal('third_birth_parent'),
        severite: z.literal('refus'),
        personnes: z.array(z.string()).min(4),
      }),
      propositions: z.array(filiationTypeKey).min(1),
      accepte: addedFiliationSchema,
    }),
  });

  it('modèle : refus, qui nomme l’enfant et ses parents, et propose un autre type de lien', () => {
    const scenario = loadScenario('CL-DON-11', schema);
    const tree = buildScenarioTree(scenario.arbre);
    expect(findCoherenceIssues(tree.data)).toEqual([]);
    const { parent, enfant, type } = scenario.action.ajout_filiation;
    const added = newFiliation(tree, parent, enfant, type);
    const issues = checkNewFiliation(tree.data, added);
    expect(issues.map((issue) => asScenarioAlert(tree, issue))).toEqual([
      {
        code: scenario.attendu.refus.code,
        severite: scenario.attendu.refus.severite,
        personnes: scenario.attendu.refus.personnes,
      },
    ]);
    const proposed = scenario.attendu.propositions.map((key) => scenarioFiliationTypes[key]);
    expect(issues[0]?.suggestedFiliationTypes).toEqual(proposed);
    // Chaque type proposé est accepté pour le même parent et le même enfant.
    for (const key of scenario.attendu.propositions) {
      expect({
        key,
        issues: checkNewFiliation(tree.data, newFiliation(tree, parent, enfant, key)),
      }).toEqual({ key, issues: [] });
    }
    const accepted = scenario.attendu.accepte;
    expect(
      checkNewFiliation(
        tree.data,
        newFiliation(tree, accepted.parent, accepted.enfant, accepted.type),
      ),
    ).toEqual([]);
  });

  it('modèle : enregistré malgré tout, le troisième parent est retrouvé dans l’arbre entier', () => {
    const scenario = loadScenario('CL-DON-11', schema);
    const tree = buildScenarioTree(scenario.arbre);
    const { parent, enfant, type } = scenario.action.ajout_filiation;
    const issues = findCoherenceIssues({
      ...tree.data,
      filiations: [...tree.data.filiations, newFiliation(tree, parent, enfant, type)],
    });
    expect(issues.map((issue) => asScenarioAlert(tree, issue))).toEqual([
      {
        code: scenario.attendu.refus.code,
        severite: scenario.attendu.refus.severite,
        personnes: scenario.attendu.refus.personnes,
      },
    ]);
  });
});

describe('CL-POL-05 — aucune date : unions simultanées ou successives ?', () => {
  const answers = { simultanees: 'simultaneous', successives: 'successive' } as const;
  const schema = scenarioSchema('CL-POL-05', {
    arbre: scenarioTreeSchema,
    action: z.strictObject({
      reponses: z.array(z.enum(['simultanees', 'successives'])).min(2),
    }),
    attendu: z.strictObject({
      questions: z
        .array(
          z.strictObject({
            personne: z.string(),
            unions: z.array(z.tuple([z.string(), z.string()])).min(2),
          }),
        )
        .min(1),
      questions_apres_reponse: z.literal(0),
    }),
  });

  it('modèle : une seule question ; la réponse est gardée et reste modifiable', () => {
    const scenario = loadScenario('CL-POL-05', schema);
    const tree = buildScenarioTree(scenario.arbre);
    const unionIdOf = ([a, b]: readonly [string, string]): Id => {
      const found = tree.data.unions.find((union) =>
        union.spouses.every((spouse) => [tree.id(a), tree.id(b)].includes(spouse.personId)),
      );
      if (found === undefined) throw new Error(`missing union ${a}-${b}`);
      return found.id;
    };

    const questions = simultaneityQuestions(tree.data);
    expect(
      questions.map((question) => ({
        personne: tree.keyOf(question.personId),
        unions: question.unionIds,
      })),
    ).toEqual(
      scenario.attendu.questions.map((question) => ({
        personne: question.personne,
        unions: question.unions.map(unionIdOf),
      })),
    );

    let data = tree.data;
    const [question] = questions;
    if (question === undefined) throw new Error('missing question');
    for (const answer of scenario.action.reponses) {
      data = { ...data, unions: answerSimultaneity(data.unions, question, answers[answer]) };
      expect(simultaneityQuestions(data)).toHaveLength(scenario.attendu.questions_apres_reponse);
      const [first, second] = data.unions;
      if (first === undefined || second === undefined) throw new Error('missing unions');
      expect(resolveSimultaneity(data, question.personId, first, second)).toEqual({
        source: 'answer',
        value: answers[answer],
      });
      expect(treeDataIssues(data)).toEqual([]);
    }
  });
});
