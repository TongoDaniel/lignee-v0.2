// CON-12 (PRD) : « Aucune bibliothèque de reconnaissance faciale dans l'app ».
// Ces tests échouent si le contrôle laisse passer un paquet interdit, s'il bloque un paquet
// légitime, ou s'il ne sait plus lire le lockfile.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  FORBIDDEN_PACKAGES,
  FORBIDDEN_SCOPES,
  findForbiddenDependencies,
  findForbiddenInLockfile,
  listLockfilePackageNames,
  packageNameFromLockKey,
} from './forbidden-dependencies.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const cliPath = join(import.meta.dirname, 'check-forbidden-dependencies.ts');

/** Lockfile pnpm (format 9) minimal, avec des paquets fictifs. */
function lockfile(packageKeys: readonly string[], snapshotKeys: readonly string[] = []): string {
  const packages = packageKeys
    .map((key) => `  '${key}':\n    resolution: {integrity: sha512-AAAA}\n`)
    .join('\n');
  const snapshots = snapshotKeys.map((key) => `  '${key}': {}\n`).join('\n');
  return [
    "lockfileVersion: '9.0'",
    '',
    'settings:',
    '  autoInstallPeers: true',
    '  excludeLinksFromLockfile: false',
    '',
    'importers:',
    '  .:',
    '    devDependencies:',
    '      left-pad:',
    '        specifier: 1.3.0',
    '        version: 1.3.0',
    '',
    packageKeys.length > 0 ? 'packages:\n\n' + packages : 'packages: {}',
    '',
    snapshotKeys.length > 0 ? 'snapshots:\n\n' + snapshots : 'snapshots: {}',
    '',
  ].join('\n');
}

describe('packageNameFromLockKey', () => {
  it.each([
    ['left-pad@1.3.0', 'left-pad'],
    ['@vladmandic/face-api@1.7.13', '@vladmandic/face-api'],
    ['@rolldown/binding-linux-x64-gnu@1.2.14', '@rolldown/binding-linux-x64-gnu'],
    ['eslint-plugin-jsx-a11y@6.10.2(eslint@10.11.0)', 'eslint-plugin-jsx-a11y'],
    ['@scope/pkg@2.0.0(@types/node@24.19.0)(typescript@6.0.3)', '@scope/pkg'],
    ['tool@git+ssh://git@github.com/acme/tool.git#abc123', 'tool'],
    ['/legacy-key/1.0.0', undefined],
  ])('%s -> %s', (key, expected) => {
    expect(packageNameFromLockKey(key)).toBe(expected);
  });
});

describe('findForbiddenDependencies', () => {
  it.each(FORBIDDEN_PACKAGES.map((entry) => entry.name))(
    'refuse le paquet de la liste %s',
    (name) => {
      expect(findForbiddenDependencies([name]).map((v) => v.name)).toEqual([name]);
    },
  );

  it.each([
    'face-api.js',
    'face-recognition',
    'node-facenet',
    'expo-face-detector',
    'react-native-face-detection',
    'react-native-vision-camera-face-detector',
    '@react-native-ml-kit/face-detection',
    '@infinitered/react-native-mlkit-face-detection',
    '@mediapipe/face_detection',
    '@mediapipe/face_mesh',
    '@tensorflow-models/face-landmarks-detection',
    '@tensorflow-models/blazeface',
    '@aws-sdk/client-rekognition',
    'Facial-Expression-Kit',
    'insightface-js',
    'compreface-js-sdk',
    // Faux négatifs relevés en relecture de T-002.
    'face.detect',
    'face-js',
    'node-face-recog',
    'faces-api',
    'face-recognizer-lite',
    'react-native-face-id',
  ])('refuse par motif %s', (name) => {
    expect(findForbiddenDependencies([name])).toHaveLength(1);
  });

  it.each([
    'facetec',
    '@facetec/sdk',
    'faceio',
    '@faceio/fiojs',
    'faceplusplus',
    'facepp',
    '@luxand/cloud',
    '@react-native-firebase/ml-vision',
  ])('refuse le paquet ou la portée %s', (name) => {
    expect(findForbiddenDependencies([name]).map((v) => v.name)).toEqual([name]);
  });

  it.each(FORBIDDEN_SCOPES.map((entry) => entry.scope))('refuse toute la portée %s', (scope) => {
    expect(findForbiddenDependencies([scope + '/nouveau-paquet'])).toHaveLength(1);
  });

  it.each([
    'interface-datastore',
    'interface-ipld-format',
    'surface-api',
    'typeface-roboto',
    'facet-api',
    '@clerk/facets',
    'react-facebook-login',
    '@react-native-firebase/app',
    'faceted-search',
    'faceless-ui',
    'typeface-inter',
    'surface-nets',
    'preface',
    '@types/facebook-js-sdk',
    'expo-local-authentication',
    'expo-camera',
    'expo-image-manipulator',
    'sharp',
  ])('laisse passer %s', (name) => {
    expect(findForbiddenDependencies([name])).toEqual([]);
  });

  it('donne une raison pour chaque refus', () => {
    const [violation] = findForbiddenDependencies(['@vladmandic/human']);
    expect(violation?.reason).toMatch(/visage/);
  });
});

describe('findForbiddenInLockfile', () => {
  it('ne signale rien sur un lockfile propre', () => {
    expect(findForbiddenInLockfile(lockfile(['left-pad@1.3.0', 'yaml@2.9.1']))).toEqual([]);
  });

  it('signale une dépendance directe interdite', () => {
    const violations = findForbiddenInLockfile(
      lockfile(['left-pad@1.3.0', '@vladmandic/face-api@1.7.13']),
    );
    expect(violations.map((v) => v.name)).toEqual(['@vladmandic/face-api']);
  });

  it('signale une dépendance transitive vue seulement dans les instantanés', () => {
    const violations = findForbiddenInLockfile(
      lockfile(['left-pad@1.3.0'], ['expo-face-detector@13.0.2(expo@54.0.0)']),
    );
    expect(violations.map((v) => v.name)).toEqual(['expo-face-detector']);
  });

  it('signale une dépendance déclarée dans un paquet du monorepo', () => {
    const text = lockfile([]).replace(
      'importers:\n  .:',
      'importers:\n  apps/mobile:\n    dependencies:\n      face-api.js:\n        specifier: 0.22.2\n        version: 0.22.2\n  .:',
    );
    expect(findForbiddenInLockfile(text).map((v) => v.name)).toEqual(['face-api.js']);
  });

  it('ne compte chaque paquet interdit qu’une fois, quelle que soit la version', () => {
    const violations = findForbiddenInLockfile(
      lockfile(['face-api.js@0.22.1', 'face-api.js@0.22.2'], ['face-api.js@0.22.2']),
    );
    expect(violations).toHaveLength(1);
  });

  it('refuse un format de lockfile inconnu plutôt que de ne rien voir', () => {
    expect(() => findForbiddenInLockfile("lockfileVersion: '6.0'\npackages: {}\n")).toThrow(
      /format/,
    );
    expect(() => findForbiddenInLockfile('packages: {}\n')).toThrow(/format/);
  });

  it('refuse un lockfile illisible', () => {
    expect(() => findForbiddenInLockfile('lockfileVersion: [\n')).toThrow();
    expect(() => findForbiddenInLockfile('')).toThrow(/format/);
  });

  it('lit tous les noms du lockfile', () => {
    const names = listLockfilePackageNames(lockfile(['yaml@2.9.1'], ['vitest@5.0.3(yaml@2.9.1)']));
    expect([...names].sort()).toEqual(['left-pad', 'vitest', 'yaml']);
  });
});

// Le lockfile réel grandit avec les dépendances : son analyse dépasse parfois les 5 s par défaut
// de vitest quand turbo lance tous les paquets en parallèle sur un runner de CI.
const REAL_LOCKFILE_TIMEOUT_MS = 30_000;

describe('pnpm-lock.yaml du dépôt', () => {
  it(
    'ne contient aucune bibliothèque de reconnaissance faciale (CON-12)',
    () => {
      const text = readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8');
      expect(listLockfilePackageNames(text).size).toBeGreaterThan(50);
      expect(findForbiddenInLockfile(text)).toEqual([]);
    },
    REAL_LOCKFILE_TIMEOUT_MS,
  );
});

describe('script check-forbidden-dependencies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lignee-con12-'));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(lockfileText: string | undefined): { status: number; output: string } {
    const path = join(dir, `pnpm-lock-${String(Math.random()).slice(2)}.yaml`);
    if (lockfileText !== undefined) {
      writeFileSync(path, lockfileText);
    }
    try {
      const output = execFileSync(process.execPath, [cliPath, path], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, GITHUB_ACTIONS: '' },
      });
      return { status: 0, output };
    } catch (error) {
      const failure = error as { status: number; stdout: string; stderr: string };
      return { status: failure.status, output: failure.stdout + failure.stderr };
    }
  }

  it('sort en 0 sur un lockfile propre', () => {
    const result = run(lockfile(['left-pad@1.3.0']));
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/CON-12/);
  });

  it('sort en 1 et nomme le paquet fautif', () => {
    const result = run(lockfile(['left-pad@1.3.0', 'face-api.js@0.22.2']));
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/face-api\.js/);
  });

  it('sort en 2 si le lockfile est introuvable', () => {
    const result = run(undefined);
    expect(result.status).toBe(2);
    expect(result.output).toMatch(/impossible de lire/);
  });

  it('sort en 2 si le lockfile est illisible', () => {
    const result = run("lockfileVersion: '5.4'\n");
    expect(result.status).toBe(2);
  });
});
