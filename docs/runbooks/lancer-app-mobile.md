# Lancer l'app mobile

L'app Expo est dans `apps/mobile`. Elle a besoin d'un **build de développement** (pas d'Expo Go) : Skia (T-017) et SQLCipher (T-016) sont des modules natifs qu'Expo Go ne contient pas. Le build de développement s'installe une fois sur le téléphone ; ensuite, le code JavaScript arrive du poste par Metro, sans réinstaller.

Versions : Expo SDK 57 (React Native 0.86, React 19.2, Hermes et nouvelle architecture, imposés par le SDK). Le SDK 58 est sorti le 29 septembre 2026 avec React Native 0.88 en version candidate jusqu'au 15 octobre : on y passera quand React Native 0.88 aura deux semaines de publication stable (voir « Changer de SDK »).

## Ce que seul Daniel peut faire

1. **Confirmer l'identifiant des stores** `com.lignee.app` (Android `package`, iOS `bundleIdentifier`, dans `apps/mobile/app.config.ts`). Il ne change plus après la première publication.
2. **Créer le projet EAS** avec son compte Expo, depuis `apps/mobile` :

   ```sh
   corepack pnpm dlx eas-cli@24.8.0 login
   corepack pnpm dlx eas-cli@24.8.0 init
   ```

   `eas init` ajoute l'identifiant du projet. Comme la configuration est un `app.config.ts`, EAS demande de l'y écrire à la main : ajoutez `eas: { projectId: '…' }` dans `extra` et `owner: '…'` au premier niveau. L'identifiant du projet n'est pas un secret.
3. **Lancer le build de développement** (gratuit dans la limite du plan EAS) :

   ```sh
   corepack pnpm dlx eas-cli@24.8.0 build --profile development --platform android
   corepack pnpm dlx eas-cli@24.8.0 build --profile development --platform ios
   ```

   - Android : un `.apk`, installable sur l'itel (Android 10, 2 Go) par le lien ou le QR code d'EAS. Autorisez l'installation depuis le navigateur.
   - iOS : il faut un compte Apple Developer (99 $ par an) et enregistrer l'iPhone avant le build : `eas device:create`, puis le build. Pour le simulateur sur un Mac : profil `development-simulator`.
4. **Installer et ouvrir** sur l'itel et l'iPhone, puis vérifier ce que le ticket T-011 demande : l'écran de lancement (symbole or sur fond Nuit), la barre d'onglets Arbre et Famille, le passage Jour/Nuit en changeant le thème du téléphone, le passage français/anglais en changeant la langue du téléphone sans relancer l'app, et le texte du téléphone au maximum (rien de coupé). Notez ce qui ne va pas dans la pull request.

Version de Node des builds EAS (`eas.json`, profil `base`) : la même que les images Docker du serveur (`apps/api/Dockerfile`), dans la majeure de `.nvmrc`. Quand Dependabot monte l'image Node, un test de l'app échoue jusqu'à ce qu'`eas.json` suive.

Les profils `preproduction` et `production` d'`eas.json` serviront à T-068 et à la sortie ; ils ne contiennent ni identifiant ni secret (les secrets vont dans les variables d'environnement EAS).

## Travailler au quotidien

Sur le poste, téléphone et poste sur le même réseau Wi-Fi :

```sh
cd apps/mobile
corepack pnpm start          # Metro, pour le build de développement installé
```

Ouvrez l'app Lignée (build de développement) sur le téléphone et choisissez le serveur du poste, ou scannez le QR code affiché. Un changement dans `apps/mobile`, `packages/ui` ou `packages/i18n` se voit aussitôt.

Vérifications, depuis la racine :

```sh
corepack pnpm --filter @lignee/mobile lint
corepack pnpm --filter @lignee/mobile typecheck
corepack pnpm --filter @lignee/mobile test       # Jest (jest-expo) : rendu des écrans, polyfills, configuration
cd apps/mobile && corepack pnpm exec expo export --platform android --output-dir dist   # bundle Hermes
```

## Build Android local, sans EAS (facultatif)

Possible sous Windows avec Android Studio, mais long la première fois (téléchargement du NDK 27 et de la plateforme Android 36, compilation C++ des modules natifs) :

```sh
cd apps/mobile
corepack pnpm exec expo prebuild --platform android   # crée android/ (non commité)
corepack pnpm exec expo run:android                   # compile, installe sur l'émulateur ou le téléphone branché
```

Il faut le JDK 17 (celui d'Android Studio convient) dans `JAVA_HOME`, et `ANDROID_HOME` vers le SDK Android. Essai du 16 octobre 2026 avec le JDK 25 d'Adoptium : échec après 13 minutes, à la configuration CMake de `react-native-screens` et `react-native-worklets` (« A restricted method in java.lang.System has been called ») ; le JDK 25 ne convient pas à React Native 0.86. Le dossier `android/` se régénère à chaque `prebuild` : on ne le modifie jamais à la main, on passe par `app.config.ts` ou un plugin de configuration.

## Vérifier l'arbre sur le téléphone (T-017, issue #34)

Skia est un module natif : après la fusion de T-017, reconstruisez le build de développement (`eas build --profile development --platform android`, ou le build local ci-dessus). Sur l'Android de référence, avec l'arbre généré de développement (500 personnes), vérifiez et notez :

1. **ARB-01** : de la touche de l'icône à l'arbre dessiné, moins de 1 s ; « Vous » est visible en bas au centre, avatar doré.
2. **ARB-02** : pincer et déplacer ; 30 images par seconde au moins (idéalement 60) ; les trois niveaux apparaissent (points, prénoms, noms entiers et années) ; les boutons « Agrandir l'arbre » et « Réduire l'arbre » font le même parcours ; avec « Réduire les animations » activé dans le téléphone, ils changent le cadre sans glisser.
3. **ARB-03 / CL-POL-12** : trouvez le chef de famille à plusieurs épouses (ou chargez l'arbre de test) : ses foyers repliés montrent « + n », un toucher les déplie, rien ne se chevauche, les traits restent lisibles au niveau standard.
4. **ACC-06** : avec TalkBack, la liste s'ouvre d'office, chaque nom se touche et mène à la personne ; sans TalkBack, « Parcourir en liste » donne le même parcours ; tout l'arbre se parcourt sans pincer ni glisser.
5. **Mode Aînés et texte à 200 %** : fiches plus larges, aucune troncature du prénom au-delà de deux lignes, zones touchables de 56.
6. **Jour et Nuit** : lisibilité des traits, des pastilles et des mentions « Voir aussi ».
7. **Liens** : repérez un trait long, un renvoi « Voir aussi » (le toucher mène à l'autre fiche) et un trait en pointillés ; dites si `MAX_LINE_CROSSINGS` (ADR 0024 / 0025) est trop bas ou trop haut.

## Changer de SDK Expo

Une seule pull request, quand la nouvelle version a au moins deux semaines :

```sh
cd apps/mobile
corepack pnpm add expo@<version>
corepack pnpm exec expo install --fix     # aligne React, React Native et les modules natifs
```

Puis relisez les notes de version d'Expo, mettez à jour les `overrides` de `package.json` à la racine (versions de `@expo/cli`, `@expo/router-server`, `expo-asset`, `expo-constants` gardées à plus de 14 jours ; `tools/ci/src/expo-overrides.test.ts` échoue tant qu'un override sort de la plage demandée par le nouvel `expo`), refaites un build de développement et vérifiez sur les deux téléphones. Dependabot ne propose pas ces montées (voir `.github/dependabot.yml`).

## En cas de problème

- **« Unable to resolve module »** après une mise à jour : `corepack pnpm exec expo start --clear`.
- **L'app reste sur l'écran de lancement** : une police n'a pas pu se charger ; regardez le journal de Metro.
- **Le téléphone ne trouve pas le poste** : même réseau Wi-Fi, pare-feu Windows ouvert pour Node, ou `corepack pnpm start --tunnel`.
