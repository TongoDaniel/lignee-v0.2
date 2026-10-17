// Configuration ESLint plate, commune à tout le monorepo.
// Chaque paquet lance `eslint .` depuis son dossier ; ESLint remonte jusqu'à ce fichier.
import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Les deux greffons d'accessibilité n'annoncent pas encore ESLint 10 (ils utilisent des API
// retirées) : @eslint/compat les adapte. À retirer quand ils publieront une version compatible.
const reactNativeA11yPlugin = fixupPluginRules(reactNativeA11y);
const jsxA11yPlugin = fixupPluginRules(jsxA11y);
// Même précaution pour la règle contre les textes en dur (eslint-plugin-i18next).
const i18nextPlugin = fixupPluginRules(i18next);

// ACC-04 hors JSX : texte passé aux boîtes de dialogue natives de React Native.
const nativeDialogCall =
  "CallExpression[callee.type='MemberExpression']" +
  ":matches([callee.object.name='Alert'][callee.property.name=/^(alert|prompt)$/]," +
  " [callee.object.name='ToastAndroid'][callee.property.name=/^show/])";
const hardcodedText = ':matches(Literal[value=/[A-Za-zÀ-ÿ]/], TemplateLiteral)';
const nativeDialogMessage =
  'Texte en dur dans une boîte de dialogue : ajoutez-le à @lignee/i18n et passez t("espace:cle")';
const nativeDialogTextSelectors = [
  { selector: `${nativeDialogCall} > ${hardcodedText}`, message: nativeDialogMessage },
  {
    selector: `${nativeDialogCall} Property[key.name='text'] > ${hardcodedText}`,
    message: nativeDialogMessage,
  },
];

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
          // apps/mobile/app.config.ts est dans le tsconfig de l'app : il n'est pas listé ici.
          allowDefaultProject: [
            '*.config.ts',
            'apps/{admin,api,web,worker}/*.config.ts',
            'packages/*/*.config.ts',
          ],
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

  // ACC-04 « Aucun texte écrit en dur dans le code » : dans les interfaces, tout texte affiché ou
  // lu par le lecteur d'écran passe par @lignee/i18n. Prouvé par tools/ci/src/no-hardcoded-text.test.ts.
  //
  // Refusé :
  // - le texte entre deux balises JSX, les chaînes et gabarits dans le JSX ({'Valider'},
  //   accessibilityLabel="Ajouter votre mère", {ok ? 'Oui' : 'Non'}) ;
  // - une chaîne ou un gabarit passé à Alert.alert, Alert.prompt, ToastAndroid.show, ou en
  //   `text` d'un bouton d'Alert, y compris dans un fichier .ts.
  // Permis : une valeur d'union littérale, grâce aux types (variant="primary",
  // accessibilityRole="button") ; testID, style, key… ; le texte factice des tests.
  //
  // Limites connues, que la relecture doit couvrir :
  // - une constante texte déclarée hors du JSX puis affichée (const titre = 'Bienvenue' ;
  //   <Text>{titre}</Text>) passe, comme les textes rangés dans un objet ou un tableau ;
  // - le greffon tient tout nom en capitales pour une constante et ignore son contenu :
  //   un composant nommé `FAQ` ou `A` échappe au contrôle (nommez-les en PascalCase) ;
  // - dans un fichier .ts, seuls Alert et ToastAndroid sont surveillés : un titre de navigation,
  //   une notification locale ou un hook qui renvoie du texte passent ;
  // - les textes produits par le serveur (apps/api, apps/worker : notifications, courriels,
  //   messages d'erreur) ne sont pas couverts : ils devront passer par @lignee/i18n eux aussi.
  {
    files: [
      'apps/mobile/**/*.{tsx,jsx}',
      'apps/web/**/*.{tsx,jsx}',
      'apps/admin/**/*.{tsx,jsx}',
      'packages/ui/**/*.{tsx,jsx}',
    ],
    ignores: ['**/*.test.{tsx,jsx}'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          message: 'Texte en dur : ajoutez-le à @lignee/i18n et affichez t("espace:cle")',
          'should-validate-template': true,
          'jsx-attributes': {
            exclude: ['className', 'style', 'key', 'id', 'nativeID', 'testID', 'href', 'src'],
          },
          // Seuls les chiffres, la ponctuation et les espaces restent permis seuls.
          words: { exclude: ['[0-9\\s!-/:-@[-`{-~·–—…×−]+'] },
        },
      ],
    },
  },
  {
    files: [
      'apps/mobile/**/*.{ts,tsx,js,jsx}',
      'apps/web/**/*.{ts,tsx,js,jsx}',
      'apps/admin/**/*.{ts,tsx,js,jsx}',
      'packages/ui/**/*.{ts,tsx,js,jsx}',
    ],
    ignores: ['**/*.test.{ts,tsx,js,jsx}'],
    rules: {
      // Une autre configuration de no-restricted-syntax sur ces fichiers remplacerait celle-ci :
      // reprenez alors ces sélecteurs.
      'no-restricted-syntax': ['error', ...nativeDialogTextSelectors],
    },
  },

  // Désactive les règles de mise en forme : Prettier s'en charge.
  prettier,
);
