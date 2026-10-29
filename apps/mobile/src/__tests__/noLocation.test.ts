// CAR-01 : « Aucune permission de localisation demandée ». Les lieux se saisissent au texte
// (T-031). Ce test échoue si une permission de localisation, un module de géolocalisation ou une
// demande d'autorisation de position apparaît dans la configuration de l'app, dans ses
// dépendances ou dans son code (celui de l'app et ceux des paquets qu'elle embarque).
import type { ExpoConfig } from 'expo/config';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import createConfig from '../../app.config';

const appRoot = join(__dirname, '..', '..');
const repoRoot = join(appRoot, '..', '..');

/** Ce qui trahit un accès à la position : permissions, modules, API du système. */
const LOCATION_PATTERNS: readonly RegExp[] = [
  /ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION/u,
  /NSLocation\w*UsageDescription/u,
  /expo-location/u,
  /geolocation/iu,
  /requestForegroundPermissions?Async/u,
  /requestBackgroundPermissions?Async/u,
  /getCurrentPositionAsync/u,
  /watchPositionAsync/u,
  /PermissionsAndroid[\s\S]{0,200}LOCATION/u,
  /Location\.(request|get|watch)/u,
];

export function findLocationUse(text: string): string[] {
  return LOCATION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

/** Fichiers de code livrés dans l'app : ni tests, ni générés, ni dépendances. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (entry === 'node_modules' || entry === 'generated' || entry === 'dist') return [];
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path);
    const isCode = /\.(ts|tsx|js|json)$/u.test(entry);
    const isTest = /\.test\.(ts|tsx)$/u.test(entry) || /test-support/u.test(path);
    return isCode && !isTest ? [path] : [];
  });
}

const config: ExpoConfig = createConfig({
  config: {},
  projectRoot: appRoot,
  staticConfigPath: null,
  packageJsonPath: join(appRoot, 'package.json'),
});

describe('CAR-01 — aucune permission de localisation', () => {
  it('le détecteur voit une permission, un module et une demande de position', () => {
    expect(findLocationUse('permissions: ["ACCESS_FINE_LOCATION"]')).not.toEqual([]);
    expect(findLocationUse("import * as Location from 'expo-location';")).not.toEqual([]);
    expect(findLocationUse('await Location.requestForegroundPermissionsAsync()')).not.toEqual([]);
    expect(findLocationUse('navigator.geolocation.getCurrentPosition(ok)')).not.toEqual([]);
    expect(findLocationUse('infoPlist: { NSLocationWhenInUseUsageDescription: "…" }')).not.toEqual(
      [],
    );
    expect(findLocationUse('const lieu = "Bafoussam"; // un lieu écrit à la main')).toEqual([]);
  });

  it('la configuration Expo ne déclare ni permission Android, ni texte iOS de localisation, ni module', () => {
    expect(findLocationUse(JSON.stringify(config))).toEqual([]);
    const permissions = config.android?.permissions ?? [];
    expect(permissions.filter((permission) => /LOCATION/iu.test(permission))).toEqual([]);
    const infoPlist = config.ios?.infoPlist ?? {};
    expect(Object.keys(infoPlist).filter((key) => /Location/u.test(key))).toEqual([]);
    const plugins = (config.plugins ?? []).map((entry) =>
      Array.isArray(entry) ? entry[0] : entry,
    );
    expect(plugins.filter((name) => /location/iu.test(String(name)))).toEqual([]);
  });

  it('aucune dépendance de géolocalisation dans l’app ni dans les paquets qu’elle embarque', () => {
    const manifests = [
      join(appRoot, 'package.json'),
      ...['domain', 'i18n', 'layout', 'sync', 'ui'].map((name) =>
        join(repoRoot, 'packages', name, 'package.json'),
      ),
    ];
    for (const manifest of manifests) {
      const json = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>;
      const names = ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((key) =>
        Object.keys((json[key] ?? {}) as Record<string, string>),
      );
      expect({
        manifest: relative(repoRoot, manifest),
        found: names.filter((name) => /location|geoloc/iu.test(name)),
      }).toEqual({
        manifest: relative(repoRoot, manifest),
        found: [],
      });
    }
  });

  it('aucun code de l’app ni des paquets embarqués ne demande ni ne lit la position', () => {
    const directories = [
      join(appRoot, 'src'),
      join(appRoot, 'plugins'),
      ...['domain', 'i18n', 'layout', 'sync', 'ui'].map((name) =>
        join(repoRoot, 'packages', name, 'src'),
      ),
    ];
    const files = [join(appRoot, 'app.config.ts'), ...directories.flatMap(sourceFiles)];
    expect(files.length).toBeGreaterThan(50);
    const offenders = files
      .map((file) => ({
        file: relative(repoRoot, file),
        found: findLocationUse(readFileSync(file, 'utf8')),
      }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });
});
