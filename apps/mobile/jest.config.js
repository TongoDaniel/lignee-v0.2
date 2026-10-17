// Tests de rendu (jest-expo, préréglage d'Expo) : écrans, barre d'onglets, polyfills Intl.
// Sous pnpm, les paquets sont dans node_modules/.pnpm : le motif de la documentation d'Expo
// (« Unit testing with Jest », variante pnpm) laisse Babel les transformer.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Le premier rendu charge Expo Router et toutes les routes : plusieurs secondes quand Turborepo
  // lance les tests de tous les paquets en même temps.
  testTimeout: 30_000,
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg|@formatjs/.*|intl-messageformat|standard-navigation))',
  ],
};
