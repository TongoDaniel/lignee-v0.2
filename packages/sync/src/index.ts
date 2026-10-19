// Point d'entrée de @lignee/sync : protocole de synchronisation, côté téléphone et côté serveur.
// T-016 : base locale chiffrée du téléphone (schéma Drizzle, migrations, clé, instantané d'arbre).
export const packageName = '@lignee/sync';

export * from './local-db/connection';
export * from './local-db/key';
export * from './local-db/migrate';
export * from './local-db/open';
export * from './local-db/schema';
export * from './local-db/snapshot';
