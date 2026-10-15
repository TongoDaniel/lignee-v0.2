// CON-12 (PRD, Confidentialité) : « Aucune bibliothèque de reconnaissance faciale dans l'app ».
// Les données biométriques sont sensibles au Cameroun comme dans le RGPD : on identifie les
// personnes à la main (Présentation, « Ce que Lignée ne fera pas »).
//
// Le contrôle lit pnpm-lock.yaml, qui recense toutes les dépendances, directes et transitives,
// de tous les paquets du monorepo.
import { parse } from 'yaml';

export interface ForbiddenPackage {
  readonly name: string;
  readonly reason: string;
}

export interface ForbiddenPattern {
  readonly pattern: RegExp;
  readonly reason: string;
}

export interface Violation {
  readonly name: string;
  readonly reason: string;
}

/** Paquets interdits nommément, quand leur nom ne trahit pas leur usage. */
export const FORBIDDEN_PACKAGES: readonly ForbiddenPackage[] = [
  { name: '@vladmandic/human', reason: 'détection, description et reconnaissance de visages' },
  { name: '@mediapipe/tasks-vision', reason: 'contient la détection et le maillage de visages' },
  { name: '@azure/cognitiveservices-face', reason: 'service de reconnaissance de visages Azure' },
  { name: '@azure-rest/ai-vision-face', reason: 'service de reconnaissance de visages Azure' },
  { name: 'react-native-camera', reason: 'détection de visages intégrée (ML Kit)' },
  { name: 'clmtrackr', reason: 'suivi des points du visage' },
  { name: 'jeelizfacefilter', reason: 'détection et suivi de visages' },
];

// Un motif commence au début du nom ou après un séparateur (`/`, `@`, `-`, `_`, `.`), pour ne pas
// confondre `face` avec `interface`, `typeface` ou `surface`.
const START = String.raw`(?:^|[/@._-])`;
const END = String.raw`(?![a-z])`;
const FACE_KEYWORDS = [
  'api',
  'recognition',
  'recognizer',
  'detection',
  'detector',
  'landmarks?',
  'mesh',
  'matcher',
  'matching',
  'verification',
  'embeddings?',
  'compare',
  'net',
  'tracker',
  'tracking',
].join('|');

/** Motifs interdits : noms qui annoncent un traitement de visages. */
export const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  {
    pattern: new RegExp(`${START}face[-_.]?(?:${FACE_KEYWORDS})${END}`, 'i'),
    reason: 'traitement de visages (détection, repères, reconnaissance)',
  },
  {
    pattern: new RegExp(
      `${START}(?:blazeface|arcface|facenet|insightface|retinaface|deepface|mtcnn|compreface)${END}`,
      'i',
    ),
    reason: 'modèle de détection ou de reconnaissance de visages',
  },
  { pattern: /facial/i, reason: 'analyse faciale' },
  { pattern: /rekognition/i, reason: 'service de reconnaissance de visages AWS' },
];

/**
 * Nom du paquet à partir d'une clé du lockfile pnpm 9 : `nom@version`, `@portée/nom@version`,
 * éventuellement suivie des dépendances pairs entre parenthèses. Le nom ne contient jamais `@`
 * en dehors de la portée : on coupe au premier `@` après le premier caractère.
 */
export function packageNameFromLockKey(key: string): string | undefined {
  const at = key.indexOf('@', 1);
  if (at <= 0) {
    return undefined;
  }
  return key.slice(0, at);
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Tous les noms de paquets présents dans un lockfile pnpm au format 9. Lève une erreur si le
 * texte n'est pas un lockfile de ce format : un contrôle qui ne voit plus rien serait un faux vert.
 */
export function listLockfilePackageNames(lockfileText: string): Set<string> {
  const lockfile: unknown = parse(lockfileText);
  if (!isRecord(lockfile)) {
    throw new Error('Lockfile illisible : format inattendu (objet YAML attendu).');
  }
  const version = lockfile['lockfileVersion'];
  if (typeof version !== 'string' && typeof version !== 'number') {
    throw new Error('Lockfile illisible : format inconnu, `lockfileVersion` absent.');
  }
  if (!String(version).startsWith('9')) {
    throw new Error(
      `Lockfile au format ${String(version)} : format non pris en charge (9 attendu). ` +
        'Mettez à jour tools/ci/src/forbidden-dependencies.ts.',
    );
  }

  const names = new Set<string>();
  for (const section of ['packages', 'snapshots'] as const) {
    const entries = lockfile[section];
    if (isRecord(entries)) {
      for (const key of Object.keys(entries)) {
        const name = packageNameFromLockKey(key);
        if (name !== undefined) {
          names.add(name);
        }
      }
    }
  }

  const importers = lockfile['importers'];
  if (isRecord(importers)) {
    for (const importer of Object.values(importers)) {
      if (!isRecord(importer)) {
        continue;
      }
      for (const field of DEPENDENCY_FIELDS) {
        const dependencies = importer[field];
        if (isRecord(dependencies)) {
          for (const name of Object.keys(dependencies)) {
            names.add(name);
          }
        }
      }
    }
  }

  return names;
}

/** Paquets interdits parmi `names`, triés par nom, chacun une seule fois. */
export function findForbiddenDependencies(names: Iterable<string>): Violation[] {
  const violations = new Map<string, Violation>();
  for (const name of names) {
    const normalized = name.toLowerCase();
    const listed = FORBIDDEN_PACKAGES.find((entry) => entry.name === normalized);
    const matched = FORBIDDEN_PATTERNS.find((entry) => entry.pattern.test(normalized));
    const reason = listed?.reason ?? matched?.reason;
    if (reason !== undefined) {
      violations.set(name, { name, reason });
    }
  }
  return [...violations.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Contrôle CON-12 sur le texte d'un pnpm-lock.yaml. */
export function findForbiddenInLockfile(lockfileText: string): Violation[] {
  return findForbiddenDependencies(listLockfilePackageNames(lockfileText));
}
