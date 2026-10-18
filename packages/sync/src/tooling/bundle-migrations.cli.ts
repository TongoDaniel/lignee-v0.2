// `corepack pnpm --filter @lignee/sync db:generate` lance drizzle-kit puis ce script, qui écrit
// le module des migrations embarqué par le téléphone.
import { writeFileSync } from 'node:fs';

import { generatedMigrationsFile, renderMigrationBundle } from './migration-bundle.ts';

writeFileSync(generatedMigrationsFile, renderMigrationBundle());
console.log(`Migrations écrites : ${generatedMigrationsFile}`);
