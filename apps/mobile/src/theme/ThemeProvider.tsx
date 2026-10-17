// Thème de l'app : Jour ou Nuit selon le réglage du téléphone, mode Aînés (09-accessibilite.md).
// Le calcul est dans @lignee/ui (getTheme) ; ce fournisseur ne fait que choisir les entrées.
// Il rejoindra @lignee/ui avec les composants de la charte (T-014).
import { getTheme, schemeFromSystem, type SchemeName, type Theme } from '@lignee/ui';
import * as SystemUI from 'expo-system-ui';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext<Theme>(getTheme({ scheme: 'jour', seniorMode: false }));

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Mode Aînés (Profil › Affichage, à venir) : textes × 1,3, zones touchables de 56. */
  readonly seniorMode?: boolean;
  /** Schéma imposé (tests) ; sinon celui du téléphone. */
  readonly scheme?: SchemeName;
}

export function ThemeProvider({ children, seniorMode = false, scheme }: ThemeProviderProps) {
  const system = useColorScheme();
  const theme = getTheme({ scheme: scheme ?? schemeFromSystem(system), seniorMode });

  // Fond de la fenêtre native : aucun éclair blanc en Nuit pendant une transition.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.fond);
  }, [theme.colors.fond]);

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/** Thème courant : couleurs, ombres, typographie (mode Aînés compris), zone touchable. */
export function useTheme(): Theme {
  return use(ThemeContext);
}
