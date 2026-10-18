# mobile

App Expo (Expo Router) pour iOS et Android. Hors-ligne d'abord. Agent : ecrans-lignee.

Expo SDK 57, React Native 0.86, Hermes et nouvelle architecture (imposés par le SDK ; après `prebuild`, `android/gradle.properties` contient `hermesEnabled=true` et `newArchEnabled=true`). Lancer l'app sur un téléphone : [docs/runbooks/lancer-app-mobile.md](../../docs/runbooks/lancer-app-mobile.md).

## Organisation

| Chemin | Contenu |
| --- | --- |
| `app.config.ts` | Nom, icônes et écran de lancement (fichiers de `docs/charte/assets/Applications`, couleurs des tokens), Jour/Nuit automatique, langues déclarées au système |
| `eas.json` | Profils `development` (et `development-simulator`), `preproduction`, `production` ; aucun identifiant ni secret |
| `index.ts` | Point d'entrée (`main`) : polyfills Intl, puis `expo-router/entry` |
| `src/app/` | Routes d'Expo Router : `_layout.tsx` (polices, thème, langue), `(tabs)/` (onglets Arbre et Famille) |
| `src/intl/polyfills.ts` | Polyfills Intl de FormatJS, installés seulement si Hermes en a besoin, pour `fr` et `en` |
| `src/theme/`, `src/i18n/` | Fournisseurs de thème (`getTheme` de `@lignee/ui`) et de traduction (`@lignee/i18n`, langue de l'appareil suivie à chaud) |
| `src/navigation/` | Onglets de la V1 et barre d'onglets de la charte |
| `src/icons/` | Symbole compact (onglet Arbre) et icône Famille |

La barre d'onglets, les icônes et le fournisseur de thème sont provisoirement dans l'app : ils rejoindront `@lignee/ui` avec les composants de la charte (T-014, T-015).

## Onglets

La charte prévoit Arbre, Famille, Santé, Mémoire. En V1 : **Arbre** et **Famille** seulement ([ADR 0015](../../docs/adr/0015-onglets-de-la-v1.md)). Santé est la V3 et Mémoire la V2 ; ils s'ajouteront dans `src/navigation/tabs.ts`, à leur place.

## Vérifications

```sh
corepack pnpm --filter @lignee/mobile lint        # ESLint : accessibilité React Native et textes en dur (ACC-04)
corepack pnpm --filter @lignee/mobile typecheck   # tout le code, puis le code embarqué sans types de Node
corepack pnpm --filter @lignee/mobile test        # Jest (jest-expo, expo-router/testing-library)
```

Les tests rendent l'app entière avec Expo Router : onglets de la V1, libellés et zones touchables, couleurs Jour et Nuit, mode Aînés, langue de l'appareil suivie à chaud, textes des écrans, et polyfills Intl (tout Intl remplacé par FormatJS, comme sur un Hermes qui n'aurait rien). La CI construit aussi le bundle Hermes Android et iOS (job `bundle-mobile`).

## Dépendances

Chaque dépendance directe est épinglée sur une version publiée depuis au moins 14 jours et compatible avec le SDK (`EXPO_OFFLINE=1 corepack pnpm exec expo install --check`). Quatre paquets transitifs d'Expo sont tenus au même niveau par `pnpm.overrides` à la racine. pnpm reste en installation isolée : depuis le SDK 54, Expo n'exige plus `nodeLinker: hoisted`. Metro trouve seul les paquets du monorepo depuis le SDK 52 : pas de `metro.config.js`.

Taille : le bundle Hermes fait environ 5,5 Mo sur Android. `expo-router` embarque `expo-symbols` et sa police Material Symbols (971 Ko) : à réexaminer pour HOL-06 (moins de 40 Mo installé).
