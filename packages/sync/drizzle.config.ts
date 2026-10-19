// drizzle-kit : écrit les migrations SQL de la base du téléphone à partir du schéma Drizzle.
// `corepack pnpm --filter @lignee/sync db:generate`, puis relire et commiter le SQL produit.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/local-db/schema.ts',
  out: './src/local-db/migrations',
});
