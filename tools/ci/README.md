# ci

Contrôles lancés par l'intégration continue (`.github/workflows/ci.yml`), testés comme le reste du code. Agent : exploitation.

Les scripts sont en TypeScript et tournent directement sous Node 24 (suppression des types intégrée), sans étape de compilation.

| Script | Exigence | Commande à la racine |
| --- | --- | --- |
| `src/check-forbidden-dependencies.ts` | CON-12 : aucune bibliothèque de reconnaissance faciale | `corepack pnpm check:forbidden-dependencies` |

## CON-12 : dépendances interdites

Le script lit `pnpm-lock.yaml` (dépendances directes et transitives, de tous les paquets) et échoue si l'une d'elles est une bibliothèque de reconnaissance ou de détection de visages. La liste est dans `src/forbidden-dependencies.ts` : des noms exacts (`facetec`, `faceio`, `facepp`, `@react-native-firebase/ml-vision`…), des portées entières (`@facetec`, `@faceio`, `@luxand`) et des motifs (`face-api`, `face.detect`, `face-recog…`, `face-id`, `faces-api`, `facial`, `rekognition`…). Les motifs sont bornés : `interface-*`, `surface-*`, `typeface-*`, `facet-api`, `@clerk/facets` ou `react-facebook-login` passent. Le contrôle échoue aussi si le format du lockfile change (version autre que 9) : mieux vaut un échec à corriger qu'un contrôle qui ne voit plus rien.

### Limite : seul npm est contrôlé

Le contrôle ne voit que les paquets npm de `pnpm-lock.yaml`. Une bibliothèque native ajoutée hors de npm lui échappe : pod CocoaPods (`Podfile`, `Podfile.lock`) ou dépendance Gradle (`build.gradle`), par exemple ML Kit Face Detection, y compris quand un plugin de configuration Expo l'injecte au moment du `prebuild`. À compléter au ticket qui crée `apps/mobile` (T-011) : contrôler aussi les fichiers natifs générés par `expo prebuild`, ou la liste des plugins de `app.config.ts`.

### Hors du périmètre, volontairement

- le déverrouillage par Face ID ou empreinte du système (`expo-local-authentication`) : l'app ne reçoit aucune donnée biométrique, seulement « réussi » ou « échoué ». En revanche, un paquet tiers nommé `face-id` ou `faceid` est refusé : il faut l'examiner avant de l'admettre ;
- les bibliothèques de vision généralistes (OpenCV, Google Cloud Vision) : à examiner au cas par cas en relecture, et à ajouter à la liste si elles servent aux visages.

### Ajouter un paquet

Pour ajouter un paquet : une ligne dans `FORBIDDEN_PACKAGES` (ou `FORBIDDEN_SCOPES` pour une portée) avec la raison, et un cas dans `forbidden-dependencies.test.ts`.

Le test qui contrôle le `pnpm-lock.yaml` du dépôt dépend d'un fichier hors du paquet : `turbo.json` le déclare dans les entrées de `@lignee/ci#test`, pour que Turborepo ne réutilise pas un résultat en cache quand le lockfile change.
