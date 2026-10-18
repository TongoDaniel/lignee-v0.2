// Régénère packages/ui/src/tokens.ts et src/fontFiles.ts depuis docs/charte/tokens.json.
// Lancement : `corepack pnpm --filter @lignee/ui tokens`.
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

import { repoRoot } from './paths.ts';
import { generateTokensFiles } from './tokens.ts';

for (const [path, content] of await generateTokensFiles()) {
  writeFileSync(path, content, 'utf8');
  console.log(`${relative(repoRoot, path)} régénéré depuis docs/charte/tokens.json.`);
}
