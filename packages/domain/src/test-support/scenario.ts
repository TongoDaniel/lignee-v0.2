// Lecture d'un scénario de cas limite (test/scenarios/<ID>.yaml), réservée aux tests : fichier,
// trace du scénario joué, formats des lignes. Le format complet (arbre, action, attendu) et la
// construction de l'arbre sont dans scenario-format.ts et scenario-tree.ts (T-006).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { z } from 'zod';

export const SCENARIOS_DIR = fileURLToPath(new URL('../../../../test/scenarios/', import.meta.url));

/**
 * Dossier où chaque scénario chargé laisse une trace (job `cas-limites` de la CI). Sans cette
 * variable, rien n'est écrit.
 */
const PLAYED_DIR_VARIABLE = 'LIGNEE_SCENARIOS_PLAYED_DIR';

/**
 * Couverture partielle (test/scenarios/README.md) : parties testées, tickets qui complètent.
 * `lecture` : le scénario est lu et son arbre de départ construit en objets valides du modèle,
 * sans que son attendu soit encore vérifié. `disposition` : générations et foyers calculés par
 * packages/layout et comparés à l'attendu (T-008). `lien` : le lien attendu (`attendu.lien`) est
 * vérifié sur la structure calculée par packages/kinship (fratrie, T-020) ; les mots restent à
 * T-026 et T-027.
 */
export const coverageSchema = z.strictObject({
  teste: z.array(z.enum(['lecture', 'modele', 'disposition', 'lien', 'base_locale'])).min(1),
  reste: z.array(z.string().regex(/^T-\d{3}$/)),
});

/**
 * Schéma strict d'un scénario : en-tête commun, puis les sections lues par le test. Une clé que
 * le test ne lit pas fait échouer la lecture.
 */
export function scenarioSchema<Shape extends z.ZodRawShape>(id: string, sections: Shape) {
  return z.strictObject({
    id: z.literal(id),
    titre: z.string().min(1),
    couverture: coverageSchema.optional(),
    ...sections,
  });
}

/**
 * Lit `test/scenarios/<id>.yaml` et le valide avec `schema`. À appeler dans le corps d'un test
 * (`it`), pas au chargement du fichier : un test ignoré ne compte pas comme joué.
 */
export function loadScenario<T extends z.ZodType>(id: string, schema: T): z.infer<T> {
  const scenario = schema.parse(readScenarioYaml(id));
  const playedDir = process.env[PLAYED_DIR_VARIABLE];
  if (playedDir !== undefined && playedDir !== '') {
    mkdirSync(playedDir, { recursive: true });
    writeFileSync(join(playedDir, id), '');
  }
  return scenario;
}

/** Contenu brut de `test/scenarios/<id>.yaml`, sans validation ni trace. */
export function readScenarioYaml(id: string): unknown {
  return parse(readFileSync(`${SCENARIOS_DIR}${id}.yaml`, 'utf8'));
}

/** « pierre/M » → nom court et genre. */
export const scenarioPersonSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\/[MFAN]$/)
  .transform((value) => {
    const [key = '', code = ''] = value.split('/');
    const gender = ({ M: 'male', F: 'female', A: 'other', N: 'unspecified' } as const)[
      code as 'M' | 'F' | 'A' | 'N'
    ];
    return { key, gender };
  });

/** Types de nom, dans les mots du cahier. */
export const scenarioNameTypes = {
  naissance: 'birth',
  usage: 'usage',
  surnom: 'nickname',
  titre: 'title',
  variante: 'variant',
  ancien: 'former',
} as const;

export const scenarioNameSchema = z.strictObject({
  personne: z.string(),
  type: z.enum(Object.keys(scenarioNameTypes) as [keyof typeof scenarioNameTypes]),
  prenoms: z.string().optional(),
  nom: z.string().optional(),
  forme: z.string().optional(),
  debut: z.string().optional(),
  fin: z.string().optional(),
});
export type ScenarioName = z.infer<typeof scenarioNameSchema>;

/** Motifs de fin d'union, dans les mots du cahier (UNI-05). */
export const scenarioEndReasons = {
  deces: 'death',
  divorce: 'divorce',
  separation: 'separation',
  non_renseigne: 'unspecified',
} as const;

/** Réponse de simultanéité (UNI-08, ADR 0012), dans les mots de CL-POL-05. */
export const scenarioSimultaneities = {
  simultanees: 'simultaneous',
  successives: 'successive',
} as const;

/**
 * Réponse gardée pour des unions désignées par leurs conjoints (`[[a, b], [a, c]]`, comme dans
 * CL-POL-05) : chaque paire de ces unions reçoit la même valeur (ADR 0012).
 */
export const scenarioSimultaneityAnswerSchema = z.strictObject({
  unions: z.array(z.tuple([z.string(), z.string()])).min(2),
  reponse: z.enum(Object.keys(scenarioSimultaneities) as [keyof typeof scenarioSimultaneities]),
});

/**
 * Union au format de CL-POL-03 : `{ conjoints: [a, b], rang_a: 1 }`. Le rang de chaque conjoint
 * est facultatif (le TRD n'écrit que `rang_pierre`) : absent, la construction de l'arbre donne
 * le rang suivant de ce conjoint, comme l'app (UNI-07). Facultatifs aussi : `debut` et `fin`
 * (dates floues au format `scenarioFuzzyDateSchema`) et `motif` de fin. Aucune autre clé. La
 * simultanéité se dit par paire d'unions, dans la section `simultaneites` de l'arbre.
 */
export const scenarioUnionSchema = z
  .looseObject({ conjoints: z.tuple([z.string(), z.string()]) })
  .transform((line, context) => {
    const [a, b] = line.conjoints;
    const allowed = new Set(['conjoints', `rang_${a}`, `rang_${b}`, 'debut', 'fin', 'motif']);
    const extra = Object.keys(line).filter((key) => !allowed.has(key));
    const optional = <T extends z.ZodType>(schema: T, key: string) =>
      line[key] === undefined
        ? { success: true as const, data: undefined }
        : schema.safeParse(line[key]);
    const rankA = optional(z.int().min(1), `rang_${a}`);
    const rankB = optional(z.int().min(1), `rang_${b}`);
    const start = optional(scenarioFuzzyDateSchema, 'debut');
    const end = optional(scenarioFuzzyDateSchema, 'fin');
    const reason = optional(
      z.enum(Object.keys(scenarioEndReasons) as [keyof typeof scenarioEndReasons]),
      'motif',
    );
    const parsed = [rankA, rankB, start, end, reason];
    if (extra.length > 0 || parsed.some((result) => !result.success)) {
      context.addIssue({
        code: 'custom',
        message:
          `Expected conjoints and optional rang_${a}, rang_${b} (positive integers), debut, ` +
          'fin, motif',
      });
      return z.NEVER;
    }
    return {
      spouses: [a, b] as const,
      ranks: [rankA.data, rankB.data] as const,
      start: start.data,
      end: end.data,
      endReason: reason.data === undefined ? undefined : scenarioEndReasons[reason.data],
    };
  });

/** Parents candidats d'un enfant (UNI-11) : « mère parmi ses épouses ». */
export const scenarioCandidatesSchema = z.strictObject({
  enfant: z.string(),
  candidates: z.array(z.string()).min(1),
});

/** Types de filiation, dans les mots du cahier (UNI-09). Sans type : de naissance. */
export const scenarioFiliationTypes = {
  naissance: 'birth',
  adoptive: 'adoptive',
  a_eleve: 'raised',
  confie: 'fostered',
  tuteur: 'guardian',
  donneur: 'donor',
  gpa: 'surrogacy',
} as const;

/** Certitude, dans les mots du cahier (UNI-10). Sans certitude : certain. */
export const scenarioCertainties = {
  certain: 'certain',
  probable: 'probable',
  hypothetique: 'hypothetical',
} as const;

export const scenarioFiliationSchema = z.strictObject({
  parents: z.array(z.string()).min(1).max(2),
  enfant: z.string(),
  type: z
    .enum(Object.keys(scenarioFiliationTypes) as [keyof typeof scenarioFiliationTypes])
    .optional(),
  certitude: z
    .enum(Object.keys(scenarioCertainties) as [keyof typeof scenarioCertainties])
    .optional(),
});

/** Qualificatifs de date, dans les mots du cahier. */
export const scenarioQualifiers = {
  exacte: 'exact',
  vers: 'about',
  avant: 'before',
  apres: 'after',
  entre: 'between',
  calculee: 'calculated',
  texte: 'text',
} as const;

/** Précisions de date, dans les mots du cahier. */
export const scenarioPrecisions = {
  jour: 'day',
  mois: 'month',
  annee: 'year',
  decennie: 'decade',
} as const;

const scenarioDay = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/);

/**
 * Date floue d'un scénario : `date` (une borne) ou `de` et `a` (deux bornes) en AAAA, AAAA-MM
 * ou AAAA-MM-JJ ; la précision se déduit de la première borne, sauf « decennie » écrite à part.
 */
export const scenarioFuzzyDateSchema = z.strictObject({
  qualificatif: z.enum(Object.keys(scenarioQualifiers) as [keyof typeof scenarioQualifiers]),
  precision: z
    .enum(Object.keys(scenarioPrecisions) as [keyof typeof scenarioPrecisions])
    .optional(),
  date: scenarioDay.optional(),
  de: scenarioDay.optional(),
  a: scenarioDay.optional(),
  texte: z.string().optional(),
  calendrier: z.enum(['gregorien', 'hegirien']).optional(),
});
export type ScenarioFuzzyDate = z.infer<typeof scenarioFuzzyDateSchema>;

function scenarioBound(value: string) {
  const [year = '', month, day] = value.split('-');
  return {
    year: Number(year),
    ...(month === undefined ? {} : { month: Number(month) }),
    ...(day === undefined ? {} : { day: Number(day) }),
  };
}

/**
 * Entrée brute du schéma `fuzzyDateSchema`, non validée : les scénarios décrivent aussi des
 * dates refusées.
 */
export function fuzzyDateInputFromScenario(line: ScenarioFuzzyDate): Record<string, unknown> {
  const qualifier = scenarioQualifiers[line.qualificatif];
  if (qualifier === 'text') return { qualifier, originalText: line.texte };
  const first = line.date ?? line.de ?? '';
  const inferred = (['year', 'month', 'day'] as const)[first.split('-').length - 1];
  return {
    qualifier,
    precision: line.precision === undefined ? inferred : scenarioPrecisions[line.precision],
    ...(line.date === undefined ? {} : { date: scenarioBound(line.date) }),
    ...(line.de === undefined ? {} : { from: scenarioBound(line.de) }),
    ...(line.a === undefined ? {} : { to: scenarioBound(line.a) }),
    ...(line.texte === undefined ? {} : { originalText: line.texte }),
    ...(line.calendrier === undefined
      ? {}
      : { calendar: line.calendrier === 'hegirien' ? 'hijri' : 'gregorian' }),
  };
}
