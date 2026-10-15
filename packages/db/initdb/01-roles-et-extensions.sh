#!/usr/bin/env bash
# Initialisation de la base locale (Docker Compose, docs/runbooks/environnement-local.md).
#
# Lancé une seule fois par l'image officielle de PostgreSQL, au premier démarrage sur un volume
# vide (/docker-entrypoint-initdb.d), avec le superutilisateur, par le socket local. Pour le
# rejouer : remettre l'environnement à zéro (`docker compose down --volumes`).
#
# TRD, « Choix techniques » : extensions pg_trgm, unaccent, fuzzystrmatch.
# TRD, « Authentification et sécurité » : utilisateur applicatif sans droit de modifier le
# schéma, utilisateur de migration séparé.
#
#   lignee_migration  propriétaire de la base et du schéma public ; lance les migrations Prisma
#                     (T-042). CREATEDB en local seulement, pour la base fantôme de
#                     `prisma migrate dev` ; la préproduction et la production ne le donnent pas.
#   lignee_app        utilisé par l'API et le worker : lit et écrit les lignes des tables créées
#                     par lignee_migration, ne crée ni table, ni table temporaire, ni schéma.
#
# Les mots de passe viennent de l'environnement du conteneur (.env, copié de .env.example) et
# passent par des variables psql : ni dans le texte SQL, ni dans les journaux.

set -Eeuo pipefail

: "${LIGNEE_DB_APP_PASSWORD:?LIGNEE_DB_APP_PASSWORD manquant : copiez .env.example en .env}"
: "${LIGNEE_DB_MIGRATION_PASSWORD:?LIGNEE_DB_MIGRATION_PASSWORD manquant : copiez .env.example en .env}"

psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
  --set=db_name="$POSTGRES_DB" \
  --set=app_password="$LIGNEE_DB_APP_PASSWORD" \
  --set=migration_password="$LIGNEE_DB_MIGRATION_PASSWORD" <<'SQL'
BEGIN;

-- Recherche approchée des noms et doublons (TRD, « Recherche »).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE ROLE lignee_migration
  LOGIN NOSUPERUSER NOCREATEROLE CREATEDB NOREPLICATION NOBYPASSRLS
  PASSWORD :'migration_password';

CREATE ROLE lignee_app
  LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS
  PASSWORD :'app_password';

-- La base et le schéma public appartiennent à l'utilisateur de migration.
ALTER DATABASE :"db_name" OWNER TO lignee_migration;
ALTER SCHEMA public OWNER TO lignee_migration;

-- Personne d'autre ne crée de schéma ni de table temporaire dans la base, ni d'objet dans
-- le schéma public. L'utilisateur applicatif peut seulement se connecter et y lire.
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO lignee_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lignee_app;

-- Droits sur les lignes des tables que les migrations créeront, pas sur leur structure.
ALTER DEFAULT PRIVILEGES FOR ROLE lignee_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lignee_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lignee_migration IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lignee_app;

COMMIT;
SQL
