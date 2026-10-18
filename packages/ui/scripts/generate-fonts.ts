// Décompresse les WOFF2 de la charte en TTF dans packages/ui/assets/fonts, avec le texte de
// licence (OFL.txt) et les empreintes (empreintes.json).
// Lancement : `corepack pnpm --filter @lignee/ui fonts`.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { buildFontFiles, fontsOutputDir, repoRoot } from './fonts.ts';

const files = await buildFontFiles();
mkdirSync(fontsOutputDir, { recursive: true });
for (const name of readdirSync(fontsOutputDir)) {
  if (!files.has(name)) rmSync(join(fontsOutputDir, name));
}
for (const [name, content] of files) writeFileSync(join(fontsOutputDir, name), content);
console.log(
  `${String(files.size)} fichiers écrits dans ${relative(repoRoot, fontsOutputDir)} depuis docs/charte/fonts.`,
);
