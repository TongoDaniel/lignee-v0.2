// Date floue (TRD, « Modèle de données » ; PRD, VOX-14 ; cas limites CL-DON-05, CL-DON-06,
// CL-VOI-16). Conventions que le cahier ne fixe pas : ADR 0009 (proposée).
//
// Une date floue est un objet : qualificatif (exacte, vers, avant, après, entre, calculée,
// texte), précision (jour, mois, année, décennie), une ou deux bornes, le texte d'origine et le
// calendrier. C'est une union discriminée sur `qualifier` ; la forme « texte » de T-004
// (`{ qualifier: 'text', originalText }`) en reste une branche, inchangée. La clé de tri n'est
// pas stockée dans l'objet : elle en est déduite (`fuzzyDateSortKey`) pour la colonne de tri.
//
// Le calendrier est gardé tel quel, sans conversion (CL-DON-07 est V2) : une date d'un autre
// calendrier que le grégorien se range en fin, avec le texte libre, jusqu'à la conversion.
import { z } from 'zod';

import { textSchema } from './common';

/** Précision d'une date : jour, mois, année, décennie. */
export const fuzzyDatePrecisionSchema = z.enum(['day', 'month', 'year', 'decade']);
export type FuzzyDatePrecision = z.infer<typeof fuzzyDatePrecisionSchema>;

/**
 * Calendrier de la date saisie. Seul le grégorien a une place dans le tri en V1 ; l'hégirien
 * est gardé sans conversion (CL-DON-07, V2).
 */
export const calendarSchema = z.enum(['gregorian', 'hijri']);
export type Calendar = z.infer<typeof calendarSchema>;

/** Plus petite et plus grande année admises dans une borne. */
export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;

/**
 * Une borne : une année et, selon la précision, un mois et un jour. Une décennie s'écrit par sa
 * première année (1940 pour « les années 1940 »).
 */
export const dateBoundSchema = z.strictObject({
  year: z.int().min(MIN_YEAR).max(MAX_YEAR),
  month: z.int().min(1).max(12).optional(),
  day: z.int().min(1).max(31).optional(),
});
export type DateBound = z.infer<typeof dateBoundSchema>;

/** Qualificatifs à une seule borne. */
export const singleBoundQualifiers = ['exact', 'about', 'before', 'after', 'calculated'] as const;
export type SingleBoundQualifier = (typeof singleBoundQualifiers)[number];

/** Champs communs aux dates qui ont des bornes. */
const datedFields = {
  precision: fuzzyDatePrecisionSchema,
  /** Texte d'origine, tel qu'il a été dit ou écrit, s'il y en a un (« vers 1940 »). */
  originalText: textSchema.optional(),
  calendar: calendarSchema.default('gregorian'),
};

const singleBound = <Q extends SingleBoundQualifier>(qualifier: Q) =>
  z.strictObject({ qualifier: z.literal(qualifier), date: dateBoundSchema, ...datedFields });

const fuzzyDateShape = z.discriminatedUnion('qualifier', [
  /** Exacte, à la précision donnée (« 1940 » : l'année est sûre). */
  singleBound('exact'),
  /** Vers (« vers 1940 »). */
  singleBound('about'),
  /** Avant (« avant 1940 ») : avant le premier jour de la borne. */
  singleBound('before'),
  /** Après (« après 1940 ») : après le dernier jour de la borne. */
  singleBound('after'),
  /** Calculée (« mort à 80 ans en 2010 » : née vers 1930), toujours approximative (VOX-14). */
  singleBound('calculated'),
  /** Entre deux bornes ordonnées et distinctes, de même précision (« entre 1935 et 1940 »). */
  z.strictObject({
    qualifier: z.literal('between'),
    from: dateBoundSchema,
    to: dateBoundSchema,
    ...datedFields,
  }),
  /** Texte seul, gardé tel quel (« l'année de l'éclipse ») : la forme de T-004, inchangée. */
  z.strictObject({
    qualifier: z.literal('text'),
    /** Texte d'origine, tel qu'il a été dit ou écrit (« vers 1940 », « l'année de l'éclipse »). */
    originalText: z.string().trim().min(1),
  }),
]);

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Jours d'un mois : grégorien réel ; hégirien sans table, 30 au plus (pas de conversion en V1). */
function daysInMonth(calendar: Calendar, year: number, month: number): number {
  if (calendar === 'hijri') return 30;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Erreurs d'une borne au regard de la précision et du calendrier. */
function boundIssues(
  bound: DateBound,
  precision: FuzzyDatePrecision,
  calendar: Calendar,
): string[] {
  const issues: string[] = [];
  const needsMonth = precision === 'day' || precision === 'month';
  if (needsMonth !== (bound.month !== undefined)) {
    issues.push(needsMonth ? 'Month required by precision' : 'Month not allowed by precision');
  }
  if ((precision === 'day') !== (bound.day !== undefined)) {
    issues.push(precision === 'day' ? 'Day required by precision' : 'Day not allowed by precision');
  }
  if (precision === 'decade' && bound.year % 10 !== 0) {
    issues.push('A decade starts on a year ending in 0');
  }
  if (
    bound.month !== undefined &&
    bound.day !== undefined &&
    bound.day > daysInMonth(calendar, bound.year, bound.month)
  ) {
    issues.push('Day does not exist in this month');
  }
  return issues;
}

/** Ordre de deux bornes de même précision et de même calendrier. */
function compareBounds(a: DateBound, b: DateBound): number {
  return a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.day ?? 0) - (b.day ?? 0);
}

export const fuzzyDateSchema = fuzzyDateShape.superRefine((date, context) => {
  if (date.qualifier === 'text') return;
  const check = (bound: DateBound, path: 'date' | 'from' | 'to') => {
    for (const message of boundIssues(bound, date.precision, date.calendar)) {
      context.addIssue({ code: 'custom', message, path: [path] });
    }
  };
  if (date.qualifier === 'between') {
    check(date.from, 'from');
    check(date.to, 'to');
    if (compareBounds(date.from, date.to) >= 0) {
      context.addIssue({
        code: 'custom',
        message: 'A range needs two ordered, distinct bounds',
        path: ['to'],
      });
    }
  } else {
    check(date.date, 'date');
  }
});
export type FuzzyDate = z.infer<typeof fuzzyDateSchema>;
export type FuzzyDateInput = z.input<typeof fuzzyDateSchema>;
export type FuzzyDateQualifier = FuzzyDate['qualifier'];

/** Date floue gardée comme texte (qualificatif « texte »). */
export function fuzzyDateFromText(originalText: string): FuzzyDate {
  return fuzzyDateSchema.parse({ qualifier: 'text', originalText });
}

/**
 * Approximative : tout sauf une date exacte. Une date calculée l'est toujours (VOX-14), un texte
 * libre aussi.
 */
export function isApproximate(date: FuzzyDate): boolean {
  return date.qualifier !== 'exact';
}

// --- Jours du calendrier grégorien ---------------------------------------------------------

/** Un jour du calendrier grégorien proleptique. */
export interface CalendarDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Numéro d'un jour, depuis le 1970-01-01 (« days from civil », H. Hinnant). */
function dayNumber({ year, month, day }: CalendarDay): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/** Jour d'un numéro (« civil from days », H. Hinnant). */
function dayFromNumber(number: number): CalendarDay {
  const shiftedNumber = number + 719_468;
  const era = Math.floor(shiftedNumber / 146_097);
  const dayOfEra = shiftedNumber - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Premier et dernier jour couverts par une borne grégorienne, à sa précision. */
function boundDays(bound: DateBound, precision: FuzzyDatePrecision): [number, number] {
  const { year } = bound;
  const month = bound.month ?? 1;
  switch (precision) {
    case 'day': {
      const day = dayNumber({ year, month, day: bound.day ?? 1 });
      return [day, day];
    }
    case 'month':
      return [
        dayNumber({ year, month, day: 1 }),
        dayNumber({ year, month, day: daysInMonth('gregorian', year, month) }),
      ];
    case 'year':
      return [dayNumber({ year, month: 1, day: 1 }), dayNumber({ year, month: 12, day: 31 })];
    case 'decade':
      return [
        dayNumber({ year, month: 1, day: 1 }),
        dayNumber({ year: year + 9, month: 12, day: 31 }),
      ];
  }
}

type DaySpan = readonly [earliest: number | undefined, latest: number | undefined];

function daySpan(date: FuzzyDate): DaySpan | undefined {
  if (date.qualifier === 'text' || date.calendar !== 'gregorian') return undefined;
  if (date.qualifier === 'between') {
    return [boundDays(date.from, date.precision)[0], boundDays(date.to, date.precision)[1]];
  }
  const [first, last] = boundDays(date.date, date.precision);
  if (date.qualifier === 'before') return [undefined, first - 1];
  if (date.qualifier === 'after') return [last + 1, undefined];
  return [first, last];
}

/**
 * Étendue nominale d'une date grégorienne : premier et dernier jour possibles, `undefined` du
 * côté ouvert (« avant », « après »). « Vers » et « calculée » prennent l'étendue de leur borne,
 * sans marge : la marge d'une date approximative relève des contrôles de cohérence (T-007).
 * Renvoie `undefined` pour un texte libre ou un autre calendrier (pas de conversion en V1).
 */
export function fuzzyDateSpan(
  date: FuzzyDate,
): { earliest: CalendarDay | undefined; latest: CalendarDay | undefined } | undefined {
  const span = daySpan(date);
  if (span === undefined) return undefined;
  const [earliest, latest] = span;
  return {
    earliest: earliest === undefined ? undefined : dayFromNumber(earliest),
    latest: latest === undefined ? undefined : dayFromNumber(latest),
  };
}

// --- Clé de tri ----------------------------------------------------------------------------

/** Clé d'une date sans place dans le tri : texte libre ou autre calendrier. */
export const UNDATED_SORT_KEY = '1';
/** Clé d'une date absente : après tout le reste. */
export const MISSING_SORT_KEY = '2';

const RANK_CODE: Record<Exclude<FuzzyDateQualifier, 'text'>, string> = {
  after: '0',
  exact: '5',
  calculated: '5',
  about: '5',
  between: '5',
  before: '9',
};
const PRECISION_CODE: Record<FuzzyDatePrecision, string> = {
  decade: '1',
  year: '2',
  month: '3',
  day: '4',
};
const QUALIFIER_CODE: Record<Exclude<FuzzyDateQualifier, 'text'>, string> = {
  after: '0',
  exact: '1',
  calculated: '2',
  about: '3',
  between: '4',
  before: '9',
};

/** Jour sur une largeur fixe : année sur cinq chiffres (de 00000 à 10000), mois, jour. */
function formatDay(number: number): string {
  const { year, month, day } = dayFromNumber(number);
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return `${pad(year, 5)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Clé de tri déduite d'une date floue (colonne de tri du TRD). Chaîne à comparer code par code
 * (`<` en JavaScript, collation « C » en base), jamais avec les règles d'une langue.
 *
 * Forme : `0:AAAAA-MM-JJ:R:P:Q`, suivie de `:AAAAA-MM-JJ` (dernier jour) pour « entre ».
 * - Le jour est pris dans l'étendue nominale : le premier jour pour exacte, vers, calculée et
 *   entre ; la veille du début de la borne pour « avant » ; le lendemain de sa fin pour
 *   « après ». Une date qui finit avant qu'une autre commence a donc une clé plus petite.
 * - Au même jour (R, P, Q) : « après » d'abord, « avant » en dernier ; entre les deux, du moins
 *   précis au plus précis, puis exacte, calculée, vers, entre (le plus court d'abord).
 * - Texte libre et autre calendrier ensuite (`UNDATED_SORT_KEY`), puis date absente
 *   (`MISSING_SORT_KEY`) ; entre eux, un tri stable garde l'ordre d'arrivée.
 *
 * Deux dates grégoriennes ont la même clé si et seulement si elles disent la même chose (texte
 * d'origine mis à part).
 */
export function fuzzyDateSortKey(date: FuzzyDate | undefined): string {
  if (date === undefined) return MISSING_SORT_KEY;
  const span = daySpan(date);
  if (span === undefined || date.qualifier === 'text') return UNDATED_SORT_KEY;
  const [earliest, latest] = span;
  const point = (date.qualifier === 'before' ? latest : earliest) ?? 0;
  const key = [
    '0',
    formatDay(point),
    RANK_CODE[date.qualifier],
    PRECISION_CODE[date.precision],
    QUALIFIER_CODE[date.qualifier],
  ];
  if (date.qualifier === 'between') key.push(formatDay(latest ?? 0));
  return key.join(':');
}

/** Comparaison de deux dates floues par leur clé de tri : -1, 0 ou 1. */
export function compareFuzzyDates(a: FuzzyDate | undefined, b: FuzzyDate | undefined): number {
  const left = fuzzyDateSortKey(a);
  const right = fuzzyDateSortKey(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

// --- Calcul (VOX-14) -----------------------------------------------------------------------

/**
 * Naissance déduite d'un âge atteint à une date (« mort à 80 ans en 2010 » : née vers 1930).
 * Le résultat est une date calculée, donc approximative (VOX-14), à l'année : année de la
 * référence moins l'âge, dans le calendrier de la référence. Renvoie `undefined` quand le calcul
 * ne donne pas une année : référence en texte, à la décennie, ou bornée par « avant », « après »
 * ou « entre » ; âge négatif ou non entier ; année hors limites. La date dite reste alors celle
 * qui est gardée.
 */
export function birthDateFromAge(age: number, reference: FuzzyDate): FuzzyDate | undefined {
  if (!Number.isInteger(age) || age < 0) return undefined;
  switch (reference.qualifier) {
    case 'text':
    case 'between':
    case 'before':
    case 'after':
      return undefined;
    default: {
      if (reference.precision === 'decade') return undefined;
      const year = reference.date.year - age;
      if (year < MIN_YEAR) return undefined;
      return fuzzyDateSchema.parse({
        qualifier: 'calculated',
        precision: 'year',
        date: { year },
        calendar: reference.calendar,
      });
    }
  }
}

// --- Affichage neutre ----------------------------------------------------------------------

/** Une borne à afficher, à sa précision ; une décennie se donne par sa première année. */
export interface DisplayBound {
  readonly precision: FuzzyDatePrecision;
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
}

/**
 * Ce qu'il faut afficher d'une date floue, sans aucun mot : `packages/i18n` en fera le texte
 * (« vers 1940 », « années 1940 », « entre 1935 et 1940 ») dans la langue du lecteur.
 */
export type FuzzyDateDisplay =
  | {
      readonly kind: 'point';
      readonly qualifier: SingleBoundQualifier;
      readonly date: DisplayBound;
      readonly calendar: Calendar;
      readonly approximate: boolean;
    }
  | {
      readonly kind: 'range';
      readonly from: DisplayBound;
      readonly to: DisplayBound;
      readonly calendar: Calendar;
      readonly approximate: true;
    }
  | { readonly kind: 'text'; readonly text: string; readonly approximate: true };

function displayBound(bound: DateBound, precision: FuzzyDatePrecision): DisplayBound {
  return {
    precision,
    year: bound.year,
    ...(bound.month === undefined ? {} : { month: bound.month }),
    ...(bound.day === undefined ? {} : { day: bound.day }),
  };
}

/** Structure d'affichage d'une date floue (voir `FuzzyDateDisplay`). */
export function describeFuzzyDate(date: FuzzyDate): FuzzyDateDisplay {
  switch (date.qualifier) {
    case 'text':
      return { kind: 'text', text: date.originalText, approximate: true };
    case 'between':
      return {
        kind: 'range',
        from: displayBound(date.from, date.precision),
        to: displayBound(date.to, date.precision),
        calendar: date.calendar,
        approximate: true,
      };
    default:
      return {
        kind: 'point',
        qualifier: date.qualifier,
        date: displayBound(date.date, date.precision),
        calendar: date.calendar,
        approximate: isApproximate(date),
      };
  }
}
