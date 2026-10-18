// Règle de teinte des avatars (03-couleurs.md ; ARB-12 ; docs/adr/0022-couleur-des-avatars.md).
import { describe, expect, it } from 'vitest';

import { CONTRAST_TEXT, contrastRatio } from '../contrast';
import { schemeNames, themes } from '../tokens';
import {
  AVATAR_TINTS,
  avatarTintColors,
  avatarTintFromBirthName,
  defaultAvatarTintRule,
} from './avatarTint';

describe('avatarTintFromBirthName', () => {
  it('suit l’ordre de la charte : vert, or, lagon, lilas, ciel, terre', () => {
    expect(AVATAR_TINTS).toEqual(['green', 'gold', 'lagoon', 'lilac', 'sky', 'earth']);
  });

  it('additionne les codes de caractères, modulo 6', () => {
    // « diallo » : 100 + 105 + 97 + 108 + 108 + 111 = 629 ; 629 mod 6 = 5, donc terre.
    expect(avatarTintFromBirthName('Diallo')).toBe('earth');
    // « bah » : 98 + 97 + 104 = 299 ; 299 mod 6 = 5, donc terre aussi.
    expect(avatarTintFromBirthName('Bah')).toBe('earth');
    // « martin » : 109 + 97 + 114 + 116 + 105 + 110 = 651 ; 651 mod 6 = 3, donc lilas.
    expect(avatarTintFromBirthName('Martin')).toBe('lilac');
    // « lefèvre » : 990 ; 990 mod 6 = 0, donc vert.
    expect(avatarTintFromBirthName('Lefèvre')).toBe('green');
  });

  it('donne la même teinte à toutes les personnes nées du même nom, quelle que soit la saisie', () => {
    const variants = ['Diallo', 'DIALLO', 'diallo', '  Diallo ', 'Diallo '.trim()];
    expect(new Set(variants.map(avatarTintFromBirthName)).size).toBe(1);
    // « è » composé ou décomposé (e + accent grave) : même teinte.
    expect(avatarTintFromBirthName('Lefèvre')).toBe(avatarTintFromBirthName('Lefèvre'));
  });

  it('reste dans les six teintes, même pour un nom vide ou en alphabet non latin', () => {
    for (const name of ['', 'Ö', 'Nguyễn', '李', 'Ndiaye-Sow', "N'Diaye"]) {
      expect(AVATAR_TINTS).toContain(avatarTintFromBirthName(name));
    }
  });
});

describe('defaultAvatarTintRule', () => {
  it('ne dépend que du nom de naissance : ni prénom, ni genre, ni branche (ADR 0022, option A)', () => {
    const a = defaultAvatarTintRule({ birthName: 'Diallo' });
    expect(defaultAvatarTintRule({ birthName: 'Diallo', branchId: 'branche-1' })).toBe(a);
    expect(defaultAvatarTintRule({ birthName: 'Diallo', branchId: 'branche-2' })).toBe(a);
  });
});

describe('avatarTintColors', () => {
  it('prend les couleurs `personne-*` du thème, jamais le corail', () => {
    for (const scheme of schemeNames) {
      const colors = themes[scheme];
      for (const tint of AVATAR_TINTS) {
        const { text, background } = avatarTintColors(tint, colors);
        expect([colors.sante, colors.santeDouce, colors.santeTexte]).not.toContain(text);
        expect([colors.sante, colors.santeDouce, colors.santeTexte]).not.toContain(background);
      }
    }
  });

  it('garde 4,5:1 entre l’initiale et le fond, dans les deux thèmes', () => {
    for (const scheme of schemeNames) {
      for (const tint of AVATAR_TINTS) {
        const { text, background } = avatarTintColors(tint, themes[scheme]);
        expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
      }
    }
  });

  it('donne six couples distincts', () => {
    const pairs = AVATAR_TINTS.map((tint) => avatarTintColors(tint, themes.jour));
    expect(new Set(pairs.map((pair) => pair.background)).size).toBe(6);
  });
});
