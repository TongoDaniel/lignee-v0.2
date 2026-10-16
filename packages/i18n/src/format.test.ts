import { describe, expect, it } from 'vitest';

import {
  formatCalendarDate,
  formatDateTime,
  formatNumber,
  formattersFor,
  pluralCategory,
} from './format';

// Espace insécable, fine (U+202F) ou non (U+00A0) : le choix entre les deux varie selon la
// version des données ICU du moteur (Node, Hermes). Ce qui compte : jamais une espace sécable.
const NBSP = '[\\u00a0\\u202f]';
const fullMatch = (pattern: string): RegExp => new RegExp(`^${pattern}$`);

describe('formatNumber', () => {
  it('follows French and English conventions', () => {
    expect(formatNumber(1234567.5, 'fr')).toMatch(fullMatch(`1${NBSP}234${NBSP}567,5`));
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
  });

  it('passes Intl options through', () => {
    expect(formatNumber(0.25, 'fr', { style: 'percent' })).toMatch(fullMatch(`25${NBSP}%`));
    expect(formatNumber(0.25, 'en', { style: 'percent' })).toBe('25%');
  });
});

describe('pluralCategory', () => {
  it('treats 0 and 1.5 as singular in French, plural in English', () => {
    expect(pluralCategory(0, 'fr')).toBe('one');
    expect(pluralCategory(1.5, 'fr')).toBe('one');
    expect(pluralCategory(2, 'fr')).toBe('other');
    expect(pluralCategory(0, 'en')).toBe('other');
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(1.5, 'en')).toBe('other');
  });
});

describe('formatCalendarDate', () => {
  it('shows only what is known: year, month and year, or full date', () => {
    expect(formatCalendarDate({ year: 1968 }, 'fr')).toBe('1968');
    expect(formatCalendarDate({ year: 1968, month: 3 }, 'fr')).toBe('mars 1968');
    expect(formatCalendarDate({ year: 1968, month: 3, day: 12 }, 'fr')).toBe('12 mars 1968');

    expect(formatCalendarDate({ year: 1968 }, 'en')).toBe('1968');
    expect(formatCalendarDate({ year: 1968, month: 3 }, 'en')).toBe('March 1968');
    expect(formatCalendarDate({ year: 1968, month: 3, day: 12 }, 'en')).toBe('March 12, 1968');
  });

  it('writes « 1er » for the first day of the month in French', () => {
    expect(formatCalendarDate({ year: 1931, month: 1, day: 1 }, 'fr')).toBe('1er janvier 1931');
    expect(formatCalendarDate({ year: 1931, month: 1, day: 1 }, 'en')).toBe('January 1, 1931');
  });

  it('keeps old years as they are', () => {
    expect(formatCalendarDate({ year: 1789, month: 7, day: 14 }, 'fr')).toBe('14 juillet 1789');
    expect(formatCalendarDate({ year: 45 }, 'fr')).toBe('45');
  });

  it('accepts 29 February only in leap years', () => {
    expect(formatCalendarDate({ year: 2000, month: 2, day: 29 }, 'fr')).toBe('29 février 2000');
    expect(() => formatCalendarDate({ year: 1900, month: 2, day: 29 }, 'fr')).toThrow(RangeError);
  });

  it('rejects impossible dates', () => {
    expect(() => formatCalendarDate({ year: 1968, month: 13 }, 'fr')).toThrow(RangeError);
    expect(() => formatCalendarDate({ year: 1968, month: 4, day: 31 }, 'fr')).toThrow(RangeError);
    expect(() => formatCalendarDate({ year: 1968, day: 3 }, 'fr')).toThrow(RangeError);
    expect(() => formatCalendarDate({ year: 0 }, 'fr')).toThrow(RangeError);
    expect(() => formatCalendarDate({ year: 1968.5 }, 'fr')).toThrow(RangeError);
  });
});

describe('formatDateTime', () => {
  it('formats an instant in the given time zone', () => {
    const instant = new Date(Date.UTC(2026, 2, 12, 13, 5));
    expect(formatDateTime(instant, 'fr', 'Africa/Douala')).toBe('12 mars 2026 à 14:05');
    expect(formatDateTime(instant, 'en', 'Africa/Douala')).toMatch(
      fullMatch(`March 12, 2026 at 2:05[ \\u00a0\\u202f]PM`),
    );
  });
});

describe('formattersFor', () => {
  it('binds every formatter to one language', () => {
    const fr = formattersFor('fr');
    expect(fr.number(1234)).toMatch(fullMatch(`1${NBSP}234`));
    expect(fr.plural(0)).toBe('one');
    expect(fr.calendarDate({ year: 1968, month: 3 })).toBe('mars 1968');
    expect(fr.dateTime(new Date(Date.UTC(2026, 0, 1, 9, 0)), 'UTC')).toBe(
      '1er janvier 2026 à 09:00',
    );
  });
});
