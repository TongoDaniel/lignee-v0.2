// Lieux, « À placer » et noms d'usage (TRD, tables `lieux`, `a_placer`, `noms_usage`).
import { z } from 'zod';

import { textSchema } from './common';
import { idSchema } from './ids';

/**
 * Lieu, partagé dans un arbre. Saisi en texte libre (CAR-01) ; les coordonnées sont facultatives
 * et ne viennent jamais de la position du téléphone.
 */
export const placeSchema = z.strictObject({
  id: idSchema,
  treeId: idSchema,
  name: textSchema,
  currentName: textSchema.optional(),
  formerNames: z.array(textSchema).default([]),
  /** Pays, code ISO 3166-1 alpha-2 (« CM »). */
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  coordinates: z
    .strictObject({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});
export type Place = z.infer<typeof placeSchema>;

/** Un pas du chemin connu vers la personne à placer, depuis la personne de référence. */
export const kinshipStepSchema = z.enum(['parent', 'child', 'spouse', 'sibling']);
export type KinshipStep = z.infer<typeof kinshipStepSchema>;

/** Côté du chemin, quand on le connaît. */
export const lineageSideSchema = z.enum(['paternal', 'maternal', 'unknown']);
export type LineageSide = z.infer<typeof lineageSideSchema>;

/**
 * « À placer » (UNI-04) : une vraie fiche sans lien, qui attend avec ce qu'on sait d'elle
 * (« grand-mère de Nora, côté inconnu » : référence Nora, chemin parent puis parent, côté
 * inconnu). Fermé dès que la personne est placée.
 */
export const toPlaceSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    personId: idSchema,
    referencePersonId: idSchema,
    path: z.array(kinshipStepSchema).min(1),
    side: lineageSideSchema.default('unknown'),
    status: z.enum(['open', 'closed']).default('open'),
  })
  .refine((entry) => entry.personId !== entry.referencePersonId, {
    message: 'The reference person is another person',
    path: ['referencePersonId'],
  });
export type ToPlace = z.infer<typeof toPlaceSchema>;

/** Portée d'un nom d'usage : moi seul, ou toute la famille. */
export const usageNameScopeSchema = z.enum(['only_me', 'family']);
export type UsageNameScope = z.infer<typeof usageNameScopeSchema>;

/**
 * Nom d'usage choisi par un membre pour une personne (« Maman Fatou »). Jamais utilisé dans le
 * calcul du lien.
 */
export const usageNameSchema = z.strictObject({
  id: idSchema,
  treeId: idSchema,
  authorAccountId: idSchema,
  personId: idSchema,
  label: textSchema,
  scope: usageNameScopeSchema,
});
export type UsageName = z.infer<typeof usageNameSchema>;
