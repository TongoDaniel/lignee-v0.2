// Aides de dessin sans Skia (T-017) : chemin d'un trait, lignes de texte d'une fiche. Pures, donc
// testées sans téléphone.
import { wrapText, type Point, type ZoomLevel } from '@lignee/layout';

import type { PersonCard } from './personCards';

/** Chemin SVG d'un trait à angles droits (Skia lit les chemins SVG). */
export function pathData(points: readonly Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ');
}

/** Le signe « + » d'une place à compléter, centré en (`x`, `y`), de demi-longueur `half`. */
export function plusPath(x: number, y: number, half: number): string {
  return pathData([
    { x: x - half, y },
    { x: x + half, y },
  ]).concat(
    ' ',
    pathData([
      { x, y: y - half },
      { x, y: y + half },
    ]),
  );
}

function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Texte d'une fiche à un niveau de zoom : rien en vue d'ensemble, le prénom, puis le nom entier. */
export function nameForLevel(
  card: PersonCard | undefined,
  level: ZoomLevel,
  placeholderText: string,
): string {
  if (level === 'overview') return '';
  if (card === undefined || card.placeholder) return placeholderText;
  if (level === 'detail' && card.fullName !== '') return card.fullName;
  return card.firstName === '' ? card.fullName : card.firstName;
}

export interface CardLines {
  readonly name: readonly string[];
  readonly secondary: string | undefined;
}

/**
 * Lignes d'une fiche : le nom sur deux lignes au plus, la ligne secondaire (années d'une personne
 * décédée) si elle existe, en vue standard et en détail ; rien en vue d'ensemble. La largeur est
 * celle de la fiche moins un peu de marge : `measure` mesure avec la police chargée.
 */
export function cardLines(options: {
  readonly name: string;
  readonly secondary: string | undefined;
  readonly width: number;
  readonly maxLines: number;
  readonly measure: (text: string) => number;
  readonly level: ZoomLevel;
}): CardLines {
  if (options.level === 'overview') return { name: [], secondary: undefined };
  const wrapped = wrapText(options.name, options.width, options.measure, options.maxLines);
  return { name: wrapped.lines, secondary: options.secondary };
}
