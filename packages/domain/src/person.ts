// Personnes et noms (TRD, tables `personnes` et `noms` ; PRD, UNI-01, UNI-02, UNI-22).
import { z } from 'zod';

import { textSchema } from './common';
import { fuzzyDateSchema } from './fuzzy-date';
import { idSchema } from './ids';

/**
 * Nature d'une personne. « À compléter » (UNI-02) est une nature, pas un nom spécial : son
 * existence est certaine, son identité inconnue. Aucun nom « Inconnu » n'est jamais enregistré.
 */
export const personNatureSchema = z.enum(['known', 'placeholder']);
export type PersonNature = z.infer<typeof personNatureSchema>;

/** Genre (UNI-01) : femme, homme, autre, non renseigné. */
export const genderSchema = z.enum(['female', 'male', 'other', 'unspecified']);
export type Gender = z.infer<typeof genderSchema>;

/**
 * Statut vital saisi. « Présumée vivante » (UNI-16) n'est pas une valeur saisie : elle est
 * calculée (T-007) à partir de ce statut et des dates.
 */
export const vitalStatusSchema = z.enum(['living', 'deceased', 'unknown']);
export type VitalStatus = z.infer<typeof vitalStatusSchema>;

export const personSchema = z.strictObject({
  id: idSchema,
  treeId: idSchema,
  nature: personNatureSchema,
  gender: genderSchema.default('unspecified'),
  vitalStatus: vitalStatusSchema.default('unknown'),
  notes: textSchema.optional(),
  /** Version de la fiche, pour la synchronisation (TRD, table `personnes`). */
  version: z.int().min(0).default(0),
});
export type Person = z.infer<typeof personSchema>;
export type PersonInput = z.input<typeof personSchema>;

/**
 * Type d'un nom (TRD, table `noms`) : de naissance, d'usage, surnom, titre (appellation portée
 * comme un nom), variante d'écriture, ancien. « Ancien » sert à l'ancien prénom d'une personne
 * trans ou non binaire (UNI-22) : masqué par défaut, voir README.
 */
export const nameTypeSchema = z.enum(['birth', 'usage', 'nickname', 'title', 'variant', 'former']);
export type NameType = z.infer<typeof nameTypeSchema>;

/**
 * Un nom d'une personne. Prénoms et nom de famille sont des champs séparés (CL-DON-01) ; une
 * seule forme suffit (CL-DON-02). Les dates de début et de fin datent les noms successifs
 * (CL-FAM-18). Aucun nom n'est jamais recopié d'une fiche à l'autre (CL-POL-15) : un nom
 * appartient à une seule personne.
 */
export const nameSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    personId: idSchema,
    type: nameTypeSchema,
    givenNames: textSchema.optional(),
    surname: textSchema.optional(),
    /** Forme d'affichage saisie telle quelle (« Tonton Bobo »), prioritaire à l'affichage. */
    displayForm: textSchema.optional(),
    /** Écriture, code ISO 15924 (« Latn », « Arab »). */
    script: z
      .string()
      .regex(/^[A-Z][a-z]{3}$/)
      .optional(),
    start: fuzzyDateSchema.optional(),
    end: fuzzyDateSchema.optional(),
    /** Compte qui a saisi ce nom. */
    authorAccountId: idSchema,
  })
  .refine(
    (name) =>
      name.givenNames !== undefined || name.surname !== undefined || name.displayForm !== undefined,
    { message: 'A name needs given names, a surname or a display form', path: ['givenNames'] },
  );
export type Name = z.infer<typeof nameSchema>;
export type NameInput = z.input<typeof nameSchema>;

/** Ordre d'affichage des noms, réglé par arbre (CL-DON-01). */
export const nameOrderSchema = z.enum(['given_first', 'surname_first']);
export type NameOrder = z.infer<typeof nameOrderSchema>;

/**
 * Forme affichée d'un nom : la forme d'affichage si elle existe, sinon prénoms et nom dans
 * l'ordre de l'arbre. Le choix du nom à afficher parmi ceux d'une personne relève de la fiche.
 */
export function formatName(
  name: Pick<Name, 'givenNames' | 'surname' | 'displayForm'>,
  order: NameOrder,
): string {
  if (name.displayForm !== undefined) return name.displayForm;
  const parts =
    order === 'given_first' ? [name.givenNames, name.surname] : [name.surname, name.givenNames];
  return parts.filter((part): part is string => part !== undefined).join(' ');
}

/**
 * Une personne avec ses noms, tels qu'ils sont créés ensemble. UNI-01 : seul un nom est
 * obligatoire ; une personne à compléter (« Inconnu » à l'écran) n'en a pas besoin.
 */
export const personRecordSchema = z
  .strictObject({
    person: personSchema,
    names: z.array(nameSchema),
  })
  .superRefine((record, context) => {
    if (record.person.nature === 'known' && record.names.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A known person needs at least one name',
        path: ['names'],
      });
    }
    record.names.forEach((name, index) => {
      if (name.personId !== record.person.id || name.treeId !== record.person.treeId) {
        context.addIssue({
          code: 'custom',
          message: 'Name belongs to another person or tree',
          path: ['names', index],
        });
      }
    });
  });
export type PersonRecord = z.infer<typeof personRecordSchema>;
export type PersonRecordInput = z.input<typeof personRecordSchema>;
