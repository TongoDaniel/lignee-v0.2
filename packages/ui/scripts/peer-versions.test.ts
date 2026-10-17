// Les composants de @lignee/ui importent react, react-native, react-native-svg et
// react-native-safe-area-context : l'app doit les fournir (peerDependencies), et les versions de
// test de ce paquet doivent être exactement celles de l'app. Sinon pnpm installerait deux copies,
// et deux React dans l'app font planter les hooks.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { packageRoot, repoRoot } from './paths.ts';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPackage(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

const ui = readPackage(join(packageRoot, 'package.json'));
const mobile = readPackage(join(repoRoot, 'apps', 'mobile', 'package.json'));

describe('dépendances partagées avec l’app', () => {
  const peers = Object.keys(ui.peerDependencies ?? {});

  it('déclare React Native et ses modules en dépendances de pair, pas en dépendances', () => {
    expect(peers.sort()).toEqual([
      'react',
      'react-native',
      'react-native-safe-area-context',
      'react-native-svg',
    ]);
    expect(ui.dependencies ?? {}).toEqual({});
  });

  it.each(peers)('%s : même version pour les tests de @lignee/ui que dans l’app', (name) => {
    expect(mobile.dependencies?.[name]).toBeDefined();
    expect(ui.devDependencies?.[name]).toBe(mobile.dependencies?.[name]);
  });

  it.each(['jest', 'jest-expo', 'react-test-renderer', '@testing-library/react-native'])(
    '%s : même outil de test que l’app',
    (name) => {
      expect(ui.devDependencies?.[name]).toBe(mobile.devDependencies?.[name]);
    },
  );

  it('expo : même version que l’app (jest-expo s’appuie dessus)', () => {
    expect(ui.devDependencies?.['expo']).toBe(mobile.dependencies?.['expo']);
  });
});
