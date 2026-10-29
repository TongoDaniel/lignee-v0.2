// Cas limites de la fiche d'une personne (T-024 du plan V1) : CL-FAM-11 (jumeaux), CL-FAM-15
// (personne trans), CL-FAM-17 (surnom), CL-FAM-19 (titre traditionnel), CL-DON-01 (ordre des
// noms). Chaque scénario est lu dans test/scenarios/<ID>.yaml ; `attendu.fiche` liste les fiches
// attendues, lecteur par lecteur, et `buildProfile` doit les produire. Les parties modèle des
// mêmes fichiers sont jouées par model-scenarios.test.ts.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { FuzzyDateDisplay } from '../fuzzy-date';
import { buildProfile, type MultipleBirthKind, type Profile } from '../profile';
import { loadScenario, requireScenarioParts, scenarioSchema } from '../test-support/scenario';
import { buildScenarioTree, scenarioTreeSchema } from '../test-support/scenario-tree';

const TODAY = { year: 2026, month: 10, day: 25 };

const MULTIPLE_BIRTH_KINDS: Record<string, MultipleBirthKind> = {
  jumeaux: 'twins',
  triples: 'triplets',
  quadruples: 'quadruplets',
  multiple: 'multiple',
};
const GENDERS = {
  femme: 'female',
  homme: 'male',
  autre: 'other',
  non_renseigne: 'unspecified',
} as const;

/** Une fiche attendue : seules les clés écrites sont comparées. */
const expectedProfileSchema = z.strictObject({
  personne: z.string(),
  /** `auteur` : le compte qui a saisi les noms ; `autre` : tout autre compte. */
  lecteur: z.enum(['auteur', 'autre']).default('auteur'),
  ordre_des_noms: z.enum(['nom_puis_prenoms', 'prenoms_puis_nom']).optional(),
  nom_affiche: z.string().optional(),
  autres_noms: z.array(z.string()).optional(),
  anciens_noms: z.array(z.string()).optional(),
  nom_de_naissance: z.enum(['absent', 'present']).optional(),
  genre: z.enum(['femme', 'homme', 'autre', 'non_renseigne']).optional(),
  titres: z
    .array(
      z.strictObject({
        libelle: z.string(),
        debut: z.string().optional(),
        fin: z.string().optional(),
      }),
    )
    .optional(),
  naissance_multiple: z
    .union([
      z.literal('absente'),
      z.strictObject({
        type: z.enum(['jumeaux', 'triples', 'quadruples', 'multiple']),
        avec: z.array(z.string()),
        ordre: z.int().min(1).optional(),
      }),
    ])
    .optional(),
  /** Textes qui ne figurent nulle part dans la fiche calculée, même en clair dans un champ caché. */
  texte_absent: z.array(z.string()).optional(),
});
type ExpectedProfile = z.infer<typeof expectedProfileSchema>;

const ficheAttendu = z.looseObject({ fiche: z.array(expectedProfileSchema).min(1) });

/** Texte d'une date de titre ou de nom : ces dates restent du texte d'origine (T-005). */
function plainText(display: FuzzyDateDisplay | undefined): string | undefined {
  if (display === undefined) return undefined;
  if (display.kind !== 'text') throw new Error('Expected a date kept as text');
  return display.text;
}

function play(id: string): void {
  const scenario = loadScenario(
    id,
    scenarioSchema(id, { arbre: scenarioTreeSchema, attendu: ficheAttendu }).superRefine(
      requireScenarioParts('fiche', ['saisie']),
    ),
  );
  const built = buildScenarioTree(scenario.arbre);
  const stranger = built.context.nextId();

  const profileFor = (expected: ExpectedProfile): Profile => {
    const order = expected.ordre_des_noms === 'nom_puis_prenoms' ? 'surname_first' : undefined;
    const profile = buildProfile(
      { ...built.data, tree: { ...built.data.tree, ...(order ? { nameOrder: order } : {}) } },
      built.id(expected.personne),
      {
        viewer: {
          accountId: expected.lecteur === 'auteur' ? built.context.authorAccountId : stranger,
        },
        today: TODAY,
      },
    );
    if (profile === undefined) throw new Error(`No profile for ${expected.personne}`);
    return profile;
  };

  for (const expected of scenario.attendu.fiche) {
    const profile = profileFor(expected);
    if (expected.nom_affiche !== undefined) expect(profile.name).toBe(expected.nom_affiche);
    if (expected.autres_noms !== undefined) {
      expect(profile.otherNames.map((name) => name.text)).toEqual(expected.autres_noms);
    }
    if (expected.anciens_noms !== undefined) {
      expect(profile.formerNames.map((name) => name.text)).toEqual(expected.anciens_noms);
    }
    if (expected.nom_de_naissance !== undefined) {
      expect(profile.birthNameMissing).toBe(expected.nom_de_naissance === 'absent');
    }
    if (expected.genre !== undefined) expect(profile.gender).toBe(GENDERS[expected.genre]);
    if (expected.titres !== undefined) {
      expect(
        profile.titles.map((title) => ({
          libelle: title.label,
          ...(title.start === undefined ? {} : { debut: plainText(title.start) }),
          ...(title.end === undefined ? {} : { fin: plainText(title.end) }),
        })),
      ).toEqual(expected.titres);
    }
    if (expected.naissance_multiple === 'absente') {
      expect(profile.multipleBirth).toBeUndefined();
    } else if (expected.naissance_multiple !== undefined) {
      const birth = profile.multipleBirth;
      expect(birth?.kind).toBe(MULTIPLE_BIRTH_KINDS[expected.naissance_multiple.type]);
      expect(birth?.count).toBe(expected.naissance_multiple.avec.length + 1);
      expect(birth?.others.map((other) => other.personId)).toEqual(
        expected.naissance_multiple.avec.map(built.id),
      );
      expect(birth?.order).toBe(expected.naissance_multiple.ordre);
    }
    const everything = JSON.stringify(profile);
    for (const text of expected.texte_absent ?? []) expect(everything).not.toContain(text);
  }
}

describe('fiche d’une personne : cas limites', () => {
  it('CL-FAM-11 — « Jumeaux » (ou triplés) sur chacune des fiches, avec l’ordre s’il est connu', () => {
    play('CL-FAM-11');
  });

  it('CL-FAM-15 — prénom et genre actuels ; l’ancien prénom reste à son auteur', () => {
    play('CL-FAM-15');
  });

  it('CL-FAM-17 — le surnom sert de nom, le nom de naissance reste à compléter', () => {
    play('CL-FAM-17');
  });

  it('CL-FAM-19 — le titre daté s’affiche sous le nom, dans l’ordre des dates', () => {
    play('CL-FAM-19');
  });

  it('CL-DON-01 — l’ordre d’affichage des noms suit le réglage de l’arbre', () => {
    play('CL-DON-01');
  });
});
