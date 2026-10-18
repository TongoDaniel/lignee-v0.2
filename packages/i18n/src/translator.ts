// Traducteur de l'interface : i18next avec messages ICU (pluriels, nombres, dates), clés typées,
// changement de langue à chaud (CPT-12 : immédiat, sans redémarrer).
import i18next from 'i18next';
import ICU from 'i18next-icu';

import { formattersFor, type Formatters } from './format';
import type { MessageParams } from './generated/message-params';
import { defaultLanguage, isLanguage, languages, type Language } from './languages';
import { namespaces, resources } from './resources';

/** Clé complète d'un message : `espace:chemin.de.la.cle`. */
export type MessageKey = keyof MessageParams;

/** Paramètres à fournir pour une clé : aucun si le message n'en a pas, tous sinon. */
export type MessageArgs<K extends MessageKey> = MessageParams[K] extends null
  ? []
  : [params: MessageParams[K]];

// Méthodes en propriétés fléchées : `const { t } = translator` reste sûr, sans `this`.
export interface Translator {
  /** Langue en cours. */
  readonly language: Language;
  /** Texte d'une clé dans la langue en cours. Clé inconnue ou paramètre manquant : erreur de compilation. */
  readonly t: <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => string;
  /** Change la langue de toute l'interface, sans redémarrer. */
  readonly changeLanguage: (language: Language) => Promise<void>;
  /**
   * Prévient à chaque changement de langue ; renvoie la fonction de désabonnement.
   * Convient à `useSyncExternalStore(translator.subscribe, () => translator.language)`.
   */
  readonly subscribe: (listener: (language: Language) => void) => () => void;
  /** Dates, nombres et pluriels dans la langue en cours. */
  readonly format: Formatters;
}

export interface TranslatorOptions {
  readonly language?: Language;
}

export function createTranslator(options: TranslatorOptions = {}): Translator {
  const instance = i18next.createInstance();
  void instance.use(new ICU()).init({
    lng: options.language ?? defaultLanguage,
    fallbackLng: defaultLanguage,
    supportedLngs: [...languages],
    ns: [...namespaces],
    defaultNS: false,
    resources,
    // Ressources en mémoire : l'initialisation est synchrone, le premier texte est prêt aussitôt.
    initAsync: false,
    returnNull: false,
    // React échappe déjà le texte ; un double échappement afficherait « &amp; ».
    interpolation: { escapeValue: false },
  });

  const current = (): Language => {
    const language = instance.resolvedLanguage ?? instance.language;
    return isLanguage(language) ? language : defaultLanguage;
  };
  const translate = instance.t.bind(instance) as unknown as (key: string, params: object) => string;

  return {
    get language() {
      return current();
    },
    t: (key, ...args) => translate(key, args[0] ?? {}),
    changeLanguage: async (language) => {
      await instance.changeLanguage(language);
    },
    subscribe: (listener) => {
      const handler = (): void => {
        listener(current());
      };
      instance.on('languageChanged', handler);
      return () => {
        instance.off('languageChanged', handler);
      };
    },
    get format() {
      return formattersFor(current());
    },
  };
}
