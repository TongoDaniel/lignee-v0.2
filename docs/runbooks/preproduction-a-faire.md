# Préproduction et production : ce qui change par rapport à l'environnement local

Objet : liste de ce que l'environnement local (T-003, [environnement-local.md](environnement-local.md)) fait par commodité, et que la préproduction et la production ne doivent **pas** reprendre telles quelles. À traiter par T-068 (préproduction), puis à reporter en production. Établie avec la relecture de `gardien-confidentialite` sur T-003.

Ce n'est pas encore une procédure : T-068 la transforme en étapes du runbook de déploiement, et coche chaque ligne avec la preuve (commande, test ou contrôle de la CI).

## Base de données

- [ ] **Authentification locale** : l'image locale fait confiance au socket local (`--auth-local=trust`). Sur le serveur : `scram-sha-256` partout, ou `peer` pour le seul compte système d'administration.
- [ ] **`lignee_migration` sans CREATEDB** : l'attribut ne sert qu'à la base fantôme de `prisma migrate dev` en local. En préproduction et en production, `prisma migrate deploy` n'en a pas besoin.
- [ ] **Retraits de droits identiques** : `REVOKE ALL ON DATABASE … FROM PUBLIC` sur la base de Lignée, `postgres` et `template1` ; `REVOKE ALL ON SCHEMA public FROM PUBLIC` ; droits par défaut de `lignee_migration` vers `lignee_app` (voir `packages/db/initdb/01-roles-et-extensions.sh`). Rejouer les contrôles de `tools/ci/src/local-env.ts` contre le serveur.
- [ ] **TLS** entre l'API et PostgreSQL si la base quitte la machine de l'API (palier de 1 000 familles), `sslmode=verify-full`.
- [ ] **`search_path` fixe** dans les scripts d'administration et les fonctions `SECURITY DEFINER` (`SET search_path = pg_catalog, public`), pour qu'un objet créé ailleurs ne soit pas pris à la place d'une fonction d'extension.
- [ ] **Journaux PostgreSQL sans paramètres** : `log_statement = none`, `log_parameter_max_length = 0`, `log_parameter_max_length_on_error = 0`. Les valeurs des requêtes contiennent des noms, des dates et des liens de famille ; elles ne doivent jamais arriver dans un journal.

## Réseau et exposition

- [ ] **Aucun port publié hors de Caddy** : ni PostgreSQL, ni l'API, ni le stockage. Seuls 443 (Caddy) et SSH par clé sont ouverts (TRD, « Authentification et sécurité »).
- [ ] **Réseaux séparés** : `base` (API, worker, PostgreSQL) et `stockage` (ce qui parle à R2), plus le réseau de Caddy vers l'API ; aucun conteneur sur un réseau dont il n'a pas besoin. En local, un seul réseau `poste` et un réseau `interne` suffisent ; pas sur le serveur.

## Secrets

- [ ] **SOPS par environnement** : chaque environnement a ses propres secrets, chiffrés avec SOPS (TRD, « Environnements, CI/CD et livraison ») ; aucune valeur partagée entre préproduction et production.
- [ ] **Refus des valeurs locales** : le déploiement échoue si un secret commence par `local-only-` (valeurs factices de `.env.example`) ou est vide.

## Médias (Cloudflare R2)

- [ ] **Jeton R2 limité aux actions sur les objets** du compartiment (lecture, écriture, suppression, envois en plusieurs parties). Étudier le retrait de `ListBucket` : l'API connaît les clés qu'elle a créées et n'a pas à lister le compartiment ; sans cette action, une clé volée ne permet pas d'énumérer les médias.
- [ ] **Clés d'objet opaques** : identifiants aléatoires, sans nom de personne, de famille ni de lieu dans la clé (TRD, « Médias et économie de données » : une clé par arbre et par média, lecture par URL signée de 10 minutes).

## Journal

- [ ] Liste reprise par T-068 le … (lien vers le runbook de déploiement).
