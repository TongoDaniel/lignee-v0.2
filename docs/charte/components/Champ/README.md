# Champ

Une saisie de texte : libellé au-dessus, boîte de 56 px, contour `bordure-champ`.

## Ce que vous fournissez

- `libelle` (toujours visible : jamais remplacé par le texte d’exemple).
- `valeur`, `onChangeText`, `exemple` (texte d’exemple en `texte-discret`).
- `erreur` : une phrase qui dit quoi corriger.
- `micro` : propose la saisie à la voix (activé par défaut en mode Aînés).

## Règles

- Contour de 1.5 px (`trait-champ`) en `bordure-champ` ; au focus, 2.5 px en `action`, curseur `action`.
- Erreur : contour `erreur`, message sous le champ avec l’icône `alerte`. Jamais la couleur seule.
- Texte saisi en Instrument Sans 17, graisse 500.
