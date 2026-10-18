// Contrôle CON-12 en ligne de commande : `node tools/ci/src/check-forbidden-dependencies.ts [lockfile]`.
// Lit le lockfile (paquets npm), puis les fichiers natifs des apps du dossier du lockfile
// (app.config.*, plugins/, android/ et ios/ générés : forbidden-native.ts).
// Codes de sortie : 0 rien d'interdit ; 1 paquet ou référence native interdits ; 2 lockfile illisible.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { findForbiddenInLockfile, type Violation } from './forbidden-dependencies.ts';
import { findForbiddenNativeInRepo } from './forbidden-native.ts';

const lockfilePath = resolve(process.argv[2] ?? 'pnpm-lock.yaml');
const inGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';

let violations: Violation[];
try {
  violations = findForbiddenInLockfile(readFileSync(lockfilePath, 'utf8'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CON-12 : impossible de lire ${lockfilePath}. ${message}`);
  process.exit(2);
}

const nativeViolations = findForbiddenNativeInRepo(dirname(lockfilePath));
for (const { file, line, match, reason } of nativeViolations) {
  console.error(`CON-12 : ${file}:${String(line)} : « ${match} » est interdit (${reason}).`);
  if (inGitHubActions) {
    console.log(`::error file=${file},line=${String(line)},title=CON-12::${match} (${reason}).`);
  }
}

if (violations.length === 0 && nativeViolations.length === 0) {
  console.log(
    'CON-12 : aucune bibliothèque de reconnaissance faciale dans les dépendances npm ' +
      'ni dans la configuration native des apps.',
  );
  process.exit(0);
}
if (violations.length === 0) {
  console.error('Retirez la référence native ou le plugin qui l’ajoute.');
  process.exit(1);
}

console.error(
  `CON-12 : ${String(violations.length)} paquet(s) interdit(s) dans ${lockfilePath} ` +
    '(« Aucune bibliothèque de reconnaissance faciale dans l’app ») :',
);
for (const { name, reason } of violations) {
  console.error(`  - ${name} : ${reason}`);
  if (inGitHubActions) {
    console.log(`::error file=pnpm-lock.yaml,title=CON-12::${name} est interdit (${reason}).`);
  }
}
console.error(
  'Retirez ce paquet ; `corepack pnpm why <paquet>` montre qui le tire. ' +
    'Si c’est un faux positif, corrigez tools/ci/src/forbidden-dependencies.ts et son test.',
);
process.exit(1);
