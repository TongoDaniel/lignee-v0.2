// Format complet d'un scénario de cas limite (TRD, Tests et qualité ; test/scenarios/README.md) :
// en-tête, couverture, arbre, action, attendu. Les tests jouent un scénario avec `loadScenario`
// (scenario.ts), qui laisse la trace « joué » ; `readScenarioFile` sert à valider tous les
// fichiers sans les compter comme joués.
import { readdirSync } from 'node:fs';

import { z } from 'zod';

import { textSchema } from '../common';
import { filiationSchema, parentCandidateSchema } from '../filiation';
import { personSchema } from '../person';
import {
  coverageSchema,
  readScenarioYaml,
  SCENARIOS_DIR,
  scenarioFiliationTypes,
} from './scenario';
import { defaultName, scenarioTreeSchema, type ScenarioTree } from './scenario-tree';

/** Identifiant de l'onglet Cas limites : `CL-POL-03`. */
export const scenarioIdSchema = z.string().regex(/^CL-[A-Z]{3}-\d{2}$/);

/** Identifiants des scénarios présents dans test/scenarios, triés. */
export function listScenarioIds(): string[] {
  return readdirSync(SCENARIOS_DIR)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => file.slice(0, -'.yaml'.length))
    .sort();
}

/** Fichiers de test/scenarios qui ne sont ni un scénario `.yaml` ni le README. */
export function unexpectedScenarioFiles(): string[] {
  return readdirSync(SCENARIOS_DIR).filter(
    (file) => !file.endsWith('.yaml') && file !== 'README.md',
  );
}

/**
 * Action du scénario : qui parle, et ce qu'il dit. Une opération sans dictée (saisie à la main,
 * fusion…) s'ajoutera ici, avec sa forme, quand un scénario en aura besoin.
 */
export const scenarioActionSchema = z.strictObject({
  locuteur: z.string(),
  dictee: textSchema,
});
export type ScenarioAction = z.infer<typeof scenarioActionSchema>;

/** Lien attendu entre deux personnes, en français et en anglais (moteur, T-020, T-026, T-027). */
export const expectedLinkSchema = z.strictObject({
  de: z.string(),
  vers: z.string(),
  fr: textSchema,
  en: textSchema,
});
export type ExpectedLink = z.infer<typeof expectedLinkSchema>;

/**
 * Pas d'un plan attendu (voix, T-062), dans le format du TRD. D'autres pas s'ajoutent ici quand
 * un scénario en a besoin.
 */
export const expectedPlanStepSchema = z.union([
  z.strictObject({ creer: z.string() }),
  z.strictObject({
    filiation: z.strictObject({
      parent: z.string(),
      enfant: z.string(),
      type: z.enum(Object.keys(scenarioFiliationTypes) as [keyof typeof scenarioFiliationTypes]),
    }),
  }),
  z.strictObject({
    candidats_mere: z.strictObject({ enfant: z.string(), candidates: z.array(z.string()).min(1) }),
  }),
]);
export type ExpectedPlanStep = z.infer<typeof expectedPlanStepSchema>;

/**
 * Attendu d'un scénario avec action (dictée) : le vocabulaire partagé par la voix et le moteur.
 * Strict : une clé inconnue est refusée, chaque clé a sa forme.
 */
export const actionExpectedSchema = z
  .strictObject({
    /** Nombre de questions posées avant l'aperçu. */
    questions: z.int().min(0).optional(),
    plan: z.array(expectedPlanStepSchema).min(1).optional(),
    lien: expectedLinkSchema.optional(),
  })
  .refine((expected) => Object.keys(expected).length > 0, { message: 'Nothing is expected' });
export type ActionExpected = z.infer<typeof actionExpectedSchema>;

/**
 * Scénario avec action (format de CL-POL-03) : arbre de départ, action, attendu. À passer à
 * `loadScenario` dans le test qui le joue (moteur, voix, saisie…).
 */
export function actionScenarioSchema(id: string) {
  return z.strictObject({
    id: z.literal(id),
    titre: textSchema,
    couverture: coverageSchema.optional(),
    arbre: scenarioTreeSchema,
    action: scenarioActionSchema,
    attendu: actionExpectedSchema,
  });
}
export type ActionScenario = z.infer<ReturnType<typeof actionScenarioSchema>>;

const nonEmptyRecord = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0, { message: 'Must not be empty' });

/**
 * Forme commune à tous les fichiers : en-tête, couverture, arbre facultatif (un cas qui porte
 * sur une valeur, une date par exemple, n'en a pas besoin), action facultative, attendu non
 * vide. Une action avec un `locuteur` est une dictée dans un arbre (format de CL-POL-03) : elle
 * suit `scenarioActionSchema`, le locuteur est une personne de l'arbre, et l'attendu suit
 * `actionExpectedSchema`. Les autres actions (saisie d'une date, calcul… : T-005) et l'attendu
 * d'un scénario sans dictée sont propres au cas : le test qui le joue les valide en schéma
 * strict avec `loadScenario`.
 */
export function scenarioFileSchema(id: string) {
  return z
    .strictObject({
      id: z.literal(id),
      titre: textSchema,
      couverture: coverageSchema.optional(),
      arbre: scenarioTreeSchema.optional(),
      action: nonEmptyRecord.optional(),
      attendu: nonEmptyRecord,
    })
    .superRefine((scenario, context) => {
      if (scenario.action === undefined || !('locuteur' in scenario.action)) return;
      const relay = (prefix: string, issues: readonly z.core.$ZodIssue[]) => {
        for (const issue of issues) {
          context.addIssue({
            code: 'custom',
            message: issue.message,
            path: [prefix, ...issue.path],
          });
        }
      };
      const action = scenarioActionSchema.safeParse(scenario.action);
      if (!action.success) relay('action', action.error.issues);
      const keys = new Set(scenario.arbre?.personnes.map(({ key }) => key) ?? []);
      if (action.success && !keys.has(action.data.locuteur)) {
        context.addIssue({
          code: 'custom',
          message: `Speaker ${action.data.locuteur} is not in the tree`,
          path: ['action', 'locuteur'],
        });
      }
      const expected = actionExpectedSchema.safeParse(scenario.attendu);
      if (!expected.success) relay('attendu', expected.error.issues);
    });
}
export type ScenarioFile = z.infer<ReturnType<typeof scenarioFileSchema>>;

/**
 * Lit et valide un fichier de scénario dans sa forme commune, sans laisser de trace « joué » :
 * pour contrôler tous les fichiers. Pour jouer un scénario, utilisez `loadScenario`.
 */
export function readScenarioFile(id: string): ScenarioFile {
  return scenarioFileSchema(id).parse(readScenarioYaml(id));
}

/**
 * Applique un plan attendu à l'arbre d'un scénario : l'arbre tel qu'il sera après l'action, en
 * objets valides du modèle. Le moteur de parenté s'en sert pour vérifier le lien attendu sans
 * dépendre du résolveur vocal ; la voix compare son propre plan au plan attendu. Une personne
 * créée est connue, de genre non renseigné (le plan du TRD ne le donne pas), et porte son nom
 * court comme prénom, comme dans `buildScenarioTree`.
 * Renvoie l'identifiant de chaque personne créée, par nom court.
 */
export function applyExpectedPlan(tree: ScenarioTree, plan: readonly ExpectedPlanStep[]) {
  const { context, data } = tree;
  const created = new Map<string, string>();
  const idOf = (key: string) => {
    const value = created.get(key) ?? (tree.has(key) ? tree.id(key) : undefined);
    if (value === undefined) throw new Error(`Unknown person in plan: ${key}`);
    return value;
  };
  for (const step of plan) {
    if ('creer' in step) {
      if (tree.has(step.creer) || created.has(step.creer)) {
        throw new Error(`Person already exists: ${step.creer}`);
      }
      const person = personSchema.parse({
        id: context.personId(step.creer),
        treeId: context.treeId,
        nature: 'known',
      });
      created.set(step.creer, person.id);
      data.people.push(person);
      data.names.push(defaultName(context, step.creer));
    } else if ('filiation' in step) {
      data.filiations.push(
        filiationSchema.parse({
          id: context.nextId(),
          treeId: context.treeId,
          parentId: idOf(step.filiation.parent),
          childId: idOf(step.filiation.enfant),
          type: scenarioFiliationTypes[step.filiation.type],
          certainty: 'certain',
        }),
      );
    } else {
      for (const candidate of step.candidats_mere.candidates) {
        data.parentCandidates.push(
          parentCandidateSchema.parse({
            id: context.nextId(),
            treeId: context.treeId,
            childId: idOf(step.candidats_mere.enfant),
            candidateId: idOf(candidate),
          }),
        );
      }
    }
  }
  return { id: idOf };
}
