// Point d'entrée de @lignee/sync : protocole de synchronisation, côté téléphone et côté serveur.
// T-016 : base locale chiffrée du téléphone (schéma Drizzle, migrations, clé, instantané d'arbre).
// T-030 : application locale d'un lot de mutations et file de changements.
// T-024 : fiche d'une personne lue dans la copie locale (`readProfile`).
export const packageName = '@lignee/sync';

export * from './local-db/connection';
export * from './local-db/key';
export * from './local-db/migrate';
export * from './local-db/open';
export * from './local-db/schema';
export * from './local-db/snapshot';
export * from './mutations/apply';
export * from './mutations/local-changes';
export * from './mutations/queue';
export * from './profile/read-profile';
