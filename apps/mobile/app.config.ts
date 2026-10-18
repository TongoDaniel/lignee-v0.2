// Configuration Expo de Lignée (TRD, « Choix techniques » ; charte, 10-applications.md).
// Lue par Node au moment de `expo start`, `expo export`, `expo prebuild` et des builds EAS.
//
// Les couleurs viennent des tokens de la charte (packages/ui), les fichiers de marque de
// docs/charte/assets/Applications : rien n'est recopié, un changement de charte suffit.
import type { ConfigContext, ExpoConfig } from 'expo/config';

import { palette } from '../../packages/ui/src/tokens.ts';

/** Fichiers de marque de la charte (icône d'app, icône adaptative, écran de lancement). */
const brandAssets = '../../docs/charte/assets/Applications';

/**
 * Identifiant des stores (Android `package`, iOS `bundleIdentifier`). À confirmer par Daniel
 * avant le premier build : il ne change plus une fois l'app publiée.
 */
const applicationId = 'com.lignee.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Lignée',
  slug: 'lignee',
  // Schéma des liens profonds (invitations : T-083).
  scheme: 'lignee',
  version: '0.1.0',
  orientation: 'portrait',
  // Jour ou Nuit selon le réglage du téléphone (expo-system-ui l'applique sur Android).
  userInterfaceStyle: 'automatic',
  icon: `${brandAssets}/icone-app-ios-1024.png`,
  ios: {
    bundleIdentifier: applicationId,
    supportsTablet: false,
  },
  android: {
    package: applicationId,
    // Pas de sauvegarde automatique Android (Google Drive, transfert d'appareil) : la base est
    // chiffrée par une clé qui ne quitte pas le trousseau de ce téléphone ; restaurée ailleurs,
    // elle serait illisible et ne ferait que copier des données chiffrées (CL-SEC-14, ADR 0023).
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: `${brandAssets}/android-adaptive-avant-plan-1024.png`,
      monochromeImage: `${brandAssets}/android-icone-monochrome-1024.png`,
      backgroundColor: palette.vert700,
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Fond Nuit 900, symbole or seul, 160 de large, sans animation (10-applications.md).
        image: `${brandAssets}/splash-symbole-1024.png`,
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: palette.nuit900,
      },
    ],
    // Langues de l'interface déclarées au système (choix de la langue par app, Android 13+ et iOS).
    ['expo-localization', { supportedLocales: ['fr', 'en'] }],
    'expo-font',
    // Base locale chiffrée par SQLCipher (TRD, « Hors-ligne et synchronisation » ; T-016).
    ['expo-sqlite', { useSQLCipher: true }],
    // Clé de la base dans le trousseau du système.
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // L'identifiant du projet EAS (`eas.projectId`) est ajouté par Daniel au premier
    // `eas init` : voir docs/runbooks/lancer-app-mobile.md.
    ...config.extra,
  },
});
