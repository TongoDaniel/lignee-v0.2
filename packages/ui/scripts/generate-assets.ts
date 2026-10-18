// Régénère packages/ui/src/icons/icons.generated.ts et src/logo/logo.generated.ts depuis les SVG
// de la charte (docs/charte/assets/Icones et Logos).
// Lancement : `corepack pnpm --filter @lignee/ui assets`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';

import { repoRoot } from './paths.ts';
import { generateAssetFiles } from './svg-assets.ts';

for (const [path, content] of await generateAssetFiles()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  console.log(`${relative(repoRoot, path)} régénéré depuis les SVG de la charte.`);
}
