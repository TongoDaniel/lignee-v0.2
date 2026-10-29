// Mots de la saisie d'une personne (T-031 du plan V1) : des codes que les paquets calculent
// (dates, brouillon, refus de l'enregistrement, alertes de cohérence) au texte de la langue en
// cours. Les tables sont typées : un code de plus sans message ne compile pas. Aucune valeur
// saisie n'entre dans un message.
import type { CoherenceCode, DateDraftIssueCode, EntryIssueCode } from '@lignee/domain';
import type { MessageKey, Translator } from '@lignee/i18n';
import type { MutationIssueCode } from '@lignee/sync';

const DATE_KEYS = {
  year_required: 'common:personForm.date.errors.yearRequired',
  year_invalid: 'common:personForm.date.errors.yearInvalid',
  month_invalid: 'common:personForm.date.errors.monthInvalid',
  day_invalid: 'common:personForm.date.errors.dayInvalid',
  day_needs_month: 'common:personForm.date.errors.dayNeedsMonth',
  decade_year_invalid: 'common:personForm.date.errors.decadeYearInvalid',
  decade_no_month: 'common:personForm.date.errors.decadeNoMonth',
  precision_differs: 'common:personForm.date.errors.precisionDiffers',
  range_order: 'common:personForm.date.errors.rangeOrder',
  text_required: 'common:personForm.date.errors.textRequired',
  invalid_date: 'common:personForm.date.errors.invalidDate',
} as const satisfies Record<DateDraftIssueCode, MessageKey>;

const ENTRY_KEYS = {
  name_required: 'common:personForm.errors.nameRequired',
  cannot_forget_name: 'common:personForm.errors.cannotForgetName',
  title_label_required: 'common:personForm.errors.titleLabelRequired',
  occupation_required: 'common:personForm.errors.occupationRequired',
} as const satisfies Record<Exclude<EntryIssueCode, DateDraftIssueCode>, MessageKey>;

/** Refus de l'enregistrement (`MUTATION_ISSUE_CODES` de @lignee/sync, ADR 0027). */
export const RECORD_ISSUE_KEYS = {
  unknown_tree: 'common:personForm.errors.record.unknownTree',
  foreign_author: 'common:personForm.errors.record.foreignAuthor',
  duplicate_mutation: 'common:personForm.errors.record.duplicateMutation',
  duplicate_id: 'common:personForm.errors.record.duplicateId',
  unknown_object: 'common:personForm.errors.record.unknownObject',
  invalid_object: 'common:personForm.errors.record.invalidObject',
  dangling_reference: 'common:personForm.errors.record.danglingReference',
  unsupported_reference: 'common:personForm.errors.record.unsupportedReference',
  author_mismatch: 'common:personForm.errors.record.authorMismatch',
  person_without_name: 'common:personForm.errors.record.personWithoutName',
  invalid_simultaneity_answer: 'common:personForm.errors.record.invalidSimultaneityAnswer',
  duplicate_visibility_rule: 'common:personForm.errors.record.duplicateVisibilityRule',
  base_version_mismatch: 'common:personForm.errors.record.baseVersionMismatch',
  coherence_refusal: 'common:personForm.errors.record.coherenceRefusal',
  privacy_barrier: 'common:personForm.errors.record.privacyBarrier',
} as const satisfies Record<MutationIssueCode, MessageKey>;

/** Alertes de dates qu'on peut passer outre (UNI-18) ; les refus de lien ne viennent pas d'ici. */
const COHERENCE_KEYS = {
  death_before_birth: 'common:personForm.coherence.deathBeforeBirth',
  implausible_age: 'common:personForm.coherence.implausibleAge',
  parent_younger_than_child: 'common:personForm.coherence.parentYoungerThanChild',
  parent_too_young: 'common:personForm.coherence.parentTooYoung',
  born_long_after_father_death: 'common:personForm.coherence.bornLongAfterFatherDeath',
  born_after_mother_death: 'common:personForm.coherence.bornAfterMotherDeath',
} as const satisfies Partial<Record<CoherenceCode, MessageKey>>;

export function entryIssueText(translator: Translator, code: EntryIssueCode): string {
  const key = code in DATE_KEYS ? DATE_KEYS[code as DateDraftIssueCode] : undefined;
  if (key !== undefined) return translator.t(key);
  return translator.t(ENTRY_KEYS[code as keyof typeof ENTRY_KEYS]);
}

export function dateIssueText(translator: Translator, code: DateDraftIssueCode): string {
  return translator.t(DATE_KEYS[code]);
}

/** Texte d'un refus de l'enregistrement ; un code inconnu (autre version) tombe sur le générique. */
export function recordIssueText(translator: Translator, code: string): string {
  const key = (RECORD_ISSUE_KEYS as Record<string, MessageKey | undefined>)[code];
  return key === undefined
    ? translator.t('common:personForm.saveFailed')
    : (translator.t as (key: MessageKey) => string)(key);
}

/** Texte d'une alerte de cohérence ; `undefined` pour un code qui n'est pas une alerte de date. */
export function coherenceText(translator: Translator, code: CoherenceCode): string | undefined {
  const key = (COHERENCE_KEYS as Partial<Record<CoherenceCode, MessageKey>>)[code];
  return key === undefined ? undefined : (translator.t as (key: MessageKey) => string)(key);
}
