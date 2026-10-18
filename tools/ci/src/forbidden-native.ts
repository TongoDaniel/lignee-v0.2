// CON-12, côté natif : « Aucune bibliothèque de reconnaissance faciale dans l'app ».
//
// Le lockfile (forbidden-dependencies.ts) ne voit que les paquets npm. Une bibliothèque native
// peut entrer sans paquet npm à son nom : dépendance Gradle ou pod CocoaPods ajoutés par un
// plugin de configuration Expo (app.config.ts, plugins/ de l'app), ou écrits dans les dossiers
// android/ et ios/ générés par `expo prebuild`. Ce module lit ces fichiers et y cherche les
// bibliothèques de visages connues (ML Kit, Vision d'Apple…) et les mêmes motifs que pour npm.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { FORBIDDEN_PATTERNS } from './forbidden-dependencies.ts';

export interface NativeViolation {
  /** Fichier, relatif à la racine du dépôt, avec des `/`. */
  readonly file: string;
  readonly line: number;
  readonly match: string;
  readonly reason: string;
}

interface NativePattern {
  readonly pattern: RegExp;
  readonly reason: string;
}

/** Coordonnées natives connues (Maven, CocoaPods, API du système). */
export const FORBIDDEN_NATIVE_PATTERNS: readonly NativePattern[] = [
  {
    pattern: /com\.google\.mlkit:face[-_a-z]*/i,
    reason: 'ML Kit Face Detection / Face Mesh (Gradle)',
  },
  {
    pattern: /com\.google\.android\.gms:play-services-mlkit-face[-_a-z]*/i,
    reason: 'ML Kit Face Detection des services Google Play (Gradle)',
  },
  { pattern: /GoogleMLKit\/Face[A-Za-z]*/, reason: 'ML Kit Face Detection (CocoaPods)' },
  { pattern: /MLKitFace[A-Za-z]*/, reason: 'ML Kit Face Detection (CocoaPods)' },
  {
    pattern: /VNDetectFace[A-Za-z]*|VNFaceObservation/,
    reason: 'détection de visages du framework Vision d’Apple',
  },
  {
    // « face » en début de mot ou de segment camelCase (FaceDetector, face-detection), jamais
    // à l'intérieur d'un mot (SurfaceDetection, InterfaceMesh).
    pattern:
      /(?:(?<![A-Za-z])[Ff]|(?<=[a-z0-9])F)ace[-_ ]?(?:[Dd]etect(?:ion|or)|[Rr]ecogni(?:tion|zer)|[Ll]andmarks?|[Mm]esh)|FACE[-_ ]?(?:DETECT|RECOGNI|LANDMARK|MESH)/,
    reason: 'traitement de visages',
  },
];

/** Dossiers jamais parcourus : dépendances, sorties de build, caches. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'build',
  '.gradle',
  '.cxx',
  '.expo',
  'Pods',
  'DerivedData',
  '.git',
]);

/** Fichiers natifs ou de configuration native d'une app. */
function isNativeConfigFile(path: string): boolean {
  const name = path.split(sep).pop() ?? '';
  return (
    /^app\.(?:config\.(?:ts|js|mjs|cjs)|json)$/.test(name) ||
    /\.gradle(?:\.kts)?$/.test(name) ||
    name === 'libs.versions.toml' ||
    name === 'Podfile' ||
    name === 'Podfile.lock' ||
    name === 'Podfile.properties.json' ||
    name.endsWith('.podspec')
  );
}

function walk(directory: string, onFile: (path: string) => void): void {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, onFile);
    else onFile(path);
  }
}

/**
 * Fichiers à lire sous `apps/` : configuration Expo de chaque app (app.config.*, app.json),
 * tout le dossier `plugins/` d'une app, et les fichiers Gradle et CocoaPods de `android/` et
 * `ios/` quand `expo prebuild` les a générés sur le poste.
 */
export function listNativeFiles(repoRoot: string): string[] {
  const appsDirectory = join(repoRoot, 'apps');
  if (!existsSync(appsDirectory)) return [];
  const files: string[] = [];
  for (const app of readdirSync(appsDirectory)) {
    const appDirectory = join(appsDirectory, app);
    if (!statSync(appDirectory).isDirectory()) continue;
    for (const entry of readdirSync(appDirectory)) {
      const path = join(appDirectory, entry);
      if (statSync(path).isFile() && isNativeConfigFile(path)) files.push(path);
    }
    const plugins = join(appDirectory, 'plugins');
    if (existsSync(plugins)) walk(plugins, (path) => files.push(path));
    for (const native of ['android', 'ios']) {
      const directory = join(appDirectory, native);
      if (existsSync(directory)) {
        walk(directory, (path) => {
          if (isNativeConfigFile(path)) files.push(path);
        });
      }
    }
  }
  return files.sort();
}

/** Références interdites dans le texte d'un fichier natif ou de configuration. */
export function findForbiddenNativeReferences(text: string, file: string): NativeViolation[] {
  const violations: NativeViolation[] = [];
  const patterns = [...FORBIDDEN_NATIVE_PATTERNS, ...FORBIDDEN_PATTERNS];
  text.split(/\r?\n/).forEach((content, index) => {
    for (const { pattern, reason } of patterns) {
      const found = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(content);
      if (found !== null) {
        violations.push({ file, line: index + 1, match: found[0], reason });
        break;
      }
    }
  });
  return violations;
}

/** Contrôle CON-12 sur les fichiers natifs des apps du dépôt. */
export function findForbiddenNativeInRepo(repoRoot: string): NativeViolation[] {
  return listNativeFiles(repoRoot).flatMap((path) =>
    findForbiddenNativeReferences(
      readFileSync(path, 'utf8'),
      relative(repoRoot, path).split(sep).join('/'),
    ),
  );
}
