// Racine de l'app : base locale chiffrée (ouverte sans attendre), polices de la charte, thème,
// langue, puis les onglets. Les polyfills Intl
// sont installés avant, par le point d'entrée (index.ts).
import { fontFiles } from '@lignee/ui/fontFiles';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProviders } from '../AppProviders';
import { LocalDatabaseProvider } from '../db/LocalDatabaseProvider';

// L'écran de lancement reste affiché jusqu'au chargement des polices (11-react-native.md).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  // Si une police manque, l'app s'ouvre quand même, avec la police du système.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // La base locale s'ouvre dès le premier rendu, pendant le chargement des polices.
  return (
    <LocalDatabaseProvider>
      {ready ? (
        <AppProviders>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </AppProviders>
      ) : null}
    </LocalDatabaseProvider>
  );
}
