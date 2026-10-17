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
| `unions` | `{ conjoints: [a, b], rang_a?, rang_b?, debut?, fin?, motif? }` ; `debut` et `fin` au format `scenarioFuzzyDateSchema` ; `motif` : `deces`, `divorce`, `separation`, `non_renseigne` | `Union`. Un rang absent est le rang suivant de ce conjoint dans l'ordre des lignes (UNI-07) : dans CL-POL-03, Rose a le rang 1. Un rang déjà pris par la même personne, écrit ou déduit, est refusé |
| `filiations` | `{ parents: [a, b?], enfant, type?, certitude? }` ; `type` : `naissance` (par défaut), `adoptive`, `a_eleve`, `confie`, `tuteur`, `donneur`, `gpa` ; `certitude` : `certain` (par défaut), `probable`, `hypothetique` | Une `Filiation` par parent |
| `candidats` | `{ enfant, candidates: [a, b…] }` | Un `ParentCandidate` par candidate (UNI-11) |
| `simultaneites` | `{ unions: [[a, b], [a, c]…], reponse }` ; chaque union désignée par ses conjoints (une seule union entre eux) ; `reponse` : `simultanees` ou `successives` | Une `SimultaneityAnswer` par paire des unions citées, toutes de même valeur (UNI-08, ADR 0012) |
| `naissances_multiples` | `{ enfants: [a, b…], ordre? }` | `MultipleBirth` |
| `titres` | `{ personne, libelle, debut?, fin? }` | `TitleRole` |
| `faits` | `{ personne, type, date }` ; `type` : `naissance`, `deces` ; `date` : date floue complète (`scenarioFuzzyDateSchema`, ci-dessous) | `Fact` daté (T-007 : CL-DON-08, CL-DON-09) ; `factFromScenario` en crée d'autres pour rejouer un cas avec d'autres dates |

Les dates `debut` et `fin` d'un nom ou d'un titre sont gardées comme texte d'origine (`fuzzyDateFromText`) ; celles d'une union sont des dates floues complètes. Les dates floues complètes d'un cas (T-005) s'écrivent avec `scenarioFuzzyDateSchema` (`qualificatif`, `date` ou `de` et `a`, `precision`, `texte`, `calendrier`) et se convertissent avec `fuzzyDateInputFromScenario` (`scenario.ts`). Une section nouvelle (places à compléter, candidats, règles de visibilité…) s'ajoute dans `scenario-tree.ts` et dans ce tableau quand un scénario en a besoin, jamais dans un seul test.

Plan attendu (`attendu.plan`) : `{ creer: samuel/M }`, `{ filiation: { parent, enfant, type } }`, `{ candidats_mere: { enfant, candidates: […] } }`. Lien attendu (`attendu.lien`) : `{ de, vers, fr, en }`.

**Écart au format du TRD** : le TRD écrit `creer: samuel`, sans genre. Le genre de la personne créée compte pour le lien attendu (« frère ou demi-frère », pas « frère ou sœur ») ; `creer` prend donc la notation de `personnes` (`samuel/M`). La forme sans genre reste admise et crée une personne de genre non renseigné.

## Couverture partielle

Un cas limite se vérifie souvent en plusieurs endroits (modèle, moteur, saisie, voix). Un scénario dont une partie seulement est testée le dit dans un champ `couverture` :

```yaml
couverture:
  teste: [modele]          # parties jouées aujourd'hui par un test
  reste: [T-024, T-031]    # tickets du plan qui doivent compléter le scénario
```

Parties reconnues dans `teste` : `lecture` (le scénario est lu, son arbre construit en objets valides du modèle et son plan attendu applicable, sans que le comportement attendu soit vérifié) `modele` (l'attendu porte sur le modèle et il est vérifié) et `disposition` (générations et foyers calculés par `packages/layout` et comparés à l'attendu, T-008). Un ticket qui joue une autre partie l'ajoute à l'énumération de `coverageSchema` (`packages/domain/src/test-support/scenario.ts`) et à cette liste. Un ticket de `reste` qui joue sa partie l'ajoute à `teste` et se retire de `reste`. Quand `reste` est vide, le champ peut disparaître.

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
  const after = applyExpectedPlan(tree, plan); // copie : l'arbre de départ reste intact
  const result = relation(after.data, after.id(lien.de), after.id(lien.vers));
  expect(result.fr).toBe(lien.fr);
  expect(result.en).toBe(lien.en);
});
```

- Moteur de parenté (T-013, T-020 à T-022, T-026, T-027) : `applyExpectedPlan` renvoie une copie de l'arbre après l'action (un `ScenarioTree` dont `id`, `has` et `keyOf` connaissent aussi les personnes créées), sans passer par la voix et sans modifier l'arbre de départ : on peut rejouer le plan. Comparez le lien calculé à `attendu.lien`.
- Voix (T-062, T-065) : jouez `action.dictee` avec les réponses de modèle enregistrées, depuis `action.locuteur`, puis comparez le plan produit à `attendu.plan` et le nombre de questions à `attendu.questions`.
- Saisie et écrans (T-024, T-031, T-033) : construisez l'état de départ depuis `tree.data`.
- Puis mettez à jour `couverture` dans le YAML. Un attendu dont la forme manque s'ajoute à `actionExpectedSchema` (`scenario-format.ts`), avec un test qui le refuse quand il est mal formé.

Pour les tests de propriétés, `treeArbitrary()` (fast-check) et `referenceTree(100 | 1000 | 5000)` donnent des arbres générés valides (`packages/domain/README.md`).

## Disposition (packages/layout, T-008)

Les scénarios de disposition (CL-POL-01, 04, 06, 13, 14, 18) déclarent `teste: [disposition]`. Leur arbre suit le format commun, avec les dates, la fin et la simultanéité des unions et les candidats (sections ci-dessus) ; leur action et leur attendu sont lus en schéma strict par `packages/layout/src/test-support/layout-scenario.ts` :

| Clé | Contenu |
| --- | --- |
| `action.centre` | Personne centrale de la disposition |
| `action.autres_centres` | Facultatif : autres personnes centrales, pour `attendu.vers_centre_depuis` |
| `action.puis` | Facultatif : modifications avant un second calcul : `{ rang: { conjoints, de, rang } }` (UNI-07), `{ preciser_parent: { enfant, parent } }` (ARB-05) |
| `attendu.unites` | Liste complète des unités, par personne au centre : `forme` (`seul`, `couple`, `successives`, `simultanees`), `foyers` dans l'ordre (`conjoint`, `enfants` sans ordre, `en_cours?`, `vers_centre?`), `non_precise?` (`manque` : `mere`, `pere`, `parent` ; `enfants` ; `candidates` dans l'ordre) |
| `attendu.generations`, `attendu.apres`, `attendu.vers_centre_depuis`, `attendu.sans_regle_de_genre` | Facultatifs : rangées attendues ; unités après `action.puis` ; foyers `[centre, conjoint]` qui mènent à chaque autre personne centrale ; même disposition genres inversés |
