// Lecture des SVG de la charte (docs/charte/assets/Icones et Logos) et fabrication des fichiers
// src/icons/icons.generated.ts et src/logo/logo.generated.ts. Les SVG de la charte n'utilisent
// que <svg>, <g>, <path> et <circle>, avec des attributs de présentation : ce lecteur s'en tient
// là et refuse tout le reste, pour qu'un nouveau fichier plus riche ne soit pas tronqué en silence.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { format, resolveConfig } from 'prettier';

import { palette, stroke } from '../src/tokens.ts';
import { charteIconsDir, charteLogosDir, iconsOutputPath, logoOutputPath } from './paths.ts';

export class SvgFormatError extends Error {
  override name = 'SvgFormatError';
}

/** Une forme à plat : les attributs des groupes parents sont recopiés sur chaque forme. */
export interface RawShape {
  readonly tag: 'path' | 'circle';
  readonly attrs: Readonly<Record<string, string>>;
}

export interface RawSvg {
  readonly viewBox: string;
  readonly shapes: readonly RawShape[];
}

const PRESENTATION = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
]);

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) {
    attrs[match[1] ?? ''] = match[2] ?? '';
  }
  return attrs;
}

/** Lit un SVG de la charte et aplatit ses groupes. */
export function parseSvg(text: string, name: string): RawSvg {
  const stack: Record<string, string>[] = [];
  const shapes: RawShape[] = [];
  let viewBox: string | undefined;
  const body = text.replace(/<title>[^<]*<\/title>/g, '');
  for (const match of body.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, tag = '', rawAttrs = '', selfClosing] = match;
    if (closing === '/') {
      if (tag === 'g') stack.pop();
      continue;
    }
    const attrs = parseAttrs(rawAttrs);
    const inherited: Record<string, string> = {};
    for (const frame of stack) Object.assign(inherited, frame);
    switch (tag) {
      case 'svg':
        viewBox = attrs['viewBox'];
        break;
      case 'g':
        if (selfClosing !== '/') {
          stack.push(
            Object.fromEntries(Object.entries(attrs).filter(([k]) => PRESENTATION.has(k))),
          );
        }
        break;
      case 'path':
      case 'circle':
        shapes.push({ tag, attrs: { ...inherited, ...attrs } });
        break;
      default:
        throw new SvgFormatError(`${name} : élément <${tag}> non pris en charge.`);
    }
  }
  if (viewBox === undefined) throw new SvgFormatError(`${name} : viewBox absent.`);
  return { viewBox, shapes };
}

function sameColor(a: string | undefined, b: string): boolean {
  return a !== undefined && a.toUpperCase() === b.toUpperCase();
}

async function formatSource(source: string, targetPath: string): Promise<string> {
  const config = await resolveConfig(targetPath);
  return format(source, { ...config, filepath: targetPath });
}

// ---------------------------------------------------------------------------------------------
// Icônes

/** Une forme d'icône : au trait (`stroke.icone`), pleine, ou pleine et percée (pair-impair). */
export interface IconShape {
  readonly d: string;
  readonly mode: 'stroke' | 'fill';
  /** Remplissage pair-impair : le second sous-tracé perce le premier (point de `lieu`). */
  readonly evenOdd?: true;
  /**
   * Trait plus fin que `stroke.icone`, dessiné ainsi dans la charte pour un détail (1,8 dans
   * `anniversaire`, `document`, `photo`). Absent : `stroke.icone`.
   */
  readonly strokeWidth?: number;
}

/** Encre des fichiers d'icônes (README des icônes : encre-900), recolorée dans le code. */
export const ICON_INK = palette.encre900;
/** Le blanc d'une icône pleine est un trou : il laisse voir ce qu'il y a dessous. */
const ICON_KNOCKOUT = palette.blanc;

export function iconShapes(svg: RawSvg, name: string): IconShape[] {
  if (svg.viewBox !== '0 0 24 24') {
    throw new SvgFormatError(`${name} : une icône est sur la grille de 24 (viewBox 0 0 24 24).`);
  }
  const out: IconShape[] = [];
  for (const { tag, attrs } of svg.shapes) {
    if (tag !== 'path') throw new SvgFormatError(`${name} : une icône n'a que des <path>.`);
    const d = attrs['d'] ?? '';
    const fill = attrs['fill'];
    const strokeColor = attrs['stroke'];
    if (strokeColor !== undefined && strokeColor !== 'none') {
      if (!sameColor(strokeColor, ICON_INK)) {
        throw new SvgFormatError(`${name} : trait ${strokeColor}, attendu ${ICON_INK}.`);
      }
      const width = Number(attrs['stroke-width']);
      if (!(width > 0 && width <= stroke.icone)) {
        throw new SvgFormatError(
          `${name} : trait de ${String(attrs['stroke-width'])}, attendu ${String(stroke.icone)} au plus.`,
        );
      }
      if (attrs['stroke-linecap'] !== 'round' || attrs['stroke-linejoin'] !== 'round') {
        throw new SvgFormatError(`${name} : extrémités et jonctions arrondies attendues.`);
      }
      if (fill !== 'none') throw new SvgFormatError(`${name} : un tracé au trait est sans fond.`);
      out.push(
        width === stroke.icone ? { d, mode: 'stroke' } : { d, mode: 'stroke', strokeWidth: width },
      );
    } else if (sameColor(fill, ICON_INK)) {
      out.push({ d, mode: 'fill' });
    } else if (sameColor(fill, ICON_KNOCKOUT)) {
      const previous = out.pop();
      if (previous?.mode !== 'fill') {
        throw new SvgFormatError(`${name} : un blanc doit suivre la forme pleine qu'il perce.`);
      }
      out.push({ d: `${previous.d} ${d}`, mode: 'fill', evenOdd: true });
    } else {
      throw new SvgFormatError(`${name} : couleur ${String(fill)} inattendue.`);
    }
  }
  return out;
}

/** « appareil-photo.svg » → « appareilPhoto ». */
export function iconKey(fileName: string): string {
  return basename(fileName, '.svg').replace(/-([a-z])/g, (_m: string, c: string) =>
    c.toUpperCase(),
  );
}

export function readIcons(dir = charteIconsDir): Map<string, IconShape[]> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort();
  return new Map(
    files.map((file) => [
      iconKey(file),
      iconShapes(parseSvg(readFileSync(join(dir, file), 'utf8'), file), file),
    ]),
  );
}

export const GENERATED_HEADER_ICONS = [
  '// Fichier généré : ne pas modifier.',
  '// Source : docs/charte/assets/Icones/*.svg. Générateur : packages/ui/scripts/generate-assets.ts.',
  '// Pour changer une icône, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui assets`.',
].join('\n');

export function buildIconsSource(icons: Map<string, IconShape[]>): string {
  const entries = [...icons].map(([key, shapes]) => `${key}: ${JSON.stringify(shapes)},`);
  return [
    GENERATED_HEADER_ICONS,
    '',
    '/** Une forme d’icône : au trait (`stroke.icone`), pleine, ou pleine et percée (pair-impair). */',
    'export interface IconShape {',
    '  readonly d: string;',
    "  readonly mode: 'stroke' | 'fill';",
    '  readonly evenOdd?: true;',
    '  /** Trait plus fin que `stroke.icone` pour un détail du dessin ; absent : `stroke.icone`. */',
    '  readonly strokeWidth?: number;',
    '}',
    '',
    '/** Jeu d’icônes Lignée : grille de 24, trait de 2, extrémités arrondies (05-iconographie.md). */',
    `export const iconShapes = {\n${entries.join('\n')}\n} as const satisfies Record<string, readonly IconShape[]>;`,
    '',
    'export type IconName = keyof typeof iconShapes;',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Logo

/** Partie du logo, colorée selon le fond (02-logo.md) : le symbole ou le logotype. */
export type LogoPart = 'symbol' | 'wordmark';

export interface LogoShape {
  readonly tag: 'path' | 'circle';
  readonly part: LogoPart;
  readonly mode: 'stroke' | 'fill';
  readonly d?: string;
  readonly cx?: number;
  readonly cy?: number;
  readonly r?: number;
  readonly strokeWidth?: number;
}

export interface LogoDrawing {
  readonly viewBox: string;
  readonly shapes: readonly LogoShape[];
}

/** Variantes du logo et leurs fichiers Jour (symbole vert, logotype encre). */
export const LOGO_FILES = {
  horizontal: 'lignee-logo-horizontal-jour.svg',
  vertical: 'lignee-logo-vertical-jour.svg',
  symbol: 'lignee-symbole-vert.svg',
  symbolCompact: 'lignee-symbole-compact-vert.svg',
  wordmark: 'lignee-logotype-encre.svg',
} as const;
export type LogoVariant = keyof typeof LOGO_FILES;

/** Fichiers Nuit (symbole or, logotype crème) : même dessin, autres encres. */
export const LOGO_NIGHT_FILES: { readonly [K in LogoVariant]: string } = {
  horizontal: 'lignee-logo-horizontal-nuit.svg',
  vertical: 'lignee-logo-vertical-nuit.svg',
  symbol: 'lignee-symbole-or.svg',
  symbolCompact: 'lignee-symbole-compact-or.svg',
  wordmark: 'lignee-logotype-creme.svg',
};

/** Encres des logos par fond (02-logo.md, assets/Logos/README.md). */
export const LOGO_INKS = {
  jour: { symbol: palette.vert700, wordmark: palette.encre900 },
  nuit: { symbol: palette.or500, wordmark: palette.creme50 },
} as const;

export function logoDrawing(
  svg: RawSvg,
  name: string,
  inks: { readonly symbol: string; readonly wordmark: string },
): LogoDrawing {
  const partOf = (color: string | undefined): LogoPart => {
    if (sameColor(color, inks.symbol)) return 'symbol';
    if (sameColor(color, inks.wordmark)) return 'wordmark';
    throw new SvgFormatError(`${name} : encre ${String(color)} inattendue.`);
  };
  const shapes = svg.shapes.map(({ tag, attrs }): LogoShape => {
    const stroked = attrs['stroke'] !== undefined && attrs['stroke'] !== 'none';
    const base = {
      tag,
      part: partOf(stroked ? attrs['stroke'] : attrs['fill']),
      mode: stroked ? ('stroke' as const) : ('fill' as const),
      ...(stroked ? { strokeWidth: Number(attrs['stroke-width']) } : {}),
    };
    if (tag === 'circle') {
      return { ...base, cx: Number(attrs['cx']), cy: Number(attrs['cy']), r: Number(attrs['r']) };
    }
    return { ...base, d: attrs['d'] ?? '' };
  });
  return { viewBox: svg.viewBox, shapes };
}

export function readLogo(
  variant: LogoVariant,
  scheme: 'jour' | 'nuit' = 'jour',
  dir = charteLogosDir,
): LogoDrawing {
  const file = scheme === 'jour' ? LOGO_FILES[variant] : LOGO_NIGHT_FILES[variant];
  return logoDrawing(
    parseSvg(readFileSync(join(dir, file), 'utf8'), file),
    file,
    LOGO_INKS[scheme],
  );
}

export const GENERATED_HEADER_LOGO = [
  '// Fichier généré : ne pas modifier.',
  '// Source : docs/charte/assets/Logos/*.svg. Générateur : packages/ui/scripts/generate-assets.ts.',
  '// Pour changer le logo, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui assets`.',
].join('\n');

export function buildLogoSource(): string {
  const variants = Object.keys(LOGO_FILES) as LogoVariant[];
  const entries = variants.map((v) => `${v}: ${JSON.stringify(readLogo(v))},`);
  return [
    GENERATED_HEADER_LOGO,
    '',
    '/** Partie du logo : le symbole (vert en Jour, or en Nuit) ou le logotype (encre, crème). */',
    "export type LogoPart = 'symbol' | 'wordmark';",
    '',
    'export interface LogoShape {',
    "  readonly tag: 'path' | 'circle';",
    '  readonly part: LogoPart;',
    "  readonly mode: 'stroke' | 'fill';",
    '  readonly d?: string;',
    '  readonly cx?: number;',
    '  readonly cy?: number;',
    '  readonly r?: number;',
    '  /** Épaisseur propre au dessin du logo (unités du viewBox), pas une épaisseur d’interface. */',
    '  readonly strokeWidth?: number;',
    '}',
    '',
    'export interface LogoDrawing {',
    '  readonly viewBox: string;',
    '  readonly shapes: readonly LogoShape[];',
    '}',
    '',
    '/** Dessins du logo (02-logo.md) : horizontal, vertical, symbole, symbole compact, logotype. */',
    `export const logoDrawings = {\n${entries.join('\n')}\n} as const satisfies Record<string, LogoDrawing>;`,
    '',
    'export type LogoVariant = keyof typeof logoDrawings;',
    '',
  ].join('\n');
}

/** Contenu attendu de chaque fichier généré, par chemin, pour la charte actuelle. */
export async function generateAssetFiles(): Promise<Map<string, string>> {
  return new Map([
    [iconsOutputPath, await formatSource(buildIconsSource(readIcons()), iconsOutputPath)],
    [logoOutputPath, await formatSource(buildLogoSource(), logoOutputPath)],
  ]);
}
