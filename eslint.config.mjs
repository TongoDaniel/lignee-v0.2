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
        projectService: true,
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
