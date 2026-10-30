// Saisie à la main d'une personne (T-031 du plan V1 ; PRD, UNI-01, UNI-15 ; CAR-01 ; cas limites
// CL-POL-15, CL-DON-01, CL-DON-02, CL-DON-05, CL-DON-06, CL-FAM-12, CL-FAM-17 à CL-FAM-19) : du
// brouillon d'un formulaire à la liste de changements que `recordLocalChanges` (@lignee/sync)
// enregistre, d'un seul lot. Fonctions pures, sans mot (les textes sont ceux de packages/i18n),
// sans horloge ni base. L'écran affiche et recueille ; il ne décide ni du type d'une mutation, ni
// de la validité d'une date.
//
// Conventions (ADR 0032, proposée) :
// - une date se saisit par morceaux (choix « vers », « avant »…, année, mois, jour), jamais comme
//   une phrase : aucun mot d'une langue n'est analysé ici ;
// - un lieu se saisit en texte (CAR-01), jamais par la position du téléphone ; un lieu déjà connu
//   de l'arbre (même texte, sans tenir compte de la casse ni des espaces) est réutilisé ;
// - la cause de décès et l'ancien prénom sont toujours créés au nom du rédacteur ;
// - aucune valeur saisie n'entre dans un message d'erreur : un constat est un code et un champ.
import {
  fuzzyDateSchema,
  type Calendar,
  type DateBound,
  type FuzzyDate,
  type FuzzyDateInput,
  type FuzzyDatePrecision,
} from './fuzzy-date';
import type { Fact, MultipleBirth, TitleRole } from './fact';
import type { Filiation, ParentCandidate } from './filiation';
import type { Id } from './ids';
import type { MutationEntity } from './mutation';
import { canViewFormerName, type ProfileViewer } from './profile';
import type { Gender, Name, NameOrder, NameType, Person, VitalStatus } from './person';
import type { Place, ToPlace } from './place';

// --- Dates saisies par morceaux ------------------------------------------------------------

/**
 * Choix de la date : aucune, exacte, « vers », « avant », « après », « entre », texte libre.
 * `calculated` n'est jamais proposé : une date calculée (VOX-14) est gardée telle quelle.
 */
export type DateMode =
  'none' | 'exact' | 'about' | 'before' | 'after' | 'between' | 'calculated' | 'text';

/** Une borne telle que tapée : chiffres seulement, ou vide. */
export interface DateBoundDraft {
  readonly year: string;
  readonly month: string;
  readonly day: string;
}

export interface DateDraft {
  readonly mode: DateMode;
  /** « Années 1940 » : l'année saisie est celle de la première année de la décennie. */
  readonly decade: boolean;
  readonly calendar: Calendar;
  /** La borne de « exacte », « vers », « avant », « après » ; la première de « entre ». */
  readonly from: DateBoundDraft;
  /** La seconde borne de « entre ». */
  readonly to: DateBoundDraft;
  /** Texte libre (« l'année de la grande sécheresse »). */
  readonly text: string;
}

const EMPTY_BOUND: DateBoundDraft = { year: '', month: '', day: '' };

export function emptyDateDraft(): DateDraft {
  return {
    mode: 'none',
    decade: false,
    calendar: 'gregorian',
    from: EMPTY_BOUND,
    to: EMPTY_BOUND,
    text: '',
  };
}

/** Une raison de refuser une date saisie ; le texte vient de packages/i18n. */
export type DateDraftIssueCode =
  | 'year_required'
  | 'year_invalid'
  | 'month_invalid'
  | 'day_invalid'
  | 'day_needs_month'
  | 'decade_year_invalid'
  | 'decade_no_month'
  | 'precision_differs'
  | 'range_order'
  | 'text_required'
  | 'invalid_date';

export interface DateDraftIssue {
  readonly code: DateDraftIssueCode;
  /** Où corriger : la borne (`from` pour une date seule), la seconde borne, ou le texte. */
  readonly part: 'from' | 'to' | 'text';
}

export type DateParseResult =
  | { readonly ok: true; readonly date: FuzzyDate | undefined }
  | { readonly ok: false; readonly issue: DateDraftIssue };

const DIGITS = /^\d{1,4}$/;

interface ParsedBound {
  readonly bound: { year: number; month?: number; day?: number };
  readonly precision: FuzzyDatePrecision;
}

function parseBound(
  draft: DateBoundDraft,
  decade: boolean,
  part: 'from' | 'to',
): ParsedBound | DateDraftIssue {
  const issue = (code: DateDraftIssueCode): DateDraftIssue => ({ code, part });
  const year = draft.year.trim();
  const month = draft.month.trim();
  const day = draft.day.trim();
  if (year === '') return issue('year_required');
  if (!DIGITS.test(year) || Number(year) < 1) return issue('year_invalid');
  if (decade) {
    if (month !== '' || day !== '') return issue('decade_no_month');
    if (Number(year) % 10 !== 0) return issue('decade_year_invalid');
    return { bound: { year: Number(year) }, precision: 'decade' };
  }
  if (month === '') {
    if (day !== '') return issue('day_needs_month');
    return { bound: { year: Number(year) }, precision: 'year' };
  }
  if (!/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12) {
    return issue('month_invalid');
  }
  if (day === '')
    return { bound: { year: Number(year), month: Number(month) }, precision: 'month' };
  if (!/^\d{1,2}$/.test(day) || Number(day) < 1 || Number(day) > 31) return issue('day_invalid');
  return {
    bound: { year: Number(year), month: Number(month), day: Number(day) },
    precision: 'day',
  };
}

const isIssue = (value: ParsedBound | DateDraftIssue): value is DateDraftIssue => 'code' in value;

/**
 * La date floue d'un brouillon, ou la raison du refus. Une date « entre » a deux bornes de même
 * précision, la première avant la seconde (CL-DON-06). Aucune date : `date` est `undefined`.
 */
export function parseDateDraft(draft: DateDraft): DateParseResult {
  if (draft.mode === 'none') return { ok: true, date: undefined };
  if (draft.mode === 'text') {
    const text = draft.text.trim();
    if (text === '') return { ok: false, issue: { code: 'text_required', part: 'text' } };
    return { ok: true, date: fuzzyDateSchema.parse({ qualifier: 'text', originalText: text }) };
  }
  const first = parseBound(draft.from, draft.decade, 'from');
  if (isIssue(first)) return { ok: false, issue: first };
  let input: FuzzyDateInput;
  if (draft.mode === 'between') {
    const second = parseBound(draft.to, draft.decade, 'to');
    if (isIssue(second)) return { ok: false, issue: second };
    if (second.precision !== first.precision) {
      return { ok: false, issue: { code: 'precision_differs', part: 'to' } };
    }
    input = {
      qualifier: 'between',
      precision: first.precision,
      from: first.bound,
      to: second.bound,
      calendar: draft.calendar,
    };
  } else {
    input = {
      qualifier: draft.mode,
      precision: first.precision,
      date: first.bound,
      calendar: draft.calendar,
    };
  }
  const result = fuzzyDateSchema.safeParse(input);
  if (result.success) return { ok: true, date: result.data };
  const found = result.error.issues[0];
  const range = draft.mode === 'between' && found?.message.startsWith('A range') === true;
  const day = found?.message.startsWith('Day does not exist') === true;
  const code: DateDraftIssueCode = range ? 'range_order' : day ? 'day_invalid' : 'invalid_date';
  return { ok: false, issue: { code, part: found?.path[0] === 'to' ? 'to' : 'from' } };
}

const text = (value: number | undefined): string => (value === undefined ? '' : String(value));

/** Le brouillon d'une date existante, pour la modifier. */
export function dateDraftFromDate(date: FuzzyDate | undefined): DateDraft {
  if (date === undefined) return emptyDateDraft();
  if (date.qualifier === 'text') {
    return { ...emptyDateDraft(), mode: 'text', text: date.originalText };
  }
  const bound = (value: DateBound): DateBoundDraft => ({
    year: text(value.year),
    month: text(value.month),
    day: text(value.day),
  });
  const base = { decade: date.precision === 'decade', calendar: date.calendar, text: '' };
  if (date.qualifier === 'between') {
    return { ...base, mode: 'between', from: bound(date.from), to: bound(date.to) };
  }
  return { ...base, mode: date.qualifier, from: bound(date.date), to: EMPTY_BOUND };
}

// --- Noms : découper « NOM Prénom » --------------------------------------------------------

/**
 * Sépare un nom complet écrit d'un seul tenant (CL-DON-01 : « Abenzo Lucien ») selon l'ordre
 * réglé par l'arbre : nom puis prénoms, ou prénoms puis nom. Le premier mot est le nom de famille
 * (nom d'abord), ou le dernier (prénoms d'abord) ; le reste, les prénoms. Une particule
 * (« de la Fontaine ») ou un nom composé se corrige à la main : aucune devinette. Moins de deux
 * mots : rien à séparer (`undefined`).
 */
export function splitFullName(
  fullName: string,
  order: NameOrder,
): { readonly givenNames: string; readonly surname: string } | undefined {
  const words = fullName
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '');
  if (words.length < 2) return undefined;
  if (order === 'surname_first') {
    return { surname: words[0] ?? '', givenNames: words.slice(1).join(' ') };
  }
  return { surname: words[words.length - 1] ?? '', givenNames: words.slice(0, -1).join(' ') };
}

// --- Le brouillon --------------------------------------------------------------------------

export interface NameDraft {
  /** Identifiant du nom quand on modifie un nom existant. */
  readonly id?: Id;
  readonly type: NameType;
  readonly givenNames: string;
  readonly surname: string;
  /** Une seule forme, sans prénoms ni nom de famille (CL-DON-02, CL-FAM-17). */
  readonly displayForm: string;
  readonly start: DateDraft;
  readonly end: DateDraft;
}

export interface EventDraft {
  readonly id?: Id;
  readonly date: DateDraft;
  /** Lieu écrit à la main (CAR-01). */
  readonly place: string;
}

export interface FactDraft extends EventDraft {
  /** Profession : le texte. Inutilisé pour un lieu de vie. */
  readonly value: string;
}

export interface TitleDraft {
  readonly id?: Id;
  readonly label: string;
  readonly start: DateDraft;
  readonly end: DateDraft;
}

export interface PersonDraft {
  /** « Inconnu » (UNI-01) : une place à compléter, sans nom. */
  readonly placeholder: boolean;
  readonly gender: Gender;
  readonly vitalStatus: VitalStatus;
  readonly notes: string;
  readonly names: readonly NameDraft[];
  readonly birth: EventDraft;
  readonly death: EventDraft;
  /** Cause de décès (UNI-15) : donnée de santé, du rédacteur seul. */
  readonly deathCause: { readonly id?: Id; readonly value: string };
  readonly residences: readonly FactDraft[];
  readonly occupations: readonly FactDraft[];
  readonly titles: readonly TitleDraft[];
}

export function emptyNameDraft(type: NameType = 'birth'): NameDraft {
  return {
    type,
    givenNames: '',
    surname: '',
    displayForm: '',
    start: emptyDateDraft(),
    end: emptyDateDraft(),
  };
}

export function emptyFactDraft(): FactDraft {
  return { date: emptyDateDraft(), place: '', value: '' };
}

export function emptyTitleDraft(): TitleDraft {
  return { label: '', start: emptyDateDraft(), end: emptyDateDraft() };
}

/** Brouillon d'une nouvelle personne : un nom de naissance vide à remplir. */
export function emptyPersonDraft(): PersonDraft {
  return {
    placeholder: false,
    gender: 'unspecified',
    vitalStatus: 'unknown',
    notes: '',
    names: [emptyNameDraft('birth')],
    birth: { date: emptyDateDraft(), place: '' },
    death: { date: emptyDateDraft(), place: '' },
    deathCause: { value: '' },
    residences: [],
    occupations: [],
    titles: [],
  };
}

// --- Du brouillon aux changements ----------------------------------------------------------

/** Ce que `recordLocalChanges` reçoit, plus de quoi retrouver le champ de l'écran d'un constat. */
export interface PlannedChange {
  readonly entity: Exclude<MutationEntity, 'visibility_rule'>;
  readonly entityId: Id;
  readonly operation: 'create' | 'update' | 'delete';
  readonly fields?: Record<string, unknown>;
  /** Champ de l'écran quand la mutation n'a pas de correspondance plus fine : `names.0`. */
  readonly target: string;
  /** Champ de l'écran de chacun des champs de la mutation (`placeId` : `birth.place`). */
  readonly fieldMap?: Readonly<Record<string, string>>;
}

export interface PersonPlan {
  readonly personId: Id;
  readonly changes: readonly PlannedChange[];
}

/** Un constat sur un champ du formulaire : un code, jamais la valeur. */
export interface EntryIssue {
  /** `names.0.givenNames`, `birth.date`, `titles.1.label`… ; `form` pour l'ensemble. */
  readonly field: string;
  readonly code: EntryIssueCode;
  /** Pour une date : la partie à corriger. */
  readonly part?: DateDraftIssue['part'];
}
export type EntryIssueCode =
  | DateDraftIssueCode
  | 'name_required'
  | 'title_label_required'
  | 'occupation_required'
  | 'cannot_forget_name';

const trimmed = (value: string): string => value.trim();
const nameHasContent = (name: NameDraft): boolean =>
  trimmed(name.givenNames) !== '' ||
  trimmed(name.surname) !== '' ||
  trimmed(name.displayForm) !== '';
const eventHasContent = (event: EventDraft): boolean =>
  event.date.mode !== 'none' || trimmed(event.place) !== '';
const factHasContent = (fact: FactDraft): boolean =>
  eventHasContent(fact) || trimmed(fact.value) !== '';
const titleHasContent = (title: TitleDraft): boolean =>
  trimmed(title.label) !== '' || title.start.mode !== 'none' || title.end.mode !== 'none';

/** Types de nom que la fiche accepte comme nom d'une personne connue (hors ancien prénom). */
const isCurrentType = (type: NameType): boolean => type !== 'former';

/**
 * Contrôle d'un brouillon avant d'en faire des changements : un nom (sauf « Inconnu »), des dates
 * lisibles, un libellé de titre. Les refus du modèle (`MUTATION_ISSUE_CODES`) viennent ensuite de
 * l'enregistrement et se rattachent au champ par `entryFieldForIssue`.
 */
export function validatePersonDraft(draft: PersonDraft): EntryIssue[] {
  const issues: EntryIssue[] = [];
  const checkDate = (date: DateDraft, field: string): void => {
    const result = parseDateDraft(date);
    if (!result.ok) issues.push({ field, code: result.issue.code, part: result.issue.part });
  };
  if (!draft.placeholder) {
    const named = draft.names.some((name) => nameHasContent(name) && isCurrentType(name.type));
    if (!named) issues.push({ field: 'names.0.givenNames', code: 'name_required' });
  }
  draft.names.forEach((name, index) => {
    if (draft.placeholder && name.id === undefined) return;
    // Une ligne ajoutée puis laissée vide est ignorée ; un nom existant ne se vide pas en silence.
    if (name.id !== undefined && !nameHasContent(name)) {
      issues.push({ field: `names.${String(index)}.givenNames`, code: 'cannot_forget_name' });
    }
    if (!nameHasContent(name) && name.id === undefined) return;
    checkDate(name.start, `names.${String(index)}.start`);
    checkDate(name.end, `names.${String(index)}.end`);
  });
  checkDate(draft.birth.date, 'birth.date');
  if (draft.vitalStatus === 'deceased') checkDate(draft.death.date, 'death.date');
  draft.residences.forEach((fact, index) => {
    checkDate(fact.date, `residences.${String(index)}.date`);
  });
  draft.occupations.forEach((fact, index) => {
    if (!factHasContent(fact) && fact.id === undefined) return;
    if (trimmed(fact.value) === '') {
      issues.push({ field: `occupations.${String(index)}.value`, code: 'occupation_required' });
    }
    checkDate(fact.date, `occupations.${String(index)}.date`);
  });
  draft.titles.forEach((title, index) => {
    if (!titleHasContent(title) && title.id === undefined) return;
    if (trimmed(title.label) === '') {
      issues.push({ field: `titles.${String(index)}.label`, code: 'title_label_required' });
    }
    checkDate(title.start, `titles.${String(index)}.start`);
    checkDate(title.end, `titles.${String(index)}.end`);
  });
  return issues;
}

/** Comparaison de deux valeurs de brouillon : des données simples, sans fonction. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Lieu comparé sans tenir compte de la casse ni des espaces en trop. */
export function normalizePlaceName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export interface PersonPlanOptions {
  readonly draft: PersonDraft;
  /** Brouillon de la fiche avant modification (`draftFromSource`) ; absent pour une création. */
  readonly original?: PersonDraft;
  /** Identifiant de la personne : celui de la fiche modifiée, sinon un nouveau. */
  readonly personId: Id;
  /** Compte du rédacteur : auteur des noms, faits et titres créés (UNI-15, UNI-22). */
  readonly authorAccountId: Id;
  /** Lieux déjà dans l'arbre, à réutiliser. */
  readonly places: readonly Pick<Place, 'id' | 'name'>[];
  readonly newId: () => Id;
}

type Fields = Record<string, unknown>;

/**
 * Les changements d'une saisie, dans l'ordre : lieux, fiche, noms, faits, titres. Un lot : tout
 * passe ensemble ou rien. Un nom, un fait ou un titre retiré du brouillon est supprimé ; un champ
 * qui n'a pas changé n'est pas envoyé (la file ne garde que ce que l'auteur a modifié).
 * Le brouillon doit avoir passé `validatePersonDraft`.
 */
export function planPersonChanges(options: PersonPlanOptions): PersonPlan {
  const { draft, original, personId, authorAccountId, newId } = options;
  const creating = original === undefined;
  const changes: PlannedChange[] = [];
  const places = [...options.places];

  /** Lieu écrit → identifiant d'un lieu de l'arbre (créé si besoin, avant le fait qui le cite). */
  const placeIdFor = (placeText: string, target: string): Id | undefined => {
    const name = trimmed(placeText);
    if (name === '') return undefined;
    const known = places.find(
      (place) => normalizePlaceName(place.name) === normalizePlaceName(name),
    );
    if (known !== undefined) return known.id;
    const id = newId();
    places.push({ id, name });
    changes.push({
      entity: 'place',
      entityId: id,
      operation: 'create',
      fields: { name },
      target,
    });
    return id;
  };
  const dateOf = (date: DateDraft): FuzzyDate | undefined => {
    const result = parseDateDraft(date);
    return result.ok ? result.date : undefined;
  };
  /** Les deux brouillons disent-ils la même date ? (un aller-retour de choix ne change rien) */
  const sameDate = (a: DateDraft, b: DateDraft): boolean => same(dateOf(a), dateOf(b));
  /**
   * Date modifiée à la main : une date « calculée » (VOX-14) ne l'est plus, elle devient « vers ».
   * Une date calculée qu'on n'a pas touchée n'est jamais renvoyée ici (`sameDate`).
   */
  const editedDate = (date: DateDraft): FuzzyDate | undefined =>
    dateOf(date.mode === 'calculated' ? { ...date, mode: 'about' } : date);

  // --- La fiche
  const personFields: Fields = {};
  if (creating) {
    personFields.nature = draft.placeholder ? 'placeholder' : 'known';
    personFields.gender = draft.gender;
    personFields.vitalStatus = draft.vitalStatus;
    if (trimmed(draft.notes) !== '') personFields.notes = trimmed(draft.notes);
  } else {
    if (original.placeholder && !draft.placeholder) personFields.nature = 'known';
    if (draft.gender !== original.gender) personFields.gender = draft.gender;
    if (draft.vitalStatus !== original.vitalStatus) personFields.vitalStatus = draft.vitalStatus;
    if (trimmed(draft.notes) !== trimmed(original.notes)) {
      personFields.notes = trimmed(draft.notes) === '' ? null : trimmed(draft.notes);
    }
  }
  const personChange: PlannedChange | undefined = creating
    ? {
        entity: 'person',
        entityId: personId,
        operation: 'create',
        fields: personFields,
        target: 'form',
        fieldMap: {
          nature: 'placeholder',
          gender: 'gender',
          vitalStatus: 'vitalStatus',
          notes: 'notes',
        },
      }
    : Object.keys(personFields).length > 0
      ? {
          entity: 'person',
          entityId: personId,
          operation: 'update',
          fields: personFields,
          target: 'form',
          fieldMap: {
            nature: 'placeholder',
            gender: 'gender',
            vitalStatus: 'vitalStatus',
            notes: 'notes',
          },
        }
      : undefined;

  // --- Les noms
  const nameChanges: PlannedChange[] = [];
  draft.names.forEach((name, index) => {
    // « Inconnu » : un nom saisi avant de cocher la case n'est jamais enregistré.
    if (draft.placeholder && name.id === undefined) return;
    const target = `names.${String(index)}`;
    const fieldMap = {
      type: `${target}.type`,
      givenNames: `${target}.givenNames`,
      surname: `${target}.surname`,
      displayForm: `${target}.displayForm`,
      start: `${target}.start`,
      end: `${target}.end`,
    };
    if (name.id === undefined && !nameHasContent(name)) return;
    const before = original?.names.find((candidate) => candidate.id === name.id);
    const text = (value: string): string | null => (trimmed(value) === '' ? null : trimmed(value));
    if (name.id === undefined || before === undefined) {
      const fields: Fields = { type: name.type, authorAccountId };
      for (const key of ['givenNames', 'surname', 'displayForm'] as const) {
        const value = text(name[key]);
        if (value !== null) fields[key] = value;
      }
      const start = dateOf(name.start);
      const end = dateOf(name.end);
      if (start !== undefined) fields.start = start;
      if (end !== undefined) fields.end = end;
      nameChanges.push({
        entity: 'name',
        entityId: newId(),
        operation: 'create',
        fields: { personId, ...fields },
        target,
        fieldMap: { ...fieldMap, personId: 'form', authorAccountId: 'form' },
      });
      return;
    }
    const fields: Fields = {};
    // Un ancien prénom enregistré garde son type : le changer le montrerait à toute la famille
    // (UNI-22). Il se modifie ou se supprime, il ne se « déclasse » pas.
    if (before.type !== 'former' && name.type !== before.type) fields.type = name.type;
    for (const key of ['givenNames', 'surname', 'displayForm'] as const) {
      if (trimmed(name[key]) !== trimmed(before[key])) fields[key] = text(name[key]);
    }
    if (!sameDate(name.start, before.start)) fields.start = editedDate(name.start) ?? null;
    if (!sameDate(name.end, before.end)) fields.end = editedDate(name.end) ?? null;
    if (Object.keys(fields).length > 0) {
      nameChanges.push({
        entity: 'name',
        entityId: name.id,
        operation: 'update',
        fields,
        target,
        fieldMap,
      });
    }
  });
  const keptNames = new Set(
    draft.names.flatMap((name) => (name.id === undefined ? [] : [name.id])),
  );
  const removedNames: PlannedChange[] = (original?.names ?? [])
    .filter((name) => name.id !== undefined && !keptNames.has(name.id))
    .map((name) => ({
      entity: 'name' as const,
      entityId: name.id as Id,
      operation: 'delete' as const,
      target: 'names',
    }));

  // --- Les faits (naissance, décès, cause, lieux de vie, professions)
  const factChanges: PlannedChange[] = [];
  const planFact = (config: {
    type: 'birth' | 'death' | 'death_cause' | 'residence' | 'occupation';
    target: string;
    id: Id | undefined;
    present: boolean;
    now: { date: DateDraft; place: string; value: string };
    before: { date: DateDraft; place: string; value: string } | undefined;
  }): void => {
    const { type, target, id, present, now, before } = config;
    if (!present) {
      if (id !== undefined) {
        factChanges.push({ entity: 'fact', entityId: id, operation: 'delete', target });
      }
      return;
    }
    const fieldMap = {
      date: `${target}.date`,
      placeId: `${target}.place`,
      value: type === 'death_cause' ? target : `${target}.value`,
    };
    if (id === undefined || before === undefined) {
      const fields: Fields = {
        subject: { kind: 'person', personId },
        type,
        authorAccountId,
      };
      const date = dateOf(now.date);
      if (date !== undefined) fields.date = date;
      const placeId = type === 'death_cause' ? undefined : placeIdFor(now.place, `${target}.place`);
      if (placeId !== undefined) fields.placeId = placeId;
      if (trimmed(now.value) !== '') fields.value = trimmed(now.value);
      factChanges.push({
        entity: 'fact',
        entityId: newId(),
        operation: 'create',
        fields,
        target,
        fieldMap: { ...fieldMap, subject: 'form', type: 'form', authorAccountId: 'form' },
      });
      return;
    }
    const fields: Fields = {};
    if (!sameDate(now.date, before.date)) fields.date = editedDate(now.date) ?? null;
    if (normalizePlaceName(now.place) !== normalizePlaceName(before.place)) {
      fields.placeId = placeIdFor(now.place, `${target}.place`) ?? null;
    }
    if (trimmed(now.value) !== trimmed(before.value)) {
      fields.value = trimmed(now.value) === '' ? null : trimmed(now.value);
    }
    if (Object.keys(fields).length > 0) {
      factChanges.push({
        entity: 'fact',
        entityId: id,
        operation: 'update',
        fields,
        target,
        fieldMap,
      });
    }
  };
  const asFact = (event: EventDraft, value = ''): FactDraft => ({ ...event, value });
  const deceased = draft.vitalStatus === 'deceased';
  planFact({
    type: 'birth',
    target: 'birth',
    id: draft.birth.id,
    present: eventHasContent(draft.birth),
    now: asFact(draft.birth),
    before: original === undefined ? undefined : asFact(original.birth),
  });
  planFact({
    type: 'death',
    target: 'death',
    id: draft.death.id,
    present: deceased && eventHasContent(draft.death),
    now: asFact(draft.death),
    before: original === undefined ? undefined : asFact(original.death),
  });
  planFact({
    type: 'death_cause',
    target: 'deathCause',
    id: draft.deathCause.id,
    present: deceased && trimmed(draft.deathCause.value) !== '',
    now: { date: emptyDateDraft(), place: '', value: draft.deathCause.value },
    before:
      original === undefined
        ? undefined
        : { date: emptyDateDraft(), place: '', value: original.deathCause.value },
  });
  const planList = (list: 'residences' | 'occupations', type: 'residence' | 'occupation'): void => {
    draft[list].forEach((fact, index) => {
      const hasContent = factHasContent(fact);
      if (fact.id === undefined && !hasContent) return;
      const before = original?.[list].find((candidate) => candidate.id === fact.id);
      planFact({
        type,
        target: `${list}.${String(index)}`,
        id: fact.id,
        present: hasContent,
        now: fact,
        before,
      });
    });
    const kept = new Set(draft[list].flatMap((fact) => (fact.id === undefined ? [] : [fact.id])));
    for (const fact of original?.[list] ?? []) {
      if (fact.id !== undefined && !kept.has(fact.id)) {
        factChanges.push({ entity: 'fact', entityId: fact.id, operation: 'delete', target: list });
      }
    }
  };
  planList('residences', 'residence');
  planList('occupations', 'occupation');

  // --- Les titres (CL-FAM-19)
  const titleChanges: PlannedChange[] = [];
  draft.titles.forEach((title, index) => {
    const target = `titles.${String(index)}`;
    const fieldMap = {
      label: `${target}.label`,
      start: `${target}.start`,
      end: `${target}.end`,
    };
    if (title.id === undefined && !titleHasContent(title)) return;
    const before = original?.titles.find((candidate) => candidate.id === title.id);
    if (title.id === undefined || before === undefined) {
      const fields: Fields = { personId, label: trimmed(title.label), authorAccountId };
      const start = dateOf(title.start);
      const end = dateOf(title.end);
      if (start !== undefined) fields.start = start;
      if (end !== undefined) fields.end = end;
      titleChanges.push({
        entity: 'title_role',
        entityId: newId(),
        operation: 'create',
        fields,
        target,
        fieldMap: { ...fieldMap, personId: 'form', authorAccountId: 'form' },
      });
      return;
    }
    const fields: Fields = {};
    if (trimmed(title.label) !== trimmed(before.label)) fields.label = trimmed(title.label);
    if (!sameDate(title.start, before.start)) fields.start = editedDate(title.start) ?? null;
    if (!sameDate(title.end, before.end)) fields.end = editedDate(title.end) ?? null;
    if (Object.keys(fields).length > 0) {
      titleChanges.push({
        entity: 'title_role',
        entityId: title.id,
        operation: 'update',
        fields,
        target,
        fieldMap,
      });
    }
  });
  const keptTitles = new Set(
    draft.titles.flatMap((title) => (title.id === undefined ? [] : [title.id])),
  );
  for (const title of original?.titles ?? []) {
    if (title.id !== undefined && !keptTitles.has(title.id)) {
      titleChanges.push({
        entity: 'title_role',
        entityId: title.id,
        operation: 'delete',
        target: 'titles',
      });
    }
  }

  // Lieux d'abord (déjà poussés par `placeIdFor`), puis la fiche : un lot lisible dans l'ordre.
  const placeChanges = changes.filter((change) => change.entity === 'place');
  return {
    personId,
    changes: [
      ...(personChange === undefined || !creating ? [] : [personChange]),
      ...placeChanges,
      ...(personChange === undefined || creating ? [] : [personChange]),
      ...nameChanges,
      ...removedNames,
      ...factChanges,
      ...titleChanges,
    ],
  };
}

// --- Du constat au champ de l'écran --------------------------------------------------------

/** Constat de l'enregistrement : un code et un chemin (`mutations[2].fields.start.date.year`). */
export interface RecordIssue {
  readonly code: string;
  readonly path: string;
}

const RANK = /^mutations\[(\d+)\](?:\.fields\.([A-Za-z]+))?/u;

/**
 * Le champ de l'écran qu'un refus de l'enregistrement désigne. Les chemins des constats donnent
 * le rang de la mutation (celui de `plan.changes`) et son champ ; quand le constat ne désigne
 * qu'une mutation (`person_without_name`, `coherence_refusal`…), c'est l'objet de cette mutation
 * ou, pour le nom manquant, la liste des noms. `form` si rien de plus précis.
 */
export function entryFieldForIssue(plan: PersonPlan, issue: RecordIssue): string {
  if (issue.code === 'person_without_name') return 'names.0.givenNames';
  const match = RANK.exec(issue.path);
  if (match === null) return 'form';
  const change = plan.changes[Number(match[1])];
  if (change === undefined) return 'form';
  const field = match[2];
  const found =
    field !== undefined && change.fieldMap?.[field] !== undefined
      ? change.fieldMap[field]
      : change.target;
  // Un champ que le formulaire n'affiche pas (version de départ, auteur, cible d'un bloc) ne
  // doit pas faire perdre le refus : il remonte à l'ensemble du formulaire.
  return DISPLAYED_FIELD.test(found) ? found : 'form';
}

/** Champs qui montrent une erreur dans le formulaire (voir PersonFormFields et PersonFormScreen). */
const DISPLAYED_FIELD =
  /^(?:names\.\d+\.(?:givenNames|surname|displayForm|start|end)|birth\.(?:date|place)|death\.(?:date|place)|deathCause|(?:residences|occupations)\.\d+\.(?:value|place|date)|titles\.\d+\.(?:label|start|end)|notes)$/u;

// --- Du brouillon au plan : lecture d'une fiche existante ----------------------------------

/** Ce que la saisie lit de la copie locale : l'arbre du lecteur. */
export interface EntrySource {
  readonly people: readonly Person[];
  readonly names: readonly Name[];
  readonly facts: readonly Fact[];
  readonly titleRoles: readonly TitleRole[];
  readonly places: readonly Place[];
}

/**
 * Le brouillon d'une fiche existante, pour la modifier, lu dans la copie locale du lecteur. Un
 * ancien prénom n'y figure que si `canViewFormerName` l'y autorise ; la cause de décès, que si le
 * lecteur en est l'auteur (la copie ne contient pas celle des autres).
 */
export function draftFromSource(
  source: EntrySource,
  personId: Id,
  viewer: ProfileViewer,
): PersonDraft | undefined {
  const person = source.people.find((candidate) => candidate.id === personId);
  if (person === undefined) return undefined;
  const placeName = (placeId: Id | undefined): string =>
    placeId === undefined ? '' : (source.places.find((place) => place.id === placeId)?.name ?? '');
  const facts = source.facts.filter(
    (fact) => fact.subject.kind === 'person' && fact.subject.personId === personId,
  );
  const eventOf = (type: Fact['type']): EventDraft => {
    const fact = facts.find((candidate) => candidate.type === type);
    if (fact === undefined) return { date: emptyDateDraft(), place: '' };
    return {
      id: fact.id,
      date: dateDraftFromDate(fact.date),
      place: placeName(fact.placeId),
    };
  };
  const cause = facts.find(
    (fact) => fact.type === 'death_cause' && fact.authorAccountId === viewer.accountId,
  );
  const listOf = (type: Fact['type']): FactDraft[] =>
    facts
      .filter((fact) => fact.type === type)
      .map((fact) => ({
        id: fact.id,
        date: dateDraftFromDate(fact.date),
        place: placeName(fact.placeId),
        value: fact.value ?? '',
      }));
  const names = source.names
    .filter(
      (name) =>
        name.personId === personId && (name.type !== 'former' || canViewFormerName(name, viewer)),
    )
    .map((name): NameDraft => ({
      id: name.id,
      type: name.type,
      givenNames: name.givenNames ?? '',
      surname: name.surname ?? '',
      displayForm: name.displayForm ?? '',
      start: dateDraftFromDate(name.start),
      end: dateDraftFromDate(name.end),
    }));
  return {
    placeholder: person.nature === 'placeholder',
    gender: person.gender,
    vitalStatus: person.vitalStatus,
    notes: person.notes ?? '',
    names: names.length > 0 ? names : [emptyNameDraft('birth')],
    birth: eventOf('birth'),
    death: eventOf('death'),
    deathCause: cause === undefined ? { value: '' } : { id: cause.id, value: cause.value ?? '' },
    residences: listOf('residence'),
    occupations: listOf('occupation'),
    titles: source.titleRoles
      .filter((title) => title.personId === personId)
      .map((title) => ({
        id: title.id,
        label: title.label,
        start: dateDraftFromDate(title.start),
        end: dateDraftFromDate(title.end),
      })),
  };
}

// --- Ancien prénom (UNI-22) ----------------------------------------------------------------

/**
 * Faut-il proposer de ranger le prénom d'un nom de naissance comme ancien prénom ? Oui quand la
 * fiche dit déjà quelque chose d'une transition (un ancien prénom, ou un genre renseigné), qu'un
 * nom de naissance a des prénoms, et qu'un autre nom en cours porte d'autres prénoms : le prénom
 * de naissance saisi est peut-être celui que la personne a quitté, et il serait alors visible de
 * toute la famille. Seule une question : rien ne change sans que la personne qui saisit l'accepte
 * (ADR 0032). Renvoie l'indice du nom de naissance concerné.
 */
export function suggestFormerNameIndex(draft: PersonDraft): number | undefined {
  const hasFormer = draft.names.some((name) => name.type === 'former' && nameHasContent(name));
  if (!hasFormer && draft.gender === 'unspecified') return undefined;
  const lower = (value: string) => trimmed(value).toLowerCase();
  const current = draft.names.filter(
    (name) => name.type === 'usage' && name.end.mode === 'none' && trimmed(name.givenNames) !== '',
  );
  if (current.length === 0) return undefined;
  const index = draft.names.findIndex(
    (name) => name.type === 'birth' && trimmed(name.givenNames) !== '',
  );
  if (index < 0) return undefined;
  const birthGiven = lower(draft.names[index]?.givenNames ?? '');
  return current.some((name) => lower(name.givenNames) !== birthGiven) ? index : undefined;
}

/**
 * Range le prénom d'un nom de naissance en ancien prénom : le nom devient `former` (visible de
 * son auteur seul) et ne garde que ses prénoms ; le nom de famille de naissance reste à la fiche
 * comme un nom de naissance à part, s'il y en a un. Le résultat sépare donc les deux, pour que le
 * nom de famille ne soit pas caché avec le prénom.
 */
export function moveGivenNamesToFormer(draft: PersonDraft, index: number): PersonDraft {
  const name = draft.names[index];
  if (name === undefined || name.type !== 'birth') return draft;
  const former: NameDraft = {
    ...emptyNameDraft('former'),
    givenNames: name.givenNames,
  };
  const keepsSurname = trimmed(name.surname) !== '';
  const rest: NameDraft = { ...name, givenNames: '' };
  const names = draft.names.flatMap((entry, at): NameDraft[] => {
    if (at !== index) return [entry];
    return keepsSurname ? [rest, former] : [former];
  });
  return { ...draft, names };
}

// --- Suppression d'une personne (ADR 0027) -------------------------------------------------

/** L'arbre complet de la copie locale, pour lister ce qui dépend d'une personne. */
export interface DeletionSource {
  readonly people: readonly {
    readonly id: Id;
    readonly distinctFrom?: readonly Id[] | undefined;
  }[];
  readonly names: readonly Pick<Name, 'id' | 'personId'>[];
  readonly unions: readonly {
    readonly id: Id;
    readonly spouses: readonly { readonly personId: Id }[];
  }[];
  readonly simultaneityAnswers: readonly { readonly id: Id; readonly unionIds: readonly Id[] }[];
  readonly filiations: readonly Pick<Filiation, 'id' | 'parentId' | 'childId' | 'originUnionId'>[];
  readonly parentCandidates: readonly Pick<ParentCandidate, 'id' | 'childId' | 'candidateId'>[];
  readonly facts: readonly Pick<Fact, 'id' | 'subject' | 'filiationId'>[];
  readonly titleRoles: readonly Pick<TitleRole, 'id' | 'personId'>[];
  readonly multipleBirths: readonly MultipleBirth[];
  readonly toPlace: readonly Pick<ToPlace, 'id' | 'personId' | 'referencePersonId'>[];
}

/** Ce que la suppression emporte, pour le dire avant de confirmer. */
export interface DeletionSummary {
  readonly names: number;
  readonly facts: number;
  readonly titles: number;
  /** Liens de parenté et candidats parents. */
  readonly links: number;
  readonly unions: number;
}

export interface DeletionPlan {
  readonly personId: Id;
  readonly changes: readonly PlannedChange[];
  readonly summary: DeletionSummary;
}

/**
 * Le lot qui supprime une personne avec tout ce qui la cite : ses noms, ses faits et ses titres,
 * ses liens de filiation et de candidature, ses unions (avec leurs faits et leurs réponses
 * « simultanées ou successives »), ses places « À placer ». Ce qui cite aussi d'autres
 * personnes est corrigé et non supprimé : l'union d'origine d'une filiation, une naissance
 * multiple qui garde deux enfants, le « n'est pas » d'une place à compléter. Pas de cascade
 * implicite : tout est dans le lot, donc visible avant la confirmation (ADR 0027).
 */
export function planPersonDeletion(source: DeletionSource, personId: Id): DeletionPlan {
  const changes: PlannedChange[] = [];
  const deleted = new Set<Id>();
  const remove = (entity: PlannedChange['entity'], id: Id): void => {
    if (deleted.has(id)) return;
    deleted.add(id);
    changes.push({ entity, entityId: id, operation: 'delete', target: 'form' });
  };

  const names = source.names.filter((name) => name.personId === personId);
  const titles = source.titleRoles.filter((title) => title.personId === personId);
  const filiations = source.filiations.filter(
    (link) => link.parentId === personId || link.childId === personId,
  );
  const candidates = source.parentCandidates.filter(
    (entry) => entry.childId === personId || entry.candidateId === personId,
  );
  const unions = source.unions.filter((union) =>
    union.spouses.some((spouse) => spouse.personId === personId),
  );
  const unionIds = new Set(unions.map((union) => union.id));
  const filiationIds = new Set(filiations.map((link) => link.id));
  const facts = source.facts.filter(
    (fact) =>
      (fact.subject.kind === 'person' && fact.subject.personId === personId) ||
      (fact.subject.kind === 'union' && unionIds.has(fact.subject.unionId)) ||
      (fact.filiationId !== undefined && filiationIds.has(fact.filiationId)),
  );
  const answers = source.simultaneityAnswers.filter((answer) =>
    answer.unionIds.some((id) => unionIds.has(id)),
  );

  for (const name of names) remove('name', name.id);
  for (const title of titles) remove('title_role', title.id);
  for (const fact of facts) remove('fact', fact.id);
  for (const answer of answers) remove('simultaneity_answer', answer.id);
  for (const entry of candidates) remove('parent_candidate', entry.id);
  for (const link of filiations) remove('filiation', link.id);
  for (const entry of source.toPlace) {
    if (entry.personId === personId || entry.referencePersonId === personId) {
      remove('to_place', entry.id);
    }
  }

  // Les liens des autres qui citent une union supprimée gardent leur parent : seule l'union
  // d'origine est retirée.
  for (const link of source.filiations) {
    if (deleted.has(link.id)) continue;
    if (link.originUnionId !== undefined && unionIds.has(link.originUnionId)) {
      changes.push({
        entity: 'filiation',
        entityId: link.id,
        operation: 'update',
        fields: { originUnionId: null },
        target: 'form',
      });
    }
  }
  for (const union of unions) remove('union', union.id);

  for (const birth of source.multipleBirths) {
    if (!birth.members.some((member) => member.personId === personId)) continue;
    const members = birth.members.filter((member) => member.personId !== personId);
    if (members.length >= 2) {
      changes.push({
        entity: 'multiple_birth',
        entityId: birth.id,
        operation: 'update',
        fields: { members },
        target: 'form',
      });
    } else {
      remove('multiple_birth', birth.id);
    }
  }
  for (const other of source.people) {
    if (other.distinctFrom === undefined || !other.distinctFrom.includes(personId)) continue;
    const rest = other.distinctFrom.filter((id) => id !== personId);
    changes.push({
      entity: 'person',
      entityId: other.id,
      operation: 'update',
      fields: { distinctFrom: rest.length > 0 ? rest : null },
      target: 'form',
    });
  }
  remove('person', personId);

  return {
    personId,
    changes,
    summary: {
      names: names.length,
      facts: facts.length,
      titles: titles.length,
      links: filiations.length + candidates.length,
      unions: unions.length,
    },
  };
}
