// Briques partagées par les schémas du modèle.
import { z } from 'zod';

/** Texte saisi : espaces de bord retirés, jamais vide. */
export const textSchema = z.string().trim().min(1);

/** Certitude d'un lien ou d'un fait (UNI-10) : certain, probable, hypothétique. */
export const certaintySchema = z.enum(['certain', 'probable', 'hypothetical']);
export type Certainty = z.infer<typeof certaintySchema>;

/** Rang : entier strictement positif (1 = premier). */
export const rankSchema = z.int().min(1);
