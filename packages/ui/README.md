# ui

Composants de la charte et `tokens.ts`, générés depuis `docs/charte/tokens.json`. Agent : ecrans-lignee.

## Ce que contient le paquet

- `src/tokens.ts` : **généré, ne pas modifier.** Palette, thèmes Jour et Nuit (`themes`), ombres par thème, polices (`fontFaces`), typographie (`typography`, en dp, `fontFamily` seul), espacements (`space`), rayons (`radius`), tailles et zones touchables (`size`), traits (`stroke`), opacités (`opacity`), mouvement (`motion`), mode Aînés (`aines`).
- `src/theme.ts` : `getTheme({ scheme, seniorMode })`, fonction pure qui renvoie couleurs, ombres, typographie (× 1,3 en mode Aînés) et zone touchable (48, ou 56 en mode Aînés) ; `schemeFromSystem()` traduit `useColorScheme()`. Le fournisseur React arrive avec T-014.
- `src/contrast.ts` : rapport de contraste WCAG 2.
- `assets/fonts/` : les sept polices en TTF, décompressées des WOFF2 de `docs/charte/fonts`, avec `OFL.txt` (licence et mentions de copyright) et `empreintes.json` (SHA-256 des TTF et des WOFF2).

Dans un écran, n'écrivez jamais une couleur, une taille ou un rayon : importez-les de `@lignee/ui`.

## Régénérer

Une modification se fait dans la charte (`docs/charte/tokens.json`), puis :

```sh
corepack pnpm --filter @lignee/ui tokens   # src/tokens.ts
corepack pnpm --filter @lignee/ui fonts    # assets/fonts/ (après un changement de docs/charte/fonts)
```

Commitez le fichier régénéré avec la charte. Les tests (`corepack pnpm --filter @lignee/ui test`) échouent si `tokens.ts` ou un TTF ne correspond plus à la charte, s'il a été modifié à la main, ou si une paire de couleurs déclarée par la charte (`03-couleurs.md`, « Contrastes mesurés ») passe sous 4,5:1 (texte) ou 3:1 (élément graphique) dans un des deux thèmes.

Le mouvement et le facteur du mode Aînés ne sont pas dans `tokens.json` : ils sont recopiés dans `scripts/charte-complements.ts`, et un test vérifie qu'ils restent ceux de `07-mouvement.md`, `04-typographie.md` et `09-accessibilite.md`.

## Polices

La décompression utilise `wawoff2` (le décodeur WOFF2 de référence de Google, compilé en WebAssembly) : elle redonne la police d'origine, sans toucher aux glyphes. Les trois familles sont sous SIL Open Font License 1.1, sans nom réservé ; `OFL.txt` doit accompagner les TTF partout où ils sont distribués (l'app les embarque).
