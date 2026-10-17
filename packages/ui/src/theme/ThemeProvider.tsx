// Thème des composants : Jour ou Nuit selon le téléphone, mode Aînés, et réglage « Réduire les
// animations » du téléphone (07-mouvement.md). Le calcul du thème est dans getTheme (fonction
// pure) ; ce fournisseur ne fait que choisir les entrées et les transmettre.
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { getTheme, schemeFromSystem, type Theme } from '../theme';
import type { SchemeName } from '../tokens';

/** Thème et préférence de mouvement transmis aux composants. */
export interface UiTheme extends Theme {
  /** Vrai quand le téléphone demande de réduire les animations : fondus courts seulement. */
  readonly reduceMotion: boolean;
}

const DEFAULT_THEME: UiTheme = {
  ...getTheme({ scheme: 'jour', seniorMode: false }),
  reduceMotion: false,
};

const ThemeContext = createContext<UiTheme>(DEFAULT_THEME);

/**
 * Réglage « Réduire les animations » du téléphone, suivi à chaud. Tant que la réponse du système
 * n'est pas arrivée, on suppose qu'il faut réduire : mieux vaut un premier fondu court qu'un
 * mouvement non voulu. `enabled` faux : rien n'est demandé au système (réglage imposé).
 */
export function useSystemReduceMotion(enabled = true): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active) setReduce(value);
      },
      () => {
        // Réponse impossible : on garde les animations réduites.
      },
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduce(value);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [enabled]);
  return reduce;
}

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Mode Aînés (Profil › Affichage) : textes × 1,3, zones touchables de 56. */
  readonly seniorMode?: boolean;
  /** Schéma imposé (tests, page de démonstration) ; sinon celui du téléphone. */
  readonly scheme?: SchemeName;
  /** Animations réduites imposées (tests, page de démonstration) ; sinon le réglage du téléphone. */
  readonly reduceMotion?: boolean;
}

export function ThemeProvider({
  children,
  seniorMode = false,
  scheme,
  reduceMotion,
}: ThemeProviderProps) {
  const system = useColorScheme();
  const systemReduceMotion = useSystemReduceMotion(reduceMotion === undefined);
  const base = getTheme({ scheme: scheme ?? schemeFromSystem(system), seniorMode });
  const reduce = reduceMotion ?? systemReduceMotion;
  const value = useMemo<UiTheme>(() => ({ ...base, reduceMotion: reduce }), [base, reduce]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/** Thème courant : couleurs, ombres, typographie (mode Aînés compris), zone touchable, mouvement. */
export function useTheme(): UiTheme {
  return use(ThemeContext);
}
