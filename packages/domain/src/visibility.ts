// Règles de visibilité, sous forme de données seulement (TRD, tables `visibilites` et
// `visibilite_comptes` ; PRD, CON-02, CON-03). Le calcul (qui voit quoi, valeurs par défaut,
// dépendances) est T-052 et passe par la relecture de gardien-confidentialite.
import { z } from 'zod';

import { idSchema } from './ids';

/** Objets qui portent une règle (CON-03) : personne, union, lien de filiation, fait, nom. */
export const visibilityTargetTypeSchema = z.enum(['person', 'union', 'filiation', 'fact', 'name']);
export type VisibilityTargetType = z.infer<typeof visibilityTargetTypeSchema>;

export const visibilityTargetSchema = z.strictObject({
  type: visibilityTargetTypeSchema,
  id: idSchema,
});
export type VisibilityTarget = z.infer<typeof visibilityTargetSchema>;

const ruleBase = {
  id: idSchema,
  treeId: idSchema,
  target: visibilityTargetSchema,
  /** Compte qui a posé la règle : le « moi » de « moi seul ». */
  authorAccountId: idSchema,
};

/**
 * Règle de visibilité d'un objet (CON-02) : tout l'arbre, une branche (avec sa personne racine),
 * des personnes choisies (leurs comptes), ou moi seul.
 */
export const visibilityRuleSchema = z.discriminatedUnion('level', [
  z.strictObject({ ...ruleBase, level: z.literal('tree') }),
  z.strictObject({ ...ruleBase, level: z.literal('branch'), branchRootPersonId: idSchema }),
  z.strictObject({
    ...ruleBase,
    level: z.literal('chosen_people'),
    accountIds: z.array(idSchema).min(1),
  }),
  z.strictObject({ ...ruleBase, level: z.literal('only_me') }),
]);
export type VisibilityRule = z.infer<typeof visibilityRuleSchema>;
export type VisibilityLevel = VisibilityRule['level'];

/**
 * Ensemble des règles d'un arbre : une règle par objet (TRD). Sans règle, l'objet prend la valeur
 * par défaut de son type (T-052).
 */
export const visibilityRuleSetSchema = z
  .array(visibilityRuleSchema)
  .superRefine((rules, context) => {
    const seen = new Set<string>();
    rules.forEach((rule, index) => {
      const key = `${rule.target.type}:${rule.target.id}`;
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Only one visibility rule per object',
          path: [index, 'target'],
        });
      }
      seen.add(key);
    });
  });
