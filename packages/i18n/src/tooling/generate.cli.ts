// `corepack pnpm --filter @lignee/i18n generate` : à lancer après toute modification des messages.
// Écrit les types des clés et des paramètres, et remet en phase les fichiers de relecture (ACC-05).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { defaultLanguage, languages } from '../languages.ts';
import { loadCatalog } from './catalog.ts';
import { generatedParamsFile, messagesDir, reviewFileOf } from './paths.ts';
import { countReview, parseReviewFile, renderReviewFile, syncReview } from './review.ts';
import { renderMessageParams } from './types.ts';

try {
  writeFileSync(
    generatedParamsFile,
    renderMessageParams(loadCatalog(messagesDir, defaultLanguage)),
  );
  console.log(`Types écrits : ${generatedParamsFile}`);

  for (const language of languages) {
    const catalog = loadCatalog(messagesDir, language);
    const file = reviewFileOf(language);
    const current = existsSync(file)
      ? parseReviewFile(JSON.parse(readFileSync(file, 'utf8')), file)
      : {};
    const synced = syncReview(catalog, current);
    writeFileSync(file, renderReviewFile(synced));
    const { total, toReview } = countReview(catalog, synced);
    console.log(
      `Relecture ${language} : ${String(toReview.length)} sur ${String(total)} à relire.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
