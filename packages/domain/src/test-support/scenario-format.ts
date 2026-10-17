// Format complet d'un scénario de cas limite (TRD, Tests et qualité ; test/scenarios/README.md) :
// en-tête, couverture, arbre, action, attendu. Les tests jouent un scénario avec `loadScenario`
// (scenario.ts), qui laisse la trace « joué » ; `readScenarioFile` sert à valider tous les
// fichiers sans les compter comme joués.
import { readdirSync } from 'node:fs';

import { z } from 'zod';

import { textSchema } from '../common';
import { filiationSchema, parentCandidateSchema, type Filiation } from '../filiation';
import type { Id } from '../ids';
import { personSchema } from '../person';
import {
  coverageSchema,
  readScenarioYaml,
  SCENARIOS_DIR,
  scenarioFiliationTypes,
  scenarioPersonSchema,
} from './scenario';
import { defaultName, scenarioTreeSchema, type ScenarioTree } from './scenario-tree';
import type { TreeData } from './tree-data';

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
 * Personne créée par un plan : `samuel/M`, même notation que `personnes`. Écart au format du
 * TRD, qui écrit `creer: samuel` : le genre compte pour le lien attendu (« frère »). La forme
 * sans genre reste admise, le genre est alors non renseigné.
 */
export const expectedCreatedPersonSchema = z.union([
  scenarioPersonSchema,
  z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .transform((key) => ({ key, gender: 'unspecified' as const })),
]);

/**
 * Pas d'un plan attendu (voix, T-062), dans le format du TRD (sauf le genre de `creer`).
 * D'autres pas s'ajoutent ici quand un scénario en a besoin.
 */
export const expectedPlanStepSchema = z.union([
  z.strictObject({ creer: expectedCreatedPersonSchema }),
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
  /**
   * Crée une place à compléter (UNI-02) : « la mère de Bruno », identité inconnue. `distincte_de`
   * : personnes qu'elle n'est pas, dit explicitement (« de même père », sa mère n'est pas la
   * mienne : CL-VOI-08, ADR 0017).
   */
  z.strictObject({
    a_completer: expectedCreatedPersonSchema,
    distincte_de: z.array(z.string()).min(1).optional(),
  }),
  /**
   * Précise une place à compléter : c'est en fait `personne` (« même père même mère »,
   * CL-VOI-08). Ses filiations, unions et candidatures passent à `personne`, et la place
   * disparaît.
   */
  z.strictObject({ preciser: z.strictObject({ place: z.string(), personne: z.string() }) }),
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
 * Scénario en plusieurs dictées successives (CL-VOI-08 : « mon frère de même père », puis « même
 * père même mère ») : `action.etapes` et `attendu.etapes`, de même longueur ; l'attendu d'une
 * étape porte sur l'arbre après les plans de cette étape et des précédentes.
 */
export const stepsActionSchema = z.strictObject({
  etapes: z.array(scenarioActionSchema).min(2),
});
export const stepsExpectedSchema = z.strictObject({
  etapes: z.array(actionExpectedSchema).min(2),
});

export function stepsScenarioSchema(id: string) {
  return z
    .strictObject({
      id: z.literal(id),
      titre: textSchema,
      couverture: coverageSchema.optional(),
      arbre: scenarioTreeSchema,
      action: stepsActionSchema,
      attendu: stepsExpectedSchema,
    })
    .refine((scenario) => scenario.action.etapes.length === scenario.attendu.etapes.length, {
      message: 'Each step needs its expectation',
      path: ['attendu', 'etapes'],
    });
}
export type StepsScenario = z.infer<ReturnType<typeof stepsScenarioSchema>>;

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
      if (scenario.action === undefined) return;
      const relay = (prefix: string, issues: readonly z.core.$ZodIssue[]) => {
        for (const issue of issues) {
          context.addIssue({
            code: 'custom',
            message: issue.message,
            path: [prefix, ...issue.path],
          });
        }
      };
      const keys = new Set(scenario.arbre?.personnes.map(({ key }) => key) ?? []);
      const checkSpeaker = (speaker: string, path: (string | number)[]) => {
        if (keys.has(speaker)) return;
        context.addIssue({
          code: 'custom',
          message: `Speaker ${speaker} is not in the tree`,
          path,
        });
      };
      if ('locuteur' in scenario.action) {
        const action = scenarioActionSchema.safeParse(scenario.action);
        if (!action.success) relay('action', action.error.issues);
        if (action.success) checkSpeaker(action.data.locuteur, ['action', 'locuteur']);
        const expected = actionExpectedSchema.safeParse(scenario.attendu);
        if (!expected.success) relay('attendu', expected.error.issues);
      } else if ('etapes' in scenario.action) {
        // Dictées successives (CL-VOI-08) : chaque étape a la forme d'une dictée.
        const action = stepsActionSchema.safeParse(scenario.action);
        if (!action.success) relay('action', action.error.issues);
        action.data?.etapes.forEach((step, index) => {
          checkSpeaker(step.locuteur, ['action', 'etapes', index, 'locuteur']);
        });
        const expected = stepsExpectedSchema.safeParse(scenario.attendu);
        if (!expected.success) relay('attendu', expected.error.issues);
        if (action.data !== undefined && expected.data !== undefined) {
          if (action.data.etapes.length !== expected.data.etapes.length) {
            context.addIssue({
              code: 'custom',
              message: 'Each step needs its expectation',
              path: ['attendu', 'etapes'],
            });
          }
        }
      }
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
 * Remplace une place à compléter par la personne qu'elle était (pas `preciser` d'un plan) : ses
 * filiations, unions et candidatures passent à `personId`, la place disparaît. Une filiation qui
 * ferait double emploi (même parent, même enfant, même type) n'est pas recopiée. Refuse une place
 * qui n'est pas à compléter, une place citée ailleurs (faits, titres, naissances multiples) et une
 * filiation d'une personne vers elle-même.
 */
function precisePlaceholder(data: TreeData, placeId: Id, personId: Id): void {
  const place = data.people.find((person) => person.id === placeId);
  if (place?.nature !== 'placeholder') throw new Error(`Not a placeholder: ${placeId}`);
  if (placeId === personId) throw new Error('A placeholder cannot be precised as itself');
  const citedElsewhere =
    data.facts.some(
      (fact) => fact.subject.kind === 'person' && fact.subject.personId === placeId,
    ) ||
    data.titleRoles.some((title) => title.personId === placeId) ||
    data.multipleBirths.some((birth) =>
      birth.members.some((member) => member.personId === placeId),
    );
  if (citedElsewhere) throw new Error(`Placeholder ${placeId} is cited outside its links`);
  const swap = (value: Id) => (value === placeId ? personId : value);

  const filiations: Filiation[] = [];
  for (const filiation of data.filiations) {
    const moved = {
      ...filiation,
      parentId: swap(filiation.parentId),
      childId: swap(filiation.childId),
    };
    if (moved.parentId === moved.childId) throw new Error('A person cannot be their own parent');
    const duplicate = filiations.some(
      (kept) =>
        kept.parentId === moved.parentId &&
        kept.childId === moved.childId &&
        kept.type === moved.type,
    );
    if (!duplicate) filiations.push(moved);
  }
  data.filiations = filiations;
  data.unions = data.unions.map((union) => ({
    ...union,
    spouses: [
      { ...union.spouses[0], personId: swap(union.spouses[0].personId) },
      { ...union.spouses[1], personId: swap(union.spouses[1].personId) },
    ],
  }));
  data.parentCandidates = data.parentCandidates.map((candidate) => ({
    ...candidate,
    childId: swap(candidate.childId),
    candidateId: swap(candidate.candidateId),
  }));
  data.names = data.names.filter((name) => name.personId !== placeId);
  // La mention « distincte de » de la place disparaît avec elle : préciser l'emporte (correction
  // dictée, « en fait, même mère », CL-VOI-08). Celles des autres places passent à la personne.
  data.people = data.people
    .filter((person) => person.id !== placeId)
    .map((person) => {
      if (person.distinctFrom === undefined) return person;
      const distinctFrom = [...new Set(person.distinctFrom.map(swap))].filter(
        (id) => id !== person.id,
      );
      const rest = { ...person };
      delete rest.distinctFrom;
      return distinctFrom.length === 0 ? rest : { ...rest, distinctFrom };
    });
}

/**
 * Applique un plan attendu à l'arbre d'un scénario et renvoie l'arbre tel qu'il sera après
 * l'action, en objets valides du modèle. L'arbre de départ n'est pas modifié : le résultat en
 * est une copie (`structuredClone`), et le plan peut être rejoué. Le moteur de parenté s'en sert
 * pour vérifier le lien attendu sans dépendre du résolveur vocal ; la voix compare son propre
 * plan au plan attendu. Une personne créée est connue, du genre écrit dans le plan (`samuel/M`),
 * et porte son nom court comme prénom, comme dans `buildScenarioTree`. `id`, `has` et `keyOf`
 * du résultat connaissent aussi les personnes créées.
 */
export function applyExpectedPlan(
  tree: ScenarioTree,
  plan: readonly ExpectedPlanStep[],
): ScenarioTree {
  const { context } = tree;
  const data = structuredClone(tree.data);
  const created = new Map<string, Id>();
  const has = (key: string) => created.has(key) || tree.has(key);
  const idOf = (key: string): Id => {
    const value = created.get(key) ?? (tree.has(key) ? tree.id(key) : undefined);
    if (value === undefined) throw new Error(`Unknown person in plan: ${key}`);
    return value;
  };
  for (const step of plan) {
    if ('creer' in step) {
      const { key, gender } = step.creer;
      if (has(key)) throw new Error(`Person already exists: ${key}`);
      const person = personSchema.parse({
        id: context.personId(key),
        treeId: context.treeId,
        nature: 'known',
        gender,
      });
      created.set(key, person.id);
      data.people.push(person);
      data.names.push(defaultName(context, key));
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
    } else if ('a_completer' in step) {
      const { key, gender } = step.a_completer;
      if (has(key)) throw new Error(`Person already exists: ${key}`);
      const distinct = (step.distincte_de ?? []).map(idOf);
      const person = personSchema.parse({
        id: context.personId(key),
        treeId: context.treeId,
        nature: 'placeholder',
        gender,
        ...(distinct.length === 0 ? {} : { distinctFrom: distinct }),
      });
      created.set(key, person.id);
      data.people.push(person);
    } else if ('preciser' in step) {
      precisePlaceholder(data, idOf(step.preciser.place), idOf(step.preciser.personne));
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
  return {
    data,
    id: idOf,
    has,
    keyOf: (value) =>
      tree.keyOf(value) ?? [...created].find(([, createdId]) => createdId === value)?.[0],
    context,
  };
}
