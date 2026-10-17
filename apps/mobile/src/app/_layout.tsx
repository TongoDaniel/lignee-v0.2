// Racine de l'app : polices de la charte, thème, langue, puis les onglets. Les polyfills Intl
// sont installés avant, par le point d'entrée (index.ts).
import { fontFiles } from '@lignee/ui/fontFiles';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProviders } from '../AppProviders';

// L'écran de lancement reste affiché jusqu'au chargement des polices (11-react-native.md).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  // Si une police manque, l'app s'ouvre quand même, avec la police du système.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </AppProviders>
  );
}
