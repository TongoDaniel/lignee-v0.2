// Lecture simple d'un scénario de cas limite (test/scenarios/<ID>.yaml), réservée aux tests.
// Le lecteur complet, avec la validation du format, arrive avec T-006.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { z } from 'zod';

const SCENARIOS_DIR = fileURLToPath(new URL('../../../../test/scenarios/', import.meta.url));

/**
 * Dossier où chaque scénario chargé laisse une trace (job `cas-limites` de la CI). Sans cette
 * variable, rien n'est écrit.
 */
const PLAYED_DIR_VARIABLE = 'LIGNEE_SCENARIOS_PLAYED_DIR';

/** Couverture partielle (test/scenarios/README.md) : parties testées, tickets qui complètent. */
export const coverageSchema = z.strictObject({
  teste: z.array(z.enum(['modele'])).min(1),
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
  const raw: unknown = parse(readFileSync(`${SCENARIOS_DIR}${id}.yaml`, 'utf8'));
  const scenario = schema.parse(raw);
  const playedDir = process.env[PLAYED_DIR_VARIABLE];
  if (playedDir !== undefined && playedDir !== '') {
    mkdirSync(playedDir, { recursive: true });
    writeFileSync(join(playedDir, id), '');
  }
  return scenario;
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

/**
 * Union au format de CL-POL-03 : `{ conjoints: [a, b], rang_a: 1, rang_b: 1 }`. Exactement ces
 * clés, avec un rang entier positif pour chaque conjoint.
 */
export const scenarioUnionSchema = z
  .looseObject({ conjoints: z.tuple([z.string(), z.string()]) })
  .transform((line, context) => {
    const [a, b] = line.conjoints;
    const expected = ['conjoints', `rang_${a}`, `rang_${b}`].sort();
    const keys = Object.keys(line).sort();
    const rankA = z.int().min(1).safeParse(line[`rang_${a}`]);
    const rankB = z.int().min(1).safeParse(line[`rang_${b}`]);
    if (keys.join() !== expected.join() || !rankA.success || !rankB.success) {
      context.addIssue({
        code: 'custom',
        message: `Expected exactly ${expected.join(', ')} with positive integer ranks`,
      });
      return z.NEVER;
    }
    return { spouses: [a, b] as const, ranks: [rankA.data, rankB.data] as const };
  });

export const scenarioFiliationSchema = z.strictObject({
  parents: z.array(z.string()).min(1).max(2),
  enfant: z.string(),
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
