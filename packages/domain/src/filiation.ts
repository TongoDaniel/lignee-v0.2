// Filiations et candidats parent (TRD, tables `filiations` et `candidats_parent` ; PRD, UNI-09
// à UNI-11). Une filiation relie un parent et un enfant, pas un couple.
// « Au plus deux parents de naissance » et « aucun cycle » portent sur l'ensemble de l'arbre :
// ces contrôles sont T-007.
import { z } from 'zod';

import { certaintySchema } from './common';
import { idSchema } from './ids';

/**
 * Type de filiation (UNI-09) : de naissance, adoptif, « a élevé », confié (confiage, kafala),
 * tuteur, donneur, gestation pour autrui.
 */
export const filiationTypeSchema = z.enum([
  'birth',
  'adoptive',
  'raised',
  'fostered',
  'guardian',
  'donor',
  'surrogacy',
]);
export type FiliationType = z.infer<typeof filiationTypeSchema>;

export const filiationSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    parentId: idSchema,
    childId: idSchema,
    type: filiationTypeSchema,
    certainty: certaintySchema,
    /** Source facultative (UNI-10). */
    sourceId: idSchema.optional(),
    /** Union d'origine facultative : le foyer où l'enfant est rangé. */
    originUnionId: idSchema.optional(),
  })
  .refine((filiation) => filiation.parentId !== filiation.childId, {
    message: 'A person cannot be their own parent',
    path: ['parentId'],
  });
export type Filiation = z.infer<typeof filiationSchema>;
export type FiliationInput = z.input<typeof filiationSchema>;

/**
 * Parent candidat (UNI-11) : « enfant de Moussa, mère parmi ses épouses ». Supprimé quand le
 * parent est précisé.
 */
export const parentCandidateSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    childId: idSchema,
    candidateId: idSchema,
  })
  .refine((candidate) => candidate.childId !== candidate.candidateId, {
    message: 'A person cannot be their own parent candidate',
    path: ['candidateId'],
  });
export type ParentCandidate = z.infer<typeof parentCandidateSchema>;
