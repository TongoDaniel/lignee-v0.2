// Unions (TRD, tables `unions` et `conjoints_union` ; PRD, UNI-05 à UNI-08).
// La polygamie, ce sont plusieurs unions à deux : aucune limite de nombre, aucune règle de genre.
import { z } from 'zod';

import { rankSchema, textSchema } from './common';
import { fuzzyDateSchema } from './fuzzy-date';
import { idSchema } from './ids';

/** Type d'union (UNI-05) : civil, coutumier, religieux, union libre, PACS ou partenariat. */
export const unionTypeSchema = z.enum([
  'civil',
  'customary',
  'religious',
  'free_union',
  'civil_partnership',
  'unspecified',
]);
export type UnionType = z.infer<typeof unionTypeSchema>;

/** Motif de fin (UNI-05) : décès, divorce, séparation, non renseigné. */
export const unionEndReasonSchema = z.enum(['death', 'divorce', 'separation', 'unspecified']);
export type UnionEndReason = z.infer<typeof unionEndReasonSchema>;

/** Option déclarée à l'état civil (UNI-05) : monogamie, polygamie. */
export const declaredOptionSchema = z.enum(['monogamy', 'polygamy']);
export type DeclaredOption = z.infer<typeof declaredOptionSchema>;

/**
 * Simultanéité saisie (UNI-08) : la réponse à la question posée quand les dates ne suffisent pas
 * (`union-simultaneity.ts`), gardée et modifiable. Elle est portée par chaque conjoint, pas par
 * l'union (ADR 0012) : dans un lévirat, la même union est « simultanée » pour le frère déjà marié
 * et « successive » pour la veuve.
 */
export const unionSimultaneitySchema = z.enum(['simultaneous', 'successive']);
export type UnionSimultaneity = z.infer<typeof unionSimultaneitySchema>;

/**
 * Un conjoint, le rang de cette union pour lui (UNI-07 : 2e de l'un, 1re de l'autre) et, si la
 * question a été posée, la place de cette union parmi les autres unions de ce conjoint :
 * simultanée ou successive (UNI-08, ADR 0012).
 */
export const spouseSchema = z.strictObject({
  personId: idSchema,
  rank: rankSchema,
  simultaneity: unionSimultaneitySchema.optional(),
});
export type Spouse = z.infer<typeof spouseSchema>;

/**
 * Une union relie exactement deux personnes distinctes (TRD), chacune avec son rang. Seules les
 * deux personnes sont obligatoires (UNI-05) ; le rang est attribué par l'app (rang suivant de
 * chaque conjoint) et reste modifiable à la main.
 */
export const unionSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    spouses: z.tuple([spouseSchema, spouseSchema]),
    type: unionTypeSchema.default('unspecified'),
    start: fuzzyDateSchema.optional(),
    end: fuzzyDateSchema.optional(),
    endReason: unionEndReasonSchema.optional(),
    declaredOption: declaredOptionSchema.optional(),
    placeId: idSchema.optional(),
    notes: textSchema.optional(),
  })
  .refine((union) => union.spouses[0].personId !== union.spouses[1].personId, {
    message: 'A union links two different people',
    path: ['spouses'],
  });
export type Union = z.infer<typeof unionSchema>;
export type UnionInput = z.input<typeof unionSchema>;
