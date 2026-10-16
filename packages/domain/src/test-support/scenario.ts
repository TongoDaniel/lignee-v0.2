// Lecture simple d'un scénario de cas limite (test/scenarios/<ID>.yaml), réservée aux tests.
// Le lecteur complet, avec la validation du format, arrive avec T-006.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { z } from 'zod';

const SCENARIOS_DIR = fileURLToPath(new URL('../../../../test/scenarios/', import.meta.url));

/** Lit `test/scenarios/<id>.yaml`, vérifie son identifiant et le valide avec `schema`. */
export function loadScenario<T extends z.ZodType>(id: string, schema: T): z.infer<T> {
  const raw: unknown = parse(readFileSync(`${SCENARIOS_DIR}${id}.yaml`, 'utf8'));
  const header = z.looseObject({ id: z.literal(id), titre: z.string().min(1) }).parse(raw);
  return schema.parse(header);
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
