import { describe, expect, it } from 'vitest';

import { contrastRatio, relativeLuminance } from './contrast';

describe('contrastRatio (WCAG 2)', () => {
  it('donne 21:1 entre le noir et le blanc, 1:1 entre deux couleurs égales', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#1E5A48', '#1E5A48')).toBe(1);
  });

  it('ne dépend pas de l’ordre des couleurs', () => {
    expect(contrastRatio('#FFFFFF', '#1E5A48')).toBe(contrastRatio('#1E5A48', '#FFFFFF'));
  });

  it('suit la formule de luminance relative', () => {
    expect(relativeLuminance('#FFFFFF')).toBe(1);
    expect(relativeLuminance('#000000')).toBe(0);
    // Gris #777777 : luminance relative 0,1845.
    expect(relativeLuminance('#777777')).toBeCloseTo(0.1845, 4);
  });

  it('refuse une couleur avec transparence', () => {
    expect(() => contrastRatio('#0A171352', '#FFFFFF')).toThrow(/opaque/);
  });
});
