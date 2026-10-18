// Traducteur de l'interface (ACC-04) : langue de l'appareil au démarrage, suivie à chaud quand
// la personne la change dans les réglages du téléphone, sans redémarrer l'app (CPT-12).
import { createTranslator, resolveLanguage, type Language, type Translator } from '@lignee/i18n';
import { useLocales } from 'expo-localization';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

interface I18nValue {
  readonly translator: Translator;
  /** Langue en cours : change à chaque `changeLanguage`, ce qui redessine les écrans. */
  readonly language: Language;
}

const I18nContext = createContext<I18nValue | null>(null);

export interface I18nProviderProps {
  readonly children: ReactNode;
  /** Traducteur fourni (tests) ; sinon créé dans la langue de l'appareil. */
  readonly translator?: Translator;
}

/** Langue de l'interface d'après les préférences de l'appareil, dans leur ordre. */
export function useDeviceLanguage(): Language {
  const locales = useLocales();
  return resolveLanguage(locales.map((locale) => locale.languageTag));
}

/**
 * Passe l'interface dans `next`. Si le changement échoue, l'interface reste dans la langue
 * précédente : un écran à moitié traduit serait pire. Rien n'est journalisé (ni langue ni
 * contenu) ; la prochaine préférence de l'appareil retentera.
 */
export async function switchLanguage(translator: Translator, next: Language): Promise<void> {
  const previous = translator.language;
  if (previous === next) return;
  try {
    await translator.changeLanguage(next);
  } catch {
    try {
      await translator.changeLanguage(previous);
    } catch {
      // La langue précédente reste celle du traducteur si i18next n'a rien changé.
    }
  }
}

export function I18nProvider({ children, translator: given }: I18nProviderProps) {
  const deviceLanguage = useDeviceLanguage();
  const [translator] = useState(() => given ?? createTranslator({ language: deviceLanguage }));
  const language = useSyncExternalStore(translator.subscribe, () => translator.language);

  // La langue du téléphone a changé pendant que l'app tournait : l'interface suit.
  // Quand la langue du profil existera (CPT-12), elle passera avant celle de l'appareil.
  useEffect(() => {
    if (given === undefined) void switchLanguage(translator, deviceLanguage);
  }, [deviceLanguage, given, translator]);

  const value = useMemo(() => ({ translator, language }), [translator, language]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Traducteur courant ; l'écran se redessine quand la langue change. */
export function useTranslator(): Translator {
  const value = use(I18nContext);
  if (value === null) throw new Error('useTranslator doit être appelé sous <I18nProvider>.');
  return value.translator;
}
