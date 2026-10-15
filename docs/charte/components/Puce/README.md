# Puce

Un ou deux mots qui disent un lien, un type de contenu ou un statut, sur un fond teinté.

## Ce que vous fournissez

- `libelle` : un ou deux mots, sans point final.
- `teinte` : `vert` (lien direct), `parente` (lien de parenté, proposition), `fete` (lien mis en valeur), `sante`, `memoire`, `documents`, `neutre`.
- `icone` (facultatif) : 16 px, avant le libellé.

## Règles

- Le texte est toujours le token `*-texte` ou la teinte forte, sur la teinte douce : 4.5:1 au moins.
- Une puce n’est pas un bouton : si elle se touche, elle a un libellé d’accessibilité et une zone de 48 px.
- `sante` n’apparaît que dans le calque santé ou la fiche santé.
