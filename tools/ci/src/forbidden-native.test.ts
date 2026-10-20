// CON-12, côté natif. Ces tests échouent si une bibliothèque de visages ajoutée par Gradle,
// CocoaPods ou un plugin Expo passe inaperçue, ou si le contrôle bloque une configuration saine.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  findForbiddenNativeInRepo,
  findForbiddenNativeReferences,
  listNativeFiles,
} from './forbidden-native.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const cliPath = join(import.meta.dirname, 'check-forbidden-dependencies.ts');
const LOCKFILE = "lockfileVersion: '9.0'\n\nimporters: {}\n\npackages: {}\n\nsnapshots: {}\n";

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** Faux dépôt : chemin relatif → contenu. */
function fakeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'con12-natif-'));
  temporary.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe('findForbiddenNativeReferences', () => {
  it.each([
    ["implementation 'com.google.mlkit:face-detection:16.1.7'", 'build.gradle'],
    ['implementation("com.google.android.gms:play-services-mlkit-face-detection:17.1.0")', 'x.kts'],
    ["pod 'GoogleMLKit/FaceDetection', '7.0.0'", 'Podfile'],
    ['  - MLKitFaceDetection (6.0.0):', 'Podfile.lock'],
    ["plugins: [['react-native-vision-camera-face-detector', {}]]", 'app.config.ts'],
    ['let request = VNDetectFaceRectanglesRequest()', 'Plugin.swift'],
    ["plugins: ['expo-face-recognition']", 'app.json'],
    ['import { FaceDetector } from "vision";', 'withFaces.js'],
    ['android.permission.FACE_DETECTION', 'AndroidManifest.xml'],
  ])('refuse %s', (line, file) => {
    expect(findForbiddenNativeReferences(line, file)).toHaveLength(1);
  });

  it.each([
    "implementation 'com.google.mlkit:barcode-scanning:17.3.0'",
    "pod 'GoogleMLKit/TextRecognition'",
    'interface SurfaceDetection {}',
    'val mesh = InterfaceMesh()',
    "plugins: ['expo-router', 'expo-localization', 'expo-sqlite']",
    'typeface = Typeface.DEFAULT',
  ])('laisse passer %s', (line) => {
    expect(findForbiddenNativeReferences(line, 'build.gradle')).toEqual([]);
  });

  it('donne le fichier, la ligne et la raison', () => {
    const [violation] = findForbiddenNativeReferences(
      "plugins {\n  id 'x'\n}\nimplementation 'com.google.mlkit:face-mesh-detection:16.0.0-beta1'\n",
      'apps/mobile/android/app/build.gradle',
    );
    expect(violation).toMatchObject({
      file: 'apps/mobile/android/app/build.gradle',
      line: 4,
      match: 'com.google.mlkit:face-mesh-detection',
    });
    expect(violation?.reason).toMatch(/ML Kit/);
  });
});

describe('listNativeFiles', () => {
  it('lit la configuration Expo, les plugins et les fichiers natifs générés, pas node_modules', () => {
    const root = fakeRepo({
      'apps/mobile/app.config.ts': '',
      'apps/mobile/app.json': '{}',
      'apps/mobile/package.json': '{}',
      'apps/mobile/plugins/withThing.js': '',
      'apps/mobile/android/app/build.gradle': '',
      'apps/mobile/android/gradle/libs.versions.toml': '',
      'apps/mobile/android/app/src/main/AndroidManifest.xml': '',
      'apps/mobile/ios/Podfile': '',
      'apps/mobile/ios/Podfile.lock': '',
      'apps/mobile/ios/Pods/Ignored/Podfile.lock': '',
      'apps/mobile/node_modules/x/build.gradle': '',
      'apps/api/src/index.ts': '',
    });
    const relativeFiles = listNativeFiles(root).map((path) =>
      path.slice(root.length + 1).replaceAll('\\', '/'),
    );
    expect(relativeFiles).toEqual([
      'apps/mobile/android/app/build.gradle',
      'apps/mobile/android/gradle/libs.versions.toml',
      'apps/mobile/app.config.ts',
      'apps/mobile/app.json',
      'apps/mobile/ios/Podfile',
      'apps/mobile/ios/Podfile.lock',
      'apps/mobile/plugins/withThing.js',
    ]);
  });
});

// Parcourt tout le dépôt : le délai par défaut de vitest (5 s) est trop court sous la charge de la CI.
describe('dépôt', { timeout: 30_000 }, () => {
  it('lit la configuration de l’app mobile', () => {
    const files = listNativeFiles(repoRoot).map((path) => path.replaceAll('\\', '/'));
    expect(files.some((path) => path.endsWith('apps/mobile/app.config.ts'))).toBe(true);
  });

  it('ne référence aucune bibliothèque native de visages (CON-12)', () => {
    expect(findForbiddenNativeInRepo(repoRoot)).toEqual([]);
  });
});

describe('script check-forbidden-dependencies, partie native', () => {
  function run(root: string): { status: number; output: string } {
    try {
      const output = execFileSync(process.execPath, [cliPath, join(root, 'pnpm-lock.yaml')], {
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

  it('sort en 0 quand la configuration native est saine', () => {
    const root = fakeRepo({
      'pnpm-lock.yaml': LOCKFILE,
      'apps/mobile/app.config.ts': "export default { plugins: ['expo-router'] };\n",
    });
    expect(run(root).status).toBe(0);
  });

  it('sort en 1 et nomme le fichier quand un plugin ajoute ML Kit Face Detection', () => {
    const root = fakeRepo({
      'pnpm-lock.yaml': LOCKFILE,
      'apps/mobile/plugins/withFaces.js':
        'module.exports = (c) => withAppBuildGradle(c, (g) => g + "implementation \'com.google.mlkit:face-detection:16.1.7\'");\n',
    });
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/apps\/mobile\/plugins\/withFaces\.js:1/);
  });
});
