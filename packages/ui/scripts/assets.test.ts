// Icônes et logo de l'app : src/icons/icons.generated.ts et src/logo/logo.generated.ts doivent être
// exactement ce que le générateur tire des SVG de la charte. Le test échoue si un SVG change sans
// régénération, si un fichier généré est modifié à la main, ou si un SVG sort des règles de la
// charte (grille de 24, trait de 2 au plus, encre unique, logo aux encres de son fond).
import { readdirSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { charteIconsDir, iconsOutputPath, logoOutputPath, packageRoot } from './paths.ts';
import {
  generateAssetFiles,
  iconShapes,
  LOGO_FILES,
  parseSvg,
  readIcons,
  readLogo,
  SvgFormatError,
  type LogoVariant,
} from './svg-assets.ts';

// Régénérer les fichiers lit les SVG de la charte et formate le résultat : plus de 5 s (délai par
// défaut de vitest) quand la CI lance tous les paquets en parallèle.
const HEAVY_TIMEOUT_MS = 30_000;

const REGENERATE = 'corepack pnpm --filter @lignee/ui assets';

function readGenerated(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

describe('fichiers générés', { timeout: HEAVY_TIMEOUT_MS }, () => {
  it.each([iconsOutputPath, logoOutputPath])('%s est à jour avec la charte', async (path) => {
    const expected = (await generateAssetFiles()).get(path);
    expect(
      readGenerated(path) === expected,
      `${relative(packageRoot, path)} ne correspond pas à la charte : lancez « ${REGENERATE} » et ne modifiez pas ce fichier à la main.`,
    ).toBe(true);
  });
});

describe('icônes', { timeout: HEAVY_TIMEOUT_MS }, () => {
  const icons = readIcons();

  it('reprend les 37 icônes de la charte, une par fichier', () => {
    const files = readdirSync(charteIconsDir).filter((f) => f.endsWith('.svg'));
    expect(files).toHaveLength(37);
    expect(icons.size).toBe(files.length);
    expect([...icons.keys()]).toContain('appareilPhoto');
  });

  it('garde pleines les quatre icônes pleines, et au trait les autres (points pleins à part)', () => {
    const filled = [...icons]
      .filter(([, shapes]) => shapes.every((s) => s.mode === 'fill'))
      .map(([name]) => name)
      .sort();
    // Les quatre icônes pleines de la charte, et `plus` (le menu : trois points pleins).
    expect(filled).toEqual(['lecture', 'lieu', 'pause', 'plus', 'santePlein']);
  });

  it('perce le point blanc de `lieu` au lieu de le peindre en blanc', () => {
    expect(icons.get('lieu')).toEqual([expect.objectContaining({ mode: 'fill', evenOdd: true })]);
  });

  it('refuse une icône hors grille, d’une autre encre ou au trait trop épais', () => {
    const svg = (attrs: string, viewBox = '0 0 24 24') =>
      parseSvg(`<svg viewBox="${viewBox}"><path d="M0 0" ${attrs}></path></svg>`, 'x.svg');
    const ok = 'fill="none" stroke="#15211D" stroke-linecap="round" stroke-linejoin="round"';
    expect(() => iconShapes(svg(`${ok} stroke-width="2"`, '0 0 48 48'), 'x.svg')).toThrow(
      SvgFormatError,
    );
    expect(() =>
      iconShapes(svg(ok.replace('#15211D', '#C4513A') + ' stroke-width="2"'), 'x.svg'),
    ).toThrow(SvgFormatError);
    expect(() => iconShapes(svg(`${ok} stroke-width="3"`), 'x.svg')).toThrow(SvgFormatError);
    expect(iconShapes(svg(`${ok} stroke-width="2"`), 'x.svg')).toEqual([
      { d: 'M0 0', mode: 'stroke' },
    ]);
  });

  it('refuse un élément que le lecteur ne sait pas dessiner', () => {
    expect(() => parseSvg('<svg viewBox="0 0 24 24"><rect width="2"/></svg>', 'x.svg')).toThrow(
      SvgFormatError,
    );
  });
});

describe('logo', { timeout: HEAVY_TIMEOUT_MS }, () => {
  const variants = Object.keys(LOGO_FILES) as LogoVariant[];

  it.each(variants)('%s : le fichier Nuit a le même dessin que le fichier Jour', (variant) => {
    // Chaque fichier n'est lu qu'avec les encres de son fond (vert et encre en Jour, or et crème
    // en Nuit) : une autre encre échoue à la lecture.
    expect(readLogo(variant, 'nuit')).toEqual(readLogo(variant, 'jour'));
  });

  it('a un symbole et un logotype dans les versions horizontale et verticale', () => {
    for (const variant of ['horizontal', 'vertical'] as const) {
      const parts = new Set(readLogo(variant).shapes.map((s) => s.part));
      expect([...parts].sort()).toEqual(['symbol', 'wordmark']);
    }
    expect(new Set(readLogo('symbol').shapes.map((s) => s.part))).toEqual(new Set(['symbol']));
    expect(new Set(readLogo('wordmark').shapes.map((s) => s.part))).toEqual(new Set(['wordmark']));
  });
});
