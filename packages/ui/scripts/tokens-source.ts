// Fabrique le texte de packages/ui/src/tokens.ts à partir de la charte validée.
// Fonction pure (hors mise en forme Prettier) : même charte, même fichier, octet pour octet.
import { format, resolveConfig } from 'prettier';

import type { CharteComplements } from './charte-complements.ts';
import {
  CharteFormatError,
  type CharteTokens,
  type ScalarToken,
  type SchemeKey,
} from './charte-tokens.ts';

export const GENERATED_HEADER = [
  '// Fichier généré : ne pas modifier.',
  '// Source : docs/charte/tokens.json, et packages/ui/scripts/charte-complements.ts pour le',
  '// mouvement et le mode Aînés. Générateur : packages/ui/scripts/generate-tokens.ts.',
  '// Pour changer une valeur, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui tokens`.',
].join('\n');

const SCHEMES: readonly SchemeKey[] = ['jour', 'nuit'];

/** « fond-carte » → « fondCarte », « titre-1 » → « titre1 ». */
export function camelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match: string, letter: string) => letter.toUpperCase());
}

function stripPrefix(name: string, prefix: string): string {
  return camelCase(name.startsWith(prefix) ? name.slice(prefix.length) : name);
}

/** Clé TypeScript : identifiant nu si possible, sinon chaîne entre guillemets. */
function key(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || /^\d+$/.test(name)
    ? name
    : JSON.stringify(name);
}

function assertUniqueKeys(keys: readonly string[], section: string): void {
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k))
      throw new CharteFormatError(`${section} : deux tokens donnent la clé « ${k} »`);
    seen.add(k);
  }
}

/** Arrondi à deux décimales, sans « -0 » ni bruit de virgule flottante. */
export function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function comment(text: string): string {
  return text === '' ? '' : `/** ${text.replace(/\*\//g, '* /').replace(/\s+/g, ' ')} */\n`;
}

function scalarObject(
  tokens: readonly ScalarToken[],
  section: string,
  toKey: (name: string) => string,
): string {
  const keys = tokens.map((t) => toKey(t.name));
  assertUniqueKeys(keys, section);
  const body = tokens
    .map((t, i) => `${comment(t.usage)}${key(keys[i] ?? '')}: ${String(t.value)},`)
    .join('\n');
  return `{\n${body}\n}`;
}

export interface ShadowLayer {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly spreadDistance: number;
  readonly color: string;
}

/** Découpe une ombre CSS (« 0 1px 2px rgba(…), 0 8px 24px rgba(…) ») en couches. */
export function parseShadow(css: string, where: string): ShadowLayer[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of css) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  layers.push(current.trim());
  return layers.map((layer) => {
    const match =
      /^(-?\d+(?:\.\d+)?(?:px)?) (-?\d+(?:\.\d+)?(?:px)?) (\d+(?:\.\d+)?(?:px)?)(?: (-?\d+(?:\.\d+)?(?:px)?))? (rgba?\([\d.,\s]+\)|#[0-9A-Fa-f]{6,8})$/.exec(
        layer,
      );
    if (!match) throw new CharteFormatError(`${where} : couche d'ombre « ${layer} » illisible`);
    const px = (value: string | undefined): number =>
      value === undefined ? 0 : Number(value.replace(/px$/, ''));
    return {
      offsetX: px(match[1]),
      offsetY: px(match[2]),
      blurRadius: px(match[3]),
      spreadDistance: px(match[4]),
      color: (match[5] ?? '').replace(/\s+/g, ''),
    };
  });
}

/** Première famille d'une pile CSS : « "Fraunces Lignee", Georgia, serif » → « Fraunces Lignee ». */
function firstFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? '';
  return first.replace(/^"(.*)"$/, '$1');
}

/** Texte brut (non mis en forme) de tokens.ts. */
export function buildTokensSource(charte: CharteTokens, complements: CharteComplements): string {
  const out: string[] = [GENERATED_HEADER, ''];

  out.push(`/** Version de docs/charte/tokens.json. */`);
  out.push(`export const charteVersion = ${String(charte.version)};`, '');

  // Palette.
  const paletteKeys = charte.palette.map((c) => camelCase(c.name));
  assertUniqueKeys(paletteKeys, 'palette');
  out.push(
    '/** Palette de la charte. Un écran ne s’en sert pas directement : il passe par un thème. */',
    `export const palette = {\n${charte.palette
      .map((c, i) => `${comment(c.usage)}${key(paletteKeys[i] ?? '')}: '${c.value}',`)
      .join('\n')}\n} as const;`,
    'export type PaletteColor = keyof typeof palette;',
    '',
  );

  // Thèmes.
  const roleKeys = charte.roles.map((r) => camelCase(r.name));
  assertUniqueKeys(roleKeys, 'couleurs sémantiques');
  out.push(
    `/** Thèmes de couleurs : Jour (interface par défaut) et Nuit. */`,
    `export type SchemeName = ${SCHEMES.map((s) => `'${s}'`).join(' | ')};`,
    `export const schemeNames: readonly SchemeName[] = [${SCHEMES.map((s) => `'${s}'`).join(', ')}];`,
    '',
    `/** Couleurs sémantiques, communes aux deux thèmes. */`,
    `export type ColorRole = ${roleKeys.map((k) => `'${k}'`).join(' | ')};`,
    `export const colorRoles: readonly ColorRole[] = [${roleKeys.map((k) => `'${k}'`).join(', ')}];`,
    'export type ThemeColors = { readonly [K in ColorRole]: string };',
    '',
  );
  const themeBody = SCHEMES.map((scheme) => {
    const entries = charte.roles
      .map((r, i) => `${comment(r.usage)}${key(roleKeys[i] ?? '')}: '${r.values[scheme]}',`)
      .join('\n');
    return `${scheme}: {\n${entries}\n},`;
  }).join('\n');
  out.push(
    `export const themes: { readonly [S in SchemeName]: ThemeColors } = {\n${themeBody}\n};`,
    '',
  );

  // Ombres.
  const shadowKeys = charte.shadows.map((s) => stripPrefix(s.name, 'ombre-'));
  assertUniqueKeys(shadowKeys, 'ombres');
  out.push(
    '/** Une couche d’ombre, en dp, au format de `boxShadow` de React Native. */',
    'export interface ShadowLayer {',
    'readonly offsetX: number;',
    'readonly offsetY: number;',
    'readonly blurRadius: number;',
    'readonly spreadDistance: number;',
    'readonly color: string;',
    '}',
    '/** Une ombre de la charte : la chaîne CSS d’origine et ses couches. */',
    'export interface Shadow {',
    'readonly boxShadow: string;',
    'readonly layers: readonly ShadowLayer[];',
    '}',
    `export type ShadowName = ${shadowKeys.map((k) => `'${k}'`).join(' | ')};`,
    'export type ThemeShadows = { readonly [K in ShadowName]: Shadow };',
  );
  const shadowBody = SCHEMES.map((scheme) => {
    const entries = charte.shadows
      .map((s, i) => {
        const css = s.values[scheme];
        const layers = parseShadow(css, `ombre « ${s.name} » (${scheme})`);
        return `${comment(s.usage)}${key(shadowKeys[i] ?? '')}: { boxShadow: ${JSON.stringify(css)}, layers: ${JSON.stringify(layers)} },`;
      })
      .join('\n');
    return `${scheme}: {\n${entries}\n},`;
  }).join('\n');
  out.push(
    `export const shadows: { readonly [S in SchemeName]: ThemeShadows } = {\n${shadowBody}\n};`,
    '',
  );

  // Polices.
  out.push(
    '/**',
    ' * Fichiers de police, par nom de police dans l’app. Sur Android, une graisse est une famille à',
    ' * part : un style de texte nomme la police, jamais `fontWeight`. Les TTF sont dans',
    ' * packages/ui/assets/fonts/ (scripts/generate-fonts.ts).',
    ' */',
    `export const fontFaces = {\n${charte.fonts
      .map(
        (f) =>
          `${key(f.key)}: { family: ${JSON.stringify(f.family)}, weight: ${String(f.weight)}, style: '${f.style}', file: '${f.key}.ttf' },`,
      )
      .join('\n')}\n} as const;`,
    'export type FontName = keyof typeof fontFaces;',
    '',
    '/** Piles de polices CSS (site web, documents), par rôle. */',
    `export const fontStacks = {\n${Object.entries(charte.fontStacks)
      .map(([role, stack]) => `${key(camelCase(role))}: ${JSON.stringify(stack)},`)
      .join('\n')}\n} as const;`,
    '',
  );

  // Typographie.
  const styleKeys = charte.textStyles.map((s) => camelCase(s.name));
  assertUniqueKeys(styleKeys, 'typographie');
  out.push(
    '/**',
    ' * Un style de texte, en dp. `letterSpacing` est converti des em de la charte. Ni `fontWeight`',
    ' * ni `fontStyle` : la police nommée porte déjà sa graisse et son italique (11-react-native.md),',
    ' * et Android ajouterait un faux gras ou un faux italique.',
    ' */',
    'export interface TextStyle {',
    'readonly fontFamily: FontName;',
    'readonly fontSize: number;',
    'readonly lineHeight: number;',
    'readonly letterSpacing?: number;',
    '}',
    `export type TypographyName = ${styleKeys.map((k) => `'${k}'`).join(' | ')};`,
  );
  const styleBody = charte.textStyles
    .map((s, i) => {
      const stack = charte.fontStacks[s.familyRole] ?? '';
      const family = firstFamily(stack);
      const face = charte.fonts.find(
        (f) => f.family === family && f.weight === s.fontWeight && f.style === s.fontStyle,
      );
      if (!face) {
        throw new CharteFormatError(
          `style « ${s.name} » : aucune police ${family} ${String(s.fontWeight)} ${s.fontStyle} dans type.fonts`,
        );
      }
      const parts = [
        `fontFamily: '${face.key}'`,
        `fontSize: ${String(s.fontSize)}`,
        `lineHeight: ${String(s.lineHeight)}`,
      ];
      if (s.letterSpacingEm !== undefined) {
        parts.push(`letterSpacing: ${String(round2(s.letterSpacingEm * s.fontSize))}`);
      }
      return `${comment(`${s.group}. ${s.usage}`)}${key(styleKeys[i] ?? '')}: { ${parts.join(', ')} },`;
    })
    .join('\n');
  out.push(
    `export const typography: { readonly [K in TypographyName]: TextStyle } = {\n${styleBody}\n};`,
    '',
  );

  // Dimensions.
  out.push(
    '/** Espacements (grille de 4), par numéro : `space[5]` vaut 20. */',
    `export const space = ${scalarObject(charte.spacing, 'espacements', (name) => {
      const step = /^espace-(\d+)$/.exec(name);
      return step?.[1] ?? camelCase(name);
    })} as const;`,
    '',
    '/** Rayons. Tout ce qui se touche est en pilule. */',
    `export const radius = ${scalarObject(charte.radius, 'rayons', (n) => stripPrefix(n, 'rayon-'))} as const;`,
    '',
    '/** Tailles minimales et tailles d’éléments récurrents. */',
    `export const size = ${scalarObject(charte.sizes, 'tailles', camelCase)} as const;`,
    '',
    '/** Épaisseurs de trait. */',
    `export const stroke = ${scalarObject(charte.strokes, 'traits', (n) => stripPrefix(n, 'trait-'))} as const;`,
    '',
    '/** Opacités réservées. */',
    `export const opacity = ${scalarObject(charte.opacities, 'opacités', (n) => stripPrefix(n, 'opacite-'))} as const;`,
    '',
  );

  // Mouvement et mode Aînés.
  const { motion, aines } = complements;
  const cibleAines = charte.sizes.find((s) => s.name === 'cible-tactile-aines');
  if (!cibleAines) throw new CharteFormatError('taille « cible-tactile-aines » absente');
  out.push(
    '/**',
    ' * Mouvement (07-mouvement.md) : durées en ms, courbes au format cubic-bezier(x1, y1, x2, y2).',
    ' * Rien ne rebondit dans la santé ni la confidentialité : `rebondLeger` est réservé à une',
    ' * personne qui apparaît dans l’arbre. Avec « Réduire les animations », tout déplacement devient',
    ' * un fondu de `duration.fonduReduit`.',
    ' */',
    `export const motion = {
duration: {${Object.entries(motion.duration)
      .map(([k, v]) => `${key(k)}: ${String(v)},`)
      .join('\n')}},
easing: {${Object.entries(motion.easing)
      .map(([k, v]) => `${key(k)}: [${v.join(', ')}],`)
      .join('\n')}},
echelleAppui: ${String(motion.echelleAppui)},
} as const;`,
    '',
    '/** Mode Aînés : textes et interlignes multipliés, zones touchables agrandies (09-accessibilite.md). */',
    `export const aines = {
facteurTexte: ${String(aines.facteurTexte)},
cibleTactile: ${String(cibleAines.value)},
} as const;`,
    '',
  );

  return out.join('\n');
}

/** Met le texte en forme avec la configuration Prettier du dépôt, pour que `format:check` passe. */
export const FONT_FILES_HEADER = [
  '// Fichier généré : ne pas modifier.',
  '// Source : docs/charte/tokens.json (type.fonts). Générateur : packages/ui/scripts/generate-tokens.ts.',
  '// Pour changer une valeur, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui tokens`.',
].join('\n');

/**
 * Texte brut de src/fontFiles.ts : les TTF à charger avec `useFonts(fontFiles)` d'expo-font
 * (11-react-native.md), sous les noms de police de la charte.
 */
export function buildFontFilesSource(charte: CharteTokens): string {
  const entries = charte.fonts
    .map((f) => `${key(f.key)}: require('../assets/fonts/${f.key}.ttf'),`)
    .join('\n');
  return [
    FONT_FILES_HEADER,
    '',
    '// Au démarrage de l’app : `const [loaded] = useFonts(fontFiles);` (expo-font).',
    '// Les `require` sont résolus par Metro, qui embarque les TTF comme des assets et renvoie leur',
    '// identifiant. Node ne sait pas les charger : ce fichier n’est importé ni par l’index du paquet',
    '// ni par un test. Importez-le par `@lignee/ui/fontFiles`, depuis l’app seulement.',
    "import type { FontName } from './tokens';",
    '',
    '// `require` de Metro (les types de Node sont exclus de src/).',
    'declare const require: (path: string) => number;',
    '',
    `export const fontFiles: { readonly [K in FontName]: number } = {\n${entries}\n};`,
    '',
  ].join('\n');
}

export async function formatTokensSource(source: string, targetPath: string): Promise<string> {
  const config = await resolveConfig(targetPath);
  return format(source, { ...config, filepath: targetPath });
}
