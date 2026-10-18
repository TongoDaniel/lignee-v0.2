// Section `arbre` d'un scénario et sa construction en objets du modèle (T-006). Chaque objet est
// validé par son schéma au moment où il est construit : un scénario dont l'arbre ne respecte pas
// le modèle fait échouer le test qui le lit.
import { z } from 'zod';

import { multipleBirthSchema, titleRoleSchema } from '../fact';
import { filiationSchema } from '../filiation';
import { fuzzyDateFromText } from '../fuzzy-date';
import type { Id } from '../ids';
import { nameSchema, personRecordSchema, personSchema } from '../person';
import { treeSchema } from '../tree';
import { unionSchema } from '../union';
import { nameFromScenario, testTree, type TestTree } from './fixtures';
import {
  scenarioCertainties,
  scenarioFiliationSchema,
  scenarioFiliationTypes,
  scenarioNameSchema,
  scenarioPersonSchema,
  scenarioUnionSchema,
} from './scenario';
import { emptyTreeData, type TreeData } from './tree-data';

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

/**
 * Section `arbre` complète. Une section absente vaut une liste vide ; une clé inconnue est
 * refusée ; chaque personne n'est déclarée qu'une fois. Une section nouvelle s'ajoute ici et dans
 * `buildScenarioTree`, pas dans un test.
 */
export const scenarioTreeSchema = z
  .strictObject({
    personnes: z.array(scenarioPersonSchema).min(1),
    noms: z.array(scenarioNameSchema).optional(),
    unions: z.array(scenarioUnionSchema).optional(),
    filiations: z.array(scenarioFiliationSchema).optional(),
    naissances_multiples: z.array(scenarioMultipleBirthSchema).optional(),
    titres: z.array(scenarioTitleSchema).optional(),
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
 * Construit l'arbre de départ : personnes connues, noms, unions (rang absent : rang suivant du
 * conjoint, dans l'ordre des lignes, comme l'app, UNI-07 ; un rang déjà pris par la même personne
 * est refusé), filiations (de naissance et certaines
 * sauf mention), naissances multiples, titres. Chaque objet passe son schéma, et chaque personne
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

  data.people = section.personnes.map(({ key, gender }) =>
    personSchema.parse({ id: id(key), treeId: context.treeId, nature: 'known', gender }),
  );
  data.names = (section.noms ?? []).map((line) => {
    id(line.personne);
    return nameSchema.parse(nameFromScenario(context, line));
  });
  // Une personne sans ligne dans `noms` porte son nom court comme prénom (« pierre » : Pierre) :
  // le format du TRD ne nomme les personnes que par ce nom court, et une fiche connue a un nom.
  const named = new Set(data.names.map((name) => name.personId));
  for (const { key } of section.personnes) {
    if (!named.has(id(key))) data.names.push(defaultName(context, key));
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
      spouses: [
        { personId: id(line.spouses[0]), rank: rankOf(line.spouses[0], line.ranks[0]) },
        { personId: id(line.spouses[1]), rank: rankOf(line.spouses[1], line.ranks[1]) },
      ],
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
