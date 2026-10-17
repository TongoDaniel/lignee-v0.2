# 0007 — Image de MinIO pour l'environnement local

Date : 16 octobre 2026 · Statut : proposée (T-003)

## Contexte

Le TRD (« Environnements, CI/CD et livraison ») prévoit MinIO à la place de Cloudflare R2 dans l'environnement local. Depuis la fin de 2025, MinIO ne distribue plus d'image Docker ni de binaire pour son édition communautaire, seulement le code source. Le 16 octobre 2026, `minio/minio` et `minio/mc` ne sont plus téléchargeables sans compte, ni sur Docker Hub ni sur Quay (`UNAUTHORIZED` à une requête anonyme). Bitnami a aussi retiré ses images gratuites.

Les images encore disponibles :

| Image | Éditeur | Versions | Outils dans l'image |
| --- | --- | --- | --- |
| `pgsty/minio` | Projet Pigsty (communautaire), à partir du code de MinIO | Étiquettes datées (`RELEASE.2026-08-04T00-00-00Z`…) | `minio`, `mc`, `curl`, `sh` |
| `chainguard/minio` | Chainguard (société) | `latest` seulement en accès gratuit | `minio` seul, sans shell ; `mc` dans une seconde image, elle aussi en `latest` |

## Décision

- L'environnement local et la CI utilisent `pgsty/minio`, épinglée par étiquette et par empreinte (`compose.yaml`).
- Une seule image sert au serveur (vérification de santé par `curl`) et à la création du compartiment au démarrage (`mc`).
- **Entrée** : le serveur n'est joignable que depuis le poste (ports publiés sur `127.0.0.1`) et ne reçoit que des données générées.
- **Sortie** : c'est elle qui compte pour une image communautaire, puisque le conteneur détient le mot de passe administrateur et la clé de l'application. Sur le réseau `default` de Compose, il sortirait librement sur Internet. Il est donc relié à deux réseaux qui ne sortent pas :
  - `interne` (`internal: true`), sans aucune sortie ; Docker ne publie pas les ports d'un conteneur relié seulement à ce type de réseau ;
  - `poste`, un pont dont la traduction d'adresses vers l'extérieur est coupée (`com.docker.network.bridge.enable_ip_masquerade: "false"`) : la publication des ports sur `127.0.0.1` marche, la sortie vers Internet non.

  PostgreSQL et l'API sont sur les mêmes réseaux. Le job `environnement-local` vérifie sur Linux que les ports publiés répondent et que le conteneur `minio` n'atteint pas `https://github.com`, alors que le runner y accède. MinIO a en plus ses propres appels sortants coupés (`MINIO_UPDATE`, `MINIO_CALLHOME_ENABLE`).
- Avec cette restriction, et sur des données générées seulement, une image communautaire est acceptable.

## Écarté

- **`chainguard/minio`** : sans étiquette de version en accès gratuit, la règle « versions publiées depuis au moins deux semaines » ne se vérifie pas, et il faut une seconde image pour `mc`. Reste l'alternative si `pgsty/minio` cesse d'être maintenue.
- **Construire MinIO depuis ses sources** : une image de plus à maintenir pour un outil de développement.
- **Remplacer MinIO** (Garage, SeaweedFS, RustFS) : écart au TRD sans gain pour un usage local ; à reconsidérer avec une nouvelle ADR si les builds communautaires de MinIO s'arrêtent.

## Mises à jour

Dependabot sait suivre une image épinglée par empreinte, mais il compare sans doute mal des étiquettes de la forme `RELEASE.2026-08-04T00-00-00Z`, qui ne suivent pas la numérotation sémantique : il est probable qu'il ne propose jamais de nouvelle version de `pgsty/minio`. Une revue manuelle s'impose donc, inscrite au journal de docs/runbooks/environnement-local.md :

- tous les trois mois, et à chaque alerte de sécurité visant MinIO ;
- prochaine revue : **16 janvier 2027** ;
- à vérifier : dernière étiquette publiée (au moins 14 jours avant la revue), correctifs de sécurité de MinIO repris, projet toujours actif ; puis mise à jour de l'étiquette et de l'empreinte dans `compose.yaml`.

## Conséquences

- La production et la préproduction ne sont pas concernées : elles utilisent Cloudflare R2.
- Le code de l'API et du worker ne parle qu'au protocole S3 (`S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`) : changer d'image locale ne le touche pas.
- La restriction de sortie dépend du pilote réseau de Docker Engine sous Linux. Sous Docker Desktop (Windows, macOS), où les conteneurs tournent dans une machine virtuelle, elle reste à vérifier sur le poste de Daniel. Si les ports publiés ne répondent pas, on ne rend **pas** la sortie au réseau `poste` tant que `minio` y est : on sort `minio` de ce réseau (réseau `interne` seul, aucun port publié, accès par `docker compose exec`), par un fichier Compose local non commité décrit dans le runbook (« Docker Desktop : MinIO sur le réseau interne seulement »).
- **Limite connue : la résolution DNS.** Sur le réseau `poste`, le résolveur embarqué de Docker (`127.0.0.11`) relaie probablement les requêtes vers celui de l'hôte : un conteneur résout les noms publics même sans pouvoir s'y connecter, et pourrait faire sortir quelques octets dans des requêtes DNS. Acceptée pour un environnement local à données générées. Le job `environnement-local` relève le comportement (`getent hosts github.com` dans le conteneur `minio`) dans son résumé, sans échouer.
- L'API locale ne sort pas non plus sur Internet : elle n'utilise que les faux fournisseurs. Un ticket qui aurait besoin d'un service extérieur en local devra le dire et changer de réseau par une décision explicite.
