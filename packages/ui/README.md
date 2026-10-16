# ui

Composants de la charte et `tokens.ts`, générés depuis `docs/charte/tokens.json`. Agent : ecrans-lignee.

## Ce que contient le paquet

- `src/fontFiles.ts` : **généré, ne pas modifier.** Les sept TTF par `require()`, sous les noms de la charte, pour `useFonts(fontFiles)` d'expo-font (11-react-native.md). Résolu par Metro seulement : il n'est ni dans l'index du paquet ni importé par un test Node. Dans l'app : `import { fontFiles } from '@lignee/ui/fontFiles'`.
- `src/tokens.ts` : **généré, ne pas modifier.** Palette, thèmes Jour et Nuit (`themes`), ombres par thème, polices (`fontFaces`), typographie (`typography`, en dp, `fontFamily` seul), espacements (`space`), rayons (`radius`), tailles et zones touchables (`size`), traits (`stroke`), opacités (`opacity`), mouvement (`motion`), mode Aînés (`aines`).
- `src/theme.ts` : `getTheme({ scheme, seniorMode })`, fonction pure qui renvoie couleurs, ombres, typographie (× 1,3 en mode Aînés) et zone touchable (48, ou 56 en mode Aînés) ; `schemeFromSystem()` traduit `useColorScheme()`. Le fournisseur React arrive avec T-014.
- `src/contrast.ts` : rapport de contraste WCAG 2.
- `assets/fonts/` : les sept polices en TTF, décompressées des WOFF2 de `docs/charte/fonts`, avec `OFL.txt` (licence et mentions de copyright) et `empreintes.json` (SHA-256 des TTF et des WOFF2).

`src/` se vérifie sans les types de Node (`tsconfig.json`, `types: []`) : `process`, `Buffer` ou `node:fs` y échouent au typecheck. Les scripts ont leur `scripts/tsconfig.json`, avec les types de Node ; `typecheck` lance les deux.

Dans un écran, n'écrivez jamais une couleur, une taille ou un rayon : importez-les de `@lignee/ui`.

## Régénérer

Une modification se fait dans la charte (`docs/charte/tokens.json`), puis :

```sh
corepack pnpm --filter @lignee/ui tokens   # src/tokens.ts et src/fontFiles.ts
corepack pnpm --filter @lignee/ui fonts    # assets/fonts/ (après un changement de docs/charte/fonts)
```

Commitez le fichier régénéré avec la charte. Les tests (`corepack pnpm --filter @lignee/ui test`) échouent si `tokens.ts` ou un TTF ne correspond plus à la charte, s'il a été modifié à la main, ou si une paire de couleurs déclarée par la charte (`03-couleurs.md`, « Contrastes mesurés ») passe sous 4,5:1 (texte) ou 3:1 (élément graphique) dans un des deux thèmes.

Le mouvement et le facteur du mode Aînés ne sont pas dans `tokens.json` : ils sont recopiés dans `scripts/charte-complements.ts`, et un test vérifie qu'ils restent ceux de `07-mouvement.md`, `04-typographie.md` et `09-accessibilite.md`.

## Polices

La décompression utilise `wawoff2` (le décodeur WOFF2 de référence de Google, compilé en WebAssembly) : elle redonne la police d'origine, sans toucher aux glyphes. Les trois familles sont sous SIL Open Font License 1.1. `OFL.txt` doit accompagner les TTF partout où ils sont distribués (l'app les embarque).

Aucune ne déclare de nom réservé (« Reserved Font Name »), ce qui permet de garder le nom « Fraunces Lignee » pour l'instance tirée de Fraunces. Le test (`scripts/fonts.test.ts`) ne le vérifie que dans les tables `name` des polices du dépôt. Les OFL.txt amont ont été lus le 16 octobre 2026, sans nom réservé :

- Fraunces : <https://raw.githubusercontent.com/undercasetype/Fraunces/master/OFL.txt> et <https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt> (copyright amont daté de 2018, celui de la police du dépôt de 2020) ;
- Instrument Sans : <https://raw.githubusercontent.com/Instrument/instrument-sans/master/OFL.txt> et <https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/OFL.txt> ;
- La Belle Aurore : <https://raw.githubusercontent.com/google/fonts/main/ofl/labelleaurore/OFL.txt>.

Refaites cette lecture si une police change de version.
