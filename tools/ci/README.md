# ci

Contrôles lancés par l'intégration continue (`.github/workflows/ci.yml`), testés comme le reste du code. Agent : exploitation.

Les scripts sont en TypeScript et tournent directement sous Node 24 (suppression des types intégrée), sans étape de compilation.

| Script | Exigence | Commande à la racine |
| --- | --- | --- |
| `src/check-forbidden-dependencies.ts` | CON-12 : aucune bibliothèque de reconnaissance faciale | `corepack pnpm check:forbidden-dependencies` |

## CON-12 : dépendances interdites

Le script lit `pnpm-lock.yaml` (dépendances directes et transitives, de tous les paquets) et échoue si l'une d'elles est une bibliothèque de reconnaissance ou de détection de visages. La liste est dans `src/forbidden-dependencies.ts` : des noms exacts et des motifs (`face-api`, `face_detection`, `facial`, `rekognition`…). Le contrôle échoue aussi si le format du lockfile change (version autre que 9) : mieux vaut un échec à corriger qu'un contrôle qui ne voit plus rien.

Hors du périmètre, volontairement :

- le déverrouillage par Face ID ou empreinte du système (`expo-local-authentication`) : l'app ne reçoit aucune donnée biométrique, seulement « réussi » ou « échoué » ;
- les bibliothèques de vision généralistes (OpenCV, Google Cloud Vision) : à examiner au cas par cas en relecture, et à ajouter à la liste si elles servent aux visages.

Pour ajouter un paquet : une ligne dans `FORBIDDEN_PACKAGES` avec la raison, et un cas dans `forbidden-dependencies.test.ts`.
