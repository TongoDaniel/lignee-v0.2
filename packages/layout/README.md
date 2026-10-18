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

## Étapes 3 à 5 (T-012)

`layoutTree(graph, centerId, { folds })` ajoute à la structure l'ordre, le placement et le repli, et renvoie une `TreeLayout` en unités de grille (une fiche en largeur, une rangée en hauteur, la demi-rangée à 0,5 ; la personne centrale en x = 0 ; les tailles réelles viennent des tokens au dessin) :

| Champ | Contenu |
| --- | --- |
| `people` | Chaque personne dessinée : rangée, `x`, `y`, groupe de conjoints, `foldedParentsKey` si sa famille d'origine est repliée (branche repliée) |
| `families` | Chaque foyer ou colonne « non précisé » touché : repliée ou non (et par défaut), `childCount` (enfants du graphe reçu, CL-SEC-03), enfants dessinés dans l'ordre, point d'attache des traits et du compteur, place de la mention « non précisé » |
| `blocks`, `rows` | Groupes de conjoints (jamais coupés) avec leur fratrie ; personnes de chaque rangée de gauche à droite |
| `crossings` | Croisements des traits parent-enfant entre rangées voisines, avant et après la méthode des barycentres |

Contrat du dessin (`CARD_HEIGHT_LIMIT`, ADR 0016) : une fiche fait au plus une unité de large et moins d'une demi-rangée de haut ; une personne et son conjoint de la demi-rangée peuvent être au même `x`. La structure de T-008 donne en plus `simultaneousSpouses` (personnes aux unions simultanées, qui portent ou non ces foyers) et `unionOrderOf` (ordre de toutes les unions d'une personne) : le placement s'en sert pour dessiner un chef de famille au centre de ses épouses même quand un foyer est porté par l'épouse.

Repli : `setFolded(folds, key, folded)` et `toggleFamily(layout, key)` rendent de nouveaux choix, qu'on repasse à `layoutTree`. Par défaut, seule la ligne de la personne centrale est ouverte, jusqu'à 3 générations au-dessus et en dessous ; les conjoints d'une personne dessinée le sont toujours, chaque foyer replié avec son compteur. Cache : `createTreeLayoutCache().layout(graph, centerId, folds)` ne refait pas les étapes 1 et 2 tant que le graphe (le même objet) et la personne centrale ne changent pas, repart de l'ordre précédent, et rend le résultat précédent pour les mêmes choix (`lastRecompute` dit ce qui a été refait). Règles retenues : ADR 0016 (proposée).

Garanties vérifiées sur des arbres générés (`src/properties/layout.properties.test.ts`), replis par défaut, tirés au hasard et tout déplié : aucune fiche ne chevauche une autre, en deux dimensions (demi-rangée comprise) ; les conjoints d'un foyer dessiné sur une rangée sont dans le même groupe, les groupes ne se chevauchent pas, chaque fratrie est d'un seul tenant et dans l'ordre des frères et sœurs ; le compteur est celui du graphe reçu et aucune personne masquée n'apparaît ; une union, une filiation ou une naissance masquée donne la même disposition que si elle n'avait jamais été saisie ; inverser femmes et hommes ne change rien ; fonction pure ; le cache ne refait que les étapes 3 à 5 ; la méthode des barycentres n'augmente jamais les croisements (vrai par construction, documentaire : le test utile est la mesure ci-dessous). `src/crossings.test.ts` mesure la réduction : 22 089 croisements avant, 8 863 après sur 40 arbres générés de 300 personnes tout dépliés (relevé du 17 octobre 2026).

Hors de T-012 : le dessin et les libellés (T-017, via `packages/i18n`).

## Étape 6 et vue « descendance » (T-019)

`layoutTree` rend aussi `links` : chaque personne n'a qu'une fiche (ARB-06), et ce qui la relie ailleurs que sous sa famille est un lien entre deux fiches dessinées, dans l'ordre du dessin (de haut en bas, de gauche à droite) :

| Nature | Lien |
| --- | --- |
| `elsewhere` | Famille et enfant à la rangée suivante, rangé dans la fratrie d'une autre famille (le couple suit la famille de l'un, l'autre la rejoint : toute alliance, mariage entre cousins compris, CL-FAM-09) |
| `long` | Famille et enfant sur une rangée non voisine (étape 1 : implexe, union entre générations) |
| `couple` | Deux parents d'un foyer sur deux rangées (union entre générations, CL-FAM-10) |
| `secondary` | Filiation qui ne range pas l'enfant (adoption à côté de la naissance, « a élevé »…) |

Chaque lien porte ses deux fiches, ses points, son écart de rangées et ses croisements avec les traits des foyers ; `drawing` vaut `seeAlso` (renvoi « voir aussi » vers la fiche déjà dessinée) quand l'écart dépasse 2 rangées (`MAX_LINE_ROW_SPAN`) ou les croisements 4 (`MAX_LINE_CROSSINGS`), sinon `line`. Une famille repliée ne relie pas ses enfants ; deux conjoints dessinés sont toujours reliés.

`layoutDescendants(graph, ancestorId, { folds })` est la vue « descendance » (ARB-14) : l'ancêtre en x = 0, ses foyers dans l'ordre des rangs, puis tous ses descendants foyer par foyer, tout déplié par défaut (les choix de repli marchent comme dans l'arbre). Les descendants sont les enfants que l'arbre range sous ses familles, puis sous celles de ses descendants (`findDescendants`) ; la vue garde l'autre parent de chaque famille et les conjoints des descendants, rien d'autre (`descendantsGraph`). Règles retenues : ADR 0024 (proposée).

Garanties vérifiées sur des arbres générés (`src/properties/implex.properties.test.ts`, et `expectLinkInvariants` dans toutes les vérifications de disposition) : une seule fiche par personne, dans l'arbre tout déplié (ascendants compris) comme dans la descendance ; chaque enfant dessiné d'une famille dépliée y est relié, sous elle ou par un seul lien ; aucun lien en trop ; le tracé suit la règle, les croisements recomptés segment par segment ; les arbres générés produisent des liens de chaque nature et des renvois ; la descendance contient exactement les descendants recalculés depuis l'arbre, tout déplié ; ordre stable (même entrée, même résultat ; frères, sœurs et unions de l'ancêtre dans l'ordre de l'arbre) ; aucune personne masquée dans les liens ni dans la descendance.

## Mesure

`src/performance.test.ts` (médiane de plusieurs calculs, sur la machine des tests) : moins de 100 ms exigés pour 500 personnes visibles (budget du TRD), moins de 300 ms pour 5 000. Étapes 1 à 5 : moins de 100 ms pour 500 personnes dessinées ou plus (tout déplié), moins de 300 ms pour un arbre de 5 000 personnes au repli par défaut, moins de 1 s tout déplié ; déplier un foyer (étapes 3 à 5 seules) moins de 100 ms. Relevé du 17 octobre 2026 : environ 15 ms pour 598 personnes dessinées, 180 ms pour 4 907. Depuis T-019, ces mesures comprennent l'étape 6 (liens) ; la vue « descendance » du fondateur le plus large d'un arbre dense de 5 000 personnes doit tenir en moins de 1 s (relevé du 18 octobre 2026 : 65 ms pour 602 personnes dessinées, dont la structure de l'arbre entier). Relevé le 17 octobre 2026 sur le poste de développement, partagé avec d'autres calculs : environ 4 à 10 ms pour plus de 500 personnes visibles, 45 à 180 ms pour 5 000 selon la charge. La mesure sur l'Android de référence reste à faire (T-012, T-017).

## Scénarios

Les cas limites CL-POL-01, 04, 06, 09, 13, 14 et 18 sont joués par `src/scenarios/polygamy-scenarios.test.ts` (structure, puis ordre, placement et repli) ; CL-POL-12 et CL-SEC-03 par `src/scenarios/fold-scenarios.test.ts` ; CL-FAM-09 et CL-FAM-10 par `src/scenarios/implex-scenarios.test.ts` (T-019). Format de disposition : `test/scenarios/README.md`.
