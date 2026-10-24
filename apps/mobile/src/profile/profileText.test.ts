// Mots de la fiche : dates floues, périodes, titres, naissance multiple, en français et en
// anglais (la structure vient du domaine, les mots de packages/i18n).
import type { FuzzyDateDisplay, ProfileMultipleBirth } from '@lignee/domain';
import { createTranslator, type Language } from '@lignee/i18n';

import { fuzzyDateText, joinNames, multipleBirthText, periodText, titleLine } from './profileText';

const NNBSP = ' ';
const translators = {
  fr: createTranslator({ language: 'fr' }),
  en: createTranslator({ language: 'en' }),
} satisfies Record<Language, unknown>;

function point(
  qualifier: 'exact' | 'about' | 'before' | 'after' | 'calculated',
  date: { year: number; month?: number; day?: number },
  precision: 'day' | 'month' | 'year' | 'decade' = 'year',
  calendar: 'gregorian' | 'hijri' = 'gregorian',
): FuzzyDateDisplay {
  return {
    kind: 'point',
    qualifier,
    date: { precision, ...date },
    calendar,
    approximate: qualifier !== 'exact',
  };
}

describe('fuzzyDateText', () => {
  const { fr, en } = translators;

  it('écrit la date à sa précision, avec l’ordinal français du premier jour', () => {
    const day = point('exact', { year: 1931, month: 3, day: 1 }, 'day');
    expect(fuzzyDateText(day, fr)).toBe('1er mars 1931');
    expect(fuzzyDateText(day, en)).toBe('March 1, 1931');
    expect(fuzzyDateText(point('exact', { year: 1931, month: 3 }, 'month'), fr)).toBe('mars 1931');
    expect(fuzzyDateText(point('exact', { year: 1931 }), fr)).toBe('1931');
  });

  it('dit « vers », « avant », « après » et « entre », jamais une date exacte inventée', () => {
    expect(fuzzyDateText(point('about', { year: 1940 }), fr)).toBe('vers 1940');
    expect(fuzzyDateText(point('calculated', { year: 1940 }), fr)).toBe('vers 1940');
    expect(fuzzyDateText(point('before', { year: 1940 }), fr)).toBe('avant 1940');
    expect(fuzzyDateText(point('after', { year: 1940 }), en)).toBe('after 1940');
    const range: FuzzyDateDisplay = {
      kind: 'range',
      from: { precision: 'year', year: 1935 },
      to: { precision: 'year', year: 1940 },
      calendar: 'gregorian',
      approximate: true,
    };
    expect(fuzzyDateText(range, fr)).toBe('entre 1935 et 1940');
    expect(fuzzyDateText(range, en)).toBe('between 1935 and 1940');
  });

  it('écrit une décennie, un texte libre et le calendrier hégirien', () => {
    expect(fuzzyDateText(point('exact', { year: 1940 }, 'decade'), fr)).toBe('années 1940');
    expect(fuzzyDateText(point('exact', { year: 1940 }, 'decade'), en)).toBe('the 1940s');
    expect(fuzzyDateText({ kind: 'text', text: 'vers 1960', approximate: true }, fr)).toBe(
      'vers 1960',
    );
    expect(fuzzyDateText(point('exact', { year: 1360 }, 'year', 'hijri'), fr)).toBe(
      '1360 (calendrier hégirien)',
    );
  });

  it('garde l’année quand la date est impossible', () => {
    expect(fuzzyDateText(point('exact', { year: 1931, month: 13 }, 'month'), fr)).toBe('1931');
  });
});

describe('periodText et titleLine (UNI-17)', () => {
  const { fr, en } = translators;
  const text = (value: string): FuzzyDateDisplay => ({
    kind: 'text',
    text: value,
    approximate: true,
  });

  it('dit la période selon les dates connues', () => {
    expect(periodText(text('1968'), text('2004'), fr)).toBe('de 1968 à 2004');
    expect(periodText(text('2004'), undefined, fr)).toBe('depuis 2004');
    expect(periodText(undefined, text('2004'), en)).toBe('until 2004');
    expect(periodText(undefined, undefined, fr)).toBeUndefined();
  });

  it('range le titre sous le nom, sans traduire son libellé', () => {
    expect(titleLine({ label: 'Fon', start: text('2004') }, fr)).toBe('Fon, depuis 2004');
    expect(titleLine({ label: 'Lamido' }, fr)).toBe('Lamido');
    expect(titleLine({ label: 'Fon', start: text('2004') }, en)).toBe('Fon, since 2004');
  });
});

describe('joinNames', () => {
  it('relie les noms avec « et » / « and »', () => {
    expect(joinNames(['Adama'], translators.fr)).toBe('Adama');
    expect(joinNames(['Adama', 'Ines'], translators.fr)).toBe('Adama et Ines');
    expect(joinNames(['Adama', 'Ines', 'Ivan'], translators.en)).toBe('Adama, Ines and Ivan');
    expect(joinNames([], translators.fr)).toBe('');
  });
});

describe('multipleBirthText (UNI-14)', () => {
  const twins: ProfileMultipleBirth = {
    kind: 'twins',
    count: 2,
    others: [{ personId: '01900000-0000-7000-8000-000000000001', name: 'Adama' }],
  };

  it('dit « Jumeaux » et avec qui', () => {
    const result = multipleBirthText(twins, 'Inconnu', translators.fr);
    expect(result).toEqual({ kind: 'Jumeaux', with: 'Avec Adama' });
    expect(multipleBirthText(twins, 'Unknown', translators.en)).toEqual({
      kind: 'Twins',
      with: 'With Adama',
    });
  });

  it('dit « Triplés », le rang de naissance et « Inconnu » pour une place à compléter', () => {
    const triplets: ProfileMultipleBirth = {
      kind: 'triplets',
      count: 3,
      order: 2,
      others: [
        { personId: '01900000-0000-7000-8000-000000000001', name: 'Ines' },
        { personId: '01900000-0000-7000-8000-000000000002', name: undefined },
      ],
    };
    const result = multipleBirthText(triplets, 'Inconnu', translators.fr);
    expect(result.kind).toBe('Triplés');
    expect(result.with).toBe('Avec Ines et Inconnu');
    expect(result.order).toBe(`Ordre de naissance${NNBSP}: 2`);
  });

  it('nomme chaque cas de la charte', () => {
    const kinds = ['twins', 'triplets', 'quadruplets', 'multiple'] as const;
    expect(
      kinds.map(
        (kind) => multipleBirthText({ kind, count: 2, others: [] }, '?', translators.fr).kind,
      ),
    ).toEqual(['Jumeaux', 'Triplés', 'Quadruplés', 'Naissance multiple']);
  });
});
