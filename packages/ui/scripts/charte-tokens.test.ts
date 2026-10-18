// Lecture de docs/charte/tokens.json : la vraie charte passe, une charte mal formée est refusée
// avec un message qui nomme le token fautif.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CharteFormatError, parseCharteTokens, parsePx } from './charte-tokens.ts';
import { charteTokensPath } from './paths.ts';

type Json = Record<string, unknown>;

function charteJson(): Json {
  return JSON.parse(readFileSync(charteTokensPath, 'utf8')) as Json;
}

function colorTokens(json: Json): { name: string; value: unknown }[] {
  return (json['color'] as { tokens: { name: string; value: unknown }[] }).tokens;
}

describe('parseCharteTokens', () => {
  const charte = parseCharteTokens(charteJson());

  it('résout les couleurs sémantiques des deux thèmes', () => {
    const fond = charte.roles.find((r) => r.name === 'fond');
    expect(fond?.values).toEqual({ jour: '#EEF2F0', nuit: '#0A1713' });
    const action = charte.roles.find((r) => r.name === 'action');
    expect(action?.values).toEqual({ jour: '#1E5A48', nuit: '#F2B84B' });
  });

  it('garde les couleurs avec transparence (voile)', () => {
    expect(charte.roles.find((r) => r.name === 'voile')?.values).toEqual({
      jour: '#0A171352',
      nuit: '#000000A3',
    });
  });

  it('lit les tailles minimales de l’accessibilité (ACC-01, ACC-03)', () => {
    const sizes = new Map(charte.sizes.map((s) => [s.name, s.value]));
    expect(sizes.get('cible-tactile')).toBe(48);
    expect(sizes.get('cible-tactile-aines')).toBe(56);
    const corps = charte.textStyles.find((s) => s.name === 'corps');
    expect(corps?.fontSize).toBeGreaterThanOrEqual(17);
  });

  it('refuse une référence vers une couleur absente de la palette', () => {
    const json = structuredClone(charteJson());
    const fond = colorTokens(json).find((t) => t.name === 'fond');
    if (!fond) throw new Error('fond absent');
    fond.value = { light: '{gris-51}', dark: '{nuit-900}' };
    expect(() => parseCharteTokens(json)).toThrow(
      /couleur « fond » \(Jour\) : la référence \{gris-51\}/,
    );
  });

  it('refuse une couleur sémantique sans valeur Nuit', () => {
    const json = structuredClone(charteJson());
    const texte = colorTokens(json).find((t) => t.name === 'texte');
    if (!texte) throw new Error('texte absent');
    texte.value = { light: '{encre-900}' };
    expect(() => parseCharteTokens(json)).toThrow(CharteFormatError);
  });

  it('refuse une couleur qui n’est pas en hexadécimal', () => {
    const json = structuredClone(charteJson());
    const blanc = colorTokens(json).find((t) => t.name === 'blanc');
    if (!blanc) throw new Error('blanc absent');
    blanc.value = 'white';
    expect(() => parseCharteTokens(json)).toThrow(/couleur « blanc »/);
  });

  it('refuse une unité autre que px', () => {
    expect(parsePx('16px', 'x')).toBe(16);
    expect(parsePx('2.5px', 'x')).toBe(2.5);
    expect(() => parsePx('1rem', 'rayon « rayon-s »')).toThrow(/rayon « rayon-s »/);
  });
});
