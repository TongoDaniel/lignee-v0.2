// Lecture des tableaux Markdown de la charte, pour les tests qui confrontent le code au texte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { charteDir } from './paths.ts';

/** Contenu d'un fichier de la charte, fins de ligne normalisées. */
export function readCharte(file: string): string {
  return readFileSync(join(charteDir, file), 'utf8').replace(/\r\n?/g, '\n');
}

/** Section qui commence au titre donné (« ## Contrastes mesurés ») et finit au titre suivant. */
export function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`Titre « ${heading} » introuvable dans la charte`);
  const level = /^#+/.exec(heading)?.[0] ?? '##';
  const rest = markdown.slice(start + heading.length + 2);
  const end = rest.search(new RegExp(`\n#{1,${String(level.length)}} `));
  return end < 0 ? rest : rest.slice(0, end);
}

/** Lignes d'un tableau Markdown (sans l'en-tête ni la ligne de tirets), cellules nettoyées. */
export function tableRows(markdown: string): string[][] {
  const lines = markdown.split('\n').filter((line) => line.startsWith('|'));
  return lines.slice(2).map((line) =>
    line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((c) => c.trim()),
  );
}
