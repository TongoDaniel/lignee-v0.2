// Contrôle CON-12 en ligne de commande : `node tools/ci/src/check-forbidden-dependencies.ts [lockfile]`.
// Codes de sortie : 0 aucun paquet interdit ; 1 paquet interdit trouvé ; 2 lockfile illisible.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { findForbiddenInLockfile, type Violation } from './forbidden-dependencies.ts';

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

if (violations.length === 0) {
  console.log('CON-12 : aucune bibliothèque de reconnaissance faciale dans les dépendances.');
  process.exit(0);
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
