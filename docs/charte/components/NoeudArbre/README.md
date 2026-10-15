# NoeudArbre

Une personne dans l’arbre : avatar, prénom, et une ligne de lien ou d’années.

## Ce que vous fournissez

- `personne`, `lien` (« Maman ») ou `annees` (« 1931 – 2019 »).
- `etat` : `normal`, `chemin` (sur le chemin de parenté), `attenue` (hors du chemin ou du calque), `anniversaire`, `inconnu` (place à compléter).
- `sante` : affiche la pastille cœur (calque santé actif seulement).
- `onPress` : ouvre la fiche ; un appui long affiche le chemin de parenté.

## Règles

- Avatar `avatar-m` (58 px) au zoom par défaut ; prénom en Instrument Sans 15 ; ligne secondaire en `legende`.
- Chemin : anneau `chemin` de 3 px séparé de l’avatar par 3 px de `fond`. Anniversaire : anneau `fete` qui respire et pastille `anniversaire`.
- Personne décédée : ses années, rien d’autre.
- Inconnu : cercle pointillé `bordure-champ` et icône `ajouter` ; le libellé dit la place (« Mère »).
- Libellé d’accessibilité complet : « Claire Martin, votre mère, née en 1968 ».
