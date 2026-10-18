// Rapport de contraste WCAG 2 entre deux couleurs opaques (#RRGGBB), pour les tests de la charte
// et, plus tard, pour vérifier une couleur calculée (avatars) avant de l'afficher.

/** Seuils de la charte (09-accessibilite.md, ACC-01). */
export const CONTRAST_TEXT = 4.5;
export const CONTRAST_GRAPHIC = 3;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative d'une couleur #RRGGBB. */
export function relativeLuminance(hexColor: string): number {
  const match = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hexColor);
  if (!match) throw new Error(`Couleur opaque #RRGGBB attendue, reçu « ${hexColor} »`);
  const [r, g, b] = [match[1], match[2], match[3]].map((part) =>
    channel(Number.parseInt(part ?? '', 16)),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste, de 1 à 21, indépendant de l'ordre des couleurs. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
