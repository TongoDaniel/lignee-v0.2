# Environnement local (Docker Compose)

Objet : faire tourner sur un poste, sans coût ni réseau, ce dont l'API et le worker ont besoin (TRD, « Environnements, CI/CD et livraison », Local) : PostgreSQL avec pg_trgm, unaccent et fuzzystrmatch, MinIO à la place de Cloudflare R2, puis l'API et le worker.

Qui : tout développeur, et la CI (job `environnement-local`). Durée : 2 minutes au premier démarrage (téléchargement des images), quelques secondes ensuite.

État : **procédure non encore jouée**. Écrite avec T-003 sur un poste où Docker Desktop n'était pas démarré : seule la configuration a été validée (`docker compose config`, hadolint, tests de `tools/ci`). Le job `environnement-local` de la CI la jouera à chaque pull request (démarrage, vérification, second démarrage, arrêt), à partir de la pull request de T-003. Cochez le journal en bas de page après chaque premier passage.

## Prérequis

- Docker Desktop (Windows, macOS) ou Docker Engine avec le greffon Compose v2 (Linux).
- Node 24 et Corepack pour la vérification (`corepack pnpm check:local-env`), comme pour le reste du dépôt.

## Ce qui tourne

| Service | Rôle | Démarré par | Port sur le poste |
| --- | --- | --- | --- |
| `postgres` | PostgreSQL 18, base `lignee` | `docker compose up -d` | `127.0.0.1:5432` (`LIGNEE_PG_PORT`) |
| `minio` | Stockage compatible S3 (ADR 0007) | `docker compose up -d` | API S3 `127.0.0.1:9000` (`LIGNEE_MINIO_PORT`), console web `127.0.0.1:9001` (`LIGNEE_MINIO_CONSOLE_PORT`) |
| `minio-init` | Crée le compartiment privé et la clé de l'application, puis s'arrête | `docker compose up -d` | — |
| `api` | API Hono (vide avant T-043 : démarre et s'arrête aussitôt) | `docker compose --profile app up -d` | `127.0.0.1:3000` (`LIGNEE_API_PORT`) |
| `worker` | Tâches de fond (vide avant T-075), réseau interne seulement : ne peut joindre aucun service extérieur | `docker compose --profile app up -d` | — |

Les ports ne sont ouverts que sur `127.0.0.1` : rien n'est joignable depuis le réseau local. Si un port est déjà pris (un PostgreSQL installé sur le poste, par exemple), changez la valeur dans `.env`.

**Base de données** (`packages/db/initdb/01-roles-et-extensions.sh`, joué au premier démarrage seulement) :

| Utilisateur | Mot de passe (`.env`) | Droits |
| --- | --- | --- |
| `postgres` | `LIGNEE_PG_SUPERUSER_PASSWORD` | Superutilisateur, pour l'administration locale seulement |
| `lignee_migration` | `LIGNEE_DB_MIGRATION_PASSWORD` | Propriétaire de la base et du schéma `public` : lance les migrations Prisma (T-042) |
| `lignee_app` | `LIGNEE_DB_APP_PASSWORD` | Lit et écrit les lignes ; ne crée ni table, ni table temporaire, ni schéma |

Chaînes de connexion depuis le poste : `postgresql://lignee_app:<mot de passe>@127.0.0.1:5432/lignee`, et de même avec `lignee_migration`.

**Médias** : compartiment privé `LIGNEE_S3_BUCKET` (`lignee-medias-local`), clé de l'application `LIGNEE_S3_ACCESS_KEY_ID` / `LIGNEE_S3_SECRET_ACCESS_KEY`, limitée à ce compartiment comme un jeton R2. Console web : http://127.0.0.1:9001, avec `LIGNEE_MINIO_ROOT_USER` et `LIGNEE_MINIO_ROOT_PASSWORD`.

**Faux fournisseurs** : pas encore de service. Les interfaces internes (TRD, « Choix techniques ») arrivent avec leurs faux fournisseurs : messages (codes WhatsApp et SMS) avec T-044, transcription et compréhension avec T-075. `compose.yaml` les sélectionne déjà par variables (`MESSAGES_PROVIDER`, `TRANSCRIPTION_PROVIDER`, `UNDERSTANDING_PROVIDER` à `fake`) ; ces tickets les lisent ou les renomment.

## Démarrer

```sh
cp .env.example .env          # une fois ; valeurs factices, réservées au poste
docker compose up -d          # PostgreSQL, MinIO, création du compartiment
docker compose ps             # postgres et minio « healthy », minio-init « exited (0) »
corepack pnpm check:local-env # vérifie extensions, droits et compartiment
```

Avec l'API et le worker (images construites depuis `apps/api/Dockerfile` et `apps/worker/Dockerfile`) :

```sh
docker compose --profile app up -d --build
```

Résultat attendu de la vérification : une ligne `ok - …` par contrôle, code de sortie 0. Code 1 : un contrôle échoue (le détail est sur la ligne `échec - …`). Code 2 : l'environnement n'est pas prêt (pas de `.env`, Docker arrêté, conteneurs non démarrés).

## Arrêter

```sh
docker compose --profile app down   # arrête et retire les conteneurs ; les données restent
```

`docker compose stop` arrête sans retirer ; `docker compose up -d` repart de là.

## Remettre à zéro

Efface la base et les médias locaux, puis rejoue l'initialisation (utilisateurs, extensions, compartiment). À faire aussi après une modification de `packages/db/initdb/` ou des mots de passe de `.env` : le script d'initialisation ne tourne que sur un volume vide.

```sh
docker compose --profile app down --volumes
docker compose up -d
```

## Journaux et accès direct

```sh
docker compose logs -f postgres minio
docker compose exec postgres psql -U postgres -d lignee   # superutilisateur, par le socket local
docker compose run --rm minio-init                          # rejoue la création du compartiment
```

## En cas de problème

| Symptôme | Cause probable | Remède |
| --- | --- | --- |
| `required variable … is missing a value: copiez .env.example en .env` | Pas de fichier `.env` | `cp .env.example .env` |
| `port is already allocated` | Port déjà pris sur le poste | Changer `LIGNEE_PG_PORT`, `LIGNEE_MINIO_PORT`… dans `.env` |
| `postgres` reste « unhealthy », journaux `bad interpreter` ou `\r` | Script d'initialisation en fins de ligne CRLF | `.gitattributes` l'impose en LF ; `git rm --cached -r packages/db/initdb && git checkout -- packages/db/initdb`, puis remise à zéro |
| `password authentication failed for user "lignee_app"` | `.env` modifié après la création du volume | Remise à zéro |
| `minio-init` « exited (1) » | MinIO pas prêt, ou mot de passe root changé après la création du volume | `docker compose logs minio-init`, puis remise à zéro |

## Retour arrière

Rien à défaire hors du poste : `docker compose --profile app down --volumes` retire conteneurs, réseaux et volumes du projet `lignee`. Les images téléchargées se suppriment avec `docker image rm`.

## Journal

- [ ] Jouée par la CI (job `environnement-local`) sur la pull request de T-003, le …
- [ ] Jouée le … par Daniel sur son poste.
