// Arbre et ses réglages (TRD, table `arbres` ; PRD, CON-13).
// Minimisation (TRD, « Confidentialité appliquée », point 7) : aucun champ « ethnie » ni
// « religion », nulle part dans le modèle ; un test inspecte tous les schémas.
import { z } from 'zod';

import { textSchema } from './common';
import { idSchema } from './ids';
import { nameOrderSchema } from './person';

export const treeLanguageSchema = z.enum(['fr', 'en']);
export type TreeLanguage = z.infer<typeof treeLanguageSchema>;

export const treeSettingsSchema = z.strictObject({
  /**
   * Carte des origines activée pour tout l'arbre (CON-13). Le propriétaire peut la couper.
   * Pas de valeur par défaut ici : elle se décide à la création de l'arbre (T-048).
   */
  mapEnabled: z.boolean(),
});
export type TreeSettings = z.infer<typeof treeSettingsSchema>;

export const treeSchema = z.strictObject({
  id: idSchema,
  /** Nom de la famille. */
  name: textSchema,
  language: treeLanguageSchema,
  /** Ordre d'affichage des noms (CL-DON-01). */
  nameOrder: nameOrderSchema,
  /** Un seul propriétaire. */
  ownerAccountId: idSchema,
  settings: treeSettingsSchema,
});
export type Tree = z.infer<typeof treeSchema>;
