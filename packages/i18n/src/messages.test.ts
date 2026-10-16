// Contrôle des fichiers de messages réels (ACC-04, ACC-05) : mêmes clés et mêmes paramètres ICU
// dans chaque langue, types et fichiers de relecture à jour, typographie de la charte (08-ton.md).
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { defaultLanguage, languages } from './languages';
import { namespaces } from './resources';
import { literalTexts, loadCatalog, namespacesOnDisk, signatureOf } from './tooling/catalog';
import { generatedParamsFile, messagesDir, reviewFileOf } from './tooling/paths';
import { countReview, parseReviewFile, renderReviewFile, syncReview } from './tooling/review';
import { renderMessageParams } from './tooling/types';

const catalogs = new Map(
  languages.map((language) => [language, loadCatalog(messagesDir, language)]),
);
const catalogOf = (language: string): ReadonlyMap<string, string> => {
  const catalog = catalogs.get(language as (typeof languages)[number]);
  if (catalog === undefined) throw new Error(`Langue absente : ${language}`);
  return catalog;
};
const reference = catalogOf(defaultLanguage);
const REGENERATE = 'lancez `corepack pnpm --filter @lignee/i18n generate`';

describe.each(languages)('messages %s', (language) => {
  const catalog = catalogOf(language);

  it('has every namespace registered in resources.ts', () => {
    expect(namespacesOnDisk(messagesDir, language)).toEqual([...namespaces].sort());
  });

  it('has exactly the keys of the reference language', () => {
    expect([...catalog.keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it('uses the same ICU parameters as the reference language', () => {
    for (const [key, text] of catalog) {
      expect(signatureOf(text, key), key).toEqual(signatureOf(reference.get(key) ?? '', key));
    }
  });

  it('has an up-to-date native review entry for every message (ACC-05)', () => {
    const file = reviewFileOf(language);
    const review = parseReviewFile(JSON.parse(readFileSync(file, 'utf8')), file);
    expect(renderReviewFile(syncReview(catalog, review)), REGENERATE).toBe(
      readFileSync(file, 'utf8'),
    );
    const { total, reviewed, toReview } = countReview(catalog, review);
    expect(reviewed + toReview.length).toBe(total);
  });

  it('follows the charter typography: no emoji, curly apostrophes and quotes, ellipsis', () => {
    for (const [key, text] of catalog) {
      for (const literal of literalTexts(text, key)) {
        expect(literal, `${key} : emoji`).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(literal, `${key} : apostrophe droite, utilisez ’`).not.toContain("'");
        expect(literal, `${key} : guillemets droits, utilisez « » ou “ ”`).not.toContain('"');
        expect(literal, `${key} : trois points, utilisez …`).not.toContain('...');
        expect(literal, `${key} : points d'exclamation en série`).not.toMatch(/!{2,}/);
      }
    }
  });
});

describe('messages fr', () => {
  // Espace insécable, fine (U+202F) ou non (U+00A0).
  const NBSP = '\\u00a0\\u202f';
  const missingBefore = new RegExp(`(^|[^${NBSP}])[;:!?»]`);
  const missingAfter = new RegExp(`«[^${NBSP}]`);

  it('puts a non-breaking space before ; : ! ? and inside « »', () => {
    for (const [key, text] of catalogOf('fr')) {
      for (const literal of literalTexts(text, key)) {
        expect(literal, `${key} : espace insécable avant ; : ! ? »`).not.toMatch(missingBefore);
        expect(literal, `${key} : espace insécable après «`).not.toMatch(missingAfter);
      }
    }
  });
});

describe('generated types', () => {
  it('match the reference messages', () => {
    expect(renderMessageParams(reference), REGENERATE).toBe(
      readFileSync(generatedParamsFile, 'utf8'),
    );
  });
});
