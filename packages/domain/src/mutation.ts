// Mutations et lots de mutations (TRD, « Hors-ligne et synchronisation », point 2 : « chaque
// modification devient une mutation (identifiant, entité, opération, champs modifiés, version de
// départ, date). Un plan vocal devient un lot de mutations appliqué d'un seul bloc. »).
// Conventions que le TRD ne fixe pas : ADR 0027.
//
// Ce module ne fait que le format, partagé par le téléphone (file de changements, T-030) et le
// serveur (réception, T-060) : il valide l'enveloppe et normalise les champs d'après le schéma de
// chaque objet du modèle. L'application à un arbre (existence, références, invariants) est dans
// @lignee/sync, qui seul connaît l'état de l'arbre.
//
// Confidentialité : une mutation ne porte que ce que son auteur a saisi. Une modification ne
// contient que les champs changés ; une suppression, aucun champ. Les règles de visibilité y
// figurent telles que le modèle les définit (`visibilityRuleSchema`), sans calcul (T-052).
import { z } from 'zod';

import { factSchema, multipleBirthSchema, titleRoleSchema } from './fact';
import { filiationSchema, parentCandidateSchema } from './filiation';
import { idSchema, type Id } from './ids';
import { nameSchema, personSchema } from './person';
import { placeSchema, toPlaceSchema } from './place';
import { simultaneityAnswerSchema, unionSchema } from './union';
import { visibilityRuleSchema } from './visibility';

/**
 * Objets qu'une mutation peut créer, modifier ou supprimer, et leur schéma. L'arbre lui-même
 * (nom, réglages) se change par l'API des arbres (T-048), pas par la synchronisation ; les noms
 * d'usage et les sources arriveront avec leurs tickets (T-041, médias), par une migration.
 */
export const MUTATION_ENTITY_SCHEMAS = {
  person: personSchema,
  name: nameSchema,
  union: unionSchema,
  simultaneity_answer: simultaneityAnswerSchema,
  filiation: filiationSchema,
  parent_candidate: parentCandidateSchema,
  fact: factSchema,
  title_role: titleRoleSchema,
  multiple_birth: multipleBirthSchema,
  place: placeSchema,
  to_place: toPlaceSchema,
  visibility_rule: visibilityRuleSchema,
} as const satisfies Record<string, z.ZodType>;

export type MutationEntity = keyof typeof MUTATION_ENTITY_SCHEMAS;
export const mutationEntitySchema = z.enum(
  Object.keys(MUTATION_ENTITY_SCHEMAS) as [MutationEntity, ...MutationEntity[]],
);

/** Objet du modèle visé par une mutation, tel que son schéma le rend. */
export type MutationEntityObject<E extends MutationEntity = MutationEntity> = z.output<
  (typeof MUTATION_ENTITY_SCHEMAS)[E]
>;

export const mutationOperationSchema = z.enum(['create', 'update', 'delete']);
export type MutationOperation = z.infer<typeof mutationOperationSchema>;

/**
 * Règles de visibilité : créées ou supprimées, jamais modifiées champ par champ (le niveau change
 * la forme de la règle). Changer une règle = la supprimer et en créer une autre dans le même lot.
 */
const UPDATABLE: ReadonlySet<MutationEntity> = new Set(
  mutationEntitySchema.options.filter((entity) => entity !== 'visibility_rule'),
);

/**
 * Champs qu'une mutation ne porte jamais : l'identifiant et l'arbre viennent de l'enveloppe ; la
 * version d'une fiche est donnée par le serveur.
 */
const NEVER_IN_FIELDS: ReadonlySet<string> = new Set(['id', 'treeId', 'version']);
/** Champs fixés à la création : l'auteur d'un nom, d'un fait, d'un titre ou d'une règle. */
const FIXED_AFTER_CREATE: ReadonlySet<string> = new Set(['authorAccountId']);

/** Taille maximale d'un lot (un plan vocal d'une grande branche tient largement dessous). */
export const MAX_BATCH_MUTATIONS = 500;

/** Champs d'une mutation : valeurs JSON ; dans une modification, `null` retire le champ. */
const fieldsSchema = z.record(z.string(), z.unknown());

/**
 * Une mutation, hors de son lot. `fields` :
 * - création : l'objet entier, sans `id` ni `treeId` (pris de `entityId` et du lot) ;
 * - modification : les seuls champs modifiés, au moins un ; `null` retire un champ facultatif
 *   (ou le remet à sa valeur par défaut) ;
 * - suppression : absent.
 * `baseVersion` : la version de l'objet connue du téléphone au moment de la modification ; `null`
 * pour une création et pour un objet que le modèle ne versionne pas (ADR 0027).
 */
export const mutationSchema = z
  .strictObject({
    /** UUIDv7 créé sur le téléphone : rend l'envoi répétable sans double application (TRD). */
    id: idSchema,
    entity: mutationEntitySchema,
    entityId: idSchema,
    operation: mutationOperationSchema,
    fields: fieldsSchema.optional(),
    baseVersion: z.int().min(0).nullable(),
    /** Moment de la saisie sur le téléphone (UTC). */
    createdAt: z.iso.datetime(),
  })
  .superRefine((mutation, context) => {
    const { operation, entity, fields } = mutation;
    if (operation === 'delete') {
      if (fields !== undefined) {
        context.addIssue({ code: 'custom', message: 'A deletion has no fields', path: ['fields'] });
      }
    } else if (fields === undefined) {
      context.addIssue({ code: 'custom', message: 'Fields are required', path: ['fields'] });
    }
    if (operation === 'create' && mutation.baseVersion !== null) {
      context.addIssue({
        code: 'custom',
        message: 'A creation has no base version',
        path: ['baseVersion'],
      });
    }
    if (operation === 'update' && !UPDATABLE.has(entity)) {
      context.addIssue({
        code: 'custom',
        message: 'This object is replaced, not updated',
        path: ['operation'],
      });
    }
    if (fields === undefined) return;
    const keys = Object.keys(fields);
    if (operation === 'update' && keys.length === 0) {
      context.addIssue({ code: 'custom', message: 'An update changes a field', path: ['fields'] });
    }
    for (const key of keys) {
      if (NEVER_IN_FIELDS.has(key) || (operation === 'update' && FIXED_AFTER_CREATE.has(key))) {
        context.addIssue({
          code: 'custom',
          message: 'This field cannot be set by a mutation',
          path: ['fields', key],
        });
      }
    }
  });
export type Mutation = z.infer<typeof mutationSchema>;
export type MutationInput = z.input<typeof mutationSchema>;

/** Forme d'objet d'un schéma (tous sauf la règle de visibilité, union discriminée). */
function objectShape(entity: MutationEntity): Record<string, z.ZodType> | undefined {
  const schema = MUTATION_ENTITY_SCHEMAS[entity];
  return 'shape' in schema ? schema.shape : undefined;
}

type FieldsResult =
  | { readonly success: true; readonly fields: Record<string, unknown> }
  | { readonly success: false; readonly issues: readonly z.core.$ZodIssue[] };

function prefixed(issues: readonly z.core.$ZodIssue[], prefix: PropertyKey[]): z.core.$ZodIssue[] {
  return issues.map((issue) => ({ ...issue, path: [...prefix, ...issue.path] }));
}

/**
 * Objet créé par une mutation de création : ses champs, son identifiant et son arbre, passés par
 * le schéma du modèle (valeurs par défaut comprises).
 */
export function createdObject<E extends MutationEntity>(
  entity: E,
  entityId: Id,
  treeId: Id,
  fields: Record<string, unknown>,
): z.ZodSafeParseResult<MutationEntityObject<E>> {
  return MUTATION_ENTITY_SCHEMAS[entity].safeParse({
    ...fields,
    id: entityId,
    treeId,
  }) as z.ZodSafeParseResult<MutationEntityObject<E>>;
}

/**
 * Objet modifié : l'objet courant, chaque champ remplacé (ou retiré par `null`), repassé par le
 * schéma du modèle (les contrôles qui croisent plusieurs champs comprennent les champs non
 * modifiés).
 */
export function updatedObject<E extends MutationEntity>(
  entity: E,
  current: MutationEntityObject<E>,
  fields: Record<string, unknown>,
): z.ZodSafeParseResult<MutationEntityObject<E>> {
  const removed = new Set(
    Object.entries(fields)
      .filter(([, value]) => value === null)
      .map(([key]) => key),
  );
  const merged = Object.fromEntries(
    Object.entries({ ...(current as Record<string, unknown>), ...fields }).filter(
      ([key]) => !removed.has(key),
    ),
  );
  return MUTATION_ENTITY_SCHEMAS[entity].safeParse(merged) as z.ZodSafeParseResult<
    MutationEntityObject<E>
  >;
}

/**
 * Champs normalisés d'une mutation (espaces retirés, valeurs par défaut d'une création) : ce qui
 * est gardé dans la file et envoyé au serveur, qui obtient ainsi le même objet que le téléphone.
 */
export function normalizeMutationFields(
  mutation: Pick<Mutation, 'entity' | 'entityId' | 'operation' | 'fields'>,
  treeId: Id,
): FieldsResult {
  const { entity, operation, fields } = mutation;
  if (fields === undefined) return { success: true, fields: {} };
  if (operation === 'create') {
    const result = createdObject(entity, mutation.entityId, treeId, fields);
    if (!result.success)
      return { success: false, issues: prefixed(result.error.issues, ['fields']) };
    // Identifiant, arbre et version ne sont pas des champs saisis (`NEVER_IN_FIELDS`).
    const rest = Object.fromEntries(
      Object.entries(result.data as Record<string, unknown>).filter(
        ([key]) => !NEVER_IN_FIELDS.has(key),
      ),
    );
    return { success: true, fields: rest };
  }
  const shape = objectShape(entity);
  if (shape === undefined) {
    return {
      success: false,
      issues: [{ code: 'custom', message: 'Not updatable', path: ['operation'], input: fields }],
    };
  }
  const normalized: Record<string, unknown> = {};
  const issues: z.core.$ZodIssue[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const field = shape[key];
    if (field === undefined) {
      issues.push({ code: 'custom', message: 'Unknown field', path: ['fields', key], input: key });
      continue;
    }
    if (value === null) {
      // Retirer un champ n'est possible que s'il est facultatif (ou a une valeur par défaut).
      if (field.safeParse(undefined).success) normalized[key] = null;
      else {
        issues.push({
          code: 'custom',
          message: 'Required field',
          path: ['fields', key],
          input: null,
        });
      }
      continue;
    }
    const result = field.safeParse(value);
    if (result.success) normalized[key] = result.data;
    else issues.push(...prefixed(result.error.issues, ['fields', key]));
  }
  return issues.length > 0 ? { success: false, issues } : { success: true, fields: normalized };
}

/**
 * Un lot : des mutations d'un même arbre, appliquées d'un seul bloc (toutes ou aucune). Une
 * saisie à la main est un lot d'une mutation ou plus (une fiche et son nom) ; un plan vocal
 * validé est un lot. Les champs sont normalisés à la lecture (`normalizeMutationFields`).
 */
export const mutationBatchSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    mutations: z.array(mutationSchema).min(1).max(MAX_BATCH_MUTATIONS),
  })
  .transform((batch, context) => {
    const seen = new Set<Id>([batch.id]);
    const invalid = new Set<number>();
    const mutations = batch.mutations.map((mutation, index) => {
      if (seen.has(mutation.id)) {
        context.issues.push({
          code: 'custom',
          message: 'Duplicate mutation id',
          path: ['mutations', index, 'id'],
          input: mutation.id,
        });
        invalid.add(index);
      }
      seen.add(mutation.id);
      const result = normalizeMutationFields(mutation, batch.treeId);
      if (!result.success) {
        for (const issue of result.issues) {
          context.issues.push({
            ...issue,
            path: ['mutations', index, ...issue.path],
          } as z.core.$ZodRawIssue);
        }
        invalid.add(index);
        return mutation;
      }
      return mutation.fields === undefined ? mutation : { ...mutation, fields: result.fields };
    });
    return invalid.size === 0 ? { ...batch, mutations } : z.NEVER;
  });
export type MutationBatch = z.output<typeof mutationBatchSchema>;
export type MutationBatchInput = z.input<typeof mutationBatchSchema>;
