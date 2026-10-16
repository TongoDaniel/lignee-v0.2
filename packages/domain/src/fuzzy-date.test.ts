import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  MISSING_SORT_KEY,
  UNDATED_SORT_KEY,
  birthDateFromAge,
  compareFuzzyDates,
  describeFuzzyDate,
  fuzzyDateFromText,
  fuzzyDateSchema,
  fuzzyDateSortKey,
  fuzzyDateSpan,
  isApproximate,
  type CalendarDay,
  type FuzzyDate,
  type FuzzyDateInput,
} from './fuzzy-date';
import { fuzzyDateArbitrary } from './test-support/fuzzy-date-arbitrary';

const parse = (input: FuzzyDateInput): FuzzyDate => fuzzyDateSchema.parse(input);
const accepts = (input: unknown): boolean => fuzzyDateSchema.safeParse(input).success;

type Single = 'exact' | 'about' | 'before' | 'after' | 'calculated';
const year = (value: number, qualifier: Single = 'exact') =>
  parse({ qualifier, precision: 'year', date: { year: value } });
const decade = (value: number) =>
  parse({ qualifier: 'exact', precision: 'decade', date: { year: value } });
const month = (value: number, monthValue: number) =>
  parse({ qualifier: 'exact', precision: 'month', date: { year: value, month: monthValue } });
const day = (value: string) => {
  const [y = 0, m = 0, d = 0] = value.split('-').map(Number);
  return parse({ qualifier: 'exact', precision: 'day', date: { year: y, month: m, day: d } });
};
const between = (from: number, to: number) =>
  parse({ qualifier: 'between', precision: 'year', from: { year: from }, to: { year: to } });
const hijriYear = (value: number) =>
  parse({ qualifier: 'exact', precision: 'year', date: { year: value }, calendar: 'hijri' });

function compareDays(a: CalendarDay, b: CalendarDay): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Ce que la date dit, sans son texte d'origine. */
function meaning(date: FuzzyDate): string {
  if (date.qualifier === 'text') return JSON.stringify(date);
  return JSON.stringify({ ...date, originalText: undefined });
}

describe('date floue : schéma (TRD, Modèle de données)', () => {
  it('garde la forme texte de T-004, inchangée', () => {
    expect(fuzzyDateFromText('  vers 1940 ')).toEqual({
      qualifier: 'text',
      originalText: 'vers 1940',
    });
    expect(accepts({ qualifier: 'text', originalText: '' })).toBe(false);
    expect(accepts({ qualifier: 'text', originalText: 'x', precision: 'year' })).toBe(false);
  });

  it('connaît les sept qualificatifs et les quatre précisions', () => {
    for (const qualifier of ['exact', 'about', 'before', 'after', 'calculated'] as const) {
      expect(year(1940, qualifier).qualifier).toBe(qualifier);
    }
    expect(between(1935, 1940).qualifier).toBe('between');
    expect(fuzzyDateFromText('jadis').qualifier).toBe('text');
    expect(decade(1940)).toMatchObject({ precision: 'decade' });
    expect(year(1940)).toMatchObject({ precision: 'year' });
    expect(month(1940, 7)).toMatchObject({ precision: 'month' });
    expect(day('1940-07-14')).toMatchObject({ precision: 'day' });
    expect(accepts({ qualifier: 'circa', precision: 'year', date: { year: 1940 } })).toBe(false);
    expect(accepts({ qualifier: 'exact', precision: 'century', date: { year: 1900 } })).toBe(false);
  });

  it('garde le texte d’origine et le calendrier, grégorien par défaut, sans conversion', () => {
    expect(
      parse({
        qualifier: 'about',
        precision: 'year',
        date: { year: 1940 },
        originalText: 'vers 1940',
      }),
    ).toEqual({
      qualifier: 'about',
      precision: 'year',
      date: { year: 1940 },
      originalText: 'vers 1940',
      calendar: 'gregorian',
    });
    expect(hijriYear(1359)).toMatchObject({ calendar: 'hijri', date: { year: 1359 } });
    expect(
      accepts({ qualifier: 'exact', precision: 'year', date: { year: 1940 }, calendar: 'julian' }),
    ).toBe(false);
    expect(
      accepts({ qualifier: 'exact', precision: 'year', date: { year: 1940 }, sortKey: 'x' }),
    ).toBe(false);
  });

  it('refuse une précision incohérente avec la borne', () => {
    const refused: unknown[] = [
      { qualifier: 'exact', precision: 'day', date: { year: 1940, month: 7 } },
      { qualifier: 'exact', precision: 'day', date: { year: 1940 } },
      { qualifier: 'exact', precision: 'month', date: { year: 1940 } },
      { qualifier: 'exact', precision: 'month', date: { year: 1940, month: 7, day: 14 } },
      { qualifier: 'exact', precision: 'year', date: { year: 1940, month: 7 } },
      { qualifier: 'exact', precision: 'year', date: { year: 1940, day: 7 } },
      { qualifier: 'exact', precision: 'decade', date: { year: 1945 } },
      { qualifier: 'exact', precision: 'decade', date: { year: 1940, month: 1 } },
    ];
    for (const input of refused)
      expect({ input, ok: accepts(input) }).toEqual({ input, ok: false });
  });

  it('refuse un jour, un mois ou une année qui n’existe pas', () => {
    const dayOf = (y: number, m: number, d: number, calendar = 'gregorian') =>
      accepts({
        qualifier: 'exact',
        precision: 'day',
        date: { year: y, month: m, day: d },
        calendar,
      });
    expect(dayOf(1940, 2, 30)).toBe(false);
    expect(dayOf(1900, 2, 29)).toBe(false);
    expect(dayOf(2000, 2, 29)).toBe(true);
    expect(dayOf(1940, 4, 31)).toBe(false);
    expect(dayOf(1940, 12, 31)).toBe(true);
    // Hégirien : pas de table des mois en V1, 30 jours au plus.
    expect(dayOf(1359, 2, 30, 'hijri')).toBe(true);
    expect(dayOf(1359, 1, 31, 'hijri')).toBe(false);
    expect(
      accepts({ qualifier: 'exact', precision: 'month', date: { year: 1940, month: 13 } }),
    ).toBe(false);
    expect(accepts({ qualifier: 'exact', precision: 'year', date: { year: 0 } })).toBe(false);
    expect(accepts({ qualifier: 'exact', precision: 'year', date: { year: 10_000 } })).toBe(false);
    expect(accepts({ qualifier: 'exact', precision: 'year', date: { year: 1940.5 } })).toBe(false);
  });

  it('« entre » exige deux bornes ordonnées et distinctes, de même précision ; les autres une seule', () => {
    const range = (from: object, to: object, precision = 'year') => ({
      qualifier: 'between',
      precision,
      from,
      to,
    });
    expect(accepts(range({ year: 1935 }, { year: 1940 }))).toBe(true);
    expect(accepts(range({ year: 1940 }, { year: 1935 }))).toBe(false);
    expect(accepts(range({ year: 1940 }, { year: 1940 }))).toBe(false);
    expect(accepts(range({ year: 1940, month: 3 }, { year: 1940, month: 5 }, 'month'))).toBe(true);
    expect(accepts(range({ year: 1940, month: 5 }, { year: 1940, month: 3 }, 'month'))).toBe(false);
    expect(accepts(range({ year: 1940, month: 3 }, { year: 1941 }, 'month'))).toBe(false);
    expect(accepts({ qualifier: 'between', precision: 'year', from: { year: 1935 } })).toBe(false);
    expect(accepts({ qualifier: 'between', precision: 'year', date: { year: 1935 } })).toBe(false);
    expect(
      accepts({ qualifier: 'about', precision: 'year', date: { year: 1935 }, to: { year: 1940 } }),
    ).toBe(false);
    expect(accepts({ qualifier: 'about', precision: 'year' })).toBe(false);
  });
});

describe('date floue : approximative et étendue', () => {
  it('VOX-14 : une date calculée est marquée approximative ; seule l’exacte ne l’est pas', () => {
    expect(isApproximate(year(1930, 'calculated'))).toBe(true);
    expect(describeFuzzyDate(year(1930, 'calculated')).approximate).toBe(true);
    expect(isApproximate(year(1930, 'about'))).toBe(true);
    expect(isApproximate(year(1930, 'before'))).toBe(true);
    expect(isApproximate(year(1930, 'after'))).toBe(true);
    expect(isApproximate(between(1930, 1935))).toBe(true);
    expect(isApproximate(fuzzyDateFromText('jadis'))).toBe(true);
    expect(isApproximate(year(1930))).toBe(false);
  });

  it('donne l’étendue nominale, ouverte pour « avant » et « après »', () => {
    expect(fuzzyDateSpan(year(1940))).toEqual({
      earliest: { year: 1940, month: 1, day: 1 },
      latest: { year: 1940, month: 12, day: 31 },
    });
    expect(fuzzyDateSpan(year(1940, 'before'))).toEqual({
      earliest: undefined,
      latest: { year: 1939, month: 12, day: 31 },
    });
    expect(fuzzyDateSpan(year(1940, 'after'))).toEqual({
      earliest: { year: 1941, month: 1, day: 1 },
      latest: undefined,
    });
    expect(fuzzyDateSpan(decade(1940))).toEqual({
      earliest: { year: 1940, month: 1, day: 1 },
      latest: { year: 1949, month: 12, day: 31 },
    });
    expect(fuzzyDateSpan(month(2000, 2))?.latest).toEqual({ year: 2000, month: 2, day: 29 });
    expect(fuzzyDateSpan(day('1940-07-14'))).toEqual({
      earliest: { year: 1940, month: 7, day: 14 },
      latest: { year: 1940, month: 7, day: 14 },
    });
    expect(fuzzyDateSpan(fuzzyDateFromText('jadis'))).toBeUndefined();
    expect(fuzzyDateSpan(hijriYear(1359))).toBeUndefined();
  });
});

describe('date floue : clé de tri', () => {
  it('range des dates de précisions et de qualificatifs différents', () => {
    const ordered = [
      decade(1930),
      day('1939-12-31'),
      year(1940, 'before'),
      decade(1940),
      year(1940),
      year(1940, 'calculated'),
      year(1940, 'about'),
      between(1940, 1941),
      between(1940, 1945),
      day('1940-01-01'),
      month(1940, 7),
      day('1940-07-14'),
      year(1940, 'after'),
      year(1941),
      hijriYear(1359),
    ];
    expect([...ordered].reverse().sort(compareFuzzyDates)).toEqual(ordered);
  });

  it('place le texte libre en fin, puis la date absente', () => {
    const text = fuzzyDateFromText("l'année de l'éclipse");
    expect(fuzzyDateSortKey(text)).toBe(UNDATED_SORT_KEY);
    expect(fuzzyDateSortKey(undefined)).toBe(MISSING_SORT_KEY);
    expect(compareFuzzyDates(year(9999, 'after'), text)).toBeLessThan(0);
    expect(compareFuzzyDates(text, undefined)).toBeLessThan(0);
    expect(compareFuzzyDates(text, fuzzyDateFromText('jadis'))).toBe(0);
    expect(compareFuzzyDates(undefined, undefined)).toBe(0);
  });

  it('a une forme stable, lisible en base (collation « C »)', () => {
    expect(fuzzyDateSortKey(year(1940))).toBe('0:01940-01-01:5:2:1');
    expect(fuzzyDateSortKey(year(1940, 'before'))).toBe('0:01939-12-31:9:2:9');
    expect(fuzzyDateSortKey(year(1940, 'after'))).toBe('0:01941-01-01:0:2:0');
    expect(fuzzyDateSortKey(between(1935, 1940))).toBe('0:01935-01-01:5:2:4:01940-12-31');
    expect(fuzzyDateSortKey(day('1940-07-14'))).toBe('0:01940-07-14:5:4:1');
    expect(fuzzyDateSortKey(year(1, 'before'))).toBe('0:00000-12-31:9:2:9');
    expect(fuzzyDateSortKey(year(9999, 'after'))).toBe('0:10000-01-01:0:2:0');
  });
});

describe('date floue : calcul (VOX-14)', () => {
  it('« mort à 80 ans en 2010 » : née vers 1930, date calculée, approximative', () => {
    const birth = birthDateFromAge(80, year(2010));
    expect(birth).toEqual({
      qualifier: 'calculated',
      precision: 'year',
      date: { year: 1930 },
      calendar: 'gregorian',
    });
    if (birth === undefined) throw new Error('missing birth');
    expect(isApproximate(birth)).toBe(true);
  });

  it('part d’une référence au jour, au mois, « vers » ou calculée, et garde son calendrier', () => {
    expect(birthDateFromAge(80, day('2010-03-01'))).toMatchObject({ date: { year: 1930 } });
    expect(birthDateFromAge(80, month(2010, 3))).toMatchObject({ date: { year: 1930 } });
    expect(birthDateFromAge(80, year(2010, 'about'))).toMatchObject({ date: { year: 1930 } });
    expect(birthDateFromAge(30, year(1960, 'calculated'))).toMatchObject({ date: { year: 1930 } });
    expect(birthDateFromAge(80, hijriYear(1430))).toMatchObject({
      qualifier: 'calculated',
      date: { year: 1350 },
      calendar: 'hijri',
    });
    expect(birthDateFromAge(0, year(2010))).toMatchObject({ date: { year: 2010 } });
  });

  it('ne calcule rien sans une année de référence ni un âge valide', () => {
    expect(birthDateFromAge(80, fuzzyDateFromText('après la guerre'))).toBeUndefined();
    expect(birthDateFromAge(80, year(2010, 'before'))).toBeUndefined();
    expect(birthDateFromAge(80, year(2010, 'after'))).toBeUndefined();
    expect(birthDateFromAge(80, between(2008, 2010))).toBeUndefined();
    expect(birthDateFromAge(80, decade(2010))).toBeUndefined();
    expect(birthDateFromAge(-1, year(2010))).toBeUndefined();
    expect(birthDateFromAge(2.5, year(2010))).toBeUndefined();
    expect(birthDateFromAge(2010, year(2010))).toBeUndefined();
  });
});

describe('date floue : affichage neutre', () => {
  it('décrit la date par sa structure, sans aucun mot', () => {
    expect(describeFuzzyDate(year(1940, 'about'))).toEqual({
      kind: 'point',
      qualifier: 'about',
      date: { precision: 'year', year: 1940 },
      calendar: 'gregorian',
      approximate: true,
    });
    expect(describeFuzzyDate(day('1940-07-14'))).toEqual({
      kind: 'point',
      qualifier: 'exact',
      date: { precision: 'day', year: 1940, month: 7, day: 14 },
      calendar: 'gregorian',
      approximate: false,
    });
    expect(
      describeFuzzyDate(
        parse({
          qualifier: 'between',
          precision: 'decade',
          from: { year: 1930 },
          to: { year: 1950 },
        }),
      ),
    ).toEqual({
      kind: 'range',
      from: { precision: 'decade', year: 1930 },
      to: { precision: 'decade', year: 1950 },
      calendar: 'gregorian',
      approximate: true,
    });
    expect(describeFuzzyDate(fuzzyDateFromText('jadis'))).toEqual({
      kind: 'text',
      text: 'jadis',
      approximate: true,
    });
  });
});

describe('date floue : propriétés sur des dates générées', () => {
  const anyDate = fuzzyDateArbitrary({ calendars: ['gregorian', 'hijri'], withText: true });
  /** Années voisines : beaucoup de dates qui se chevauchent ou se touchent. */
  const nearDate = fuzzyDateArbitrary({ minYear: 1930, maxYear: 1950 });

  it('toute date générée est valide et survit à un aller-retour JSON, clé comprise', () => {
    fc.assert(
      fc.property(anyDate, (date) => {
        const back = fuzzyDateSchema.parse(JSON.parse(JSON.stringify(date)));
        expect(back).toEqual(date);
        expect(fuzzyDateSortKey(back)).toBe(fuzzyDateSortKey(date));
      }),
      { numRuns: 500 },
    );
  });

  it('le tri ne dépend pas de l’ordre d’arrivée', () => {
    const datesAndShuffle = fc
      .array(fc.option(anyDate, { nil: undefined }), { maxLength: 30 })
      .chain((dates) =>
        fc.tuple(
          fc.constant(dates),
          fc.shuffledSubarray(dates, { minLength: dates.length, maxLength: dates.length }),
        ),
      );
    fc.assert(
      fc.property(datesAndShuffle, ([dates, shuffled]) => {
        const keys = [...dates].sort(compareFuzzyDates).map(fuzzyDateSortKey);
        expect([...shuffled].sort(compareFuzzyDates).map(fuzzyDateSortKey)).toEqual(keys);
        expect(keys).toEqual([...keys].sort());
      }),
      { numRuns: 300 },
    );
  });

  it('la comparaison est un ordre total : réflexive, antisymétrique, transitive', () => {
    fc.assert(
      fc.property(anyDate, anyDate, anyDate, (a, b, c) => {
        expect(compareFuzzyDates(a, a)).toBe(0);
        expect(compareFuzzyDates(a, b) + compareFuzzyDates(b, a)).toBe(0);
        if (compareFuzzyDates(a, b) <= 0 && compareFuzzyDates(b, c) <= 0) {
          expect(compareFuzzyDates(a, c)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('le tri est cohérent : une date qui finit avant qu’une autre commence passe avant', () => {
    fc.assert(
      fc.property(nearDate, nearDate, (a, b) => {
        const left = fuzzyDateSpan(a);
        const right = fuzzyDateSpan(b);
        if (left?.latest === undefined || right?.earliest === undefined) return;
        if (compareDays(left.latest, right.earliest) < 0) {
          expect(compareFuzzyDates(a, b)).toBeLessThan(0);
        }
      }),
      { numRuns: 3000 },
    );
  });

  it('la clé tombe dans l’étendue de la date', () => {
    fc.assert(
      fc.property(fuzzyDateArbitrary(), (date) => {
        const span = fuzzyDateSpan(date);
        const [, point = ''] = fuzzyDateSortKey(date).split(':');
        const [y = 0, m = 0, d = 0] = point.split('-').map(Number);
        const key = { year: y, month: m, day: d };
        if (span?.earliest !== undefined)
          expect(compareDays(span.earliest, key)).toBeLessThanOrEqual(0);
        if (span?.latest !== undefined)
          expect(compareDays(key, span.latest)).toBeLessThanOrEqual(0);
      }),
      { numRuns: 1000 },
    );
  });

  it('deux dates grégoriennes ont la même clé si et seulement si elles disent la même chose', () => {
    fc.assert(
      fc.property(nearDate, nearDate, (a, b) => {
        expect(fuzzyDateSortKey(a) === fuzzyDateSortKey(b)).toBe(meaning(a) === meaning(b));
      }),
      { numRuns: 3000 },
    );
  });

  it('le texte libre et les autres calendriers passent après toute date grégorienne', () => {
    fc.assert(
      fc.property(nearDate, anyDate, (dated, other) => {
        if (other.qualifier === 'text' || other.calendar !== 'gregorian') {
          expect(compareFuzzyDates(dated, other)).toBeLessThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });
});
