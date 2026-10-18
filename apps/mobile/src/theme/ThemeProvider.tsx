// Thème de l'app : le fournisseur de @lignee/ui (Jour ou Nuit selon le téléphone, mode Aînés,
// réglage « Réduire les animations »), plus ce qui ne regarde que l'app : la couleur de fond de la
// fenêtre native, pour qu'aucun éclair blanc n'apparaisse en Nuit pendant une transition.
import { ThemeProvider as UiThemeProvider, useTheme, type ThemeProviderProps } from '@lignee/ui';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

export type { ThemeProviderProps } from '@lignee/ui';

function WindowBackground() {
  const { colors } = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.fond);
  }, [colors.fond]);
  return null;
}

export function ThemeProvider({ children, ...options }: ThemeProviderProps) {
  return (
    <UiThemeProvider {...options}>
      <WindowBackground />
      {children}
    </UiThemeProvider>
  );
}
