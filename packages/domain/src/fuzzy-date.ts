// Emplacement de la date floue (TRD, « Modèle de données »). La date floue elle-même est T-005.
//
// T-004 ne fixe que le point de branchement : tous les schémas du modèle (faits, unions, noms,
// titres) importent `fuzzyDateSchema` d'ici et nulle part ailleurs. Aujourd'hui, seule la forme
// « texte » existe : le texte d'origine, gardé tel quel. T-005 remplacera ce fichier par l'objet
// complet (qualificatif exacte, vers, avant, après, entre, calculée, texte ; précision ; une ou
// deux bornes ; texte d'origine ; calendrier ; clé de tri déduite), sous forme d'une union
// discriminée sur `qualifier`. La branche `text` ci-dessous en restera une : les données et les
// tests écrits avec `fuzzyDateFromText` resteront valides sans changement.
import { z } from 'zod';

export const fuzzyDateSchema = z.strictObject({
  qualifier: z.literal('text'),
  /** Texte d'origine, tel qu'il a été dit ou écrit (« vers 1940 », « l'année de l'éclipse »). */
  originalText: z.string().trim().min(1),
});
export type FuzzyDate = z.infer<typeof fuzzyDateSchema>;

/** Date floue gardée comme texte (qualificatif « texte »). */
export function fuzzyDateFromText(originalText: string): FuzzyDate {
  return fuzzyDateSchema.parse({ qualifier: 'text', originalText });
}
