// ACC-04 « Aucun texte écrit en dur dans le code » : la configuration ESLint du dépôt refuse
// un texte en dur dans les interfaces et laisse passer les valeurs permises. Les fichiers sont
// fictifs (lintText) : aucune app n'existe encore, la règle doit déjà s'appliquer à leurs chemins.
import { join } from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
// Les fichiers fictifs n'appartiennent à aucun tsconfig : le service de projet de typescript-eslint
// les range dans son projet par défaut, comme les fichiers de configuration.
const virtualFiles = [
  'apps/mobile/x.tsx',
  'apps/mobile/x.ts',
  'packages/ui/x.tsx',
  'packages/ui/x.test.tsx',
];
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfig: {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.config.ts',
            'apps/*/*.config.ts',
            'packages/*/*.config.ts',
            ...virtualFiles,
          ],
        },
        tsconfigRootDir: repoRoot,
      },
    },
  },
});

const TEXT_RULE = 'i18next/no-literal-string';
const DIALOG_RULE = 'no-restricted-syntax';

// Composants déclarés sur place : la règle se sert des types pour permettre une union littérale.
const header = `
interface ButtonProps {
  readonly variant: 'primary' | 'secondary';
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly testID?: string;
}
declare function Button(props: ButtonProps): null;
declare function Text(props: { readonly children?: unknown }): null;
declare const t: (key: string) => string;
declare const name: string;
declare const Alert: { alert: (...args: unknown[]) => void; prompt: (...args: unknown[]) => void };
declare const ToastAndroid: { show: (message: string, duration: number) => void; SHORT: number };
`;

// Le premier passage charge TypeScript et le projet : plusieurs secondes, une seule fois.
beforeAll(async () => {
  await eslint.lintText('export {};', { filePath: join(repoRoot, 'apps', 'mobile', 'x.ts') });
}, 120_000);

async function ruleHits(filePath: string, body: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${header}\n${body}\n`, { filePath });
  if (result === undefined) throw new Error('ESLint n’a rien renvoyé');
  const fatal = result.messages.filter((message) => message.fatal === true);
  expect(fatal, 'erreur d’analyse').toEqual([]);
  return result.messages
    .filter((message) => message.ruleId === TEXT_RULE || message.ruleId === DIALOG_RULE)
    .map((message) => message.ruleId ?? '');
}

describe.each([
  join(repoRoot, 'apps', 'mobile', 'x.tsx'),
  join(repoRoot, 'packages', 'ui', 'x.tsx'),
])('ACC-04 in %s', (filePath) => {
  it.each([
    ['text between tags', 'export const Screen = () => <Text>Valider</Text>;'],
    ['string in an expression', "export const Screen = () => <Text>{'Annuler'}</Text>;"],
    [
      'string label for the screen reader',
      'export const Screen = () => <Button variant="primary" accessibilityLabel="Ajouter votre mère" accessibilityHint={t(\'k\')} />;',
    ],
    [
      'template label',
      'export const Screen = () => <Button variant="primary" accessibilityLabel={`Ajouter ${name}`} accessibilityHint={t(\'k\')} />;',
    ],
    [
      'strings in a ternary',
      "export const Screen = (ok: boolean) => <Text>{ok ? 'Oui' : 'Non'}</Text>;",
    ],
    [
      'Alert.alert message',
      "export const confirmDelete = () => { Alert.alert(t('k'), 'Voulez-vous supprimer ?'); };",
    ],
    [
      'Alert button text',
      "export const confirmDelete = () => { Alert.alert(t('k'), t('k'), [{ text: 'Annuler' }]); };",
    ],
    ['Alert.prompt title', "export const confirmDelete = () => { Alert.prompt('Votre nom'); };"],
    [
      'ToastAndroid.show',
      'export const confirmDelete = () => { ToastAndroid.show(`Bonjour ${name}`, ToastAndroid.SHORT); };',
    ],
  ])('rejects %s', async (_case, body) => {
    expect(await ruleHits(filePath, body)).not.toEqual([]);
  });

  it.each([
    ['translated text', "export const Screen = () => <Text>{t('common:actions.confirm')}</Text>;"],
    [
      'literal union, testID and translated labels',
      'export const Screen = () => <Button variant="secondary" testID="confirm-button" accessibilityLabel={t(\'k\')} accessibilityHint={t(\'k\')} />;',
    ],
    ['digits and punctuation alone', "export const Screen = () => <Text>{12} · {'—'}</Text>;"],
    [
      'translated Alert',
      "export const confirmDelete = () => { Alert.alert(t('k'), t('k'), [{ text: t('k') }]); ToastAndroid.show(t('k'), ToastAndroid.SHORT); };",
    ],
  ])('accepts %s', async (_case, body) => {
    expect(await ruleHits(filePath, body)).toEqual([]);
  });
});

describe('ACC-04 scope', () => {
  it('lets component tests use placeholder text', async () => {
    const filePath = join(repoRoot, 'packages', 'ui', 'x.test.tsx');
    expect(await ruleHits(filePath, 'export const Screen = () => <Text>Valider</Text>;')).toEqual(
      [],
    );
  });

  it('watches native dialogs in plain .ts files too', async () => {
    const filePath = join(repoRoot, 'apps', 'mobile', 'x.ts');
    expect(
      await ruleHits(
        filePath,
        "export const confirmDelete = () => { Alert.alert('Supprimer la fiche ?'); };",
      ),
    ).toEqual([DIALOG_RULE]);
  });
});
