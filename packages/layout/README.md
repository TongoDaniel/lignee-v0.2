# layout

Disposition de l'arbre : foyers, implexe, repli (TRD, « Disposition de l'arbre »). Agent : moteur-parente.

Fonctions pures, partagées par le téléphone et le serveur : le code de `src/` n'importe que `@lignee/domain` (ESLint, `layoutSourceRules` dans `eslint.config.mjs`) et se vérifie sans types de Node (`tsconfig.src.json`). Ni React, ni Skia, ni réseau.

## Étapes 1 et 2 (T-008)

`buildTreeStructure(graph, centerId)` reçoit un graphe déjà limité à ce que le lecteur peut voir (`LayoutGraph` : personnes, unions, filiations, parents candidats, faits pour les décès, réponses de simultanéité par paire d’unions ; `TreeData` convient) et renvoie une `TreeStructure`, sans coordonnées :

| Champ | Contenu |
| --- | --- |
| `rowOf`, `rows`, `distanceOf`, `unreachable` | Étape 1 : rangée de chaque personne reliée à la personne centrale (0), ascendants en négatif ; les personnes sans chemin ne sont pas dessinées. `computeGenerations` fait cette étape seule |
| `units`, `unitOf` | Étape 2 : une unité par personne qui porte des foyers ou une colonne « non précisé », de forme `single`, `couple`, `successive` ou `simultaneous` ; la simultanéité vient de `resolveSimultaneity` (packages/domain), `kind` ne compte que les foyers portés ; `simultaneityPending` (par unité et pour toute la structure) signale une question encore ouverte |
| `foyerOf` | Chaque foyer (union, ou deux parents sans union) : conjoints et rangs, statut, enfants, `leadsToCenter` |
| `placementOf` | Place de chaque enfant : un foyer, ou la colonne « non précisé » d'un parent, avec les filiations qui l'y rangent |
| `crossLinks` | Traits longs (rangées non voisines) et liens secondaires (adoption à côté de la naissance, « a élevé »…) |

Garanties, vérifiées par les tests de propriétés sur des arbres générés (`src/properties/`) : chaque personne a une seule rangée, celle d'un plus court chemin ; une personne porte au plus une unité ; chaque union est dans un seul foyer ; chaque enfant est rangé à une seule place ; les foyers suivent les dates et les rangs ; inverser femmes et hommes ne change rien ; le graphe reçu n'est pas modifié. Règles que le cahier ne fixe pas : ADR 0013 (proposée).

Les arbres des propriétés viennent de `src/test-support/view-arbitrary.ts` : l'arbitraire « varied » de `packages/domain` tire souvent un taux de mariage nul (fast-check favorise les bornes), d'où des arbres sans union ; celui-ci garde hauts les taux de polygamie, de remariage et de mère non précisée, et prend la personne centrale dans la plus grande famille reliée. Une part des arbres reçoit en plus des unions entre générations (`withCrossUnions`), que le générateur ne produit pas : ce sont elles qui donnent des traits longs, et la propriété des liens vérifie qu'elle en a vu.

Hors de T-008 : l'ordre des frères et sœurs, la réduction des croisements, le placement et le repli (T-012), le dessin et les libellés (T-017, via `packages/i18n`).

## Mesure

`src/performance.test.ts` (médiane de plusieurs calculs, sur la machine des tests) : moins de 100 ms exigés pour 500 personnes visibles (budget du TRD), moins de 300 ms pour 5 000. Relevé le 17 octobre 2026 sur le poste de développement, partagé avec d'autres calculs : environ 4 à 10 ms pour plus de 500 personnes visibles, 45 à 180 ms pour 5 000 selon la charge. La mesure sur l'Android de référence reste à faire (T-012, T-017).

## Scénarios

Les cas limites CL-POL-01, 04, 06, 13, 14 et 18 sont joués par `src/scenarios/polygamy-scenarios.test.ts`, avec le format de disposition décrit dans `test/scenarios/README.md`.
