// Régénère packages/ui/src/tokens.ts depuis docs/charte/tokens.json.
// Lancement : `corepack pnpm --filter @lignee/ui tokens`.
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

import { repoRoot, tokensOutputPath } from './paths.ts';
import { generateTokensFile } from './tokens.ts';

writeFileSync(tokensOutputPath, await generateTokensFile(), 'utf8');
console.log(`${relative(repoRoot, tokensOutputPath)} régénéré depuis docs/charte/tokens.json.`);
