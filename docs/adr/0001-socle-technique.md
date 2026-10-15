# 0001 — Socle technique

Date : 15 octobre 2026 · Statut : acceptée (reprend les décisions du 14 octobre 2026 du cahier des charges)

## Contexte

Deux développeurs à temps partiel, une seule base de code pour iOS et Android, un marché où l'Android d'entrée de gamme, le réseau irrégulier et la data chère sont la norme.

## Décision

- Monorepo unique (`apps/`, `packages/`, `test/`, `docs/`), espaces de travail pnpm.
- App : Expo (React Native), TypeScript strict, Expo Router ; base locale expo-sqlite + Drizzle, chiffrée (SQLCipher).
- Serveur : Hono, Prisma, PostgreSQL ; médias sur Cloudflare R2 ; déploiement Docker Compose sur VPS.
- Synchronisation : protocole maison (file de changements, journal serveur, curseur), parce que la visibilité se calcule par lecteur, personne, union et lien.
- Voix : Voxtral Mini Transcribe 2 pour transcrire, Claude Haiku 5.5 en sorties structurées pour comprendre ; l'IA comprend la phrase, le code place la personne, l'utilisateur valide.

## Écarté

Flutter, deux apps natives, WatermelonDB, Realm, PowerSync (à réévaluer si le protocole maison coûte trop), ElectricSQL.

## Conséquences

`packages/kinship`, `packages/domain`, `packages/sync` et `packages/voice` sont partagés par l'app et le serveur et n'existent qu'en un exemplaire. Le choix de pnpm est le seul ajout par rapport au cahier des charges : il gère bien les monorepos Expo et peut être revu par une nouvelle ADR.
