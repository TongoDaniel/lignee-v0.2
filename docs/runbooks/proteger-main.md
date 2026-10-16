# Protéger la branche `main`

Objet : qu'aucun code n'entre dans `main` sans pull request, sans intégration continue verte, ni sans relecture (TRD, « Environnements, CI/CD et livraison » : « branche principale protégée, vérifications obligatoires » ; « Tests et qualité » : « Un test qui échoue bloque la fusion de la pull request »).

Qui : Daniel, seul (réglages GitHub, compte propriétaire du dépôt). Durée : 15 minutes. Fréquence : une fois, puis à chaque nouveau job obligatoire.

État : **procédure non encore jouée**. Elle a été écrite avec T-002 ; Claude ne modifie pas les réglages GitHub. Cochez « Jouée le … » en bas de page après le premier passage.

## 0. Prérequis : la protection n'existe pas sur un dépôt privé gratuit

Le 16 octobre 2026, `gh api repos/TongoDaniel/lignee-v0.2/branches/main/protection` et `gh api repos/TongoDaniel/lignee-v0.2/rulesets` répondent tous deux :

```text
Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
```

Sur un compte personnel gratuit, les règles de protection et les rulesets ne s'appliquent qu'aux dépôts publics. Trois voies, à décider par Daniel :

| Voie | Coût | Effet |
| --- | --- | --- |
| **GitHub Pro** sur le compte TongoDaniel (recommandé) | Environ 4 $ par mois (prix à vérifier sur github.com/pricing) ; absent du budget de fonctionnement, à y ajouter | Protection et rulesets sur les dépôts privés ; 3 000 minutes d'Actions par mois au lieu de 2 000 |
| Rendre le dépôt public | 0 $ | Protection gratuite et CodeQL gratuit, mais tout le code, les ADR et le plan deviennent publics ; à ne faire qu'après avis (marque, concurrence) |
| Rester sans protection | 0 $ | La CI tourne et affiche rouge ou vert, mais rien n'empêche une fusion rouge ni un push direct : discipline seule |

Les étapes suivantes supposent GitHub Pro (ou un dépôt public).

## 1. Faire tourner la CI une première fois

GitHub ne propose dans la liste des vérifications obligatoires que les jobs qui ont tourné dans les 7 derniers jours.

1. Pousser la branche de T-002 et ouvrir sa pull request.
2. Attendre la fin du workflow **CI** dans l'onglet *Checks* de la pull request.

## 2. Créer le ruleset de `main`

*Settings* > *Rules* > *Rulesets* > *New ruleset* > *New branch ruleset*.

| Champ | Valeur |
| --- | --- |
| Ruleset Name | `main protégée` |
| Enforcement status | `Active` |
| Bypass list | **vide** (personne, administrateur compris, ne contourne les règles) |
| Target branches | *Add target* > *Include default branch* |

Règles à cocher :

- [x] **Restrict deletions**
- [x] **Block force pushes**
- [x] **Require linear history** (fusion par *squash* : un ticket = un commit sur `main`)
- [x] **Require a pull request before merging** — c'est elle qui **interdit le push direct** sur `main`, pour tout le monde puisque la liste de contournement est vide.
  - *Required approvals* : voir l'étape 3.
  - [x] *Dismiss stale pull request approvals when new commits are pushed*
  - [x] *Require review from Code Owners* (seulement si *Required approvals* vaut au moins 1)
  - [x] *Require approval of the most recent reviewable push* (seulement si *Required approvals* vaut au moins 1)
  - [x] *Require conversation resolution before merging*
  - *Allowed merge methods* : `Squash` seulement.
- [x] **Require status checks to pass**
  - [x] *Require branches to be up to date before merging*
  - *Add checks*, source **GitHub Actions**, noms exacts (ceux de `.github/workflows/ci.yml`) :

| Vérification | Ce qu'elle bloque | Rempli par |
| --- | --- | --- |
| `verifications` | CON-12 (reconnaissance faciale), Prettier, ESLint, tsc, Vitest (unitaires et propriétés), commitlint sur chaque commit et sur le titre de la pull request (le titre devient le message du commit *squash*) | T-002 |
| `audit-dependances` | Faille haute ou critique connue (`pnpm audit --audit-level high`) | T-002 |
| `cas-limites` | Scénario `test/scenarios/*.yaml` ou `*.yml` qui n'est joué par aucun test | T-004, puis T-006. D'ici T-006, un scénario est joué quand un fichier `*.test.ts` cite son identifiant entre apostrophes ; le job tolère, avec un avertissement, la seule liste fermée `PENDING_T006` du workflow (aujourd'hui `CL-POL-03`) et échoue sur tout autre scénario non joué |
| `integration-postgresql` | Tests `*.integration.test.ts` sur PostgreSQL réel (Testcontainers) | T-042, T-043 (pour l'instant : vert s'il n'y a aucun test d'intégration, rouge s'il y en a un et que le job n'est pas branché) |
| `taille-synchro` | Dépassement du budget de données sur les arbres de 100, 1 000 et 5 000 personnes | T-064 (même règle) |
| `images-docker` | Dockerfile refusé par hadolint, image de l'API ou du worker qui ne se construit pas ou tourne sous root, Dockerfile (`Dockerfile`, `Containerfile`, toute casse) construit par aucun service de `compose.yaml` | T-003 ; publication sur GitHub Container Registry en T-068 |
| `environnement-local` | `compose.yaml` qui ne démarre plus ; extension pg_trgm, unaccent ou fuzzystrmatch absente ; utilisateur applicatif qui peut créer une table ; compartiment MinIO lisible sans clé | T-003 |

  - **Ne cochez pas `codeql`** tant que l'étape 5 n'est pas faite : sur un dépôt privé sans Code Security, le job est ignoré (*skipped*), et GitHub compte un job ignoré comme **réussi** pour une vérification obligatoire. La cocher donnerait un faux vert.

Enregistrer avec *Create*.

> Note : `audit-dependances` peut virer au rouge sans changement de code, quand une nouvelle faille est publiée. C'est voulu : la correction (souvent une pull request de Dependabot) passe avant le reste.

## 3. Revue obligatoire : le cas d'un seul humain

Les pull requests sont ouvertes par Claude **avec le compte de Daniel** (ADR 0005). Or GitHub n'accepte pas qu'on approuve sa propre pull request : avec *Required approvals* à 1, Daniel ne pourrait plus rien fusionner, faute de contournement.

| Option | Réglage | Ce qui est garanti |
| --- | --- | --- |
| A — un compte machine pour Claude (recommandé) | Créer un compte GitHub dédié (par exemple `lignee-claude`, un seul compte machine gratuit par personne selon les conditions de GitHub), l'inviter comme *collaborator* avec le rôle *Write*, et faire ouvrir les pull requests par ce compte (`gh auth login` avec son jeton). *Required approvals* : **1**, *Require review from Code Owners* coché. | Aucune fusion sans l'approbation explicite de Daniel, en plus de la CI verte. |
| B — sans compte machine | *Required approvals* : **0**. | Pull request obligatoire et CI verte ; la relecture de Daniel tient à son clic sur *Merge*, que GitHub ne peut pas distinguer d'une approbation. |

Avec l'option A, mettez aussi à jour `.github/CODEOWNERS` si besoin (il désigne déjà `@TongoDaniel` pour `packages/kinship` et `packages/voice`).

## 4. Réglages voisins

*Settings* > *General* > *Pull Requests* :

- [x] *Allow squash merging* (titre de la pull request comme message : il suit les conventions) ; décocher *Allow merge commits* et *Allow rebase merging*.
- [x] *Automatically delete head branches*.

*Settings* > *Actions* > *General* :

- *Actions permissions* : *Allow TongoDaniel, and select non-TongoDaniel, actions and reusable workflows*, avec [x] *Allow actions created by GitHub* et, dans la liste, `pnpm/action-setup@*`.
- [x] *Require actions to be pinned to a full-length commit SHA* (si le réglage est proposé).
- *Workflow permissions* : *Read repository contents and packages permissions* ; [ ] *Allow GitHub Actions to create and approve pull requests* **décoché**.

*Settings* > *Advanced Security* (ou *Code security*) — gratuit sur un dépôt privé :

- [x] *Dependency graph*
- [x] *Dependabot alerts*
- [x] *Dependabot security updates*
- [x] *Grouped security updates*

Le fichier `.github/dependabot.yml` fait le reste (mises à jour hebdomadaires, 14 jours de délai après publication).

## 5. CodeQL (plus tard)

CodeQL est gratuit sur un dépôt public et demande **GitHub Code Security** (payant, par contributeur actif) sur un dépôt privé. Le workflow `.github/workflows/codeql.yml` est prêt et ne tourne pas tant que :

- le dépôt est privé, **et**
- la variable `CODEQL_ENABLED` n'existe pas.

Pour l'activer : activer Code Security (ou rendre le dépôt public), puis *Settings* > *Secrets and variables* > *Actions* > *Variables* > *New repository variable* `CODEQL_ENABLED` = `true`. Après un premier passage vert, ajouter `codeql` aux vérifications obligatoires de l'étape 2.

## 6. Vérifier

Sans jamais pousser sur `main` pour « voir si ça bloque » :

```sh
# Le ruleset existe et est actif (lecture seule)
gh api repos/TongoDaniel/lignee-v0.2/rulesets --jq '.[] | {name, enforcement}'
gh api repos/TongoDaniel/lignee-v0.2/rules/branches/main --jq '.[].type'
# attendu : deletion, non_fast_forward, required_linear_history, pull_request, required_status_checks
```

Puis, sur une pull request de test (branche jetable, fermée sans fusion ensuite) dont un commit a un message hors convention (`git commit --allow-empty -m "test sans convention"`) :

- le job `verifications` échoue à l'étape *Messages de commit (commitlint)* ;
- avec un titre hors convention (par exemple « Test »), il échoue aussi à l'étape *Titre de la pull request (commitlint)*, et repasse au vert quand on corrige le titre ;
- le bouton *Merge* est grisé avec « Required statuses must pass before merging ».

## Retour arrière

*Settings* > *Rules* > *Rulesets* > `main protégée` > *Enforcement status* : `Disabled` (à ne faire que le temps de réparer une CI cassée, puis remettre `Active`).

## Journal

- [ ] Jouée le … par Daniel (voie retenue à l'étape 0 : … ; option retenue à l'étape 3 : …).
