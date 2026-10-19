// Tests de @lignee/sync. Le pilote better-sqlite3 de Drizzle importe `better-sqlite3` ; les tests
// lui donnent sa variante chiffrante (better-sqlite3-multiple-ciphers, même API, format
// SQLCipher 4) : drizzle-orm est donc transformé par Vitest, qui applique l'alias.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { 'better-sqlite3': 'better-sqlite3-multiple-ciphers' },
  },
  test: {
    server: { deps: { inline: ['drizzle-orm'] } },
  },
});
