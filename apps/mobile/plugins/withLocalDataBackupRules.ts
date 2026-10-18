// Greffon de configuration Expo : la base locale chiffrée et la clé du trousseau ne partent
// jamais dans une sauvegarde Android ni dans un transfert vers un autre appareil (T-016,
// CL-SEC-14, ADR 0023).
//
// `android:allowBackup="false"` coupe la sauvegarde dans le cloud, mais depuis Android 12 il
// n'empêche pas le transfert d'appareil à appareil : seules les `dataExtractionRules` le règlent
// (Android 12 et plus), et `fullBackupContent` pour Android 11 et moins. Ces règles excluent le
// dossier des bases d'expo-sqlite (`files/SQLite`, base, journal WAL et fichiers annexes) et
// reprennent l'exclusion des préférences d'expo-secure-store (`SecureStore`), dont le greffon
// est alors réglé avec `configureAndroidBackup: false` pour ne pas poser ses propres règles.
// Import de `expo/config-plugins.js` en espace de noms : `expo` n'a pas de champ `exports`, et
// ce module CommonJS n'expose pas de noms importables un à un quand Node charge ce fichier en
// module ES (`expo config`, `expo prebuild`) ; ses exports sont alors sous `default`. Sous Jest
// (Babel), ils sont directement sur l'espace de noms.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AndroidConfig as AndroidConfigTypes, ConfigPlugin } from 'expo/config-plugins';
import * as configPluginsModule from 'expo/config-plugins.js';

const configPlugins =
  (configPluginsModule as { default?: typeof configPluginsModule }).default ?? configPluginsModule;
const { AndroidConfig, withAndroidManifest, withDangerousMod } = configPlugins;

export const BACKUP_RULES_RESOURCE = 'lignee_backup_rules';
export const DATA_EXTRACTION_RULES_RESOURCE = 'lignee_data_extraction_rules';

/** Exclusions communes : dossier des bases d'expo-sqlite, préférences d'expo-secure-store. */
const EXCLUSIONS = [
  '<exclude domain="file" path="SQLite"/>',
  '<exclude domain="sharedpref" path="SecureStore"/>',
];

function indent(lines: readonly string[], depth: number): string {
  return lines.map((line) => `${' '.repeat(depth)}${line}`).join('\n');
}

/** Android 11 et moins (`android:fullBackupContent`). */
export function backupRulesXml(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!-- Lignée (T-016) : base locale chiffrée et clé du trousseau hors des sauvegardes. -->',
    '<full-backup-content>',
    indent(EXCLUSIONS, 2),
    '</full-backup-content>',
    '',
  ].join('\n');
}

/** Android 12 et plus (`android:dataExtractionRules`) : sauvegarde et transfert d'appareil. */
export function dataExtractionRulesXml(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!-- Lignée (T-016) : base locale chiffrée et clé du trousseau hors des sauvegardes',
    '     et des transferts vers un autre appareil. -->',
    '<data-extraction-rules>',
    '  <cloud-backup>',
    indent(EXCLUSIONS, 4),
    '  </cloud-backup>',
    '  <device-transfer>',
    indent(EXCLUSIONS, 4),
    '  </device-transfer>',
    '</data-extraction-rules>',
    '',
  ].join('\n');
}

/** Attributs posés sur `<application>` du manifeste. */
export function applyBackupRules(
  manifest: AndroidConfigTypes.Manifest.AndroidManifest,
): AndroidConfigTypes.Manifest.AndroidManifest {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.$['android:allowBackup'] = 'false';
  application.$['android:fullBackupContent'] = `@xml/${BACKUP_RULES_RESOURCE}`;
  application.$['android:dataExtractionRules'] = `@xml/${DATA_EXTRACTION_RULES_RESOURCE}`;
  return manifest;
}

export const withLocalDataBackupRules: ConfigPlugin = (config) => {
  const withManifest = withAndroidManifest(config, (modConfig) => {
    applyBackupRules(modConfig.modResults);
    return modConfig;
  });
  return withDangerousMod(withManifest, [
    'android',
    (modConfig) => {
      const directory = join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, `${BACKUP_RULES_RESOURCE}.xml`), backupRulesXml());
      writeFileSync(
        join(directory, `${DATA_EXTRACTION_RULES_RESOURCE}.xml`),
        dataExtractionRulesXml(),
      );
      return modConfig;
    },
  ]);
};
