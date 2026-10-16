// Faits (TRD, table `faits` ; PRD, UNI-01, UNI-15), titres et rôles datés (UNI-17, CL-FAM-19),
// naissances multiples (UNI-14, CL-FAM-11).
import { z } from 'zod';

import { certaintySchema, rankSchema, textSchema } from './common';
import { fuzzyDateSchema } from './fuzzy-date';
import { idSchema } from './ids';

/** Ce que décrit un fait : une personne ou une union. */
export const factSubjectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('person'), personId: idSchema }),
  z.strictObject({ kind: z.literal('union'), unionId: idSchema }),
]);
export type FactSubject = z.infer<typeof factSubjectSchema>;

/**
 * Type de fait. La cause de décès est un fait à part (`death_cause`), distinct du décès : c'est
 * une donnée de santé, avec sa propre règle de visibilité, visible de son seul auteur par défaut
 * (UNI-15, TRD « Confidentialité appliquée »). Le décès lui-même (date, lieu) suit la personne.
 * `recognition` : reconnaissance tardive d'un enfant, en fait daté (CL-FAM-13) ; il désigne la
 * filiation reconnue (`filiationId`) et en prend la visibilité, pour ne pas révéler un lien masqué.
 */
export const factTypeSchema = z.enum([
  'birth',
  'death',
  'death_cause',
  'occupation',
  'residence',
  'recognition',
  'other',
]);
export type FactType = z.infer<typeof factTypeSchema>;

/** Types de fait qui exigent une valeur (la cause, la profession, le libellé d'un autre fait). */
const VALUE_REQUIRED: ReadonlySet<FactType> = new Set(['death_cause', 'occupation', 'other']);
/** Types de fait qui ne décrivent qu'une personne. */
const PERSON_ONLY: ReadonlySet<FactType> = new Set([
  'birth',
  'death',
  'death_cause',
  'occupation',
  'residence',
  'recognition',
]);

export const factSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    subject: factSubjectSchema,
    type: factTypeSchema,
    date: fuzzyDateSchema.optional(),
    placeId: idSchema.optional(),
    value: textSchema.optional(),
    certainty: certaintySchema.optional(),
    sourceId: idSchema.optional(),
    /** Filiation reconnue : obligatoire pour `recognition`, absente pour les autres types. */
    filiationId: idSchema.optional(),
    /** Compte qui a saisi le fait : « son auteur » des règles de visibilité par défaut. */
    authorAccountId: idSchema,
  })
  .superRefine((fact, context) => {
    if (VALUE_REQUIRED.has(fact.type) && fact.value === undefined) {
      context.addIssue({ code: 'custom', message: 'This fact needs a value', path: ['value'] });
    }
    if ((fact.type === 'recognition') !== (fact.filiationId !== undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'A recognition fact, and only it, names the recognised filiation',
        path: ['filiationId'],
      });
    }
    if (PERSON_ONLY.has(fact.type) && fact.subject.kind !== 'person') {
      context.addIssue({
        code: 'custom',
        message: 'This fact describes a person',
        path: ['subject'],
      });
    }
  });
export type Fact = z.infer<typeof factSchema>;
export type FactInput = z.input<typeof factSchema>;

/**
 * Titre ou rôle daté (UNI-17) : chef, notable, successeur, Fon, Lamido, responsable
 * d'association. Le libellé est libre (les titres traditionnels ne se traduisent pas) ; il
 * s'affiche sous le nom, avec ses dates. Sans règle propre : il prend la visibilité de la
 * personne (ADR 0008).
 */
export const titleRoleSchema = z.strictObject({
  id: idSchema,
  treeId: idSchema,
  personId: idSchema,
  label: textSchema,
  start: fuzzyDateSchema.optional(),
  end: fuzzyDateSchema.optional(),
  placeId: idSchema.optional(),
  notes: textSchema.optional(),
  /** Compte qui a saisi le titre. */
  authorAccountId: idSchema,
});
export type TitleRole = z.infer<typeof titleRoleSchema>;

/** Un enfant d'une naissance multiple, avec son ordre de naissance facultatif. */
export const multipleBirthMemberSchema = z.strictObject({
  personId: idSchema,
  birthOrder: rankSchema.optional(),
});

/**
 * Naissance multiple (UNI-14) : jumeaux, triplés… Une seule naissance partagée par au moins deux
 * personnes ; l'ordre est facultatif, mais deux enfants n'ont pas le même rang.
 */
export const multipleBirthSchema = z
  .strictObject({
    id: idSchema,
    treeId: idSchema,
    members: z.array(multipleBirthMemberSchema).min(2),
  })
  .superRefine((birth, context) => {
    const people = birth.members.map((member) => member.personId);
    if (new Set(people).size !== people.length) {
      context.addIssue({ code: 'custom', message: 'A person appears twice', path: ['members'] });
    }
    const orders = birth.members.flatMap((member) =>
      member.birthOrder === undefined ? [] : [member.birthOrder],
    );
    if (new Set(orders).size !== orders.length) {
      context.addIssue({ code: 'custom', message: 'Two births share an order', path: ['members'] });
    }
  });
export type MultipleBirth = z.infer<typeof multipleBirthSchema>;

/** La naissance multiple d'une personne, s'il y en a une : la même pour chacun des enfants. */
export function findMultipleBirth(
  personId: string,
  births: readonly MultipleBirth[],
): MultipleBirth | undefined {
  return births.find((birth) => birth.members.some((member) => member.personId === personId));
}

/**
 * Naissance multiple telle qu'un lecteur la voit : les enfants qu'il ne voit pas en sont retirés,
 * et elle disparaît s'il en reste moins de deux (sinon « Jumeaux » trahirait un enfant masqué).
 * `isVisible` vient du module de droits (T-052) ; cette fonction ne décide rien d'autre.
 */
export function projectMultipleBirth(
  birth: MultipleBirth,
  isVisible: (personId: string) => boolean,
): MultipleBirth | undefined {
  const members = birth.members.filter((member) => isVisible(member.personId));
  return members.length < 2 ? undefined : { ...birth, members };
}
