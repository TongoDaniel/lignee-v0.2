// Rendu du fichier de types `src/generated/message-params.ts` à partir des messages français,
// qui font référence (la concordance de l'anglais est vérifiée par ailleurs).
import { signatureOf, type Catalog, type ParamKind } from './catalog.ts';

const TS_TYPE: Readonly<Record<ParamKind, string>> = {
  text: 'string | number',
  number: 'number',
  date: 'Date | number',
};

export function renderMessageParams(reference: Catalog): string {
  const lines = [
    '// Fichier généré par `corepack pnpm --filter @lignee/i18n generate` : ne pas modifier à la main.',
    '// Source : messages/fr/*.json. Un message sans paramètre vaut `null`.',
    '',
    'export interface MessageParams {',
  ];
  for (const key of [...reference.keys()].sort((a, b) => a.localeCompare(b, 'en'))) {
    const signature = signatureOf(reference.get(key) ?? '', key);
    const params = Object.entries(signature).map(
      ([name, kind]) => `readonly ${name}: ${TS_TYPE[kind]}`,
    );
    lines.push(`  '${key}': ${params.length === 0 ? 'null' : `{ ${params.join('; ')} }`};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}
