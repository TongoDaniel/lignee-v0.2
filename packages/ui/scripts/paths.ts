// Chemins partagés par les scripts de génération et leurs tests.
import { join } from 'node:path';

export const packageRoot = join(import.meta.dirname, '..');
export const repoRoot = join(packageRoot, '..', '..');
export const charteDir = join(repoRoot, 'docs', 'charte');
export const charteTokensPath = join(charteDir, 'tokens.json');
export const charteFontsDir = join(charteDir, 'fonts');
export const tokensOutputPath = join(packageRoot, 'src', 'tokens.ts');
export const fontsOutputDir = join(packageRoot, 'assets', 'fonts');
