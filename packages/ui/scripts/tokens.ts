// Génération de packages/ui/src/tokens.ts depuis la charte, partagée par le script et son test.
import { readFileSync } from 'node:fs';

import { charteComplements } from './charte-complements.ts';
import { parseCharteTokens } from './charte-tokens.ts';
import { charteTokensPath, tokensOutputPath } from './paths.ts';
import { buildTokensSource, formatTokensSource } from './tokens-source.ts';

/** Contenu attendu de src/tokens.ts pour la charte actuelle. */
export async function generateTokensFile(): Promise<string> {
  const charte = parseCharteTokens(JSON.parse(readFileSync(charteTokensPath, 'utf8')) as unknown);
  return formatTokensSource(buildTokensSource(charte, charteComplements), tokensOutputPath);
}
