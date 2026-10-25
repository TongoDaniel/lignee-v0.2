// Retour à la ligne des noms dans les fiches (T-017). Fonction pure : la mesure d'un texte est
// donnée par l'appelant (Skia sur le téléphone, une largeur par caractère dans les tests).

/** Résultat : les lignes à dessiner, et si la dernière a été raccourcie par « … ». */
export interface WrappedText {
  readonly lines: readonly string[];
  readonly truncated: boolean;
}

const ELLIPSIS = '…';

/** Coupe aux espaces et après un trait d'union (« Marie-Antoinette » passe sur deux lignes). */
function pieces(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
    .flatMap((word) => word.split(/(?<=-)(?=.)/u));
}

/** Plus grand début de `text` (au moins un caractère) qui tient dans `maxWidth`. */
function fittingPrefix(text: string, maxWidth: number, measure: (text: string) => number): number {
  const characters = Array.from(text);
  let length = characters.length;
  while (length > 1 && measure(characters.slice(0, length).join('')) > maxWidth) length -= 1;
  return length;
}

/** Lignes du texte sans limite de nombre : un mot plus large qu'une ligne est coupé au caractère. */
function greedyLines(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const piece of pieces(text)) {
    const glue = current === '' || current.endsWith('-') ? '' : ' ';
    if (measure(`${current}${glue}${piece}`) <= maxWidth) {
      current = `${current}${glue}${piece}`;
      continue;
    }
    if (current !== '') lines.push(current);
    let rest = piece;
    while (measure(rest) > maxWidth && Array.from(rest).length > 1) {
      const length = fittingPrefix(rest, maxWidth, measure);
      lines.push(Array.from(rest).slice(0, length).join(''));
      rest = Array.from(rest).slice(length).join('');
    }
    current = rest;
  }
  if (current !== '') lines.push(current);
  return lines;
}

/** Plus long début de `text` qui tient une fois suivi de « … » (au moins un caractère). */
function shorten(text: string, maxWidth: number, measure: (text: string) => number): string {
  const characters = Array.from(text);
  for (let length = characters.length; length > 1; length -= 1) {
    const candidate = `${characters.slice(0, length).join('').trimEnd()}${ELLIPSIS}`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return `${characters[0] ?? ''}${ELLIPSIS}`;
}

/**
 * Répartit `text` sur `maxLines` lignes au plus, chacune de largeur `maxWidth` au plus. S'il reste
 * du texte après la dernière ligne, elle se termine par « … » (`truncated`) : le nom entier reste
 * dans la liste accessible et sur la fiche. Un texte vide donne aucune ligne.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
  maxLines: number,
): WrappedText {
  if (maxLines < 1) return { lines: [], truncated: false };
  const lines = greedyLines(text, maxWidth, measure);
  if (lines.length <= maxLines) return { lines, truncated: false };
  const kept = lines.slice(0, maxLines - 1);
  const tail = lines.slice(maxLines - 1).join(' ');
  return { lines: [...kept, shorten(tail, maxWidth, measure)], truncated: true };
}
