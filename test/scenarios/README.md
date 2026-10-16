# scenarios

Un fichier YAML par cas limite (`CL-POL-03.yaml`…), joué par les tests. Agent : testeur-qualite.

## Couverture partielle

Un cas limite se vérifie souvent en plusieurs endroits (modèle, fiche, saisie, voix). Un scénario dont une partie seulement est testée le dit dans un champ `couverture` :

```yaml
couverture:
  teste: [modele]          # parties jouées aujourd'hui par un test
  reste: [T-024, T-031]    # tickets du plan qui doivent compléter le scénario
```

Un ticket de `reste` qui joue sa partie l'ajoute à `teste` et se retire de `reste`. Quand `reste` est vide, le champ peut disparaître. À reprendre par le lecteur de scénarios de T-006, qui validera ce champ avec le reste du format.

## Scénario joué

Les tests chargent un scénario avec `loadScenario('CL-…', schéma)` (`packages/domain/src/test-support/scenario.ts`, en attendant le lecteur de T-006). Le schéma est strict : une clé du YAML que le test ne lit pas fait échouer le test. Quand la variable `LIGNEE_SCENARIOS_PLAYED_DIR` est définie, chaque scénario réellement chargé pendant un test y laisse un fichier à son nom ; le job `cas-limites` de la CI lance les tests avec cette variable et échoue sur tout YAML qui n'a pas été chargé (hors de la liste d'attente `PENDING_T006`). Un test ignoré (`it.skip`) ou un paquet dont les tests ne tournent pas ne compte donc pas.
