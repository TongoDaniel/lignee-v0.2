# scenarios

Un fichier YAML par identifiant de l'onglet Cas limites (`CL-POL-03.yaml`…), joué par les tests. Agent : testeur-qualite. Noms et familles inventés, jamais une vraie famille.

## Format

Le format de référence est celui du TRD (`CL-POL-03.yaml`). Il est lu et validé par `packages/domain/src/test-support/` (T-006) :

| Clé | Contenu | Validé par |
| --- | --- | --- |
| `id` | Identifiant de l'onglet Cas limites, égal au nom du fichier | `scenarioFileSchema` ; le test de format vérifie aussi que l'identifiant existe dans `cahier-des-charges-4-cas-limites.md` |
| `titre` | Situation, en une ligne | |
| `couverture` | Facultatif : ce qui est déjà vérifié, ce qui reste (voir plus bas) | `coverageSchema` ; chaque ticket de `reste` doit exister dans `docs/plan/v1-decoupage.md` |
| `arbre` | Facultatif : arbre de départ (tableau ci-dessous). Un cas qui porte sur une valeur (une date, T-005) n'en a pas | `scenarioTreeSchema`, puis `buildScenarioTree` |
| `action` | Facultatif. Une dictée dans un arbre : `locuteur` (une personne de l'arbre) et `dictee`. Une autre action (saisie d'une date, calcul : CL-DON-05, CL-DON-06, CL-VOI-16) est propre au cas | Dictée : `scenarioActionSchema`. Autre action : le schéma strict du test qui la joue |
| `attendu` | Ce qui doit se passer ; jamais vide | Avec une dictée : `actionExpectedSchema` (`questions`, `plan`, `lien`). Sinon (modèle, dates) : le schéma strict du test qui le joue |

Sections de `arbre` (une section absente vaut une liste vide, une clé inconnue est refusée) :

| Section | Ligne | Objets du modèle |
| --- | --- | --- |
| `personnes` | `pierre/M` : nom court et genre (`M`, `F`, `A` autre, `N` non renseigné) ; chaque nom court une seule fois | `Person` connue. Sans ligne dans `noms`, la personne porte son nom court comme prénom (« Pierre ») |
| `noms` | `{ personne, type, prenoms?, nom?, forme?, debut?, fin? }` ; `type` : `naissance`, `usage`, `surnom`, `titre`, `variante`, `ancien` | `Name` |
| `unions` | `{ conjoints: [a, b], rang_a?, rang_b? }` | `Union`. Un rang absent est le rang suivant de ce conjoint dans l'ordre des lignes (UNI-07) : dans CL-POL-03, Rose a le rang 1 |
| `filiations` | `{ parents: [a, b?], enfant, type?, certitude? }` ; `type` : `naissance` (par défaut), `adoptive`, `a_eleve`, `confie`, `tuteur`, `donneur`, `gpa` ; `certitude` : `certain` (par défaut), `probable`, `hypothetique` | Une `Filiation` par parent |
| `naissances_multiples` | `{ enfants: [a, b…], ordre? }` | `MultipleBirth` |
| `titres` | `{ personne, libelle, debut?, fin? }` | `TitleRole` |

Les dates d'un arbre (`debut`, `fin`) sont gardées comme texte d'origine (`fuzzyDateFromText`). Les dates floues complètes d'un cas (T-005) s'écrivent avec `scenarioFuzzyDateSchema` (`qualificatif`, `date` ou `de` et `a`, `precision`, `texte`, `calendrier`) et se convertissent avec `fuzzyDateInputFromScenario` (`scenario.ts`). Une section nouvelle (places à compléter, candidats, règles de visibilité…) s'ajoute dans `scenario-tree.ts` et dans ce tableau quand un scénario en a besoin, jamais dans un seul test.

Plan attendu (`attendu.plan`, format du TRD) : `{ creer: samuel }`, `{ filiation: { parent, enfant, type } }`, `{ candidats_mere: { enfant, candidates: […] } }`. Lien attendu (`attendu.lien`) : `{ de, vers, fr, en }`.

## Couverture partielle

Un cas limite se vérifie souvent en plusieurs endroits (modèle, moteur, saisie, voix). Un scénario dont une partie seulement est testée le dit dans un champ `couverture` :

```yaml
couverture:
  teste: [modele]          # parties jouées aujourd'hui par un test
  reste: [T-024, T-031]    # tickets du plan qui doivent compléter le scénario
```

Parties reconnues dans `teste` : `lecture` (le scénario est lu, son arbre construit en objets valides du modèle et son plan attendu applicable, sans que le comportement attendu soit vérifié) et `modele` (l'attendu porte sur le modèle et il est vérifié). Un ticket qui joue une autre partie l'ajoute à l'énumération de `coverageSchema` (`packages/domain/src/test-support/scenario.ts`) et à cette liste. Un ticket de `reste` qui joue sa partie l'ajoute à `teste` et se retire de `reste`. Quand `reste` est vide, le champ peut disparaître.

## Scénario joué

Les tests chargent un scénario avec `loadScenario('CL-…', schéma)`. Le schéma est strict : une clé du YAML que le test ne déclare pas fait échouer le test. Quand la variable `LIGNEE_SCENARIOS_PLAYED_DIR` est définie, chaque scénario réellement chargé pendant un test y laisse un fichier à son nom ; le job `cas-limites` de la CI lance les tests avec cette variable et échoue sur tout YAML qui n'a pas été chargé, sans exception. Un test ignoré (`it.skip`) ou un paquet dont les tests ne tournent pas ne compte donc pas.

À côté, `packages/domain/src/test-support/scenario-format.test.ts` lit tous les fichiers avec `readScenarioFile`, qui valide le format commun et construit l'arbre sans laisser de trace : un fichier mal formé échoue même s'il n'a pas encore de test, et cette lecture de contrôle ne suffit pas à compter un scénario comme joué.

## Brancher un moteur sur un scénario (kinship, voice, écrans)

Les autres paquets importent les outils de `@lignee/domain/test-support` (ajoutez `@lignee/domain` en dépendance de développement du paquet, avec `workspace:*`). Exemple pour la partie lien de CL-POL-03 (T-020), `relation` étant la fonction du moteur :

```ts
import {
  actionScenarioSchema,
  applyExpectedPlan,
  buildScenarioTree,
  loadScenario,
} from '@lignee/domain/test-support';

it('CL-POL-03 — lien : frère ou demi-frère', () => {
  const scenario = loadScenario('CL-POL-03', actionScenarioSchema('CL-POL-03'));
  const { lien, plan = [] } = scenario.attendu;
  if (lien === undefined) throw new Error('CL-POL-03 attend un lien');
  const tree = buildScenarioTree(scenario.arbre); // arbre de départ, objets du modèle
  const after = applyExpectedPlan(tree, plan); // arbre après l'action attendue
  const result = relation(tree.data, after.id(lien.de), after.id(lien.vers));
  expect(result.fr).toBe(lien.fr);
  expect(result.en).toBe(lien.en);
});
```

- Moteur de parenté (T-013, T-020 à T-022, T-026, T-027) : `applyExpectedPlan` donne l'arbre après l'action sans passer par la voix ; comparez le lien calculé à `attendu.lien`.
- Voix (T-062, T-065) : jouez `action.dictee` avec les réponses de modèle enregistrées, depuis `action.locuteur`, puis comparez le plan produit à `attendu.plan` et le nombre de questions à `attendu.questions`.
- Saisie et écrans (T-024, T-031, T-033) : construisez l'état de départ depuis `tree.data`.
- Puis mettez à jour `couverture` dans le YAML. Un attendu dont la forme manque s'ajoute à `actionExpectedSchema` (`scenario-format.ts`), avec un test qui le refuse quand il est mal formé.

Pour les tests de propriétés, `treeArbitrary()` (fast-check) et `referenceTree(100 | 1000 | 5000)` donnent des arbres générés valides (`packages/domain/README.md`).
