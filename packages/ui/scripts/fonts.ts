// Polices de l'app : la charte ne fournit que des WOFF2 (docs/charte/fonts), React Native et
// Skia demandent des TTF. La décompression WOFF2 (décodeur de référence de Google, compilé en
// WebAssembly par le paquet wawoff2) redonne la police d'origine : mêmes tables, mêmes glyphes.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { format, resolveConfig } from 'prettier';
import { decompress } from 'wawoff2';

import { parseCharteTokens, type FontFace } from './charte-tokens.ts';
import { charteFontsDir, charteTokensPath, fontsOutputDir, repoRoot } from './paths.ts';

export const LICENSE_FILE = 'OFL.txt';
export const MANIFEST_FILE = 'empreintes.json';

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface Woff2Header {
  /** Version sfnt de la police contenue (0x00010000 pour TrueType, « OTTO » pour CFF). */
  readonly flavor: number;
  readonly numTables: number;
  /** Taille de la police une fois décompressée, annoncée par le fichier WOFF2. */
  readonly totalSfntSize: number;
}

/** En-tête WOFF2 (W3C, « WOFF File Format 2.0 », section 3). */
export function readWoff2Header(data: Uint8Array): Woff2Header {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.byteLength < 48 || view.getUint32(0) !== 0x774f4632) {
    throw new Error('Ce fichier n’est pas une police WOFF2 (signature wOF2 absente)');
  }
  return {
    flavor: view.getUint32(4),
    numTables: view.getUint16(12),
    totalSfntSize: view.getUint32(16),
  };
}

/** Lit les tables d'une police TrueType : étiquette → [début, longueur]. */
export function readSfntTables(data: Uint8Array): ReadonlyMap<string, readonly [number, number]> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4);
  const tables = new Map<string, readonly [number, number]>();
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    const tag = String.fromCharCode(...data.subarray(record, record + 4));
    tables.set(tag, [view.getUint32(record + 8), view.getUint32(record + 12)]);
  }
  return tables;
}

/** Chaînes de la table `name` (plateforme Windows, Unicode), par identifiant. */
export function readFontNames(data: Uint8Array): ReadonlyMap<number, string> {
  const table = readSfntTables(data).get('name');
  if (!table) throw new Error('Table name absente');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const [start] = table;
  const count = view.getUint16(start + 2);
  const storage = start + view.getUint16(start + 4);
  const names = new Map<number, string>();
  for (let i = 0; i < count; i += 1) {
    const record = start + 6 + i * 12;
    const platformId = view.getUint16(record);
    const languageId = view.getUint16(record + 4);
    const nameId = view.getUint16(record + 6);
    if (platformId !== 3 || languageId !== 0x0409 || names.has(nameId)) continue;
    const length = view.getUint16(record + 8);
    const offset = storage + view.getUint16(record + 10);
    let text = '';
    for (let k = 0; k < length; k += 2) text += String.fromCharCode(view.getUint16(offset + k));
    names.set(nameId, text);
  }
  return names;
}

/** Identifiants de la table `name` (OpenType) utilisés ici. */
export const NAME_ID = {
  copyright: 0,
  family: 1,
  postScript: 6,
  license: 13,
  licenseUrl: 14,
} as const;

export interface FontAsset {
  readonly face: FontFace;
  readonly woff2: Uint8Array;
  readonly ttf: Uint8Array;
}

/** Polices déclarées par la charte, décompressées. */
export async function decompressCharteFonts(): Promise<FontAsset[]> {
  const charte = parseCharteTokens(JSON.parse(readFileSync(charteTokensPath, 'utf8')) as unknown);
  const assets: FontAsset[] = [];
  for (const face of charte.fonts) {
    const woff2 = readFileSync(join(charteFontsDir, `${face.key}.woff2`));
    // Le résultat peut être une vue sur la mémoire du module WebAssembly, réécrite à l'appel
    // suivant : on le copie.
    const ttf = new Uint8Array(await decompress(woff2));
    assets.push({ face, woff2, ttf });
  }
  return assets;
}

const OFL_HEADING = 'SIL OPEN FONT LICENSE Version 1.1';

/**
 * Texte de licence à poser à côté des TTF : les mentions de copyright de chaque police (table
 * `name`), puis le texte de la SIL Open Font License 1.1 tel qu'il est inscrit dans une des
 * polices de la charte (La Belle Aurore le contient en entier).
 */
export function buildLicenseText(assets: readonly FontAsset[]): string {
  const copyrights: string[] = [];
  let licenseBody: string | undefined;
  for (const { ttf } of assets) {
    const names = readFontNames(ttf);
    const copyright = names.get(NAME_ID.copyright);
    if (copyright === undefined) throw new Error('Mention de copyright absente d’une police');
    if (!copyrights.includes(copyright)) copyrights.push(copyright);
    const license = names.get(NAME_ID.license)?.replace(/\r\n?/g, '\n');
    const at = license?.indexOf(OFL_HEADING) ?? -1;
    if (licenseBody === undefined && license !== undefined && at >= 0) {
      // Le texte commence à la ligne de tirets qui précède le titre.
      const dashes = license.lastIndexOf('-----', at);
      const from = dashes >= 0 ? license.lastIndexOf('\n', dashes) + 1 : at;
      licenseBody = license.slice(from).trim();
    }
  }
  if (licenseBody === undefined) {
    throw new Error(`Aucune police ne contient le texte « ${OFL_HEADING} »`);
  }
  return `${copyrights.join('\n')}\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\n\n${licenseBody}\n`;
}

export interface FontManifestEntry {
  readonly ttf: string;
  readonly ttfSha256: string;
  readonly ttfBytes: number;
  readonly woff2: string;
  readonly woff2Sha256: string;
}

export function buildManifest(assets: readonly FontAsset[]): FontManifestEntry[] {
  return assets.map(({ face, woff2, ttf }) => ({
    ttf: `${face.key}.ttf`,
    ttfSha256: sha256(ttf),
    ttfBytes: ttf.byteLength,
    woff2: `docs/charte/${face.woff2File}`,
    woff2Sha256: sha256(woff2),
  }));
}

/** Tous les fichiers de packages/ui/assets/fonts, par nom, tels que le script les écrit. */
export async function buildFontFiles(): Promise<Map<string, Uint8Array | string>> {
  const assets = await decompressCharteFonts();
  const files = new Map<string, Uint8Array | string>();
  for (const { face, ttf } of assets) files.set(`${face.key}.ttf`, ttf);
  files.set(LICENSE_FILE, buildLicenseText(assets));
  const manifestPath = join(fontsOutputDir, MANIFEST_FILE);
  const config = await resolveConfig(manifestPath);
  files.set(
    MANIFEST_FILE,
    await format(JSON.stringify(buildManifest(assets)), { ...config, filepath: manifestPath }),
  );
  return files;
}

export { fontsOutputDir, repoRoot };
