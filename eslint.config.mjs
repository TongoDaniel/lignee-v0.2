// Configuration ESLint plate, commune à tout le monorepo.
// Chaque paquet lance `eslint .` depuis son dossier ; ESLint remonte jusqu'à ce fichier.
import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Les deux greffons d'accessibilité n'annoncent pas encore ESLint 10 (ils utilisent des API
// retirées) : @eslint/compat les adapte. À retirer quand ils publieront une version compatible.
const reactNativeA11yPlugin = fixupPluginRules(reactNativeA11y);
const jsxA11yPlugin = fixupPluginRules(jsxA11y);

// Règles du code de packages/domain hors des tests. Une configuration par profondeur de dossier
// sous src/ : un import relatif ne peut pas remonter au-dessus de src/.
function domainSourceRules() {
  const onlyZod = {
    regex: '^(?!zod$|\\.{1,2}/)',
    message: 'packages/domain ne dépend que de Zod (TRD, « Organisation du code »).',
  };
  const message = 'packages/domain : aucun import relatif hors de src/.';
  const testSupport = {
    regex: '(^|/)test-support(/|$)',
    message: 'Le code de packages/domain n’importe pas ses outils de test (test-support).',
  };
  const globals = [
    'process',
    'Buffer',
    'require',
    'fetch',
    'global',
    '__dirname',
    '__filename',
  ].map((name) => ({
    name,
    message: `packages/domain ne dépend ni de Node ni du réseau (${name}).`,
  }));
  return [0, 1, 2, 3].map((depth) => ({
    files: [`packages/domain/src/${'*/'.repeat(depth)}*.ts`],
    ignores: ['packages/domain/src/**/*.test.ts', 'packages/domain/src/test-support/**'],
    rules: {
      'no-restricted-globals': ['error', ...globals],
      'no-restricted-imports': [
        'error',
        {
          patterns: [onlyZod, testSupport, { regex: `^(\\.\\./){${String(depth + 1)},}`, message }],
        },
      ],
    },
  }));
}

// Règles du code de packages/layout hors des tests (T-008) : même discipline que packages/domain.
// Seul @lignee/domain (sans ses outils de test) est importé ; ni Node, ni React, ni Skia, ni
// réseau ; aucun import relatif hors de src/.
function layoutSourceRules() {
  const onlyDomain = {
    regex: '^(?!@lignee/domain$|\\.{1,2}/)',
    message: 'packages/layout ne dépend que de @lignee/domain (TRD, « Disposition de l’arbre »).',
  };
  const message = 'packages/layout : aucun import relatif hors de src/.';
  const testSupport = {
    regex: '(^|/)test-support(/|$)',
    message: 'Le code de packages/layout n’importe pas d’outils de test (test-support).',
  };
  const globals = [
    'process',
    'Buffer',
    'require',
    'fetch',
    'global',
    '__dirname',
    '__filename',
  ].map((name) => ({
    name,
    message: `packages/layout ne dépend ni de Node ni du réseau (${name}).`,
  }));
  return [0, 1, 2, 3].map((depth) => ({
    files: [`packages/layout/src/${'*/'.repeat(depth)}*.ts`],
    ignores: ['packages/layout/src/**/*.test.ts', 'packages/layout/src/test-support/**'],
    rules: {
      'no-restricted-globals': ['error', ...globals],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            onlyDomain,
            testSupport,
            { regex: `^(\\.\\./){${String(depth + 1)},}`, message },
          ],
        },
      ],
    },
  }));
}

// Règles du code de packages/kinship hors des tests : le moteur de parenté tourne à l'identique
// sur le téléphone et sur le serveur (TRD, « Moteur de parenté ») : il n'importe que
// @lignee/domain (sans ses outils de test) et ses propres fichiers, sans Node ni réseau.
function kinshipSourceRules() {
  const onlyDomain = {
    regex: '^(?!@lignee/domain$|\\.{1,2}/)',
    message: 'packages/kinship ne dépend que de @lignee/domain (TRD, « Moteur de parenté »).',
  };
  const message = 'packages/kinship : aucun import relatif hors de src/.';
  const testSupport = {
    regex: '(^|/)test-support(/|$)',
    message: 'Le code de packages/kinship n’importe pas ses outils de test (test-support).',
  };
  const globals = [
    'process',
    'Buffer',
    'require',
    'fetch',
    'global',
    '__dirname',
    '__filename',
  ].map((name) => ({
    name,
    message: `packages/kinship ne dépend ni de Node ni du réseau (${name}).`,
  }));
  return [0, 1, 2].map((depth) => ({
    files: [`packages/kinship/src/${'*/'.repeat(depth)}*.ts`],
    ignores: ['packages/kinship/src/**/*.test.ts', 'packages/kinship/src/test-support/**'],
    rules: {
      'no-restricted-globals': ['error', ...globals],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            onlyDomain,
            testSupport,
            { regex: `^(\\.\\./){${String(depth + 1)},}`, message },
          ],
        },
      ],
    },
  }));
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/android/**',
      '**/ios/**',
    ],
  },

  // TypeScript strict, avec les règles qui s'appuient sur les types.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Fichiers de configuration à la racine d'un paquet (vitest.config.ts…), hors de
          // `include`. Les motifs partent de la racine du dépôt ; `**` n'y est pas admis.
          allowDefaultProject: ['*.config.ts', 'apps/*/*.config.ts', 'packages/*/*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
  },

  // Fichiers JavaScript de configuration : pas d'analyse de types.
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Outils de test de packages/domain (générateur, scénarios) : ils lisent des fichiers avec
  // Node et n'entrent jamais dans l'app ni dans le serveur. Importables par les seuls tests.
  // Placé avant les règles de packages/domain, qui fixent leur propre `no-restricted-imports`
  // (et y interdisent aussi test-support).
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    ignores: ['**/*.test.{ts,tsx}', '**/test-support/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@lignee/domain/test-support(/|$)',
              message: '@lignee/domain/test-support est réservé aux fichiers de test (*.test.ts).',
            },
          ],
        },
      ],
    },
  },

  // packages/domain est partagé par le téléphone et le serveur : Zod seul, ni Node, ni React,
  // ni Expo, ni Prisma, ni réseau, et aucun fichier hors du paquet. Les tests et leurs aides
  // (test-support) peuvent lire des fichiers. Types : tsconfig.src.json (sans types de Node).
  ...domainSourceRules(),

  // packages/layout tourne sur le téléphone et sur le serveur : @lignee/domain seul.
  ...layoutSourceRules(),

  // packages/kinship : @lignee/domain seul, ni Node, ni React, ni Prisma, ni réseau.
  ...kinshipSourceRules(),

  // Accessibilité React Native : app mobile et composants de la charte (TRD, « Tests et qualité »).
  {
    files: ['apps/mobile/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-native-a11y': reactNativeA11yPlugin },
    rules: { ...reactNativeA11y.configs.all.rules },
  },

  // Accessibilité web (DOM) : site et console interne.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11yPlugin },
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },

  // Désactive les règles de mise en forme : Prettier s'en charge.
  prettier,
);
