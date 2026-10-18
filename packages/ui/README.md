# ui

Composants de la charte et `tokens.ts`, générés depuis `docs/charte/tokens.json`. Agent : ecrans-lignee.

## Ce que contient le paquet

- `src/fontFiles.ts` : **généré, ne pas modifier.** Les sept TTF par `require()`, sous les noms de la charte, pour `useFonts(fontFiles)` d'expo-font (11-react-native.md). Résolu par Metro seulement : il n'est ni dans l'index du paquet ni importé par un test Node. Dans l'app : `import { fontFiles } from '@lignee/ui/fontFiles'`.
- `src/tokens.ts` : **généré, ne pas modifier.** Palette, thèmes Jour et Nuit (`themes`), ombres par thème, polices (`fontFaces`), typographie (`typography`, en dp, `fontFamily` seul), espacements (`space`), rayons (`radius`), tailles et zones touchables (`size`), traits (`stroke`), opacités (`opacity`), mouvement (`motion`), mode Aînés (`aines`).
- `src/theme.ts` : `getTheme({ scheme, seniorMode })`, fonction pure qui renvoie couleurs, ombres, typographie (× 1,3 en mode Aînés) et zone touchable (48, ou 56 en mode Aînés) ; `schemeFromSystem()` traduit `useColorScheme()`.
- `src/theme/ThemeProvider.tsx` : `ThemeProvider` (Jour ou Nuit selon le téléphone, mode Aînés, réglage « Réduire les animations » suivi à chaud ; chacun peut être imposé) et `useTheme()`. L'app l'enveloppe pour peindre le fond de la fenêtre native (`apps/mobile/src/theme/ThemeProvider.tsx`).
- `src/components/` : les composants de base de la charte (T-014), voir plus bas. `metrics.ts` y rassemble les mesures propres à une fiche de composant que `tokens.json` ne nomme pas (piste de l'interrupteur, hauteur d'une puce…), chacune avec sa source.
- `src/icons/` : `Icon` et `icons.generated.ts` (**généré**), les 37 icônes de `docs/charte/assets/Icones`.
- `src/logo/` : `Logo` et `logo.generated.ts` (**généré**), depuis `docs/charte/assets/Logos`.
- `src/contrast.ts` : rapport de contraste WCAG 2.
- `assets/fonts/` : les sept polices en TTF, décompressées des WOFF2 de `docs/charte/fonts`, avec `OFL.txt` (licence et mentions de copyright) et `empreintes.json` (SHA-256 des TTF et des WOFF2).

`src/` se vérifie sans les types de Node (`tsconfig.json`, `types: []`) : `process`, `Buffer` ou `node:fs` y échouent au typecheck. Les scripts ont leur `scripts/tsconfig.json`, avec les types de Node ; `typecheck` lance les deux.

Dans un écran, n'écrivez jamais une couleur, une taille ou un rayon : importez-les de `@lignee/ui`.

## Composants de base (T-014)

Noms et props en anglais (ADR 0018, `docs/adr/0018-noms-des-composants-en-anglais.md`) :

| Charte | Composant |
| --- | --- |
| Bouton | `Button` |
| Puce | `Chip` |
| Carte | `Card` |
| Champ | `Field` |
| Interrupteur | `Switch` |
| EnTete | `Header` |
| Feuille | `Sheet` |
| Toast | `Toast` |
| LigneReglage | `SettingsRow`, `SettingsGroup` |
| Icones | `Icon` |
| Logo | `Logo` |

Composants de personne et de navigation (T-015), mêmes règles :

| Charte | Composant | Props principales |
| --- | --- | --- |
| Avatar | `Avatar` | `person` (`firstName`, `birthName`, `photoUri`), `you`, `size` (`s`, `m`, `l`, `xl`), `neutral`, `tint` |
| NoeudArbre | `TreeNode` | `person`, `name`, `relation`, `years`, `probable`, `state` (`normal`, `path`, `faded`, `birthday`, `unknown`), `neutral`, `health`, `accessibilityLabel`, `onPress`, `onLongPress` |
| MentionPrivee | `PrivacyNote` | `label`, `circle` (`you`, `family`, `managers`, `people`), `health` |
| OngletsFiche | `ProfileTabs` | `tabs`, `active`, `onChange` |
| BarreOnglets | `TabBar` | `items`, `activeKey`, `onSelect`, `bottomInset` |
| Notification | `Notification` | `appName`, `title`, `text`, `time`, `onPress` |

La teinte d'un avatar vient d'une seule fonction, `defaultAvatarTintRule` (`src/components/avatarTint.ts`) : la règle de la charte (nom de naissance), en attendant la décision de l'ADR 0022 sur ARB-12 (« par branche »). Un écran ne calcule jamais de teinte. `TreeNode` reçoit son libellé d'accessibilité complet déjà assemblé et traduit (« Claire Martin, votre mère, née en 1968 ») et ne calcule aucun lien. Le dessin de l'arbre (traits, mise en page) est celui de T-017.

Règles communes, vérifiées par les tests (`test/*.test.tsx`) :

- Les composants prennent tout du thème (`useTheme()`) et des tokens. Aucun texte en dur : chaque texte, y compris les libellés pour le lecteur d'écran (« Revenir en arrière », « Fermer », « Dicter le prénom »), arrive en props, déjà traduit par l'écran (`common:controls.*`).
- Chaque élément touchable a un rôle, un libellé, son état (`disabled`, `checked`) et, au besoin, une indication ; sa zone touchable fait 48, ou 56 en mode Aînés (`hitSlop` pour un bouton compact de 44 ou une puce de 32).
- Le texte suit la taille du téléphone sans limite (`maxFontSizeMultiplier` n'est posé que sur les libellés de `TabBar`, plafonnés à 200 % comme le demande la charte ; l'initiale d'un avatar, dans un disque de taille fixe, ne grossit pas, son nom est lu et affiché à côté) ; aucune hauteur fixe autour d'un texte, seulement des hauteurs minimales.
- Mouvement (07-mouvement.md) : appui à 97 % en 120 ms, interrupteur en 240 ms, feuille en 360 ms, toast 300 ms / 2,5 s / 300 ms ; aucun rebond. Quand le téléphone demande de réduire les animations, plus d'appui animé ni de glissement : fondus de 150 ms.
- Anneau de focus clavier : contour `focus` de 2, décalé de 2.

Tests : Vitest pour les scripts et les fonctions pures (`scripts/`, `src/*.test.ts`), Jest (jest-expo et Testing Library, comme l'app) pour le rendu des composants (`test/`). `corepack pnpm --filter @lignee/ui test` lance les deux. Sous Jest, les animations du fil natif ne se jouent pas : les tests vérifient ce qui est demandé à `Animated` (durée, valeur), pas l'image.

Une page de revue montre tous les composants dans l'app de développement : onglet Arbre, « Voir les composants » (`apps/mobile/src/app/catalog.tsx`), avec le mode Aînés, le thème Nuit et les animations réduites à basculer.

## Régénérer

Une modification se fait dans la charte (`docs/charte/tokens.json`), puis :

```sh
corepack pnpm --filter @lignee/ui tokens   # src/tokens.ts et src/fontFiles.ts
corepack pnpm --filter @lignee/ui fonts    # assets/fonts/ (après un changement de docs/charte/fonts)
corepack pnpm --filter @lignee/ui assets   # icônes et logo (après un changement de docs/charte/assets)
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
