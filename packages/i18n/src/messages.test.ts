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
import {
  commonTypographyIssues,
  frenchSpacingIssues,
  tutoiementIssues,
} from './tooling/typography';

const catalogs = new Map(
  languages.map((language) => [language, loadCatalog(messagesDir, language)]),
);
const catalogOf = (language: string): ReadonlyMap<string, string> => {
  const catalog = catalogs.get(language as (typeof languages)[number]);
  if (catalog === undefined) throw new Error(`Langue absente : ${language}`);
  return catalog;
};
const reference = catalogOf(defaultLanguage);
// Problèmes trouvés dans le texte littéral de chaque message, préfixés par la clé.
const issuesIn = (
  catalog: ReadonlyMap<string, string>,
  check: (literal: string) => string[],
): string[] =>
  [...catalog].flatMap(([key, text]) =>
    literalTexts(text, key).flatMap((literal) =>
      check(literal).map((issue) => `${key} : ${issue}`),
    ),
  );
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
    expect(issuesIn(catalog, commonTypographyIssues)).toEqual([]);
  });
});

describe('messages fr', () => {
  const catalog = catalogOf('fr');

  it('puts a non-breaking space before ; : ! ? » and after «', () => {
    expect(issuesIn(catalog, frenchSpacingIssues)).toEqual([]);
  });

  it('never uses the familiar « tu » form', () => {
    expect(issuesIn(catalog, tutoiementIssues)).toEqual([]);
  });
});

describe('generated types', () => {
  it('match the reference messages', () => {
    expect(renderMessageParams(reference), REGENERATE).toBe(
      readFileSync(generatedParamsFile, 'utf8'),
    );
  });
});
