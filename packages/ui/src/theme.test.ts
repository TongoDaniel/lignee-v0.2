import { describe, expect, it } from 'vitest';

import { getTheme, schemeFromSystem } from './theme';
import { aines, shadows, size, themes, typography, type TypographyName } from './tokens';

describe('getTheme', () => {
  it('donne les couleurs et les ombres du thème Jour', () => {
    const theme = getTheme({ scheme: 'jour', seniorMode: false });
    expect(theme.colors).toBe(themes.jour);
    expect(theme.colors.fond).toBe('#EEF2F0');
    expect(theme.colors.action).toBe('#1E5A48');
    expect(theme.shadows).toBe(shadows.jour);
  });

  it('donne les couleurs et les ombres du thème Nuit', () => {
    const theme = getTheme({ scheme: 'nuit', seniorMode: false });
    expect(theme.colors).toBe(themes.nuit);
    expect(theme.colors.fond).toBe('#0A1713');
    expect(theme.colors.action).toBe('#F2B84B');
    expect(theme.shadows).toBe(shadows.nuit);
  });

  it('hors mode Aînés, garde les tailles de la charte et des cibles de 48 (ACC-01)', () => {
    const theme = getTheme({ scheme: 'jour', seniorMode: false });
    expect(theme.textScale).toBe(1);
    expect(theme.touchTarget).toBe(48);
    expect(theme.typography).toEqual(typography);
    expect(theme.typography.corps.fontSize).toBeGreaterThanOrEqual(17);
  });

  it('en mode Aînés, multiplie textes et interlignes par 1,3 et passe les cibles à 56 (ACC-03)', () => {
    for (const scheme of ['jour', 'nuit'] as const) {
      const theme = getTheme({ scheme, seniorMode: true });
      expect(theme.textScale).toBe(1.3);
      expect(theme.touchTarget).toBe(56);
      expect(theme.touchTarget).toBe(size.cibleTactileAines);
      expect(theme.typography.corps).toMatchObject({
        fontFamily: 'InstrumentSans-Regular',
        fontSize: 22.1,
        lineHeight: 31.2,
      });
      for (const name of Object.keys(typography) as TypographyName[]) {
        const base = typography[name];
        const scaled = theme.typography[name];
        expect(scaled.fontFamily).toBe(base.fontFamily);
        expect(scaled.fontSize).toBeCloseTo(base.fontSize * aines.facteurTexte, 2);
        expect(scaled.lineHeight).toBeCloseTo(base.lineHeight * aines.facteurTexte, 2);
        // L'interligne reste plus grand que la taille : les lignes ne se chevauchent pas.
        expect(scaled.lineHeight).toBeGreaterThan(scaled.fontSize);
      }
      expect(theme.typography.surtitre.letterSpacing).toBeCloseTo(1.44 * 1.3, 2);
    }
  });

  it('le mode Aînés ne change pas les couleurs', () => {
    expect(getTheme({ scheme: 'nuit', seniorMode: true }).colors).toBe(themes.nuit);
  });

  it('renvoie le même objet pour le même choix, et un objet figé', () => {
    const theme = getTheme({ scheme: 'jour', seniorMode: true });
    expect(getTheme({ scheme: 'jour', seniorMode: true })).toBe(theme);
    expect(getTheme({ scheme: 'jour', seniorMode: false })).not.toBe(theme);
    expect(Object.isFrozen(theme)).toBe(true);
    expect(Object.isFrozen(theme.typography)).toBe(true);
  });

  it('ne modifie pas les tokens de base', () => {
    getTheme({ scheme: 'nuit', seniorMode: true });
    expect(typography.corps.fontSize).toBe(17);
  });

  it('refuse un schéma inconnu', () => {
    // @ts-expect-error -- valeur hors du type, comme une préférence mal enregistrée
    expect(() => getTheme({ scheme: 'sombre', seniorMode: false })).toThrow(/inconnu/);
  });
});

describe('schemeFromSystem', () => {
  it('suit la préférence du téléphone, Jour par défaut', () => {
    expect(schemeFromSystem('dark')).toBe('nuit');
    expect(schemeFromSystem('light')).toBe('jour');
    expect(schemeFromSystem(null)).toBe('jour');
    expect(schemeFromSystem(undefined)).toBe('jour');
  });
});
