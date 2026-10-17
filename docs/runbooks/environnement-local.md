# Environnement local (Docker Compose)

Objet : faire tourner sur un poste, sans coût ni réseau, ce dont l'API et le worker ont besoin (TRD, « Environnements, CI/CD et livraison », Local) : PostgreSQL avec pg_trgm, unaccent et fuzzystrmatch, MinIO à la place de Cloudflare R2, puis l'API et le worker.

Qui : tout développeur, et la CI (job `environnement-local`). Durée : 2 minutes au premier démarrage (téléchargement des images), quelques secondes ensuite.

État : **jouée par la CI** (job `environnement-local`, Linux) à chaque pull request : démarrage, vérification, second démarrage, arrêt. **Pas encore jouée sur un poste** : Docker Desktop n'était pas démarré lors de T-003. Cochez le journal en bas de page après le premier passage sur le poste de Daniel.

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

Aucun conteneur ne sort sur Internet (ADR 0007) : `postgres`, `minio` et `api` sont sur le réseau `poste`, qui publie les ports sur `127.0.0.1` mais coupe la sortie ; `minio-init` et `worker` sont sur le réseau `interne`, sans aucune sortie. Les images se téléchargent et se construisent normalement : c'est Docker, pas les conteneurs, qui accède au réseau.

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
| Port publié qui ne répond pas sous Docker Desktop, alors que le conteneur est « healthy » | Réseau `poste` sans traduction d'adresses, non vérifié sous Docker Desktop | Le signaler (ADR 0007). **Ne retirez pas les `driver_opts` du réseau `poste` tant que `minio` y est** : l'image communautaire de MinIO, qui détient le mot de passe administrateur, retrouverait Internet. Sortez plutôt `minio` de ce réseau, avec le fichier ci-dessous |

### Docker Desktop : MinIO sur le réseau interne seulement

Si les ports publiés ne répondent pas sous Docker Desktop, créez à la racine `compose.docker-desktop.local.yaml` (ignoré par git, motif `*.local.yaml`) :

```yaml
# MinIO sur le réseau interne seulement : ni port publié, ni sortie vers Internet.
# Le réseau `poste` retrouve sa traduction d'adresses pour PostgreSQL et l'API, images
# officielles ou construites ici, qui n'ont pas le mot de passe de MinIO.
services:
  minio:
    networks: !override [interne]
    ports: !reset []
networks:
  poste:
    driver_opts: !reset {}
```

Puis démarrez avec `docker compose -f compose.yaml -f compose.docker-desktop.local.yaml up -d` (même option `-f` pour `down`, `logs`…). MinIO n'est alors joignable que depuis les conteneurs (`http://minio:9000`) et par `docker compose exec minio mc …` ; la console web et le contrôle d'accès anonyme de `check:local-env` (requête depuis le poste) ne marchent plus : ce dernier contrôle échoue, c'est attendu dans cette configuration.

## Retour arrière

Rien à défaire hors du poste : `docker compose --profile app down --volumes` retire conteneurs, réseaux et volumes du projet `lignee`. Les images téléchargées se suppriment avec `docker image rm`.

Ce qui change pour la préproduction et la production : [preproduction-a-faire.md](preproduction-a-faire.md).

## Revue de l'image de MinIO

Dependabot ne propose sans doute pas les nouvelles étiquettes `RELEASE.…` de `pgsty/minio` (ADR 0007). Tous les trois mois, et à chaque alerte de sécurité visant MinIO : dernière étiquette publiée depuis au moins 14 jours, correctifs de sécurité repris, projet actif ; puis étiquette et empreinte mises à jour dans `compose.yaml` (même étiquette dans `x-minio-image`, une seule ligne).

- [ ] Revue du 16 janvier 2027 par … (étiquette retenue : …)

## Journal

- [x] Jouée par la CI (job `environnement-local`) sur la pull request brouillon #20 de T-003, le 16 octobre 2026 (relevé du coordinateur : 19 contrôles joués).
- [ ] Jouée le … par Daniel sur son poste.
