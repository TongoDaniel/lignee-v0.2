# Lignée

App mobile d'arbre généalogique familial : construire l'arbre à plusieurs, à la voix, en français et en anglais, garder la mémoire de la famille et, en privé, ses antécédents de santé. Marché de lancement : le Cameroun et l'Afrique francophone, avec leur diaspora.

## Où lire quoi

| Sujet | Fichier |
| --- | --- |
| Contexte, objectifs, feuille de route, budget, risques | [docs/cahier-des-charges/cahier-des-charges-1-presentation.md](docs/cahier-des-charges/cahier-des-charges-1-presentation.md) |
| Produit, fonction par fonction et version par version | [docs/cahier-des-charges/cahier-des-charges-2-PRD.md](docs/cahier-des-charges/cahier-des-charges-2-PRD.md) |
| Technique : architecture, modèle, synchro, voix, sécurité | [docs/cahier-des-charges/cahier-des-charges-3-TRD.md](docs/cahier-des-charges/cahier-des-charges-3-TRD.md) |
| Scénarios à tester (CL-…) | [docs/cahier-des-charges/cahier-des-charges-4-cas-limites.md](docs/cahier-des-charges/cahier-des-charges-4-cas-limites.md) |
| Guide d'utilisation | [docs/cahier-des-charges/guide-utilisation.md](docs/cahier-des-charges/guide-utilisation.md) |
| Charte graphique, tokens, composants, logos, icônes, polices | [docs/charte/README.md](docs/charte/README.md) |
| Décisions d'architecture | [docs/adr/](docs/adr/) |

La source vivante du cahier des charges et de la charte reste sur claude.ai ; les copies de `docs/` datent du 15 octobre 2026.

## Organisation

```text
apps/
  mobile/    app Expo (Expo Router)
  api/       API Hono
  worker/    voix, exports, rappels, vignettes, purges
  web/       site, invitations, paiement web (V3), version web (V4)
  admin/     console interne
packages/
  kinship/   moteur de parenté
  layout/    disposition de l'arbre
  domain/    types, schémas Zod, dates floues, cohérence, visibilité
  sync/      protocole de synchronisation
  voice/     schéma d'extraction, glossaire, résolveur
  ui/        composants de la charte et tokens.ts
  i18n/      textes FR et EN
  db/        schéma Prisma et migrations
tools/
  ci/        contrôles de l'intégration continue (CON-12…), ADR 0006
test/
  scenarios/     un fichier par cas limite
  voice-golden/  jeu de 300 phrases (avec l'accord des locuteurs)
docs/
  adr/  runbooks/  conformite/  cahier-des-charges/  charte/
```

## Outillage

Monorepo pnpm et Turborepo, TypeScript strict, ESLint (règles d'accessibilité comprises), Prettier, Vitest et commitlint. Il faut Node 22.18 ou plus récent ; la version de référence est dans `.nvmrc` (24), celle de la CI. pnpm n'a pas besoin d'être installé globalement : Corepack, livré avec Node, prend la version fixée dans `package.json`.

```sh
corepack pnpm install        # installe les dépendances (pnpm-lock.yaml)
corepack pnpm lint           # ESLint dans chaque paquet, via Turborepo
corepack pnpm typecheck      # tsc --noEmit dans chaque paquet
corepack pnpm test           # Vitest dans chaque paquet
corepack pnpm format:check   # vérifie la mise en forme (Prettier)
corepack pnpm format         # corrige la mise en forme
corepack pnpm check:forbidden-dependencies  # CON-12 : aucune bibliothèque de reconnaissance faciale (npm et natif)
```

Pour un seul paquet : `corepack pnpm --filter @lignee/kinship test`.

### Tests de performance

Les budgets de temps du cahier des charges (TRD, « Performance et appareils cibles » ; par exemple 100 ms de disposition pour 500 personnes visibles, PAR-01) visent l'Android de référence et y sont vérifiés (T-028, T-105). Dans Vitest, sur un poste ou un runner partagé, un test de temps n'est qu'un garde-fou contre une régression grossière. Règle commune, outillée par `@lignee/domain/test-support` (`medianTime`, `reportBudget`) :

- chauffe d'abord, puis médiane de plusieurs exécutions, jamais une mesure unique ;
- plafond = budget × facteur : 3 en CI (variable `CI`), 1,5 sur un poste ; `LIGNEE_PERF_FACTOR` le remplace (par exemple `LIGNEE_PERF_FACTOR=1 corepack pnpm test` pour comparer au budget brut) ;
- chaque mesure est écrite dans la sortie du test avec le budget et le plafond (lignes `[perf]`), pour suivre la tendance d'un build à l'autre.

Les budgets eux-mêmes ne changent pas pour faire passer la CI ; seul le facteur absorbe la lenteur des runners.

Textes d'interface : jamais en dur (ACC-04). ESLint refuse le texte dans le JSX de `apps/mobile`, `apps/web`, `apps/admin` et `packages/ui` (règle `i18next/no-literal-string`) ; pour ajouter un texte, voir [packages/i18n/README.md](packages/i18n/README.md).

### Environnement local

PostgreSQL 18 (avec pg_trgm, unaccent et fuzzystrmatch) et MinIO à la place de Cloudflare R2 tournent dans Docker Compose (`compose.yaml`) ; l'API et le worker s'y ajoutent avec le profil `app`. Mode d'emploi, ports et remise à zéro : [docs/runbooks/environnement-local.md](docs/runbooks/environnement-local.md).

```sh
cp .env.example .env            # valeurs factices, réservées au poste ; .env n'est jamais commité
docker compose up -d            # PostgreSQL et MinIO
corepack pnpm check:local-env   # vérifie extensions, droits des utilisateurs et compartiment privé
docker compose down             # arrête (ajouter --volumes pour tout effacer)
```

Les messages de commit suivent les conventions (`feat(kinship): …`) ; les portées admises sont dans `commitlint.config.mjs`. Pour vérifier un message : `echo "feat(kinship): …" | corepack pnpm commitlint`. Le hook `commit-msg` est facultatif : `git config core.hooksPath .githooks` l'active.

Prettier ne reformate pas les fichiers Markdown. `apps/web` et `apps/admin` n'ont pas encore de `package.json` : ils entrent dans les tâches quand leur app est créée. L'app mobile (`apps/mobile`, Expo) se teste avec Jest (jest-expo) et non Vitest ; pour la lancer sur un téléphone : [docs/runbooks/lancer-app-mobile.md](docs/runbooks/lancer-app-mobile.md). Turborepo collecte une télémétrie anonyme ; `corepack pnpm exec turbo telemetry disable` la coupe sur votre poste. La CI la coupe avec `TURBO_TELEMETRY_DISABLED=1`.

## Intégration continue

GitHub Actions, à chaque pull request et à chaque push sur `main` :

| Workflow | Job | Contenu |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `verifications` | CON-12, Prettier, ESLint, tsc, Vitest (unitaires et propriétés) et Jest (app mobile), commitlint sur les commits et sur le titre de la pull request |
| | `bundle-mobile` | App mobile : versions conformes au SDK Expo (`expo install --check`), bundle Hermes Android et iOS (`expo export`), taille relevée dans le résumé |
| | `audit-dependances` | `pnpm audit --audit-level high` : échoue sur une faille haute ou critique |
| | `cas-limites` | Scénarios `test/scenarios/*.yaml` : les tests tournent avec `LIGNEE_SCENARIOS_PLAYED_DIR` ; un scénario est joué si un test l'a réellement chargé (`loadScenario`, voir `test/scenarios/README.md`) ; le job échoue sur tout scénario non joué, sans liste d'exception. Ce qu'un test ne vérifie pas encore est déclaré dans le champ `couverture` du scénario |
| | `integration-postgresql` | Tests `*.integration.test.ts` sur PostgreSQL réel ; à brancher avec T-042 et T-043 |
| | `taille-synchro` | Taille des réponses de synchronisation ; à brancher avec T-064 |
| | `images-docker` | hadolint et construction des images de l'API et du worker (`apps/*/Dockerfile`), démarrage sous un utilisateur autre que root ; échoue si un Dockerfile n'est construit par aucun service de `compose.yaml`. Publication sur GitHub Container Registry : T-068 |
| | `environnement-local` | `docker compose up -d`, puis `check:local-env` : extensions de PostgreSQL, utilisateur applicatif sans droit sur le schéma, utilisateur de migration séparé, compartiment MinIO privé ; second démarrage, arrêt |
| `.github/workflows/codeql.yml` | `codeql` | Analyse CodeQL ; inactif (ignoré, donc compté comme réussi) tant que le dépôt est privé sans Code Security : ne pas le rendre obligatoire avant |

Un job qui n'a encore rien à tester le dit dans son résumé, et échoue dès que la matière apparaît sans que le job soit branché. Le titre de la pull request est vérifié parce que la fusion se fait par squash : il devient le message du commit sur `main`. Dependabot (`.github/dependabot.yml`) propose chaque semaine les mises à jour, 14 jours après leur publication. La protection de `main` se règle à la main : [docs/runbooks/proteger-main.md](docs/runbooks/proteger-main.md).

## Agents Claude Code

Les agents spécialisés sont dans [.claude/agents/](.claude/agents/). Dans une session Claude Code, demandez par exemple « utilise l'agent moteur-parente pour… ».

| Agent | Rôle |
| --- | --- |
| `chef-de-chantier` | Découpe les versions en tickets, tient les ADR, vérifie la définition de « terminé » |
| `moteur-parente` | `packages/kinship`, `packages/layout`, GEDCOM |
| `pipeline-vocal` | `packages/voice`, worker voix, jeu de test vocal |
| `sync-hors-ligne` | `packages/sync`, base locale chiffrée |
| `api-serveur` | `apps/api`, `apps/worker`, `packages/db`, auth, médias |
| `ecrans-lignee` | `apps/mobile`, `packages/ui`, `packages/i18n` |
| `gardien-confidentialite` | Relecture lecture seule : droits, non-fuite, conformité |
| `testeur-qualite` | Scénarios de cas limites, tests de propriétés, Maestro, performance |
| `exploitation` | CI/CD, EAS, VPS, sauvegardes, observabilité |
