// Génération des fichiers de packages/ui/src tirés de la charte (tokens.ts, fontFiles.ts),
// partagée par le script et son test.
import { readFileSync } from 'node:fs';

import { charteComplements } from './charte-complements.ts';
import { parseCharteTokens } from './charte-tokens.ts';
import { charteTokensPath, fontFilesOutputPath, tokensOutputPath } from './paths.ts';
import { buildFontFilesSource, buildTokensSource, formatTokensSource } from './tokens-source.ts';

/** Contenu attendu de chaque fichier généré, par chemin, pour la charte actuelle. */
export async function generateTokensFiles(): Promise<Map<string, string>> {
  const charte = parseCharteTokens(JSON.parse(readFileSync(charteTokensPath, 'utf8')) as unknown);
  return new Map([
    [
      tokensOutputPath,
      await formatTokensSource(buildTokensSource(charte, charteComplements), tokensOutputPath),
    ],
    [
      fontFilesOutputPath,
      await formatTokensSource(buildFontFilesSource(charte), fontFilesOutputPath),
    ],
  ]);
}
