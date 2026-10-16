// Les TTF de packages/ui/assets/fonts sont la décompression exacte des WOFF2 de la charte :
// même empreinte qu'une décompression refaite maintenant, taille et format annoncés par le WOFF2,
// licence SIL OFL 1.1 respectée.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { fontFaces } from '../src/tokens.ts';
import {
  buildFontFiles,
  decompressCharteFonts,
  type FontAsset,
  type FontManifestEntry,
  LICENSE_FILE,
  MANIFEST_FILE,
  NAME_ID,
  readFontNames,
  readWoff2Header,
  sha256,
} from './fonts.ts';
import { fontsOutputDir, repoRoot } from './paths.ts';

const REGENERATE = 'corepack pnpm --filter @lignee/ui fonts';

let assets: FontAsset[];
let expectedFiles: Map<string, Uint8Array | string>;

beforeAll(async () => {
  assets = await decompressCharteFonts();
  expectedFiles = await buildFontFiles();
});

function committed(name: string): Buffer {
  return readFileSync(join(fontsOutputDir, name));
}

describe('assets/fonts', () => {
  it('contient exactement les fichiers produits par le script', () => {
    expect(readdirSync(fontsOutputDir).sort()).toEqual([...expectedFiles.keys()].sort());
  });

  it('a un TTF pour chaque police de tokens.ts', () => {
    expect(assets.map((a) => `${a.face.key}.ttf`).sort()).toEqual(
      Object.values(fontFaces)
        .map((f) => f.file)
        .sort(),
    );
  });

  it('chaque TTF a l’empreinte de la décompression de son WOFF2', () => {
    for (const { face, ttf } of assets) {
      expect(
        sha256(committed(`${face.key}.ttf`)),
        `${face.key}.ttf ne correspond pas à son WOFF2 : lancez « ${REGENERATE} »`,
      ).toBe(sha256(ttf));
    }
  });

  it('empreintes.json donne les empreintes réelles des TTF et des WOFF2', () => {
    const manifest = JSON.parse(committed(MANIFEST_FILE).toString('utf8')) as FontManifestEntry[];
    expect(manifest).toHaveLength(assets.length);
    for (const entry of manifest) {
      expect(sha256(committed(entry.ttf)), entry.ttf).toBe(entry.ttfSha256);
      expect(committed(entry.ttf).byteLength, entry.ttf).toBe(entry.ttfBytes);
      expect(sha256(readFileSync(join(repoRoot, entry.woff2))), entry.woff2).toBe(
        entry.woff2Sha256,
      );
    }
    expect(committed(MANIFEST_FILE).toString('utf8').replace(/\r\n/g, '\n')).toBe(
      expectedFiles.get(MANIFEST_FILE),
    );
  });

  it('chaque TTF a la taille et le format annoncés par l’en-tête du WOFF2', () => {
    for (const { face, woff2 } of assets) {
      const header = readWoff2Header(woff2);
      const ttf = committed(`${face.key}.ttf`);
      expect(ttf.byteLength, face.key).toBe(header.totalSfntSize);
      expect(ttf.readUInt32BE(0), face.key).toBe(header.flavor);
      expect(ttf.readUInt16BE(4), face.key).toBe(header.numTables);
      // TrueType (glyf) : ce que demandent React Native et Skia.
      expect(header.flavor, face.key).toBe(0x00010000);
    }
  });

  it('chaque TTF porte la famille déclarée par la charte', () => {
    for (const { face } of assets) {
      const names = readFontNames(committed(`${face.key}.ttf`));
      expect(names.get(NAME_ID.family), face.key).toBe(face.family);
    }
  });

  it('refuse un fichier qui n’est pas un WOFF2', () => {
    expect(() => readWoff2Header(committed('InstrumentSans-Regular.ttf'))).toThrow(/wOF2/);
  });
});

describe('licence des polices (SIL Open Font License 1.1)', () => {
  it('chaque police se déclare sous OFL 1.1', () => {
    for (const { face, ttf } of assets) {
      expect(readFontNames(ttf).get(NAME_ID.license), face.key).toMatch(
        /SIL Open Font License, Version 1\.1/,
      );
    }
  });

  it('aucune police n’a de nom réservé, donc « Fraunces Lignee » peut garder ce nom', () => {
    // OFL, condition 3 : une version modifiée ne peut pas reprendre un « Reserved Font Name ».
    // Fraunces Lignee est une instance de Fraunces, et un TTF tiré d'un WOFF2 est une version
    // modifiée au sens de l'OFL (changement de format). Si un nom réservé apparaît, il faut
    // renommer la police : ce test le signale.
    // Un nom réservé se déclare après la mention de copyright (« with Reserved Font Name … ») ;
    // le texte de la licence, lui, parle des noms réservés en général.
    for (const { face, ttf } of assets) {
      const names = readFontNames(ttf);
      const license = names.get(NAME_ID.license) ?? '';
      const preamble = license.split(/-{5,}|SIL OPEN FONT LICENSE/)[0] ?? '';
      const notices = `${names.get(NAME_ID.copyright) ?? ''}\n${preamble}`;
      expect(notices, face.key).not.toMatch(/Reserved Font Names?/i);
    }
  });

  it('OFL.txt accompagne les TTF, avec chaque mention de copyright et le texte de la licence', () => {
    const text = committed(LICENSE_FILE).toString('utf8').replace(/\r\n/g, '\n');
    expect(text).toBe(expectedFiles.get(LICENSE_FILE));
    expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
    expect(text).toContain('PERMISSION & CONDITIONS');
    expect(text).toContain('DISCLAIMER');
    for (const { face, ttf } of assets) {
      expect(text, face.key).toContain(readFontNames(ttf).get(NAME_ID.copyright));
    }
  });
});
