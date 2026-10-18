# Lignée — consignes pour Claude

- Le cahier des charges fait foi : `docs/cahier-des-charges/` (présentation, PRD, TRD, cas limites). Avant de concevoir quoi que ce soit, lisez la section du TRD et du PRD concernée. Si le code doit s'en écarter, écrivez une ADR dans `docs/adr/` au lieu de diverger en silence.
- La charte fait foi pour l'interface : `docs/charte/` (README, `tokens.json`, composants). Aucune couleur, taille ou espacement en dur dans un écran.
- Langue : code et identifiants en anglais ; commentaires, ADR, docs et messages à Daniel en français ; textes d'interface uniquement via `packages/i18n`, en français et en anglais, au ton de `docs/charte/08-ton.md` (vouvoiement, pas d'emoji).
- TypeScript strict partout, ESLint et Prettier, commits conventionnels (`feat(kinship): …`), une pull request ne fait qu'une chose et reprend la définition de « terminé » (`.github/pull_request_template.md`).
- Version en cours : V1. Rien de la V2 avant la porte 2 de la feuille de route. Le calque santé (V3) ne s'implémente pas avant l'analyse d'impact, le chiffrement audité et l'avis juridique.
- Chaque cas limite CL-… a un fichier `test/scenarios/<ID>.yaml` et un test qui le joue. Ajoutez une ligne à l'onglet Cas limites quand un nouveau cas apparaît.
- Données réelles de familles, de santé ou de mineurs : jamais dans le dépôt, les tests, les journaux ni les prompts. Utilisez des arbres générés.
- Secrets : jamais dans le dépôt. `.env` local, GitHub Actions, EAS, SOPS sur le serveur.
- Agents spécialisés : `.claude/agents/`. Toute modification de `packages/domain` (visibilité), `packages/sync`, `apps/api` (droits, auth) ou du contexte envoyé à la voix passe par une relecture de `gardien-confidentialite`.

## Comment Claude développe Lignée (ADR 0005, modifiée par l'ADR 0019)

- C'est Claude qui écrit, relit et fusionne le code ; Daniel décide de ce qui est humain (voir plus bas) et peut annuler toute fusion. La session principale est le maître d'œuvre : elle ne code pas elle-même un ticket, elle le confie à l'agent du module.
- Ordre de travail : les tickets GitHub dans l'ordre de `docs/plan/v1-decoupage.md` ; un ticket ne commence que si ses dépendances sont fusionnées.
- Un ticket : branche `feat/T-0NN-<slug>` dans un worktree isolé → agent du module (`modele-domaine`, `moteur-parente`, `sync-hors-ligne`, `pipeline-vocal`, `api-serveur`, `ecrans-lignee`, `exploitation`, `testeur-qualite`), scénarios et tests d'abord → lint, types et tests lancés, sortie réelle rapportée → `relecteur-code`, et `gardien-confidentialite` si le ticket le demande → corrections → pull request avec le modèle rempli et le verdict des relecteurs → **fusion par la session principale** quand la CI est verte et les relecteurs disent « à fusionner » (squash ; merge commit pour une pile), puis ticket suivant sans attendre Daniel.
- Claude ne pousse jamais directement sur `main` et ne fusionne jamais avec une CI rouge. Il accepte les ADR techniques ; les ADR de produit, de droit ou d'argent restent « proposées » pour Daniel.
- Ce que seul Daniel fait : tester sur les téléphones physiques (ticket « À vérifier sur téléphone », non bloquant), ouvrir les comptes, signer, payer, saisir les secrets, voir le juriste, recruter les familles et les locuteurs. Quand un ticket en dépend, demandez-le-lui tôt et précisément.
