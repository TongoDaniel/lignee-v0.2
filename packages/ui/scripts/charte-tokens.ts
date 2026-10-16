// Lecture et validation de docs/charte/tokens.json, la source de la charte.
// Tout ce qui ne correspond pas à la forme attendue fait échouer la génération avec un message
// qui nomme le token fautif : mieux vaut un arrêt net qu'un tokens.ts faux.

/** Nom d'un thème de couleurs, tel que l'app l'emploie (« Jour », « Nuit » dans la charte). */
export type SchemeKey = 'jour' | 'nuit';

/** Une couleur sémantique, résolue en valeur hexadécimale pour chaque thème. */
export interface ColorRole {
  readonly name: string;
  readonly values: Readonly<Record<SchemeKey, string>>;
  readonly usage: string;
}

/** Une couleur de la palette (valeur unique, sans thème). */
export interface PaletteColor {
  readonly name: string;
  readonly value: string;
  readonly usage: string;
}

export interface FontFace {
  readonly family: string;
  /** Nom du fichier sans extension (« InstrumentSans-SemiBold ») : c'est le nom de la police dans l'app. */
  readonly key: string;
  readonly woff2File: string;
  readonly weight: number;
  readonly style: 'normal' | 'italic';
}

export interface TextStyleToken {
  readonly name: string;
  readonly group: string;
  readonly familyRole: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: number;
  readonly fontStyle: 'normal' | 'italic';
  /** En em, comme dans la charte (« -0.01em »). */
  readonly letterSpacingEm?: number;
  readonly usage: string;
}

export interface ScalarToken {
  readonly name: string;
  readonly value: number;
  readonly usage: string;
}

export interface ShadowToken {
  readonly name: string;
  readonly values: Readonly<Record<SchemeKey, string>>;
  readonly usage: string;
}

export interface CharteTokens {
  readonly version: number;
  readonly palette: readonly PaletteColor[];
  readonly roles: readonly ColorRole[];
  readonly fonts: readonly FontFace[];
  readonly fontStacks: Readonly<Record<string, string>>;
  readonly textStyles: readonly TextStyleToken[];
  readonly spacing: readonly ScalarToken[];
  readonly radius: readonly ScalarToken[];
  readonly shadows: readonly ShadowToken[];
  readonly sizes: readonly ScalarToken[];
  readonly strokes: readonly ScalarToken[];
  readonly opacities: readonly ScalarToken[];
}

export class CharteFormatError extends Error {
  constructor(message: string) {
    super(`tokens.json : ${message}`);
    this.name = 'CharteFormatError';
  }
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function obj(value: unknown, where: string): JsonObject {
  if (!isObject(value)) throw new CharteFormatError(`${where} doit être un objet`);
  return value;
}

function arr(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new CharteFormatError(`${where} doit être une liste`);
  return value;
}

function str(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new CharteFormatError(`${where} doit être une chaîne non vide`);
  }
  return value;
}

function optionalStr(value: unknown, where: string): string {
  return value === undefined ? '' : str(value, where);
}

const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;

function hex(value: string, where: string): string {
  if (!HEX.test(value)) {
    throw new CharteFormatError(
      `${where} : « ${value} » n'est pas une couleur #RRGGBB ou #RRGGBBAA`,
    );
  }
  return value;
}

/** « 16px » → 16, « 2.5px » → 2.5. Aucune autre unité n'est admise. */
export function parsePx(value: unknown, where: string): number {
  if (typeof value === 'number') return value;
  const text = str(value, where);
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(text);
  if (!match?.[1]) throw new CharteFormatError(`${where} : « ${text} » n'est pas une valeur en px`);
  return Number(match[1]);
}

/** « 0.4 » → 0.4 (opacités). */
function parseUnitless(value: unknown, where: string): number {
  if (typeof value === 'number') return value;
  const text = str(value, where);
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new CharteFormatError(`${where} : « ${text} » n'est pas un nombre`);
  }
  return Number(text);
}

/** « -0.01em » → -0.01. */
function parseEm(value: unknown, where: string): number {
  const text = str(value, where);
  const match = /^(-?\d+(?:\.\d+)?)em$/.exec(text);
  if (!match?.[1]) throw new CharteFormatError(`${where} : « ${text} » n'est pas une valeur en em`);
  return Number(match[1]);
}

function parseWeight(value: unknown, where: string): number {
  const weight = typeof value === 'string' ? Number(value) : value;
  if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 1000) {
    throw new CharteFormatError(`${where} : graisse invalide`);
  }
  return weight;
}

function parseStyle(value: unknown, where: string): 'normal' | 'italic' {
  if (value === undefined || value === 'normal') return 'normal';
  if (value === 'italic') return 'italic';
  throw new CharteFormatError(`${where} : style « ${JSON.stringify(value)} » inconnu`);
}

/** Les thèmes de la charte s'appellent « Jour » et « Nuit » ; leurs identifiants sont light et dark. */
function schemeKeyFromName(name: string): SchemeKey {
  const key = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (key === 'jour' || key === 'nuit') return key;
  throw new CharteFormatError(`thème « ${name} » inconnu (attendus : Jour, Nuit)`);
}

function parseThemes(color: JsonObject): ReadonlyMap<string, SchemeKey> {
  const ids = new Map<string, SchemeKey>();
  for (const [index, raw] of arr(color['themes'], 'color.themes').entries()) {
    const theme = obj(raw, `color.themes[${String(index)}]`);
    ids.set(
      str(theme['id'], `color.themes[${String(index)}].id`),
      schemeKeyFromName(str(theme['name'], `color.themes[${String(index)}].name`)),
    );
  }
  const keys = [...ids.values()].sort();
  if (keys.join(',') !== 'jour,nuit') {
    throw new CharteFormatError('color.themes doit déclarer exactement les thèmes Jour et Nuit');
  }
  return ids;
}

function parseScalarSection(
  root: JsonObject,
  section: string,
  parse: (value: unknown, where: string) => number,
): ScalarToken[] {
  const tokens = arr(obj(root[section], section)['tokens'], `${section}.tokens`);
  return tokens.map((raw, index) => {
    const where = `${section}.tokens[${String(index)}]`;
    const token = obj(raw, where);
    const name = str(token['name'], `${where}.name`);
    return {
      name,
      value: parse(token['value'], `${section} « ${name} »`),
      usage: optionalStr(token['usage'], `${where}.usage`),
    };
  });
}

function assertUniqueNames(tokens: readonly { name: string }[], section: string): void {
  const seen = new Set<string>();
  for (const { name } of tokens) {
    if (seen.has(name))
      throw new CharteFormatError(`${section} : « ${name} » est déclaré deux fois`);
    seen.add(name);
  }
}

/** Valide le contenu de tokens.json et résout les références « {nom} » vers la palette. */
export function parseCharteTokens(input: unknown): CharteTokens {
  const root = obj(input, 'la racine');
  const version = root['version'];
  if (typeof version !== 'number') throw new CharteFormatError('version doit être un nombre');

  const color = obj(root['color'], 'color');
  const schemeIds = parseThemes(color);
  const rawColors = arr(color['tokens'], 'color.tokens').map((raw, index) =>
    obj(raw, `color.tokens[${String(index)}]`),
  );

  const palette: PaletteColor[] = [];
  for (const token of rawColors) {
    const name = str(token['name'], 'color.tokens[].name');
    if (typeof token['value'] === 'string') {
      palette.push({
        name,
        value: hex(token['value'], `couleur « ${name} »`),
        usage: optionalStr(token['usage'], `couleur « ${name} ».usage`),
      });
    }
  }
  assertUniqueNames(palette, 'palette');
  const paletteByName = new Map(palette.map((c) => [c.name, c.value]));

  const resolve = (value: string, where: string): string => {
    const ref = /^\{([a-z0-9-]+)\}$/.exec(value);
    if (!ref?.[1]) return hex(value, where);
    const target = paletteByName.get(ref[1]);
    if (target === undefined) {
      throw new CharteFormatError(
        `${where} : la référence {${ref[1]}} n'existe pas dans la palette`,
      );
    }
    return target;
  };

  const themed = (value: unknown, where: string): Record<SchemeKey, string> => {
    const values = obj(value, where);
    const out: Partial<Record<SchemeKey, string>> = {};
    for (const [id, scheme] of schemeIds) {
      out[scheme] = str(values[id], `${where}.${id}`);
    }
    const extra = Object.keys(values).filter((id) => !schemeIds.has(id));
    if (extra.length > 0)
      throw new CharteFormatError(`${where} : thème inconnu ${extra.join(', ')}`);
    return out as Record<SchemeKey, string>;
  };

  const roles: ColorRole[] = rawColors
    .filter((token) => typeof token['value'] !== 'string')
    .map((token) => {
      const name = str(token['name'], 'color.tokens[].name');
      const values = themed(token['value'], `couleur « ${name} »`);
      return {
        name,
        values: {
          jour: resolve(values.jour, `couleur « ${name} » (Jour)`),
          nuit: resolve(values.nuit, `couleur « ${name} » (Nuit)`),
        },
        usage: optionalStr(token['usage'], `couleur « ${name} ».usage`),
      };
    });
  assertUniqueNames([...palette, ...roles], 'color.tokens');

  const type = obj(root['type'], 'type');
  const fonts: FontFace[] = arr(type['fonts'], 'type.fonts').map((raw, index) => {
    const where = `type.fonts[${String(index)}]`;
    const font = obj(raw, where);
    const woff2File = str(font['file'], `${where}.file`);
    const match = /^fonts\/([A-Za-z0-9-]+)\.woff2$/.exec(woff2File);
    if (!match?.[1]) throw new CharteFormatError(`${where}.file : « ${woff2File} » inattendu`);
    return {
      family: str(font['family'], `${where}.family`),
      key: match[1],
      woff2File,
      weight: parseWeight(font['weight'], `${where}.weight`),
      style: parseStyle(font['style'], `${where}.style`),
    };
  });
  assertUniqueNames(
    fonts.map((f) => ({ name: f.key })),
    'type.fonts',
  );

  const familiesRaw = obj(type['families'], 'type.families');
  const fontStacks: Record<string, string> = {};
  for (const [role, stack] of Object.entries(familiesRaw)) {
    fontStacks[role] = str(stack, `type.families.${role}`);
  }

  const textStyles: TextStyleToken[] = [];
  for (const [groupIndex, rawGroup] of arr(type['groups'], 'type.groups').entries()) {
    const where = `type.groups[${String(groupIndex)}]`;
    const group = obj(rawGroup, where);
    const groupName = str(group['name'], `${where}.name`);
    const familyRole = str(group['family'], `${where}.family`);
    if (!(familyRole in fontStacks)) {
      throw new CharteFormatError(`${where}.family : « ${familyRole} » absent de type.families`);
    }
    for (const rawStyle of arr(group['styles'], `${where}.styles`)) {
      const style = obj(rawStyle, `${where}.styles[]`);
      const name = str(style['name'], `${where}.styles[].name`);
      const at = `style « ${name} »`;
      const letterSpacing = style['letterSpacing'];
      textStyles.push({
        name,
        group: groupName,
        familyRole,
        fontSize: parsePx(style['fontSize'], `${at}.fontSize`),
        lineHeight: parsePx(style['lineHeight'], `${at}.lineHeight`),
        fontWeight: parseWeight(style['fontWeight'], `${at}.fontWeight`),
        fontStyle: parseStyle(style['fontStyle'], `${at}.fontStyle`),
        ...(letterSpacing === undefined
          ? {}
          : { letterSpacingEm: parseEm(letterSpacing, `${at}.letterSpacing`) }),
        usage: optionalStr(style['usage'], `${at}.usage`),
      });
    }
  }
  assertUniqueNames(textStyles, 'type.groups');

  const shadows: ShadowToken[] = arr(obj(root['shadow'], 'shadow')['tokens'], 'shadow.tokens').map(
    (raw, index) => {
      const token = obj(raw, `shadow.tokens[${String(index)}]`);
      const name = str(token['name'], 'shadow.tokens[].name');
      return {
        name,
        values: themed(token['value'], `ombre « ${name} »`),
        usage: optionalStr(token['usage'], `ombre « ${name} ».usage`),
      };
    },
  );

  const result: CharteTokens = {
    version,
    palette,
    roles,
    fonts,
    fontStacks,
    textStyles,
    spacing: parseScalarSection(root, 'spacing', parsePx),
    radius: parseScalarSection(root, 'radius', parsePx),
    shadows,
    sizes: parseScalarSection(root, 'taille', parsePx),
    strokes: parseScalarSection(root, 'trait', parsePx),
    opacities: parseScalarSection(root, 'opacite', parseUnitless),
  };
  for (const section of [
    'spacing',
    'radius',
    'shadows',
    'sizes',
    'strokes',
    'opacities',
  ] as const) {
    assertUniqueNames(result[section], section);
  }
  return result;
}
