// Polyfills Intl pour Hermes, chargés avant tout autre module par le point d'entrée (index.ts).
//
// @lignee/i18n s'appuie sur Intl : PluralRules (pluriels ICU : « 1 personne », « 2 personnes »),
// NumberFormat (« 1 234,5 »), DateTimeFormat avec formatToParts (« 1er mars 1968 »), dateStyle
// et timeStyle (« 1er mars 2026 à 14:05 ») et le fuseau de l'appareil. Hermes n'en fournit pas
// toujours tout, selon la version et la plateforme : chaque polyfill de FormatJS n'est installé
// que si son test (`shouldPolyfill`) le demande pour le français ou l'anglais, dans l'ordre de
// dépendance de FormatJS. Le test src/intl/polyfills.test.ts force tous les polyfills et vérifie
// que les formats de @lignee/i18n restent justes : l'app ne dépend pas de ce que Hermes fournit.
//
// Les `require` sont conditionnels : Metro embarque les modules, mais ne les exécute que si
// le moteur en a besoin (démarrage à froid plus court quand Intl est complet).
import type { Language } from '@lignee/i18n';
import { shouldPolyfill as shouldPolyfillDateTimeFormat } from '@formatjs/intl-datetimeformat/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillCanonicalLocales } from '@formatjs/intl-getcanonicallocales/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillNumberFormat } from '@formatjs/intl-numberformat/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillPluralRules } from '@formatjs/intl-pluralrules/should-polyfill.js';

declare const require: (path: string) => unknown;

/**
 * Langues de l'interface. Recopiées plutôt qu'importées : importer @lignee/i18n chargerait
 * i18next et intl-messageformat avant les polyfills. Un test vérifie qu'elles restent celles
 * de @lignee/i18n.
 */
export const POLYFILL_LANGUAGES = ['fr', 'en'] as const satisfies readonly Language[];

/** Polyfills installés, pour le journal de démarrage et les tests. */
export type IntlPolyfill =
  'getCanonicalLocales' | 'Locale' | 'PluralRules' | 'NumberFormat' | 'DateTimeFormat';

function anyLanguage(test: (language: string) => string | undefined): boolean {
  return POLYFILL_LANGUAGES.some((language) => test(language) !== undefined);
}

/** Installe les polyfills Intl qui manquent pour le français et l'anglais. */
export function installIntlPolyfills(): readonly IntlPolyfill[] {
  const installed: IntlPolyfill[] = [];
  if (shouldPolyfillCanonicalLocales()) {
    require('@formatjs/intl-getcanonicallocales/polyfill-force.js');
    installed.push('getCanonicalLocales');
  }
  // Intl.Locale ne sert qu'aux autres polyfills de FormatJS, qui se contentent de son socle.
  // Son test complet (`shouldPolyfill`) réclame les ajouts les plus récents de la norme
  // (variants, getWeekInfo…) et remplacerait sans besoin un Intl.Locale natif, même celui de Node.
  if (!('Locale' in Intl)) {
    require('@formatjs/intl-locale/polyfill-force.js');
    installed.push('Locale');
  }
  if (anyLanguage(shouldPolyfillPluralRules)) {
    require('@formatjs/intl-pluralrules/polyfill-force.js');
    require('@formatjs/intl-pluralrules/locale-data/fr.js');
    require('@formatjs/intl-pluralrules/locale-data/en.js');
    installed.push('PluralRules');
  }
  if (anyLanguage(shouldPolyfillNumberFormat)) {
    require('@formatjs/intl-numberformat/polyfill-force.js');
    require('@formatjs/intl-numberformat/locale-data/fr.js');
    require('@formatjs/intl-numberformat/locale-data/en.js');
    installed.push('NumberFormat');
  }
  if (anyLanguage(shouldPolyfillDateTimeFormat)) {
    require('@formatjs/intl-datetimeformat/polyfill-force.js');
    require('@formatjs/intl-datetimeformat/locale-data/fr.js');
    require('@formatjs/intl-datetimeformat/locale-data/en.js');
    // Tous les fuseaux : Africa/Douala n'est pas dans la sélection « golden » de FormatJS.
    require('@formatjs/intl-datetimeformat/add-all-tz.js');
    installed.push('DateTimeFormat');
  }
  return installed;
}

/** Polyfills installés au démarrage de l'app. */
export const installedIntlPolyfills = installIntlPolyfills();
