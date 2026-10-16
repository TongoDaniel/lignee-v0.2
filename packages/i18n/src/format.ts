// Dates, nombres et pluriels au format de la langue (ACC-04), par l'API Intl.
// Les formateurs Intl coûtent cher à créer sur un téléphone d'entrée de gamme : ils sont gardés.
import type { Language } from './languages';

/**
 * Date d'un événement de vie (naissance, mariage, décès), éventuellement partielle :
 * l'année seule, le mois et l'année, ou la date complète. Elle n'a ni heure ni fuseau.
 */
export interface CalendarDate {
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
}

type IntlFormatter = Intl.NumberFormat | Intl.DateTimeFormat | Intl.PluralRules;

const cache = new Map<string, IntlFormatter>();

function cached<T extends IntlFormatter>(key: string, create: () => T): T {
  const existing = cache.get(key);
  if (existing !== undefined) return existing as T;
  const created = create();
  cache.set(key, created);
  return created;
}

/**
 * Nombre au format de la langue : « 1 234,5 » (espace fine insécable) en français,
 * « 1,234.5 » en anglais.
 */
export function formatNumber(
  value: number,
  language: Language,
  options: Intl.NumberFormatOptions = {},
): string {
  const key = `number:${language}:${JSON.stringify(options)}`;
  return cached(key, () => new Intl.NumberFormat(language, options)).format(value);
}

/** Catégorie de pluriel de la langue (« one », « other »…). En français, 0 et 1 sont « one ». */
export function pluralCategory(count: number, language: Language): Intl.LDMLPluralRule {
  return cached(`plural:${language}`, () => new Intl.PluralRules(language)).select(count);
}

/**
 * Date d'un événement de vie, à la précision connue : « 1968 », « mars 1968 », « 1er mars 1968 »
 * (« March 1, 1968 » en anglais). Calculée en UTC : aucun décalage de jour selon le fuseau.
 */
export function formatCalendarDate(date: CalendarDate, language: Language): string {
  const { year, month, day } = date;
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError(`Année invalide : ${String(year)}.`);
  }
  if (month === undefined && day !== undefined) {
    throw new RangeError('Un jour sans mois n’est pas une date.');
  }
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new RangeError(`Mois invalide : ${String(month)}.`);
  }
  const instant = new Date(Date.UTC(2000, (month ?? 1) - 1, day ?? 1));
  instant.setUTCFullYear(year);
  if (day !== undefined && (!Number.isInteger(day) || instant.getUTCDate() !== day)) {
    throw new RangeError(`Jour invalide : ${String(day)}.`);
  }

  const precision = day !== undefined ? 'day' : month !== undefined ? 'month' : 'year';
  const formatter = cached(
    `calendar:${language}:${precision}`,
    () =>
      new Intl.DateTimeFormat(language, {
        timeZone: 'UTC',
        year: 'numeric',
        ...(precision !== 'year' && { month: 'long' }),
        ...(precision === 'day' && { day: 'numeric' }),
      }),
  );
  return withFrenchOrdinal(formatter, instant, language);
}

// Typographie française : « 1er mars », pas « 1 mars ».
function withFrenchOrdinal(
  formatter: Intl.DateTimeFormat,
  value: Date,
  language: Language,
): string {
  if (language !== 'fr') return formatter.format(value);
  return formatter
    .formatToParts(value)
    .map((part) => (part.type === 'day' && part.value === '1' ? '1er' : part.value))
    .join('');
}

/**
 * Instant (envoi d'un message, dernière synchronisation), dans le fuseau de l'appareil sauf
 * fuseau donné : « 1er mars 2026 à 14:05 » en français, « March 1, 2026 at 2:05 PM » en anglais.
 */
export function formatDateTime(value: Date, language: Language, timeZone?: string): string {
  const formatter = cached(
    `datetime:${language}:${timeZone ?? ''}`,
    () =>
      new Intl.DateTimeFormat(language, {
        dateStyle: 'long',
        timeStyle: 'short',
        ...(timeZone !== undefined && { timeZone }),
      }),
  );
  return withFrenchOrdinal(formatter, value, language);
}

/** Formateurs liés à une langue (`translator.format.number(1234)`). */
export interface Formatters {
  readonly number: (value: number, options?: Intl.NumberFormatOptions) => string;
  readonly plural: (count: number) => Intl.LDMLPluralRule;
  readonly calendarDate: (date: CalendarDate) => string;
  readonly dateTime: (value: Date, timeZone?: string) => string;
}

export function formattersFor(language: Language): Formatters {
  return {
    number: (value, options) => formatNumber(value, language, options),
    plural: (count) => pluralCategory(count, language),
    calendarDate: (date) => formatCalendarDate(date, language),
    dateTime: (value, timeZone) => formatDateTime(value, language, timeZone),
  };
}
