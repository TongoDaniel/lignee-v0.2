// Polyfills Intl pour Hermes. Node fournit un Intl complet : ces tests remplacent d'abord
// tout Intl par les polyfills de FormatJS (le cas d'un Hermes qui n'aurait rien), puis vérifient
// que les formats de @lignee/i18n restent justes en français et en anglais. Un polyfill ou une
// donnée de langue oubliée fait échouer un de ces tests.
import '@formatjs/intl-getcanonicallocales/polyfill-force.js';
import '@formatjs/intl-locale/polyfill-force.js';
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-numberformat/polyfill-force.js';
import '@formatjs/intl-numberformat/locale-data/fr.js';
import '@formatjs/intl-numberformat/locale-data/en.js';
import '@formatjs/intl-datetimeformat/polyfill-force.js';
import '@formatjs/intl-datetimeformat/locale-data/fr.js';
import '@formatjs/intl-datetimeformat/locale-data/en.js';
import '@formatjs/intl-datetimeformat/add-all-tz.js';

import {
  createTranslator,
  formatCalendarDate,
  formatDateTime,
  formatNumber,
  languages,
  pluralCategory,
} from '@lignee/i18n';

import { installIntlPolyfills, POLYFILL_LANGUAGES } from './polyfills';

// Espace fine insécable (U+202F) : séparateur des milliers et espace avant « : » en français.
const NNBSP = ' ';

describe('Intl remplacé par les polyfills de FormatJS', () => {
  it('utilise bien les polyfills, pas l’Intl de Node', () => {
    const polyfilled = (ctor: object): boolean => '__addLocaleData' in ctor;
    expect(polyfilled(Intl.PluralRules)).toBe(true);
    expect(polyfilled(Intl.NumberFormat)).toBe(true);
    expect(polyfilled(Intl.DateTimeFormat)).toBe(true);
  });

  it('couvre les langues de l’interface de @lignee/i18n', () => {
    expect([...POLYFILL_LANGUAGES]).toEqual([...languages]);
  });

  it('n’installe plus rien une fois Intl complet', () => {
    expect(installIntlPolyfills()).toEqual([]);
  });

  it('accorde les pluriels : 0 et 1 au singulier en français, pas en anglais', () => {
    expect(pluralCategory(0, 'fr')).toBe('one');
    expect(pluralCategory(1, 'fr')).toBe('one');
    expect(pluralCategory(2, 'fr')).toBe('other');
    expect(pluralCategory(0, 'en')).toBe('other');
    expect(pluralCategory(1, 'en')).toBe('one');
  });

  it('formate les messages ICU au pluriel', () => {
    const translator = createTranslator({ language: 'fr' });
    expect(translator.t('common:people.count', { count: 0 })).toBe('Aucune personne');
    expect(translator.t('common:people.count', { count: 1 })).toBe('1 personne');
    expect(translator.t('common:people.count', { count: 1234 })).toBe(`1${NNBSP}234 personnes`);
  });

  it('formate les nombres', () => {
    expect(formatNumber(1234.5, 'fr')).toBe(`1${NNBSP}234,5`);
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
  });

  it('écrit « 1er mars 1968 » (formatToParts) et les dates partielles', () => {
    expect(formatCalendarDate({ year: 1968, month: 3, day: 1 }, 'fr')).toBe('1er mars 1968');
    expect(formatCalendarDate({ year: 1968, month: 3 }, 'fr')).toBe('mars 1968');
    expect(formatCalendarDate({ year: 1968, month: 3, day: 1 }, 'en')).toBe('March 1, 1968');
  });

  it('écrit un instant avec dateStyle et timeStyle, à Douala comme à Paris', () => {
    const instant = new Date(Date.UTC(2026, 2, 1, 13, 5));
    // Écart connu : les données CLDR de FormatJS joignent date et heure par une virgule
    // (« 1er mars 2026, 14:05 »), l'ICU de Node par « à » ; Hermes reste à relever sur les
    // téléphones. Les deux sont justes ; pour le même texte partout, @lignee/i18n devra composer
    // date et heure lui-même.
    expect(formatDateTime(instant, 'fr', 'Africa/Douala')).toBe('1er mars 2026, 14:05');
    expect(formatDateTime(instant, 'fr', 'Europe/Paris')).toBe('1er mars 2026, 14:05');
    expect(formatDateTime(instant, 'en', 'Africa/Douala')).toMatch(
      new RegExp(`^March 1, 2026(?: at|,) 2:05${NNBSP}PM$`),
    );
  });
});
