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
 * Deux unions d'une même personne, simultanées ou successives (UNI-08). Se déduit des dates ;
 * sinon, la réponse à la question est gardée par paire d'unions (`simultaneityAnswerSchema`).
 */
export const unionSimultaneitySchema = z.enum(['simultaneous', 'successive']);
export type UnionSimultaneity = z.infer<typeof unionSimultaneitySchema>;

/** Un conjoint et le rang de cette union pour lui (UNI-07 : 2e de l'un, 1re de l'autre). */
export const spouseSchema = z.strictObject({
  personId: idSchema,
  rank: rankSchema,
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

/**
 * Réponse gardée pour une paire d'unions qui ont un conjoint en commun (UNI-08, ADR 0012) :
 * simultanées ou successives. La paire est rangée (plus petit identifiant d'abord), si bien
 * qu'il n'y a qu'une réponse par paire ; elle se modifie en remplaçant `simultaneity`. Que les
 * deux unions aient ou non un conjoint en commun se vérifie sur l'arbre (`treeDataIssues`,
 * synchronisation). Sans règle de visibilité propre : visible de qui voit les deux unions.
 */
export const simultaneityAnswerSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    unionIds: z.tuple([idSchema, idSchema]),
    simultaneity: unionSimultaneitySchema,
  })
  .refine((answer) => answer.unionIds[0] < answer.unionIds[1], {
    message: 'A pair holds two different unions, smallest id first',
    path: ['unionIds'],
  });
export type SimultaneityAnswer = z.infer<typeof simultaneityAnswerSchema>;
