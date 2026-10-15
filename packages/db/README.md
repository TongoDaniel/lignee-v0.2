# db

Schéma Prisma et migrations, toujours compatibles avec la version précédente. Agent : api-serveur.

`initdb/01-roles-et-extensions.sh` initialise la base de l'environnement local (`compose.yaml`, docs/runbooks/environnement-local.md) : extensions pg_trgm, unaccent et fuzzystrmatch ; utilisateur de migration `lignee_migration`, propriétaire de la base et du schéma `public` ; utilisateur applicatif `lignee_app`, qui lit et écrit les lignes des tables créées par `lignee_migration` sans pouvoir créer de table ni de schéma (TRD, « Authentification et sécurité »). Les migrations Prisma (T-042) se connectent avec `lignee_migration`, l'API et le worker avec `lignee_app`.
