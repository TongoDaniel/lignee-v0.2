// Tests purs sous Vitest (Node) : scripts de génération, tokens, thème, contraste.
// Les tests de rendu React Native (test/*.test.tsx) tournent sous Jest (jest.config.cjs).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
