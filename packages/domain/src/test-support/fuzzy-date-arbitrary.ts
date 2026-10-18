// Dates floues générées pour les tests de propriétés (fast-check). Valides par construction.
import fc from 'fast-check';

import {
  MAX_YEAR,
  MIN_YEAR,
  fuzzyDateSchema,
  singleBoundQualifiers,
  type Calendar,
  type DateBound,
  type FuzzyDate,
  type FuzzyDatePrecision,
} from '../fuzzy-date';

export interface FuzzyDateArbitraryOptions {
  /** Années tirées (bornes comprises) ; une plage étroite multiplie les dates voisines. */
  readonly minYear?: number;
  readonly maxYear?: number;
  /** Calendriers tirés ; grégorien seul par défaut. */
  readonly calendars?: readonly Calendar[];
  /** Tirer aussi des dates en texte libre. */
  readonly withText?: boolean;
}

function daysIn(calendar: Calendar, year: number, month: number): number {
  if (calendar === 'hijri') return 30;
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function boundArbitrary(
  precision: FuzzyDatePrecision,
  calendar: Calendar,
  minYear: number,
  maxYear: number,
): fc.Arbitrary<DateBound> {
  if (precision === 'decade') {
    const low = Math.max(1, Math.ceil(minYear / 10));
    const high = Math.max(low, Math.floor(Math.min(maxYear, MAX_YEAR - 9) / 10));
    return fc.integer({ min: low, max: high }).map((tens) => ({ year: tens * 10 }));
  }
  const year = fc.integer({ min: minYear, max: maxYear });
  if (precision === 'year') return year.map((value) => ({ year: value }));
  const yearMonth = fc.tuple(year, fc.integer({ min: 1, max: 12 }));
  if (precision === 'month') return yearMonth.map(([value, month]) => ({ year: value, month }));
  return yearMonth.chain(([value, month]) =>
    fc
      .integer({ min: 1, max: daysIn(calendar, value, month) })
      .map((day) => ({ year: value, month, day })),
  );
}

function compareBounds(a: DateBound, b: DateBound): number {
  return a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.day ?? 0) - (b.day ?? 0);
}

/** Date floue valide, tirée parmi tous les qualificatifs et précisions. */
export function fuzzyDateArbitrary(
  options: FuzzyDateArbitraryOptions = {},
): fc.Arbitrary<FuzzyDate> {
  const minYear = options.minYear ?? MIN_YEAR;
  const maxYear = options.maxYear ?? MAX_YEAR;
  const calendars = options.calendars ?? ['gregorian'];
  const originalText = fc.option(
    fc.constantFrom('vers 1940', 'en 1935', 'avant la guerre', '1950', 'à la saison des pluies'),
    { nil: undefined },
  );
  const head = fc.record({
    precision: fc.constantFrom<FuzzyDatePrecision>('day', 'month', 'year', 'decade'),
    calendar: fc.constantFrom(...calendars),
    originalText,
  });
  const dated = head.chain(({ precision, calendar, originalText: text }) => {
    const bound = boundArbitrary(precision, calendar, minYear, maxYear);
    const common = {
      precision,
      calendar,
      ...(text === undefined ? {} : { originalText: text }),
    };
    const single = fc
      .tuple(fc.constantFrom(...singleBoundQualifiers), bound)
      .map(([qualifier, date]) => ({ qualifier, date, ...common }));
    const between = fc
      .tuple(bound, bound)
      .filter(([a, b]) => compareBounds(a, b) !== 0)
      .map(([a, b]) => {
        const [from, to] = compareBounds(a, b) < 0 ? [a, b] : [b, a];
        return { qualifier: 'between' as const, from, to, ...common };
      });
    return fc.oneof({ arbitrary: single, weight: 5 }, { arbitrary: between, weight: 1 });
  });
  const text = fc
    .constantFrom("l'année de l'éclipse", 'pendant la saison sèche', "à l'arrivée du train")
    .map((value) => ({ qualifier: 'text' as const, originalText: value }));
  const any =
    options.withText === true
      ? fc.oneof({ arbitrary: dated, weight: 9 }, { arbitrary: text, weight: 1 })
      : dated;
  return any.map((input) => fuzzyDateSchema.parse(input));
}
