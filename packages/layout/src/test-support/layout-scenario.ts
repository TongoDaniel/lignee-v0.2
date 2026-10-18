// Scénarios de disposition (T-008) : l'action et l'attendu propres à packages/layout, lus en
// schéma strict (test/scenarios/README.md, « Disposition »). L'arbre (dates, fin et
// simultanéité des unions, candidats compris) est celui du format commun. Réservé aux tests.
import {
  filiationSchema,
  projectMultipleBirth,
  unionSchema,
  type Id,
  type Person,
  type Union,
} from '@lignee/domain';
import {
  buildScenarioTree,
  scenarioSchema,
  scenarioTreeSchema,
  type ScenarioTree,
  type TreeData,
} from '@lignee/domain/test-support';
import { expect } from 'vitest';
import { z } from 'zod';

import type { LinkDrawing, LinkNature } from '../layout-types';
import type { FamilyUnitKind, MissingParent, TreeStructure } from '../types';

const pairSchema = z.tuple([z.string(), z.string()]);
/** Une famille : un foyer, par ses deux parents, ou la colonne « non précisé » d'un parent. */
const familySchema = z.union([pairSchema, z.tuple([z.string()])]);
export type ScenarioFamily = z.infer<typeof familySchema>;

/** Modification faite après le premier calcul, avant un second. */
export const layoutStepSchema = z.union([
  /** Rang d'une union pour l'un de ses conjoints, changé à la main (UNI-07). */
  z.strictObject({
    rang: z.strictObject({ conjoints: pairSchema, de: z.string(), rang: z.int().min(1) }),
  }),
  /** Parent précisé : filiation de naissance ajoutée, candidats retirés (ARB-05, UNI-11). */
  z.strictObject({ preciser_parent: z.strictObject({ enfant: z.string(), parent: z.string() }) }),
]);
export type LayoutStep = z.infer<typeof layoutStepSchema>;

export const layoutActionSchema = z.strictObject({
  /** Personne centrale de la disposition. */
  centre: z.string(),
  /** Autres personnes centrales, pour `vers_centre_depuis`. */
  autres_centres: z.array(z.string()).min(1).optional(),
  puis: z.array(layoutStepSchema).min(1).optional(),
  /**
   * Personnes masquées pour le lecteur : retirées du graphe reçu, avec tout ce qui les cite,
   * comme le fait le filtrage de packages/domain (T-052).
   */
  masques: z.array(z.string()).min(1).optional(),
  /** Familles que le lecteur déplie, pour `attendu.apres_deplier` (T-012). */
  deplier: z.array(familySchema).min(1).optional(),
  /** Ancêtre dont on calcule aussi la vue « descendance », pour `attendu.descendance` (T-019). */
  descendance_de: z.string().optional(),
});
export type LayoutAction = z.infer<typeof layoutActionSchema>;

const unitKinds = {
  seul: 'single',
  couple: 'couple',
  successives: 'successive',
  simultanees: 'simultaneous',
} as const satisfies Record<string, FamilyUnitKind>;
const missingParents = {
  mere: 'mother',
  pere: 'father',
  parent: 'parent',
} as const satisfies Record<string, MissingParent>;

const foyerExpectationSchema = z.strictObject({
  conjoint: z.string(),
  /** Enfants du foyer, sans ordre (l'ordre des frères et sœurs est T-012). */
  enfants: z.array(z.string()),
  en_cours: z.boolean().optional(),
  vers_centre: z.boolean().optional(),
});

const unitExpectationSchema = z.strictObject({
  forme: z.enum(Object.keys(unitKinds) as [keyof typeof unitKinds]),
  /** Foyers dans l'ordre attendu. */
  foyers: z.array(foyerExpectationSchema),
  non_precise: z
    .strictObject({
      manque: z.enum(Object.keys(missingParents) as [keyof typeof missingParents]),
      enfants: z.array(z.string()).min(1),
      candidates: z.array(z.string()),
    })
    .optional(),
});

/** Toutes les unités attendues, par personne au centre de l'unité : la liste est complète. */
export const unitsExpectationSchema = z.record(z.string(), unitExpectationSchema);
export type UnitsExpectation = z.infer<typeof unitsExpectationSchema>;

export const linkNatures = {
  ailleurs: 'elsewhere',
  long: 'long',
  couple: 'couple',
  secondaire: 'secondary',
} as const satisfies Record<string, LinkNature>;
export const linkDrawings = {
  trait: 'line',
  renvoi: 'seeAlso',
} as const satisfies Record<string, LinkDrawing>;

/**
 * Un lien hors des foyers (étape 6, T-019) : `de` est la famille (`ailleurs`, `long`), le
 * conjoint au centre (`couple`) ou le parent (`secondaire`) ; `vers` l'enfant ou l'autre conjoint.
 */
const linkExpectationSchema = z.strictObject({
  nature: z.enum(Object.keys(linkNatures) as [keyof typeof linkNatures]),
  de: familySchema,
  vers: z.string(),
  trace: z.enum(Object.keys(linkDrawings) as [keyof typeof linkDrawings]),
});
export type LinkExpectation = z.infer<typeof linkExpectationSchema>;

/** Ordre, placement et repli attendus (T-012), liens hors des foyers (T-019). */
export const dispositionExpectedSchema = z.strictObject({
  /**
   * Personnes dessinées de gauche à droite, par hauteur (`"-1"`, `"-0.5"` pour la demi-rangée) ;
   * seules les hauteurs citées sont vérifiées, chacune en entier.
   */
  lignes: z.record(z.string().regex(/^-?\d+(\.5)?$/), z.array(z.string())).optional(),
  /** Liste complète des personnes dessinées, sans ordre. */
  visibles: z.array(z.string()).optional(),
  /** Liste complète des familles touchées : repliée ou non, et nombre d'enfants du compteur. */
  replis: z
    .array(z.strictObject({ famille: familySchema, replie: z.boolean(), enfants: z.int().min(0) }))
    .optional(),
  /** Largeur du dessin, en fiches, au plus. */
  largeur_max: z.int().min(1).optional(),
  /** Liste complète des liens hors des foyers, sans ordre (T-019). */
  liens_hors_foyers: z.array(linkExpectationSchema).optional(),
});
export type DispositionExpected = z.infer<typeof dispositionExpectedSchema>;

export const layoutExpectedSchema = z.strictObject({
  /** Rangée de chaque personne nommée (0 pour la personne centrale). */
  generations: z.record(z.string(), z.int()).optional(),
  /** Les contrôles de cohérence de packages/domain ne signalent rien (CL-POL-14). */
  sans_avertissement: z.literal(true).optional(),
  /** La même famille, genres inversés, donne la même disposition. */
  sans_regle_de_genre: z.literal(true).optional(),
  unites: unitsExpectationSchema,
  /** Unités après les modifications de `action.puis`. */
  apres: z.strictObject({ unites: unitsExpectationSchema }).optional(),
  /** Pour chaque autre personne centrale, les foyers (centre, conjoint) qui mènent à elle. */
  vers_centre_depuis: z.record(z.string(), z.array(pairSchema)).optional(),
  /** Ordre, placement et repli par défaut (T-012). */
  disposition: dispositionExpectedSchema.optional(),
  /** Après avoir déplié les familles de `action.deplier`. */
  apres_deplier: dispositionExpectedSchema.optional(),
  /** Vue « descendance » de `action.descendance_de`, tout déplié par défaut (ARB-14, T-019). */
  descendance: dispositionExpectedSchema.optional(),
});
export type LayoutExpected = z.infer<typeof layoutExpectedSchema>;

/** Schéma strict d'un scénario de disposition. */
export function layoutScenarioSchema(id: string) {
  return scenarioSchema(id, {
    arbre: scenarioTreeSchema,
    action: layoutActionSchema,
    attendu: layoutExpectedSchema,
  });
}
export type LayoutScenario = z.infer<ReturnType<typeof layoutScenarioSchema>>;

function findUnion(tree: ScenarioTree, [a, b]: readonly [string, string]): number {
  const ids = new Set([tree.id(a), tree.id(b)]);
  const matches = tree.data.unions
    .map((union, index) => ({ union, index }))
    .filter(({ union }) => union.spouses.every((spouse) => ids.has(spouse.personId)));
  const [match, ...others] = matches;
  if (match === undefined || others.length > 0) {
    throw new Error(`Expected exactly one union between ${a} and ${b}`);
  }
  return match.index;
}

function replaceUnion(tree: ScenarioTree, index: number, union: Record<string, unknown>) {
  tree.data.unions[index] = unionSchema.parse(union);
}

/**
 * Construit l'arbre de départ d'un scénario de disposition, tel que le lecteur le reçoit : les
 * personnes de `action.masques` en sont retirées avec tout ce qui les cite.
 */
export function buildLayoutScenarioTree(scenario: LayoutScenario): ScenarioTree {
  const tree = buildScenarioTree(scenario.arbre);
  const masked = new Set((scenario.action.masques ?? []).map((key) => tree.id(key)));
  if (masked.size > 0) tree.data = withoutPeople(tree.data, masked);
  return tree;
}

/**
 * Le graphe vu par un lecteur pour qui `masked` est masqué : comme le filtrage de packages/domain
 * (T-052), sans ces personnes ni rien qui les cite. Réservé aux tests.
 */
export function withoutPeople(data: TreeData, masked: ReadonlySet<Id>): TreeData {
  const keep = (id: Id) => !masked.has(id);
  const result: TreeData = {
    ...data,
    people: data.people.filter((person) => keep(person.id)),
    names: data.names.filter((name) => keep(name.personId)),
    unions: data.unions.filter((union) => union.spouses.every((spouse) => keep(spouse.personId))),
    filiations: data.filiations.filter(
      (filiation) => keep(filiation.parentId) && keep(filiation.childId),
    ),
    parentCandidates: data.parentCandidates.filter(
      (candidate) => keep(candidate.childId) && keep(candidate.candidateId),
    ),
    facts: data.facts.filter(
      (fact) => fact.subject.kind !== 'person' || keep(fact.subject.personId),
    ),
    // Comme le fera T-052 : la naissance multiple est projetée (enfants masqués retirés, rangs
    // renumérotés), pas supprimée, pour que des jumeaux visibles parmi des triplés soient testés.
    multipleBirths: data.multipleBirths.flatMap((birth) => {
      const projected = projectMultipleBirth(birth, keep);
      return projected === undefined ? [] : [projected];
    }),
    titleRoles: data.titleRoles.filter((title) => keep(title.personId)),
  };
  const unions = new Set(result.unions.map((union) => union.id));
  return {
    ...result,
    simultaneityAnswers: result.simultaneityAnswers.filter((answer) =>
      answer.unionIds.every((id) => unions.has(id)),
    ),
  };
}

/** Applique les modifications de `action.puis` à l'arbre, en objets valides du modèle. */
export function applyLayoutSteps(tree: ScenarioTree, steps: readonly LayoutStep[]): void {
  for (const step of steps) {
    if ('rang' in step) {
      const index = findUnion(tree, step.rang.conjoints);
      const union = tree.data.unions[index] as Union;
      const who = tree.id(step.rang.de);
      if (!union.spouses.some((spouse) => spouse.personId === who)) {
        throw new Error(`${step.rang.de} is not a spouse of this union`);
      }
      replaceUnion(tree, index, {
        ...union,
        spouses: union.spouses.map((spouse) =>
          spouse.personId === who ? { ...spouse, rank: step.rang.rang } : spouse,
        ),
      });
    } else {
      const childId = tree.id(step.preciser_parent.enfant);
      tree.data.filiations.push(
        filiationSchema.parse({
          id: tree.context.nextId(),
          treeId: tree.context.treeId,
          parentId: tree.id(step.preciser_parent.parent),
          childId,
          type: 'birth',
          certainty: 'certain',
        }),
      );
      // Les candidats sont supprimés quand le parent est précisé (TRD, `candidats_parent`).
      tree.data.parentCandidates = tree.data.parentCandidates.filter(
        (candidate) => candidate.childId !== childId,
      );
    }
  }
}

/** Le même arbre, femmes et hommes inversés (les autres genres inchangés). */
export function swapGenders(data: TreeData): TreeData {
  const swapped: Record<Person['gender'], Person['gender']> = {
    female: 'male',
    male: 'female',
    other: 'other',
    unspecified: 'unspecified',
  };
  return {
    ...data,
    people: data.people.map((person) => ({ ...person, gender: swapped[person.gender] })),
  };
}

/** Vérifie les unités d'une structure contre l'attendu, liste complète des unités comprise. */
export function expectUnits(
  structure: TreeStructure,
  tree: ScenarioTree,
  expected: UnitsExpectation,
): void {
  const key = (id: Id) => tree.keyOf(id) ?? id;
  const sorted = (values: readonly string[]) => [...values].sort();
  expect(sorted(structure.units.map((unit) => key(unit.hubId)))).toEqual(
    sorted(Object.keys(expected)),
  );
  for (const [hub, unitExpected] of Object.entries(expected)) {
    const unit = structure.unitOf.get(tree.id(hub));
    if (unit === undefined) throw new Error(`No unit for ${hub}`);
    expect(unit.kind, `forme de ${hub}`).toBe(unitKinds[unitExpected.forme]);
    expect(
      unit.foyers.map((foyer) => key(foyer.partnerId)),
      `ordre des foyers de ${hub}`,
    ).toEqual(unitExpected.foyers.map((foyer) => foyer.conjoint));
    unitExpected.foyers.forEach((foyerExpected, index) => {
      const foyer = unit.foyers[index];
      if (foyer === undefined) throw new Error(`Missing foyer ${String(index)} of ${hub}`);
      const label = `foyer ${hub} et ${foyerExpected.conjoint}`;
      expect(sorted(foyer.children.map(key)), `enfants du ${label}`).toEqual(
        sorted(foyerExpected.enfants),
      );
      if (foyerExpected.en_cours !== undefined) {
        expect(foyer.status === 'ongoing', `${label} en cours`).toBe(foyerExpected.en_cours);
      }
      if (foyerExpected.vers_centre !== undefined) {
        expect(foyer.leadsToCenter, `${label} vers le centre`).toBe(foyerExpected.vers_centre);
      }
    });
    const column = unitExpected.non_precise;
    if (column === undefined) {
      expect(unit.unspecified, `colonne non précisée de ${hub}`).toBeUndefined();
    } else {
      expect(unit.unspecified?.missing).toBe(missingParents[column.manque]);
      expect(sorted(unit.unspecified?.children.map((child) => key(child.childId)) ?? [])).toEqual(
        sorted(column.enfants),
      );
      expect(unit.unspecified?.candidateIds.map(key)).toEqual(column.candidates);
    }
  }
}

/**
 * Forme comparable d'une structure : rangées, unités et foyers, liens. Le parent manquant d'une
 * colonne est omis : « mère » ou « père » se lit dans le genre des candidats (ADR 0013).
 */
export function comparableStructure(structure: TreeStructure) {
  return {
    rows: [...structure.rowOf].sort(([a], [b]) => (a < b ? -1 : 1)),
    units: structure.units.map((unit) => ({
      hubId: unit.hubId,
      row: unit.row,
      kind: unit.kind,
      simultaneityPending: unit.simultaneityPending,
      foyers: unit.foyers,
      foyersElsewhere: unit.foyersElsewhere,
      unspecified:
        unit.unspecified === undefined
          ? undefined
          : {
              parentId: unit.unspecified.parentId,
              children: unit.unspecified.children.map((child) => ({
                childId: child.childId,
                candidateIds: child.candidateIds,
              })),
              candidateIds: unit.unspecified.candidateIds,
              leadsToCenter: unit.unspecified.leadsToCenter,
            },
    })),
    crossLinks: structure.crossLinks,
    unreachable: structure.unreachable,
  };
}

/** Objets masqués seuls (sans masquer de personne) : unions, filiations, faits. */
export interface MaskedObjects {
  readonly unions: ReadonlySet<Id>;
  readonly filiations: ReadonlySet<Id>;
  readonly facts: ReadonlySet<Id>;
}

/**
 * Le graphe d'un lecteur pour qui ces objets sont masqués, retirés par un filtre qui laisse les
 * références restantes (réponses de simultanéité, union d'origine d'une filiation) pointer vers
 * eux : le pire cas à attendre d'un filtrage. Réservé aux tests.
 */
export function withoutObjects(data: TreeData, masked: MaskedObjects): TreeData {
  return {
    ...data,
    unions: data.unions.filter((union) => !masked.unions.has(union.id)),
    filiations: data.filiations.filter((filiation) => !masked.filiations.has(filiation.id)),
    facts: data.facts.filter((fact) => !masked.facts.has(fact.id)),
  };
}

/**
 * Le même arbre si ces objets n'avaient jamais été saisis : sans eux, et sans aucune référence
 * vers eux. Réservé aux tests.
 */
export function neverEntered(data: TreeData, masked: MaskedObjects): TreeData {
  const removed = withoutObjects(data, masked);
  return {
    ...removed,
    filiations: removed.filiations.map((filiation) => {
      if (filiation.originUnionId === undefined || !masked.unions.has(filiation.originUnionId)) {
        return filiation;
      }
      const rest = { ...filiation };
      delete rest.originUnionId;
      return rest;
    }),
    simultaneityAnswers: removed.simultaneityAnswers.filter((answer) =>
      answer.unionIds.every((id) => !masked.unions.has(id)),
    ),
  };
}
