# 0026 — Budget de temps du moteur de parenté : calcul découpé, caches et mesure hors du téléphone

Date : 20 octobre 2026 · Statut : acceptée (T-028, décision technique)

## Contexte

Le TRD fixe trois exigences de temps au moteur de parenté (`packages/kinship`) : « moins de 50 ms pour un lien dans un arbre de 5 000 personnes sur l'Android de référence, grâce aux ensembles d'ancêtres mis en cache et recalculés seulement pour la partie modifiée » (Moteur de parenté, Performance) ; « Ouverture de l'arbre : moins de 1 s » (Performance et appareils cibles) ; « calculs du moteur de parenté et de la disposition découpés pour ne jamais bloquer l'interface plus de 50 ms » (Pratiques). Le PRD ajoute PAR-01 : « Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000 personnes ». Le cas limite CL-FAM-20 (« Arbre de 5 000 personnes : budgets de performance tenus ») en est l'épreuve.

Le cahier ne dit pas comment découper un calcul, ce qu'il advient d'une question à laquelle le lecteur renonce, ni comment vérifier un budget du téléphone dans une intégration continue qui tourne sur Node, sur des machines bien plus rapides. Il ne dit pas non plus ce qu'est « la partie modifiée » d'un graphe qui est, par construction, la vue d'un lecteur.

## Décision

1. **Un seul moteur, en générateurs.** Les boucles du calcul des liens (montées, descentes, appariement des chemins, alliance, regroupement, tri) et de la construction du graphe sont écrites en fonctions génératrices (`Steps<T>`, `slicing.ts`). Chaque boucle passe par un point de pause : `if (pacer.due()) yield;`. Le calcul direct (`findRelationships`, `presentRelationships`, `createKinshipGraph`) mène le générateur d'un trait, avec un pas qui n'est jamais dû : il n'existe pas de seconde version du moteur, et le résultat découpé est par construction celui du calcul direct (vérifié sur des arbres générés et sur l'arbre type de 5 000 personnes, `slicing.test.ts`).
2. **API découpée.** `createKinshipGraphInSlices(input, options)`, `findRelationshipsInSlices(graph, a, b, options)` et `presentRelationshipsInSlices(graph, a, b, options)` rendent une promesse. `options.scheduler` (obligatoire) fournit l'horloge (`now`) et la main rendue (`yield`) : le paquet reste pur, sans minuterie ni horloge globale. Sur le téléphone, T-029 passe `performance.now` et `setTimeout(…, 0)`. L'horloge n'est lue que tous les 16 points de pause (`CLOCK_EVERY`) ; la construction du graphe met un point de pause tous les 32 objets (`BUILD_CHUNK`), et fait le travail de chaque objet dans une fonction ordinaire, que V8 optimise en cours de boucle (un générateur parcouru une seule fois ne l'est pas : sur l'arbre type, la construction passe ainsi d'environ 30 ms à 15 ms sur le poste).
3. **Tranche.** `sliceMs` vaut 8 ms par défaut (une demi-image à 60 images par seconde) et doit être dans ]0, 50] : une valeur hors de cet intervalle rejette la promesse sans rien calculer. Une tranche dure `sliceMs`, plus le travail jusqu'au point de pause suivant.
4. **Annulation.** `options.signal` (un `AbortSignal` convient : seul `aborted` est lu) est lu avant le calcul et à chaque reprise. Annulé, le calcul rejette par `KinshipCancelledError`, sans résultat partiel. Les caches d'un graphe ne sont écrits qu'à la fin d'un parcours d'ancêtres : un calcul annulé, ou deux calculs entrelacés sur le même graphe, ne laissent rien de partiel. L'écran annule la question précédente quand le lecteur choisit une autre fiche.
5. **« Recalculés seulement pour la partie modifiée » : écart assumé.** Un changement dans l'arbre donne un nouveau graphe (immuable), construit par tranches ; les ensembles d'ancêtres y sont calculés à la demande, personne par personne, et gardés dans le cache de ce graphe. Seules les personnes interrogées après le changement sont donc recalculées. Aucun cache n'est repris d'un graphe à l'autre : chaque graphe est la vue d'un lecteur, et un cache transporté d'une vue à une autre pourrait porter une personne ou une filiation masquée (PAR-09, CL-SEC-02). Le gain serait d'ailleurs faible : un ensemble d'ancêtres coûte quelques centièmes de milliseconde sur le poste.
6. **Mesure hors du téléphone.** Un budget du téléphone se compare à la mesure du poste multipliée par un facteur de ralentissement estimé à **30** (`ESTIMATED_DEVICE_SLOWDOWN`, `test-support/reference-device.ts`) : Hermes interprète le code sans compilation à la volée (5 à 10 fois plus lent que V8 sur ce calcul), et un processeur d'entrée de gamme (Cortex-A53 ou A55 vers 1,6 à 2 GHz) est 3 à 6 fois plus lent qu'un cœur de poste récent. Le budget ramené au poste (50 ms ÷ 30 ≈ 1,67 ms pour un lien ; 1 000 ms ÷ 30 ≈ 33 ms pour l'ouverture) est ensuite comparé au garde-fou habituel (× 1,5 sur un poste, × 3 en CI, README racine). La variable `LIGNEE_DEVICE_SLOWDOWN` remplace le facteur ; il sera remplacé par la mesure faite sur l'Android de référence (T-105, issue #34).
7. **Mesures stables sur une machine partagée.** Premier passage sur toutes les paires (médiane de 3), puis les 10 paires les plus lentes remesurées : médiane de 9 à chaud, médiane de 7 caches vides (le cache d'ancêtres est vidé avant chaque mesure ; reconstruire le graphe ferait mesurer le ramasse-miettes de la construction). La tranche la plus longue est la médiane, sur 5 passages, de la plus longue tranche de chaque passage, avec la tranche du téléphone ramenée au poste (8 ms ÷ 30). Une mesure au-dessus du garde-fou est reprise au plus 3 fois et la plus basse est gardée : la charge d'autres tâches ne fait qu'allonger les temps, une vraie régression dépasse à chaque fois. Délai Vitest explicite de 60 s pour ces tests.

## Mesures (T-028)

Poste de développement (Windows 11, Node 24), machine partagée et chargée ; ordre de grandeur, pas une référence :

- construction du graphe de l'arbre type de 5 000 personnes (5 000 personnes, 1 671 unions, 6 867 filiations) avec le contexte de l'alliance : 16 à 20 ms (budget ramené : 33 ms) ;
- lien présenté, le plus lent des 10 paires les plus lentes : 0,5 ms à chaud comme caches vides (budget ramené : 1,67 ms) ; en moyenne environ 0,1 ms par paire ;
- chef de famille à 8 épouses et 40 enfants : 0,1 à 0,5 ms ;
- plus longue tranche du calcul découpé : 0,5 à 0,8 ms (budget ramené : 1,67 ms), soit 15 à 25 ms estimés sur le téléphone ;
- le calcul direct en générateurs coûte de 0,9 à 1,4 fois l'ancien calcul sur V8 selon les mesures (création des générateurs, points de pause), sans effet sur les budgets.

## Écarté

- Un fil de calcul séparé (Worker, worklet) : pas de Worker standard dans Hermes, et un module natif ajouterait une dépendance au paquet pur ; le découpage suffit au budget.
- Deux versions du moteur (directe et découpée) : risque de divergence, et le résultat identique ne serait plus garanti par construction.
- Un facteur de ralentissement mesuré dans la CI (banc d'essai de référence) : la CI ne tourne pas sur Hermes ni sur ARM ; seule la mesure sur le téléphone vaut.

## Conséquences

- T-029 appelle `createKinshipGraphInSlices` à l'ouverture de l'arbre (une fois par vue filtrée, puis à chaque changement) et `presentRelationshipsInSlices` pour « Qui est-ce pour moi ? », avec un `AbortController` par question.
- La disposition (`packages/layout`, T-105) pourra reprendre le même schéma (`Steps`, `runInSlices`).
- Ce qui ne se mesure que sur le téléphone est listé pour T-105 et l'issue #34 : facteur réel, durée réelle des tranches, ouverture complète.
