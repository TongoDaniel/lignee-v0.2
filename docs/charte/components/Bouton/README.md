# Bouton

Une pilule de 56 px qui lance une action ; une seule variante principale par écran.

## Ce que vous fournissez

- `libelle` : un verbe à l’infinitif, en casse de phrase (« Ajouter », « Oui, ajouter »).
- `variante` : `principal` (fond `action`, texte `sur-action`), `secondaire` (contour `bordure-champ`), `discret` (texte `action`), `fete` (fond `fete-forte`, texte `sur-fete`), `danger` (contour et texte `erreur`).
- `icone` (facultatif) : une icône du jeu Lignée, placée avant le libellé.
- `compact` : 44 px de haut, pour un bouton dans une carte ou un en-tête.
- `onPress`, `desactive`.

## Règles

- Un seul bouton `principal` par écran. Les autres actions sont `secondaire` ou `discret`.
- `fete` (fond `fete-forte`, texte `sur-fete`) est rare : une action qui célèbre (sceller une capsule, commander le livre).
- `danger` sert aux actions destructrices, toujours suivies d’une confirmation.
- Marges intérieures : `espace-6` à gauche et à droite (`espace-5` en compact, `espace-3` pour `discret`).
- Au toucher, le bouton se réduit à 97 % pendant 120 ms. Désactivé, il passe à `opacite-desactive`.
- Le focus clavier : 2 px de `fond`, puis 2 px de `focus`.
- Pas d’ombre, pas de dégradé, pas de bouton en capitales.
