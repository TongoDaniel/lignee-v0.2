# Interrupteur

Active ou désactive une option, avec effet immédiat.

## Ce que vous fournissez

- `valeur`, `onValueChange`, `libelle` (et une ligne d’explication au besoin).
- `sante` : l’interrupteur du calque santé, en `sante` quand il est actif.

## Règles

- Piste 54 × 32 px, pastille blanche de 25 px. Éteint : piste `filet-fort` avec un contour `bordure-champ`. Allumé : piste `action` (ou `sante` pour le calque santé).
- Le libellé décrit l’option, pas l’état : « Calque santé », pas « Activer le calque santé ».
- Une option sensible (santé, cousins) demande un accord exprès la première fois, dans une feuille.
- La transition dure 240 ms, courbe entrée-sortie.
