# Puce

Un ou deux mots qui disent un lien, un type de contenu ou un statut, sur un fond teinté.

## Ce que vous fournissez

- `libelle` : un ou deux mots, sans point final.
- `teinte` : `vert` (lien direct), `parente` (lien de parenté, proposition), `fete` (lien mis en valeur), `sante`, `memoire`, `documents`, `neutre`.
- `icone` (facultatif) : 16 px, avant le libellé.
- `choisie` (facultatif, T-031) : fait de la puce un choix à cocher parmi plusieurs (type de date, genre, type de nom). Choisie, elle prend la teinte `vert` et la coche `valider` (jamais la couleur seule) ; sinon elle est `neutre`. Elle se lit comme un choix coché ou non (rôle « radio »).

## Règles

- Le texte est toujours le token `*-texte` ou la teinte forte, sur la teinte douce : 4.5:1 au moins.
- Une puce n’est pas un bouton : si elle se touche, elle a un libellé d’accessibilité et une zone de 48 px.
- Une puce de choix peut porter un libellé de plusieurs mots (« Entre deux dates ») : elle passe à la ligne au lieu d’être coupée, et reste une zone de 48 px (56 px en mode Aînés). Son libellé d’accessibilité dit le contexte (« Date de naissance, Vers »).
- `sante` n’apparaît que dans le calque santé ou la fiche santé.
