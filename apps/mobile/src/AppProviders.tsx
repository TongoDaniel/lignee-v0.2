// Fournisseurs communs à toute l'app : zones sûres, thème, langue, thème de navigation.
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider, type I18nProviderProps } from './i18n/I18nProvider';
import { ThemeProvider, useTheme, type ThemeProviderProps } from './theme/ThemeProvider';

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly theme?: Omit<ThemeProviderProps, 'children'>;
  readonly i18n?: Omit<I18nProviderProps, 'children'>;
}

// React Navigation peint le fond des écrans et des transitions : il prend les couleurs de la
// charte, pas les siennes.
function NavigationTheme({ children }: { readonly children: ReactNode }) {
  const { scheme, colors } = useTheme();
  const base = scheme === 'nuit' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.action,
      background: colors.fond,
      card: colors.fondCarte,
      text: colors.texte,
      border: colors.filet,
      notification: colors.action,
    },
  };
  return <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>;
}

export function AppProviders({ children, theme, i18n }: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider {...theme}>
        <I18nProvider {...i18n}>
          <NavigationTheme>{children}</NavigationTheme>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
