// src/tokens.ts et src/fontFiles.ts doivent être exactement ce que le générateur produit depuis
// docs/charte/tokens.json : ce test échoue si quelqu'un modifie la charte sans régénérer, ou un
// fichier généré à la main.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { charteComplements } from './charte-complements.ts';
import { CharteFormatError, parseCharteTokens } from './charte-tokens.ts';
import { fontFaces } from '../src/tokens.ts';
import { charteTokensPath, fontFilesOutputPath, packageRoot, tokensOutputPath } from './paths.ts';
import { generateTokensFiles } from './tokens.ts';
import {
  buildTokensSource,
  camelCase,
  FONT_FILES_HEADER,
  GENERATED_HEADER,
  parseShadow,
} from './tokens-source.ts';

const REGENERATE = 'corepack pnpm --filter @lignee/ui tokens';

function charteJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(charteTokensPath, 'utf8')) as Record<string, unknown>;
}

function readGenerated(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

describe('fichiers générés', () => {
  it.each([tokensOutputPath, fontFilesOutputPath])('%s est à jour avec la charte', async (path) => {
    const expected = (await generateTokensFiles()).get(path);
    expect(
      readGenerated(path) === expected,
      `${relative(packageRoot, path)} ne correspond pas à la charte : lancez « ${REGENERATE} » et ne modifiez pas ce fichier à la main.`,
    ).toBe(true);
  });
});

describe('src/fontFiles.ts', () => {
  // Le fichier n'est pas importé (ses require() ne se chargent que sous Metro) : on le lit.
  const source = readGenerated(fontFilesOutputPath);
  const entries = [
    ...source.matchAll(/'([A-Za-z0-9-]+)': require\('(\.\.\/assets\/fonts\/[^']+)'\)/g),
  ];

  it('porte l’en-tête « généré, ne pas modifier »', () => {
    expect(source.startsWith(FONT_FILES_HEADER)).toBe(true);
  });

  it('charge chaque police de la charte sous son nom (useFonts)', () => {
    expect(entries.map((m) => m[1]).sort()).toEqual(Object.keys(fontFaces).sort());
  });

  it('pointe vers les TTF de assets/fonts', () => {
    for (const [, name, path] of entries) {
      expect(existsSync(join(packageRoot, 'src', path ?? '')), path).toBe(true);
      expect(path).toBe(`../assets/fonts/${fontFaces[name as keyof typeof fontFaces].file}`);
    }
  });
});

describe('src/tokens.ts', () => {
  it('porte l’en-tête « généré, ne pas modifier »', () => {
    const committed = readFileSync(tokensOutputPath, 'utf8');
    expect(committed.startsWith(GENERATED_HEADER)).toBe(true);
    expect(GENERATED_HEADER).toContain('Fichier généré : ne pas modifier.');
  });

  it('change quand une couleur de la charte change', () => {
    const json = charteJson();
    const before = buildTokensSource(parseCharteTokens(json), charteComplements);
    const modified = structuredClone(json) as {
      color: { tokens: { name: string; value: unknown }[] };
    };
    const vert = modified.color.tokens.find((t) => t.name === 'vert-700');
    if (!vert) throw new Error('vert-700 absent de la charte');
    vert.value = '#123456';
    const after = buildTokensSource(parseCharteTokens(modified), charteComplements);
    expect(after).not.toBe(before);
    // La référence {vert-700} de `action` (Jour) suit la palette.
    expect(after).toMatch(/action: '#123456'/);
  });
});

describe('générateur', () => {
  it('écrit les noms en camelCase', () => {
    expect(camelCase('fond-carte')).toBe('fondCarte');
    expect(camelCase('titre-1')).toBe('titre1');
    expect(camelCase('personne-vert-fond')).toBe('personneVertFond');
  });

  it('découpe une ombre à deux couches', () => {
    expect(
      parseShadow('0 1px 2px rgba(0,0,0,0.4), 0 -8px 24px rgba(0, 0, 0, 0.32)', 'test'),
    ).toEqual([
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.4)' },
      { offsetX: 0, offsetY: -8, blurRadius: 24, spreadDistance: 0, color: 'rgba(0,0,0,0.32)' },
    ]);
  });

  it('refuse une ombre illisible', () => {
    expect(() => parseShadow('inset 0 1px red', 'ombre « x »')).toThrow(CharteFormatError);
  });

  it('refuse un style de texte sans fichier de police correspondant', () => {
    const json = structuredClone(charteJson()) as {
      type: { groups: { styles: { name: string; fontWeight: number }[] }[] };
    };
    const corps = json.type.groups.flatMap((g) => g.styles).find((s) => s.name === 'corps');
    if (!corps) throw new Error('corps absent de la charte');
    corps.fontWeight = 300;
    expect(() => buildTokensSource(parseCharteTokens(json), charteComplements)).toThrow(
      /style « corps » : aucune police Instrument Sans 300/,
    );
  });
});
