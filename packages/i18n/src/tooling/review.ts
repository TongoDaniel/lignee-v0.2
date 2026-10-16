// Suivi de la relecture par un locuteur natif (ACC-05) : un fichier par langue, `review/<langue>.json`,
// une entrée par message. Une entrée « reviewed » garde le texte relu : si le message change
// ensuite, il repasse « to-review » à la prochaine génération.
import type { Catalog } from './catalog.ts';

export type ReviewEntry =
  { readonly status: 'to-review' } | { readonly status: 'reviewed'; readonly text: string };

export type ReviewFile = Readonly<Record<string, ReviewEntry>>;

export interface ReviewCount {
  readonly total: number;
  readonly reviewed: number;
  readonly toReview: readonly string[];
}

/** Valide le contenu JSON d'un fichier de relecture. */
export function parseReviewFile(json: unknown, where: string): ReviewFile {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`${where} : un objet clé → entrée est attendu.`);
  }
  const out: Record<string, ReviewEntry> = {};
  for (const [key, entry] of Object.entries(json)) {
    if (isRecord(entry) && entry['status'] === 'to-review' && Object.keys(entry).length === 1) {
      out[key] = { status: 'to-review' };
    } else if (
      isRecord(entry) &&
      entry['status'] === 'reviewed' &&
      typeof entry['text'] === 'string' &&
      Object.keys(entry).length === 2
    ) {
      out[key] = { status: 'reviewed', text: entry['text'] };
    } else {
      throw new Error(
        `${where} : « ${key} » doit valoir { "status": "to-review" } ` +
          'ou { "status": "reviewed", "text": "<texte relu, à l’identique>" }.',
      );
    }
  }
  return out;
}

/**
 * Remet le fichier de relecture en phase avec les messages : une entrée par clé, dans l'ordre ;
 * nouvelle clé ou texte modifié depuis la relecture → « to-review » ; clé disparue → retirée.
 */
export function syncReview(catalog: Catalog, current: ReviewFile): ReviewFile {
  const out: Record<string, ReviewEntry> = {};
  for (const key of [...catalog.keys()].sort((a, b) => a.localeCompare(b, 'en'))) {
    const entry = current[key];
    const text = catalog.get(key);
    out[key] =
      entry?.status === 'reviewed' && entry.text === text ? entry : { status: 'to-review' };
  }
  return out;
}

/** Compte les messages relus et ceux qui restent à relire (seul un texte relu à l'identique compte). */
export function countReview(catalog: Catalog, file: ReviewFile): ReviewCount {
  const toReview: string[] = [];
  for (const [key, text] of catalog) {
    const entry = file[key];
    if (entry?.status !== 'reviewed' || entry.text !== text) toReview.push(key);
  }
  toReview.sort((a, b) => a.localeCompare(b, 'en'));
  return { total: catalog.size, reviewed: catalog.size - toReview.length, toReview };
}

/** Texte du fichier tel qu'il est écrit sur le disque. */
export function renderReviewFile(file: ReviewFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
