// Configuration Expo et EAS : nom, icônes et écran de lancement de la charte, Jour et Nuit
// automatiques, profils de build sans secret.
import { palette } from '@lignee/ui';
import type { ExpoConfig } from 'expo/config';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import createConfig from '../../app.config';

const appRoot = join(__dirname, '..', '..');
const config: ExpoConfig = createConfig({
  config: {},
  projectRoot: appRoot,
  staticConfigPath: null,
  packageJsonPath: join(appRoot, 'package.json'),
});

function plugin(name: string): Record<string, unknown> | undefined {
  for (const entry of config.plugins ?? []) {
    if (Array.isArray(entry) && entry[0] === name) return entry[1] as Record<string, unknown>;
  }
  return undefined;
}

function assetPaths(): string[] {
  const splash = plugin('expo-splash-screen');
  return [
    config.icon,
    config.android?.adaptiveIcon?.foregroundImage,
    config.android?.adaptiveIcon?.monochromeImage,
    splash?.['image'],
  ].filter((path): path is string => typeof path === 'string');
}

describe('app.config.ts', () => {
  it('s’appelle Lignée et suit le réglage Jour/Nuit du téléphone', () => {
    expect(config.name).toBe('Lignée');
    expect(config.userInterfaceStyle).toBe('automatic');
  });

  it('prend l’icône et l’écran de lancement dans les fichiers de la charte, qui existent', () => {
    const paths = assetPaths();
    expect(paths).toHaveLength(4);
    for (const path of paths) {
      expect(path).toMatch(/^\.\.\/\.\.\/docs\/charte\/assets\/Applications\//);
      expect(existsSync(resolve(appRoot, path))).toBe(true);
    }
  });

  it('pose l’écran de lancement sur Nuit 900, symbole de 160, et l’icône sur Vert 700', () => {
    expect(plugin('expo-splash-screen')).toMatchObject({
      backgroundColor: palette.nuit900,
      imageWidth: 160,
    });
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe(palette.vert700);
  });

  it('déclare les deux langues de l’interface au système', () => {
    expect(plugin('expo-localization')).toEqual({ supportedLocales: ['fr', 'en'] });
  });

  it('utilise Expo Router et le même identifiant sur Android et iOS', () => {
    expect(config.plugins).toContain('expo-router');
    expect(config.android?.package).toBe(config.ios?.bundleIdentifier);
  });
});

describe('eas.json', () => {
  const eas = JSON.parse(readFileSync(join(appRoot, 'eas.json'), 'utf8')) as {
    build: Record<string, Record<string, unknown>>;
  };

  it('a les profils développement, préproduction et production', () => {
    expect(Object.keys(eas.build)).toEqual(
      expect.arrayContaining(['development', 'preproduction', 'production']),
    );
    expect(eas.build['development']).toMatchObject({ developmentClient: true });
    expect(eas.build['production']).not.toHaveProperty('developmentClient');
  });

  it('ne contient ni identifiant ni secret', () => {
    const text = JSON.stringify(eas);
    expect(text).not.toMatch(/projectId|password|apiKey|serviceAccount|ascAppId|appleId|token/i);
  });
});
