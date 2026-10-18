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

/** Reconnaissance d'un lien : officielle, non officielle, inconnue (CON-04). */
export const recognitionStatusSchema = z.enum(['official', 'unofficial', 'unknown']);
export type RecognitionStatus = z.infer<typeof recognitionStatusSchema>;

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
    /**
     * Reconnaissance du lien (CON-04, CL-FAM-14) : officielle, non officielle (paternité non
     * officielle) ou inconnue. Distincte de la certitude : un lien certain peut être non officiel.
     */
    recognitionStatus: recognitionStatusSchema.default('unknown'),
  })
  .refine((filiation) => filiation.parentId !== filiation.childId, {
    message: 'A person cannot be their own parent',
    path: ['parentId'],
  });
export type Filiation = z.infer<typeof filiationSchema>;
export type FiliationInput = z.input<typeof filiationSchema>;

/** Types de filiation pour lesquels « moi seul » est proposé à la création (CON-04). */
const ONLY_ME_PROPOSED_TYPES: ReadonlySet<FiliationType> = new Set([
  'donor',
  'surrogacy',
  'adoptive',
]);

/**
 * Vrai si « moi seul » doit être proposé à la création de ce lien (CON-04, TRD « Confidentialité
 * appliquée », point 1) : donneur, gestation pour autrui, adoption, paternité non officielle.
 * Proposé seulement : le choix est montré dans l'aperçu avant validation (T-052, T-072).
 */
export function proposesOnlyMeByDefault(
  filiation: Pick<Filiation, 'type' | 'recognitionStatus'>,
): boolean {
  return ONLY_ME_PROPOSED_TYPES.has(filiation.type) || filiation.recognitionStatus === 'unofficial';
}

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
