// Aucune couleur, taille, espacement ou rayon écrit en dur dans les composants (11-react-native.md :
// « Ne tapez jamais une couleur, une taille ou un rayon dans un composant ») : tout vient de
// tokens.ts, du thème, ou de components/metrics.ts (mesures propres à une fiche de composant).
// Ce contrôle lit les sources ; il ne couvre pas une valeur calculée ailleurs, la relecture si.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { packageRoot } from './paths.ts';

const SRC = join(packageRoot, 'src');
/** Seuls endroits où une valeur est écrite : les tokens générés, et les mesures des fiches. */
const ALLOWED = new Set(['tokens.ts', 'fontFiles.ts', join('components', 'metrics.ts')]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(generated|test)\./.test(entry.name) ? [path] : [];
  });
}

// Une propriété de style suivie d'un nombre littéral autre que 0 ou 1 (flex: 1, opacité pleine).
const STYLE_NUMBER =
  /\b(padding\w*|margin\w*|gap|rowGap|columnGap|fontSize|lineHeight|letterSpacing|border\w*(Width|Radius)|borderRadius|width|height|min(Width|Height)|max(Width|Height)|top|left|right|bottom|outline\w*|elevation)\s*:\s*-?(\d*\.\d+|[2-9]\d*|1\d+)\b/;
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

describe('composants sans valeur en dur', () => {
  const files = sources(SRC).filter((path) => !ALLOWED.has(relative(SRC, path)));

  it('lit bien les composants', () => {
    expect(files.map((f) => relative(SRC, f))).toContain(join('components', 'Button.tsx'));
  });

  it.each(files.map((f) => [relative(SRC, f), f]))('%s', (_name, path) => {
    const offending = readFileSync(path, 'utf8')
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*'))
      .filter(({ line }) => COLOR.test(line) || STYLE_NUMBER.test(line))
      .map(({ line, number }) => `${String(number)}: ${line}`);
    expect(offending).toEqual([]);
  });

  it('repère une couleur et une marge écrites en dur', () => {
    expect(COLOR.test("color: '#1E5A48'")).toBe(true);
    expect(STYLE_NUMBER.test('paddingHorizontal: 18,')).toBe(true);
    expect(STYLE_NUMBER.test('borderRadius: 16,')).toBe(true);
    expect(STYLE_NUMBER.test('flex: 1,')).toBe(false);
    expect(STYLE_NUMBER.test('paddingHorizontal: space[6],')).toBe(false);
  });
});
