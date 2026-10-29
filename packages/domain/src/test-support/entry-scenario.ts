// Partie « saisie » des scénarios (T-031) : ce que la personne tape dans le formulaire, et ce que
// l'arbre doit contenir ensuite. Le format est dans test/scenarios/README.md. Réservé aux tests.
import { z } from 'zod';

import {
  emptyDateDraft,
  emptyNameDraft,
  emptyPersonDraft,
  type DateDraft,
  type NameDraft,
  type PersonDraft,
} from '../person-entry';
import type { Gender, VitalStatus } from '../person';
import { scenarioFuzzyDateSchema, scenarioNameTypes, scenarioQualifiers } from './scenario';

const text = z.union([z.string(), z.number()]).transform(String);

/** Une date telle que le formulaire la reçoit : un choix, puis des chiffres. */
export const entryDateSchema = z.strictObject({
  choix: z.enum(['exacte', 'vers', 'avant', 'apres', 'entre', 'texte'] as const),
  annee: text.optional(),
  mois: text.optional(),
  jour: text.optional(),
  decennie: z.boolean().optional(),
  annee_fin: text.optional(),
  mois_fin: text.optional(),
  jour_fin: text.optional(),
  texte: z.string().optional(),
  calendrier: z.literal('hegirien').optional(),
});
export type EntryDate = z.infer<typeof entryDateSchema>;

const nameTypeKeys = Object.keys(scenarioNameTypes) as [keyof typeof scenarioNameTypes];

export const entryNameSchema = z.strictObject({
  type: z.enum(nameTypeKeys),
  prenoms: z.string().optional(),
  nom: z.string().optional(),
  forme: z.string().optional(),
  debut: entryDateSchema.optional(),
  fin: entryDateSchema.optional(),
});

const place = z.string().optional();

export const entryFormSchema = z.strictObject({
  inconnu: z.boolean().optional(),
  genre: z.enum(['M', 'F', 'A', 'N']).optional(),
  statut: z.enum(['vivante', 'decedee', 'inconnu']).optional(),
  noms: z.array(entryNameSchema).optional(),
  naissance: z.strictObject({ date: entryDateSchema.optional(), lieu: place }).optional(),
  deces: z
    .strictObject({ date: entryDateSchema.optional(), lieu: place, cause: z.string().optional() })
    .optional(),
  titres: z
    .array(
      z.strictObject({
        libelle: z.string(),
        debut: entryDateSchema.optional(),
        fin: entryDateSchema.optional(),
      }),
    )
    .optional(),
});
export type EntryForm = z.infer<typeof entryFormSchema>;

const resultDate = scenarioFuzzyDateSchema;

export const entryResultSchema = z.strictObject({
  nature: z.enum(['connue', 'a_completer']),
  noms: z
    .array(
      z.strictObject({
        type: z.enum(nameTypeKeys),
        prenoms: z.string().optional(),
        nom: z.string().optional(),
        forme: z.string().optional(),
        debut: resultDate.optional(),
        fin: resultDate.optional(),
      }),
    )
    .optional(),
  titres: z
    .array(
      z.strictObject({
        libelle: z.string(),
        debut: resultDate.optional(),
        fin: resultDate.optional(),
      }),
    )
    .optional(),
  naissance: z.strictObject({ date: resultDate.optional(), lieu: place }).optional(),
  deces: z.strictObject({ date: resultDate.optional(), lieu: place }).optional(),
  statut: z.enum(['vivante', 'decedee', 'inconnu']).optional(),
  /** La cause de décès est un fait du rédacteur seul (UNI-15) : sa valeur, et rien d'autre. */
  cause_de_deces: z.string().optional(),
  /** Codes des alertes de cohérence (UNI-18) que l'enregistrement montrerait ; liste exacte. */
  alertes: z.array(z.string()).optional(),
});
export type EntryResult = z.infer<typeof entryResultSchema>;

/** Contenu de `attendu.saisie`. */
export const entryScenarioSchema = z.strictObject({
  /** CL-DON-01 : un nom complet écrit d'un trait, séparé selon l'ordre réglé par l'arbre. */
  decouper: z
    .array(
      z.strictObject({
        ordre: z.enum(['nom_puis_prenoms', 'prenoms_puis_nom']),
        texte: z.string(),
        prenoms: z.string(),
        nom: z.string(),
      }),
    )
    .optional(),
  /** CL-DON-05, CL-DON-06 : une date saisie par morceaux, et la date floue qui en résulte. */
  dates: z
    .array(z.strictObject({ formulaire: entryDateSchema, attendue: scenarioFuzzyDateSchema }))
    .optional(),
  /** Dates que le formulaire refuse, avec le code du refus. */
  dates_refusees: z
    .array(z.strictObject({ formulaire: entryDateSchema, code: z.string() }))
    .optional(),
  /** Des personnes créées à la main, chacune dans l'arbre du scénario (ou un petit arbre). */
  personnes: z
    .array(z.strictObject({ formulaire: entryFormSchema, resultat: entryResultSchema }))
    .optional(),
});
export type EntryScenario = z.infer<typeof entryScenarioSchema>;

const MODES = {
  exacte: 'exact',
  vers: 'about',
  avant: 'before',
  apres: 'after',
  entre: 'between',
  texte: 'text',
} as const satisfies Partial<Record<keyof typeof scenarioQualifiers, DateDraft['mode']>>;

/** Le brouillon de date d'un formulaire de scénario. */
export function dateDraftFromEntry(form: EntryDate | undefined): DateDraft {
  if (form === undefined) return emptyDateDraft();
  return {
    mode: MODES[form.choix],
    decade: form.decennie ?? false,
    calendar: form.calendrier === 'hegirien' ? 'hijri' : 'gregorian',
    from: { year: form.annee ?? '', month: form.mois ?? '', day: form.jour ?? '' },
    to: { year: form.annee_fin ?? '', month: form.mois_fin ?? '', day: form.jour_fin ?? '' },
    text: form.texte ?? '',
  };
}

const GENDERS = { M: 'male', F: 'female', A: 'other', N: 'unspecified' } as const;
const STATUSES = { vivante: 'living', decedee: 'deceased', inconnu: 'unknown' } as const;

/** Le brouillon de personne d'un formulaire de scénario. */
export function personDraftFromEntry(form: EntryForm): PersonDraft {
  const base = emptyPersonDraft();
  const names: NameDraft[] = (form.noms ?? []).map((name) => ({
    ...emptyNameDraft(scenarioNameTypes[name.type]),
    givenNames: name.prenoms ?? '',
    surname: name.nom ?? '',
    displayForm: name.forme ?? '',
    start: dateDraftFromEntry(name.debut),
    end: dateDraftFromEntry(name.fin),
  }));
  const gender: Gender = form.genre === undefined ? 'unspecified' : GENDERS[form.genre];
  const vitalStatus: VitalStatus = form.statut === undefined ? 'unknown' : STATUSES[form.statut];
  return {
    ...base,
    placeholder: form.inconnu ?? false,
    gender,
    vitalStatus,
    names: names.length > 0 ? names : base.names,
    birth: { date: dateDraftFromEntry(form.naissance?.date), place: form.naissance?.lieu ?? '' },
    death: { date: dateDraftFromEntry(form.deces?.date), place: form.deces?.lieu ?? '' },
    deathCause: { value: form.deces?.cause ?? '' },
    titles: (form.titres ?? []).map((title) => ({
      label: title.libelle,
      start: dateDraftFromEntry(title.debut),
      end: dateDraftFromEntry(title.fin),
    })),
  };
}
