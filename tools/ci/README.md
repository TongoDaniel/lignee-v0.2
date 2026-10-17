# ci

Contrôles lancés par l'intégration continue (`.github/workflows/ci.yml`), testés comme le reste du code. Agent : exploitation.

Les scripts sont en TypeScript et tournent directement sous Node 24 (suppression des types intégrée), sans étape de compilation.

| Script | Exigence | Commande à la racine |
| --- | --- | --- |
| `src/check-forbidden-dependencies.ts` | CON-12 : aucune bibliothèque de reconnaissance faciale | `corepack pnpm check:forbidden-dependencies` |
| `src/check-local-env.ts` | Environnement local (T-003) : extensions, droits des utilisateurs de la base, compartiment privé | `corepack pnpm check:local-env`, après `docker compose up -d` |

## CON-12 : dépendances interdites

Le script lit `pnpm-lock.yaml` (dépendances directes et transitives, de tous les paquets) et échoue si l'une d'elles est une bibliothèque de reconnaissance ou de détection de visages. La liste est dans `src/forbidden-dependencies.ts` : des noms exacts (`facetec`, `faceio`, `facepp`, `@react-native-firebase/ml-vision`…), des portées entières (`@facetec`, `@faceio`, `@luxand`) et des motifs (`face-api`, `face.detect`, `face-recog…`, `face-id`, `faces-api`, `facial`, `rekognition`…). Les motifs sont bornés : `interface-*`, `surface-*`, `typeface-*`, `facet-api`, `@clerk/facets` ou `react-facebook-login` passent. Le contrôle échoue aussi si le format du lockfile change (version autre que 9) : mieux vaut un échec à corriger qu'un contrôle qui ne voit plus rien.

### Côté natif : Gradle, CocoaPods, plugins Expo

Une bibliothèque native peut entrer sans paquet npm à son nom : dépendance Gradle ou pod CocoaPods ajoutés par un plugin de configuration Expo, par exemple ML Kit Face Detection. Le même script lit donc aussi, pour chaque app de `apps/` (`src/forbidden-native.ts`) : `app.config.*` et `app.json`, tout le dossier `plugins/` de l'app, et les fichiers Gradle (`*.gradle`, `*.gradle.kts`, `libs.versions.toml`) et CocoaPods (`Podfile`, `Podfile.lock`, `*.podspec`) de `android/` et `ios/` quand `expo prebuild` les a générés sur le poste. Il y cherche les coordonnées connues (`com.google.mlkit:face-…`, `GoogleMLKit/Face…`, `MLKitFace…`, `VNDetectFace…` de Vision) et les motifs de visages (`face-detection`, `FaceDetector`, `FACE_RECOGNITION`…, jamais à l'intérieur d'un mot comme `SurfaceDetection`), en plus des motifs npm. Il donne le fichier et la ligne.

Faux positif assumé : le contrôle lit le texte ligne par ligne, commentaires compris. Un commentaire de `app.config.ts` qui contient un mot interdit (« pas de face-detection ici ») fait échouer CON-12 : reformulez le commentaire, n'ajoutez pas d'exception.

Limite : en CI, `android/` et `ios/` ne sont pas générés (ils ne sont pas commités) : ce qu'un plugin npm injecte au `prebuild` sans le nommer dans `app.config.ts` n'est vu que sur un poste après `prebuild`. Le paquet du plugin, lui, passe par le contrôle du lockfile.

### Hors du périmètre, volontairement

- le déverrouillage par Face ID ou empreinte du système (`expo-local-authentication`) : l'app ne reçoit aucune donnée biométrique, seulement « réussi » ou « échoué ». En revanche, un paquet tiers nommé `face-id` ou `faceid` est refusé : il faut l'examiner avant de l'admettre ;
- les bibliothèques de vision généralistes (OpenCV, Google Cloud Vision) : à examiner au cas par cas en relecture, et à ajouter à la liste si elles servent aux visages.

### Ajouter un paquet

Pour ajouter un paquet : une ligne dans `FORBIDDEN_PACKAGES` (ou `FORBIDDEN_SCOPES` pour une portée) avec la raison, et un cas dans `forbidden-dependencies.test.ts`.

Le test qui contrôle le `pnpm-lock.yaml` du dépôt dépend d'un fichier hors du paquet : `turbo.json` le déclare dans les entrées de `@lignee/ci#test`, pour que Turborepo ne réutilise pas un résultat en cache quand le lockfile change.

## Environnement local

`src/check-local-env.ts` lit `.env`, puis interroge les conteneurs de `compose.yaml` par `docker compose exec` (PostgreSQL et `mc` dans le conteneur de MinIO) et par une requête HTTP anonyme sur MinIO. Les contrôles eux-mêmes sont dans `src/local-env.ts` ; `src/local-env.test.ts` les joue contre un faux environnement, sans Docker, pour prouver qu'ils échouent quand une exigence n'est pas tenue et qu'ils ne rendent pas de faux vert quand la base ne répond pas. Le même fichier vérifie aussi `compose.yaml`, `.env.example`, les Dockerfiles et le script d'initialisation de la base (ports sur `127.0.0.1` seulement, images épinglées par empreinte, valeurs factices) ; `turbo.json` les déclare en entrées de `@lignee/ci#test`.

Côté MinIO, l'administrateur crée un second compartiment avec un objet : la clé de l'application ne doit ni y lire ni y écrire, ni créer de compartiment. Un contrôle négatif n'est réussi que si `mc` répond par un refus de droits (« Access Denied » pour un compartiment, « Insufficient permissions to access this path » pour un objet, `REFUSAL_MESSAGES`) : une erreur réseau ou un objet absent le font échouer.

Les droits refusés se vérifient par un bloc `DO` qui ne réussit que si PostgreSQL répond « droits insuffisants » (SQLSTATE 42501) : une instruction acceptée, ou une erreur d'une autre nature, fait échouer le contrôle.

## Overrides des paquets d'Expo

`pnpm.overrides`, dans le `package.json` racine, fige quatre paquets qu'Expo installe lui-même (`@expo/cli`, `@expo/router-server`, `expo-asset`, `expo-constants`) sur des versions publiées depuis au moins 14 jours. `src/expo-overrides.test.ts` vérifie que chaque override reste dans la plage demandée par l'`expo` installé ou par sa ligne de commande, et égal à la version épinglée par l'app : au changement de version d'`expo`, un override oublié fait échouer le test au lieu de forcer en silence une version que le SDK ne demande plus.

## Audit des dépendances : exceptions

Le job `audit-dependances` (`pnpm audit --audit-level high`) échoue sur toute faille haute ou critique. Deux identifiants sont ignorés (`pnpm.auditConfig.ignoreGhsas` dans le `package.json` racine), parce qu'aucune version corrigée n'existe et que les paquets ne servent qu'aux outils du poste, jamais dans l'app publiée ni sur le serveur ([ADR 0014](../../docs/adr/0014-failles-sans-correctif-outils-mobile.md)) :

| Identifiant | Paquet et chemin | Pourquoi l'app publiée n'est pas touchée | Revue |
| --- | --- | --- | --- |
| GHSA-86w9-cpqp-85rv | `node-forge` <= 1.4.0 : `apps/mobile` > `expo` > `@expo/cli` > `node-forge` | Ligne de commande d'Expo sur le poste, pour lire le certificat de signature iOS ; Metro ne l'embarque pas | 17 janvier 2027, ou au changement de SDK Expo |
| GHSA-vfj7-8cjw-p6xm | `braces` <= 3.0.3 : `apps/mobile` > `@react-native/jest-preset` > `babel-jest` > `@jest/transform` > `micromatch` > `braces` | Jest, en test seulement, sur des motifs de notre configuration | 17 janvier 2027, ou au changement de Jest |

Retirez l'exception dès qu'une version corrigée existe. N'en ajoutez pas sans ADR.
