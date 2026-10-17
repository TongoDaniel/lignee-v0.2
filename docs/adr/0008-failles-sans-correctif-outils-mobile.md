# 0008 — Deux failles sans correctif dans les outils de l'app mobile

Date : 17 octobre 2026 · Statut : proposée (T-011)

## Contexte

Le job `audit-dependances` (`pnpm audit --audit-level high`) bloque toute faille haute ou critique. L'ajout de l'app Expo (T-011, SDK 57) fait entrer deux failles hautes pour lesquelles **aucune version corrigée n'existe** (« Patched versions <0.0.0 » le 17 octobre 2026) :

| Faille | Paquet | Chemin | Usage réel |
| --- | --- | --- | --- |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), vérification de signature RSA PKCS#1 v1.5 | `node-forge` <= 1.4.0 (dernière version : 1.4.0) | `apps/mobile` > `expo` > `@expo/cli` > `node-forge` | La ligne de commande d'Expo, sur le poste du développeur, s'en sert seulement pour lire le certificat de signature iOS local (`run/ios/codeSigning/Security.js`, `expo run:ios`). Toutes les versions de `@expo/cli`, SDK 58 compris, en dépendent. |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), épuisement de la pile | `braces` <= 3.0.3 (dernière version : 3.0.3) | `apps/mobile` > `@react-native/jest-preset` > `babel-jest` > `@jest/transform` > `micromatch` > `braces` | Jest, pour choisir les fichiers à transformer pendant les tests ; les motifs viennent de notre configuration, jamais d'un utilisateur. `micromatch` 4.0.8, sa dernière version, exige `braces` ^3.0.3. |

Aucun de ces paquets n'entre dans l'app publiée : Metro n'embarque que ce que le code de l'app importe à partir de `expo-router/entry`, et ni la ligne de commande d'Expo ni Jest n'en font partie. Le serveur (`apps/api`, `apps/worker`) n'en dépend pas.

## Décision

- Ces deux identifiants, et eux seuls, sont ignorés par `pnpm audit` (`pnpm.auditConfig.ignoreGhsas` dans le `package.json` racine). Le seuil reste « haute » pour tout le reste.
- **Revue au plus tard le 17 janvier 2027**, et à chaque changement de SDK Expo ou de Jest : si une version corrigée existe ou si le chemin disparaît, on retire l'exception. Une nouvelle faille sur ces mêmes paquets porte un autre identifiant et fait échouer l'audit.
- Les failles moyennes sans correctif (`sprintf-js` par Jest) ne bloquent pas l'audit et ne sont pas ignorées.

## Écarté

- **Baisser le seuil de l'audit ou le rendre facultatif** : on ne verrait plus les failles hautes du serveur.
- **Forcer une autre version par `overrides`** : il n'y en a aucune de corrigée.
- **Retirer `@expo/cli` ou Jest** : le premier construit l'app, le second porte les tests de rendu demandés par le TRD.
