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

- L'environnement local et la CI utilisent `pgsty/minio`, épinglée par étiquette et par empreinte (`compose.yaml`). Dependabot propose les nouvelles versions 14 jours après leur publication.
- Une seule image sert au serveur (vérification de santé par `curl`) et à la création du compartiment au démarrage (`mc`).
- Le serveur n'est joignable que depuis le poste (`127.0.0.1`) et ne reçoit que des données générées : une image communautaire y est acceptable.

## Écarté

- **`chainguard/minio`** : sans étiquette de version en accès gratuit, la règle « versions publiées depuis au moins deux semaines » ne se vérifie pas, et il faut une seconde image pour `mc`. Reste l'alternative si `pgsty/minio` cesse d'être maintenue.
- **Construire MinIO depuis ses sources** : une image de plus à maintenir pour un outil de développement.
- **Remplacer MinIO** (Garage, SeaweedFS, RustFS) : écart au TRD sans gain pour un usage local ; à reconsidérer avec une nouvelle ADR si les builds communautaires de MinIO s'arrêtent.

## Conséquences

- La production et la préproduction ne sont pas concernées : elles utilisent Cloudflare R2.
- Le code de l'API et du worker ne parle qu'au protocole S3 (`S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`) : changer d'image locale ne le touche pas.
- À revoir à chaque mise à jour proposée par Dependabot : le projet `pgsty/minio` publie-t-il encore, et suit-il les correctifs de sécurité de MinIO ?
