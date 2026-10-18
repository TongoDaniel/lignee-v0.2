// Tests de rendu des composants de la charte (jest-expo, comme apps/mobile) : test/*.test.tsx.
// Les tests purs (tokens, thème, contraste, scripts) restent sous Vitest (vitest.config.ts).
// Sous pnpm, les paquets sont dans node_modules/.pnpm : le motif laisse Babel les transformer.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.tsx'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  testTimeout: 30_000,
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-native-svg))',
  ],
};
