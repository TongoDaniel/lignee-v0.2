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
test/
  scenarios/     un fichier par cas limite
  voice-golden/  jeu de 300 phrases (avec l'accord des locuteurs)
docs/
  adr/  runbooks/  conformite/  cahier-des-charges/  charte/
```

## Outillage

Monorepo pnpm et Turborepo, TypeScript strict, ESLint (règles d'accessibilité comprises), Prettier, Vitest et commitlint. Il faut Node 22.12 ou plus récent (Node 24 conseillé). pnpm n'a pas besoin d'être installé globalement : Corepack, livré avec Node, prend la version fixée dans `package.json`.

```sh
corepack pnpm install        # installe les dépendances (pnpm-lock.yaml)
corepack pnpm lint           # ESLint dans chaque paquet, via Turborepo
corepack pnpm typecheck      # tsc --noEmit dans chaque paquet
corepack pnpm test           # Vitest dans chaque paquet
corepack pnpm format:check   # vérifie la mise en forme (Prettier)
corepack pnpm format         # corrige la mise en forme
```

Pour un seul paquet : `corepack pnpm --filter @lignee/kinship test`.

Les messages de commit suivent les conventions (`feat(kinship): …`) ; les portées admises sont dans `commitlint.config.mjs`. Pour vérifier un message : `echo "feat(kinship): …" | corepack pnpm commitlint`. Le hook `commit-msg` est facultatif : `git config core.hooksPath .githooks` l'active.

Prettier ne reformate pas les fichiers Markdown. `apps/mobile`, `apps/web` et `apps/admin` n'ont pas encore de `package.json` : ils entrent dans les tâches quand leur app est créée. Turborepo collecte une télémétrie anonyme ; `corepack pnpm exec turbo telemetry disable` la coupe sur votre poste. La CI devra définir `TURBO_TELEMETRY_DISABLED=1` (T-002).

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
