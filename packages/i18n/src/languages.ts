// Langues de l'interface (ACC-04). Ce module n'importe rien : l'outillage le charge aussi sous Node.

/** Langues de l'interface en V1. */
export const languages = ['fr', 'en'] as const;

export type Language = (typeof languages)[number];

/** Langue de référence : celle des types et du repli. */
export const defaultLanguage: Language = 'fr';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (languages as readonly string[]).includes(value);
}

/**
 * Choisit la langue de l'interface d'après les préférences de l'appareil, dans l'ordre
 * (« fr-CM », « en-GB »…) : la première dont la langue principale est prise en charge,
 * sinon le français.
 */
export function resolveLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.split(/[-_]/)[0]?.toLowerCase();
    if (isLanguage(primary)) return primary;
  }
  return defaultLanguage;
}
