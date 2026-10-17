// Scénarios de disposition (T-008) : l'action et l'attendu propres à packages/layout, lus en
// schéma strict (test/scenarios/README.md, « Disposition »). L'arbre (dates, fin et
// simultanéité des unions, candidats compris) est celui du format commun. Réservé aux tests.
import { filiationSchema, unionSchema, type Id, type Person, type Union } from '@lignee/domain';
import {
  buildScenarioTree,
  scenarioSchema,
  scenarioTreeSchema,
  type ScenarioTree,
  type TreeData,
} from '@lignee/domain/test-support';
import { expect } from 'vitest';
import { z } from 'zod';

import type { FamilyUnitKind, MissingParent, TreeStructure } from '../types';

const pairSchema = z.tuple([z.string(), z.string()]);

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

/** Construit l'arbre de départ d'un scénario de disposition. */
export function buildLayoutScenarioTree(scenario: LayoutScenario): ScenarioTree {
  return buildScenarioTree(scenario.arbre);
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
