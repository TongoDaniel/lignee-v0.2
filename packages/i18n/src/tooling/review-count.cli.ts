// `corepack pnpm --filter @lignee/i18n review:count [--strict]` : messages à relire par un
// locuteur natif (ACC-05), par langue. Avec `--strict`, sort en erreur s'il en reste.
import { readFileSync } from 'node:fs';

import { languages } from '../languages.ts';
import { loadCatalog } from './catalog.ts';
import { messagesDir, reviewFileOf } from './paths.ts';
import { countReview, parseReviewFile } from './review.ts';

const strict = process.argv.includes('--strict');
let remaining = 0;

for (const language of languages) {
  const file = reviewFileOf(language);
  const catalog = loadCatalog(messagesDir, language);
  const review = parseReviewFile(JSON.parse(readFileSync(file, 'utf8')), file);
  const { total, reviewed, toReview } = countReview(catalog, review);
  remaining += toReview.length;
  console.log(
    `${language} : ${String(reviewed)} relus, ${String(toReview.length)} à relire, ${String(total)} au total.`,
  );
  for (const key of toReview) console.log(`  - ${key}`);
}

if (strict && remaining > 0) process.exit(1);
