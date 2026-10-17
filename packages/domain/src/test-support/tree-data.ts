// Un arbre complet en objets du modèle, tel que le produisent le générateur et la construction
// d'un scénario. Réservé aux tests : les moteurs (kinship, layout, voice) le reçoivent comme le
// téléphone recevrait la base locale.
import { z } from 'zod';

import {
  factSchema,
  multipleBirthSchema,
  titleRoleSchema,
  type Fact,
  type MultipleBirth,
  type TitleRole,
} from '../fact';
import {
  filiationSchema,
  parentCandidateSchema,
  type Filiation,
  type ParentCandidate,
} from '../filiation';
import type { Id } from '../ids';
import { nameSchema, personRecordSchema, personSchema, type Name, type Person } from '../person';
import { placeSchema, toPlaceSchema, type Place, type ToPlace } from '../place';
import { treeSchema, type Tree } from '../tree';
import {
  simultaneityAnswerSchema,
  unionSchema,
  type SimultaneityAnswer,
  type Union,
} from '../union';
import { visibilityRuleSetSchema, type VisibilityRule } from '../visibility';

export interface TreeData {
  tree: Tree;
  people: Person[];
  names: Name[];
  unions: Union[];
  /** Réponses « simultanées ou successives », par paire d'unions (UNI-08, ADR 0012). */
  simultaneityAnswers: SimultaneityAnswer[];
  filiations: Filiation[];
  parentCandidates: ParentCandidate[];
  facts: Fact[];
  titleRoles: TitleRole[];
  multipleBirths: MultipleBirth[];
  places: Place[];
  toPlace: ToPlace[];
  visibilityRules: VisibilityRule[];
}

/** Un arbre vide, prêt à remplir. */
export function emptyTreeData(tree: Tree): TreeData {
  return {
    tree,
    people: [],
    names: [],
    unions: [],
    simultaneityAnswers: [],
    filiations: [],
    parentCandidates: [],
    facts: [],
    titleRoles: [],
    multipleBirths: [],
    places: [],
    toPlace: [],
    visibilityRules: [],
  };
}

/** Problème trouvé par `treeDataIssues` : où, et pourquoi. */
export interface TreeDataIssue {
  path: string;
  message: string;
}

function zodIssues(path: string, result: z.ZodSafeParseResult<unknown>): TreeDataIssue[] {
  return result.success ? [] : [{ path, message: z.prettifyError(result.error) }];
}

/**
 * Tous les problèmes d'un arbre : chaque objet passe son schéma Zod (et chaque personne, avec ses
 * noms, `personRecordSchema`) ; chaque identifiant référencé existe dans l'arbre ; tous les
 * objets portent l'identifiant de l'arbre ; aucun identifiant n'est pris deux fois. Ne vérifie
 * pas les règles portant sur tout l'arbre (au plus deux parents de naissance, aucun cycle) :
 * elles sont des propriétés testées à part, et le contrôle de cohérence est T-007.
 */
export function treeDataIssues(data: TreeData): TreeDataIssue[] {
  const issues: TreeDataIssue[] = [];
  issues.push(...zodIssues('tree', treeSchema.safeParse(data.tree)));
  const treeId = data.tree.id;

  const seen = new Set<string>([treeId]);
  const people = new Set(data.people.map((person) => person.id));
  const unions = new Set(data.unions.map((union) => union.id));
  const filiations = new Set(data.filiations.map((filiation) => filiation.id));
  const facts = new Set(data.facts.map((fact) => fact.id));
  const names = new Set(data.names.map((name) => name.id));
  const places = new Set(data.places.map((place) => place.id));

  const check = <T extends { id: Id; treeId: Id }>(
    kind: string,
    items: readonly T[],
    schema: z.ZodType,
    references: (item: T) => [string, Id | undefined, ReadonlySet<Id>][],
  ) => {
    items.forEach((item, index) => {
      const path = `${kind}[${String(index)}]`;
      issues.push(...zodIssues(path, schema.safeParse(item)));
      if (seen.has(item.id)) issues.push({ path, message: `Duplicate id ${item.id}` });
      seen.add(item.id);
      if (item.treeId !== treeId) issues.push({ path, message: 'Belongs to another tree' });
      for (const [field, id, pool] of references(item)) {
        if (id !== undefined && !pool.has(id)) {
          issues.push({ path, message: `${field} refers to a missing object ${id}` });
        }
      }
    });
  };

  check('people', data.people, personSchema, () => []);
  check('names', data.names, nameSchema, (name) => [['personId', name.personId, people]]);
  check('unions', data.unions, unionSchema, (union) => [
    ['spouses[0]', union.spouses[0].personId, people],
    ['spouses[1]', union.spouses[1].personId, people],
    ['placeId', union.placeId, places],
  ]);
  check('simultaneityAnswers', data.simultaneityAnswers, simultaneityAnswerSchema, (answer) => [
    ['unionIds[0]', answer.unionIds[0], unions],
    ['unionIds[1]', answer.unionIds[1], unions],
  ]);
  // Une réponse par paire, pour deux unions qui ont un conjoint en commun.
  const spousesOf = new Map(
    data.unions.map((union) => [union.id, union.spouses.map((spouse) => spouse.personId)]),
  );
  const pairs = new Set<string>();
  data.simultaneityAnswers.forEach((answer, index) => {
    const path = `simultaneityAnswers[${String(index)}]`;
    const key = answer.unionIds.join('|');
    if (pairs.has(key)) issues.push({ path, message: 'Two answers for the same pair' });
    pairs.add(key);
    const [first, second] = answer.unionIds.map((id) => spousesOf.get(id) ?? []);
    if (!first?.some((person) => second?.includes(person))) {
      issues.push({ path, message: 'The two unions share no spouse' });
    }
  });
  check('filiations', data.filiations, filiationSchema, (filiation) => [
    ['parentId', filiation.parentId, people],
    ['childId', filiation.childId, people],
    ['originUnionId', filiation.originUnionId, unions],
  ]);
  check('parentCandidates', data.parentCandidates, parentCandidateSchema, (candidate) => [
    ['childId', candidate.childId, people],
    ['candidateId', candidate.candidateId, people],
  ]);
  check('facts', data.facts, factSchema, (fact) => [
    [
      'subject',
      fact.subject.kind === 'person' ? fact.subject.personId : fact.subject.unionId,
      fact.subject.kind === 'person' ? people : unions,
    ],
    ['placeId', fact.placeId, places],
    ['filiationId', fact.filiationId, filiations],
  ]);
  check('titleRoles', data.titleRoles, titleRoleSchema, (title) => [
    ['personId', title.personId, people],
    ['placeId', title.placeId, places],
  ]);
  check('multipleBirths', data.multipleBirths, multipleBirthSchema, (birth) =>
    birth.members.map((member, index): [string, Id, ReadonlySet<Id>] => [
      `members[${String(index)}]`,
      member.personId,
      people,
    ]),
  );
  check('places', data.places, placeSchema, () => []);
  check('toPlace', data.toPlace, toPlaceSchema, (entry) => [
    ['personId', entry.personId, people],
    ['referencePersonId', entry.referencePersonId, people],
  ]);

  // Une personne et ses noms : une personne connue a un nom à afficher (UNI-01, UNI-22).
  const namesByPerson = new Map<Id, Name[]>();
  for (const name of data.names) {
    namesByPerson.set(name.personId, [...(namesByPerson.get(name.personId) ?? []), name]);
  }
  data.people.forEach((person, index) => {
    issues.push(
      ...zodIssues(
        `people[${String(index)}] (record)`,
        personRecordSchema.safeParse({ person, names: namesByPerson.get(person.id) ?? [] }),
      ),
    );
  });

  // Règles de visibilité : une par objet, sur un objet qui existe.
  issues.push(
    ...zodIssues('visibilityRules', visibilityRuleSetSchema.safeParse(data.visibilityRules)),
  );
  const targets: Record<VisibilityRule['target']['type'], ReadonlySet<Id>> = {
    person: people,
    union: unions,
    filiation: filiations,
    fact: facts,
    name: names,
  };
  data.visibilityRules.forEach((rule, index) => {
    const path = `visibilityRules[${String(index)}]`;
    if (rule.treeId !== treeId) issues.push({ path, message: 'Belongs to another tree' });
    if (!targets[rule.target.type].has(rule.target.id)) {
      issues.push({ path, message: `Target ${rule.target.type} ${rule.target.id} is missing` });
    }
    if (rule.level === 'branch' && !people.has(rule.branchRootPersonId)) {
      issues.push({ path, message: 'Branch root is missing' });
    }
  });

  return issues;
}
