# 0006 — Un dossier `tools/` pour les contrôles de l'intégration continue

Date : 16 octobre 2026 · Statut : proposée (T-002)

## Contexte

L'intégration continue a besoin de scripts à elle : le contrôle CON-12 (« Aucune bibliothèque de reconnaissance faciale dans l'app ») aujourd'hui, puis la vérification que chaque scénario de cas limite est joué (T-006) et la mesure de la taille des réponses de synchronisation (T-064). L'organisation du code du TRD ne prévoit que `apps/`, `packages/`, `test/` et `docs/`. Ces scripts ne sont ni une app, ni un paquet partagé par l'app et le serveur.

## Décision

- Un dossier `tools/`, déclaré dans `pnpm-workspace.yaml`. Chaque sous-dossier est un paquet privé du monorepo, avec `lint`, `typecheck` et `test` : Turborepo le vérifie comme le reste.
- Premier paquet : `tools/ci` (`@lignee/ci`), contrôles lancés par `.github/workflows/ci.yml`.
- Les scripts sont en TypeScript strict et tournent directement sous Node 24, qui retire les types sans compilation : pas de `tsx` ni d'étape de build.
- Rien de `tools/` n'est importé par une app ou un paquet de `packages/`.

## Écarté

- **Scripts dans `.github/scripts/`** : hors des espaces de travail, donc ni lint, ni types, ni tests par Turborepo.
- **Scripts dans `packages/`** : ce dossier est réservé au code partagé par l'app et le serveur ; un contrôle de CI n'y a pas sa place.
- **Scripts JavaScript non typés** : contraire à « TypeScript strict partout ».

## Conséquences

- L'arborescence du TRD (« Organisation du code ») gagne une entrée `tools/` ; le README la mentionne.
- Les scripts exigent Node 22.18 ou plus récent (suppression des types sans option) ; la CI utilise la version de `.nvmrc` (24).
