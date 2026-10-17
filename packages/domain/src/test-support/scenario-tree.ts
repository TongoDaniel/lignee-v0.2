// Section `arbre` d'un scénario et sa construction en objets du modèle (T-006). Chaque objet est
// validé par son schéma au moment où il est construit : un scénario dont l'arbre ne respecte pas
// le modèle fait échouer le test qui le lit.
import { z } from 'zod';

import { factSchema, multipleBirthSchema, titleRoleSchema, type Fact } from '../fact';
import { filiationSchema, parentCandidateSchema } from '../filiation';
import { fuzzyDateFromText, fuzzyDateSchema } from '../fuzzy-date';
import type { Id } from '../ids';
import { nameSchema, personRecordSchema, personSchema } from '../person';
import { treeSchema } from '../tree';
import { simultaneityAnswerSchema, unionSchema } from '../union';
import { unionPair } from '../union-simultaneity';
import { nameFromScenario, testTree, type TestTree } from './fixtures';
import {
  fuzzyDateInputFromScenario,
  scenarioCandidatesSchema,
  scenarioCertainties,
  scenarioSimultaneities,
  scenarioSimultaneityAnswerSchema,
  scenarioFiliationSchema,
  scenarioFuzzyDateSchema,
  scenarioFiliationTypes,
  scenarioNameSchema,
  scenarioPersonSchema,
  scenarioUnionSchema,
} from './scenario';
import { emptyTreeData, type TreeData } from './tree-data';

/** Date de début ou de fin d'une union de scénario, en date floue validée. */
function unionDate(line: z.infer<typeof scenarioFuzzyDateSchema>) {
  return fuzzyDateSchema.parse(fuzzyDateInputFromScenario(line));
}

/** Titre ou rôle daté (CL-FAM-19). */
export const scenarioTitleSchema = z.strictObject({
  personne: z.string(),
  libelle: z.string(),
  debut: z.string().optional(),
  fin: z.string().optional(),
});

/** Naissance multiple (CL-FAM-11) : les enfants, et leur ordre s'il est connu. */
export const scenarioMultipleBirthSchema = z.strictObject({
  enfants: z.array(z.string()),
  ordre: z.array(z.int()).optional(),
});
export type ScenarioMultipleBirth = z.infer<typeof scenarioMultipleBirthSchema>;

/** Types de fait datés d'un scénario, dans les mots du cahier. */
export const scenarioFactTypes = { naissance: 'birth', deces: 'death' } as const;

/**
 * Naissance ou décès daté d'une personne (contrôles de cohérence, T-007) : la date est une date
 * floue complète (`scenarioFuzzyDateSchema`), validée par `fuzzyDateSchema` à la construction.
 */
export const scenarioFactSchema = z.strictObject({
  personne: z.string(),
  type: z.enum(Object.keys(scenarioFactTypes) as [keyof typeof scenarioFactTypes]),
  date: scenarioFuzzyDateSchema,
});
export type ScenarioFact = z.infer<typeof scenarioFactSchema>;

/**
 * Section `arbre` complète. Une section absente vaut une liste vide ; une clé inconnue est
 * refusée ; chaque personne n'est déclarée qu'une fois. Une section nouvelle s'ajoute ici et dans
 * `buildScenarioTree`, pas dans un test.
 */
export const scenarioTreeSchema = z
  .strictObject({
    personnes: z.array(scenarioPersonSchema).min(1),
    /** Personnes de `personnes` qui sont « à compléter » (UNI-02, UNI-12) : sans nom par défaut. */
    a_completer: z.array(z.string()).optional(),
    noms: z.array(scenarioNameSchema).optional(),
    unions: z.array(scenarioUnionSchema).optional(),
    filiations: z.array(scenarioFiliationSchema).optional(),
    naissances_multiples: z.array(scenarioMultipleBirthSchema).optional(),
    titres: z.array(scenarioTitleSchema).optional(),
    faits: z.array(scenarioFactSchema).optional(),
    candidats: z.array(scenarioCandidatesSchema).optional(),
    simultaneites: z.array(scenarioSimultaneityAnswerSchema).optional(),
  })
  .superRefine((section, context) => {
    const seen = new Set<string>();
    section.personnes.forEach(({ key }, index) => {
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          message: `Person ${key} is declared twice`,
          path: ['personnes', index],
        });
      }
      seen.add(key);
    });
  });
export type ScenarioTreeSection = z.infer<typeof scenarioTreeSchema>;

/** L'arbre de départ d'un scénario, en objets du modèle, avec la correspondance des noms courts. */
export interface ScenarioTree {
  data: TreeData;
  /** Identifiant de la personne `key` ; une personne absente de l'arbre est une erreur. */
  id: (key: string) => Id;
  /** Vrai si `key` est une personne de l'arbre. */
  has: (key: string) => boolean;
  /** Nom court d'une personne de l'arbre. */
  keyOf: (id: Id) => string | undefined;
  /** Contexte de construction, pour créer d'autres objets dans le même arbre. */
  context: TestTree;
}

/**
 * Construit l'arbre de départ : personnes connues ou à compléter (`a_completer`), noms, unions (rang absent : rang suivant du
 * conjoint, dans l'ordre des lignes, comme l'app, UNI-07 ; un rang déjà pris par la même personne
 * est refusé), filiations (de naissance et certaines sauf mention), naissances multiples, titres,
 * naissances et décès datés (T-007). Chaque objet passe son schéma, et chaque personne
 * avec ses noms forme une fiche valide (`personRecordSchema`). Lève une erreur sur toute
 * référence à une personne non déclarée.
 */
export function buildScenarioTree(
  section: ScenarioTreeSection,
  context: TestTree = testTree(),
): ScenarioTree {
  const declared = new Set(section.personnes.map(({ key }) => key));
  const id = (key: string): Id => {
    if (!declared.has(key)) throw new Error(`Unknown person in scenario: ${key}`);
    return context.personId(key);
  };
  const data = emptyTreeData(
    treeSchema.parse({
      id: context.treeId,
      name: 'Arbre de scénario',
      language: 'fr',
      nameOrder: 'given_first',
      ownerAccountId: context.authorAccountId,
      settings: { mapEnabled: true },
    }),
  );

  // Places à compléter : nature `placeholder`, existence certaine, identité inconnue (UNI-02).
  // Un nom absent de `personnes` est une erreur, comme ailleurs.
  const placeholders = new Set(section.a_completer ?? []);
  for (const key of placeholders) id(key);
  data.people = section.personnes.map(({ key, gender }) =>
    personSchema.parse({
      id: id(key),
      treeId: context.treeId,
      nature: placeholders.has(key) ? 'placeholder' : 'known',
      gender,
    }),
  );
  data.names = (section.noms ?? []).map((line) => {
    id(line.personne);
    return nameSchema.parse(nameFromScenario(context, line));
  });
  // Une personne connue sans ligne dans `noms` porte son nom court comme prénom (« pierre » :
  // Pierre) : le format du TRD ne nomme les personnes que par ce nom court, et une fiche connue a
  // un nom. Une place à compléter n'en reçoit pas (« Inconnu » à l'écran, jamais enregistré).
  const named = new Set(data.names.map((name) => name.personId));
  for (const { key } of section.personnes) {
    if (!named.has(id(key)) && !placeholders.has(key)) data.names.push(defaultName(context, key));
  }

  // Rang absent : rang suivant du conjoint. Un rang écrit déjà pris par la même personne (écrit
  // ou déduit) est refusé : deux unions de même rang ne disent pas lequel vient d'abord.
  const ranks = new Map<string, Set<number>>();
  const rankOf = (key: string, given: number | undefined) => {
    const taken = ranks.get(key) ?? new Set<number>();
    const rank = given ?? Math.max(0, ...taken) + 1;
    if (taken.has(rank)) throw new Error(`Rank ${String(rank)} is already used by ${key}`);
    taken.add(rank);
    ranks.set(key, taken);
    return rank;
  };
  data.unions = (section.unions ?? []).map((line) =>
    unionSchema.parse({
      id: context.nextId(),
      treeId: context.treeId,
      spouses: ([0, 1] as const).map((side) => ({
        personId: id(line.spouses[side]),
        rank: rankOf(line.spouses[side], line.ranks[side]),
      })),
      ...(line.start === undefined ? {} : { start: unionDate(line.start) }),
      ...(line.end === undefined ? {} : { end: unionDate(line.end) }),
      ...(line.endReason === undefined ? {} : { endReason: line.endReason }),
    }),
  );

  data.filiations = (section.filiations ?? []).flatMap((line) =>
    line.parents.map((parent) =>
      filiationSchema.parse({
        id: context.nextId(),
        treeId: context.treeId,
        parentId: id(parent),
        childId: id(line.enfant),
        type: scenarioFiliationTypes[line.type ?? 'naissance'],
        certainty: scenarioCertainties[line.certitude ?? 'certain'],
      }),
    ),
  );

  data.multipleBirths = (section.naissances_multiples ?? []).map((group) =>
    multipleBirthSchema.parse(multipleBirthInput(context, group, id)),
  );

  data.titleRoles = (section.titres ?? []).map((line) =>
    titleRoleSchema.parse({
      id: context.nextId(),
      treeId: context.treeId,
      personId: id(line.personne),
      label: line.libelle,
      authorAccountId: context.authorAccountId,
      ...(line.debut === undefined ? {} : { start: fuzzyDateFromText(line.debut) }),
      ...(line.fin === undefined ? {} : { end: fuzzyDateFromText(line.fin) }),
    }),
  );

  data.facts = (section.faits ?? []).map((line) => factFromScenario(context, line, id));

  // Réponses de simultanéité : chaque paire des unions citées, rangée (ADR 0012).
  const unionBetween = ([a, b]: readonly [string, string]): Id => {
    const ids = new Set([id(a), id(b)]);
    const matches = data.unions.filter((union) =>
      union.spouses.every((spouse) => ids.has(spouse.personId)),
    );
    const [only, ...others] = matches;
    if (only === undefined || others.length > 0) {
      throw new Error(`Expected exactly one union between ${a} and ${b}`);
    }
    return only.id;
  };
  data.simultaneityAnswers = (section.simultaneites ?? []).flatMap((line) => {
    const unionIds = line.unions.map(unionBetween);
    return unionIds.flatMap((first, index) =>
      unionIds.slice(index + 1).map((second) =>
        simultaneityAnswerSchema.parse({
          id: context.nextId(),
          treeId: context.treeId,
          unionIds: unionPair(first, second),
          simultaneity: scenarioSimultaneities[line.reponse],
        }),
      ),
    );
  });

  data.parentCandidates = (section.candidats ?? []).flatMap((line) =>
    line.candidates.map((candidate) =>
      parentCandidateSchema.parse({
        id: context.nextId(),
        treeId: context.treeId,
        childId: id(line.enfant),
        candidateId: id(candidate),
      }),
    ),
  );

  // Chaque personne et ses noms forment une fiche valide.
  for (const person of data.people) {
    personRecordSchema.parse({
      person,
      names: data.names.filter((name) => name.personId === person.id),
    });
  }

  const byId = new Map<Id, string>();
  return {
    data,
    id,
    has: (key) => declared.has(key),
    keyOf: (value) => {
      if (byId.size === 0) for (const key of declared) byId.set(id(key), key);
      return byId.get(value);
    },
    context,
  };
}

/** Nom de naissance tiré du nom court : « pierre » donne le prénom « Pierre ». */
export function defaultName(context: TestTree, key: string) {
  return nameSchema.parse(
    nameFromScenario(context, {
      personne: key,
      type: 'naissance',
      prenoms: key.charAt(0).toUpperCase() + key.slice(1),
    }),
  );
}

/** Entrée de `multipleBirthSchema` pour un groupe du scénario, sans la valider. */
export function multipleBirthInput(
  context: TestTree,
  group: ScenarioMultipleBirth,
  id: (key: string) => Id = context.personId,
) {
  return {
    id: context.nextId(),
    treeId: context.treeId,
    members: group.enfants.map((key, index) => {
      const birthOrder = group.ordre?.[index];
      return { personId: id(key), ...(birthOrder === undefined ? {} : { birthOrder }) };
    }),
  };
}

/**
 * Fait daté d'un scénario (naissance ou décès), validé par `factSchema` ; sa date passe
 * `fuzzyDateSchema`. Sert aussi aux tests qui rejouent un scénario avec d'autres dates.
 */
export function factFromScenario(
  context: TestTree,
  line: ScenarioFact,
  id: (key: string) => Id = context.personId,
): Fact {
  return factSchema.parse({
    id: context.nextId(),
    treeId: context.treeId,
    subject: { kind: 'person', personId: id(line.personne) },
    type: scenarioFactTypes[line.type],
    date: fuzzyDateSchema.parse(fuzzyDateInputFromScenario(line.date)),
    authorAccountId: context.authorAccountId,
  });
}
