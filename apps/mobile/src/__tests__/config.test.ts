// Configuration Expo et EAS : nom, icônes et écran de lancement de la charte, Jour et Nuit
// automatiques, profils de build sans secret.
import { palette } from '@lignee/ui';
import type { ExpoConfig } from 'expo/config';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import createConfig from '../../app.config';
import {
  BACKUP_RULES_RESOURCE,
  DATA_EXTRACTION_RULES_RESOURCE,
  applyBackupRules,
  backupRulesXml,
  dataExtractionRulesXml,
} from '../../plugins/withLocalDataBackupRules';

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

  it('chiffre la base locale avec SQLCipher, clé dans le trousseau (CL-SEC-14)', () => {
    expect(plugin('expo-sqlite')).toEqual({ useSQLCipher: true });
    // Ses règles de sauvegarde sont reprises par withLocalDataBackupRules.
    expect(plugin('expo-secure-store')).toEqual({ configureAndroidBackup: false });
  });

  it('exclut la base et la clé des sauvegardes et des transferts d’appareil Android', () => {
    expect(config.android?.allowBackup).toBe(false);
    // Greffon appliqué : il a posé ses modifications du manifeste et des ressources Android.
    const { mods } = config as ExpoConfig & {
      mods?: { android?: { manifest?: unknown; dangerous?: unknown } };
    };
    expect(mods?.android?.manifest).toBeDefined();
    expect(mods?.android?.dangerous).toBeDefined();

    const manifest = applyBackupRules({
      manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' } }] },
    } as unknown as Parameters<typeof applyBackupRules>[0]);
    expect(manifest.manifest.application?.[0]?.$).toMatchObject({
      'android:allowBackup': 'false',
      'android:fullBackupContent': `@xml/${BACKUP_RULES_RESOURCE}`,
      'android:dataExtractionRules': `@xml/${DATA_EXTRACTION_RULES_RESOURCE}`,
    });

    const exclusions = [
      '<exclude domain="file" path="SQLite"/>',
      '<exclude domain="sharedpref" path="SecureStore"/>',
    ];
    const extraction = dataExtractionRulesXml();
    for (const section of ['cloud-backup', 'device-transfer']) {
      const start = extraction.indexOf(`<${section}>`);
      const end = extraction.indexOf(`</${section}>`);
      expect(start).toBeGreaterThanOrEqual(0);
      const body = extraction.slice(start, end);
      for (const exclusion of exclusions) expect(body).toContain(exclusion);
      expect(body).not.toContain('<include');
    }
    const legacy = backupRulesXml();
    for (const exclusion of exclusions) expect(legacy).toContain(exclusion);
    expect(legacy).not.toContain('<include');
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

  // Node des builds EAS : la version exacte des images Docker du serveur (mise à jour par
  // Dependabot), dans la version majeure de .nvmrc (poste et CI). .nvmrc ne donne que la majeure.
  it('construit avec le Node du serveur, dans la majeure de .nvmrc', () => {
    const repoRoot = join(appRoot, '..', '..');
    const node = (eas.build['base'] as { node?: string }).node;
    const dockerfile = readFileSync(join(repoRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
    const dockerNode = /^FROM node:(\d+\.\d+\.\d+)-/m.exec(dockerfile)?.[1];
    const nvmrc = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim();
    expect(node).toBe(dockerNode);
    expect(node?.split('.')[0]).toBe(nvmrc.split('.')[0]);
  });

  it('ne contient ni identifiant ni secret', () => {
    const text = JSON.stringify(eas);
    expect(text).not.toMatch(/projectId|password|apiKey|serviceAccount|ascAppId|appleId|token/i);
  });
});
