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

/**
 * Version exacte dans une plage « ^x.y.z » (règle de npm : même majeure, ou même mineure quand la
 * majeure est 0, et au moins la version de la plage).
 */
export function satisfiesCaret(version: string, range: string): boolean {
  const parse = (v: string) => v.replace(/^\^/, '').split('.').map(Number);
  if (!range.startsWith('^')) return false;
  const [major = 0, minor = 0, patch = 0] = parse(version);
  const [rMajor = 0, rMinor = 0, rPatch = 0] = parse(range);
  if (major !== rMajor) return false;
  if (rMajor === 0 && minor !== rMinor) return false;
  if (minor !== rMinor) return minor > rMinor;
  return patch >= rPatch;
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

  it.each(peers)('%s : plage étroite « ^ », que la version de l’app respecte', (name) => {
    const range = ui.peerDependencies?.[name] ?? '';
    expect(range).toMatch(/^\^\d+\.\d+\.\d+$/);
    expect(satisfiesCaret(mobile.dependencies?.[name] ?? '', range)).toBe(true);
  });

  it('lit les plages « ^ » comme npm', () => {
    expect(satisfiesCaret('0.86.3', '^0.86.0')).toBe(true);
    expect(satisfiesCaret('0.87.0', '^0.86.0')).toBe(false);
    expect(satisfiesCaret('19.3.0', '^19.2.0')).toBe(true);
    expect(satisfiesCaret('19.1.9', '^19.2.0')).toBe(false);
    expect(satisfiesCaret('20.0.0', '^19.2.0')).toBe(false);
    expect(satisfiesCaret('19.2.0', '*')).toBe(false);
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
