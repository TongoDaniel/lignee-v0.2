# Avatar

La représentation d’une personne : sa photo, ou son initiale sur une teinte qui suit son nom de naissance.

## Ce que vous fournissez

- `personne` : prénom, nom de naissance, photo éventuelle.
- `taille` : `s` (40), `m` (58, défaut), `l` (88) ; l’en-tête de fiche utilise 108 (`avatar-xl`).
- `vous` : l’avatar doré à silhouette de la personne qui utilise l’app.
- `neutre` : force l’avatar neutre (calque santé actif).

## Règles

- Teinte : `personne-<teinte>` sur `personne-<teinte>-fond`, choisie par le nom de naissance (vert, or, lagon, lilas, ciel, terre). Elle ne porte aucun sens.
- Initiale en Instrument Sans 600, à 86 % du rayon.
- Jamais de couleur selon le genre, jamais de corail.
- Une photo est recadrée sur le visage, en cercle, sans bordure.
