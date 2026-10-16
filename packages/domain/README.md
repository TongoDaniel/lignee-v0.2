# domain

Types, schémas Zod, dates floues, règles de cohérence et de visibilité. Partagé par le téléphone, l'API, la synchro, la voix et le moteur de parenté. Relecture : gardien-confidentialite.

Zod est la seule dépendance du code du paquet. Hors des tests, ESLint (`eslint.config.mjs`) interdit toute autre importation, tout import relatif qui sort de `src/` et les globales de Node ou du réseau (`process`, `Buffer`, `require`, `fetch`…) ; `tsconfig.src.json` vérifie ce code sans types de Node, `tsconfig.json` garde les types de Node pour les tests. Les schémas sont la source : les types en sont déduits (`z.infer`, et `z.input` pour les entrées qui ont des valeurs par défaut), et `modelSchemas` (`src/schemas.ts`) les liste pour l'API (OpenAPI, via `z.toJSONSchema`).

## Le modèle (T-004)

| Fichier | Schémas | Source |
| --- | --- | --- |
| `ids.ts` | `idSchema`, `createId`, `createUuidV7Generator`, `isUuidV7`, `uuidV7Timestamp` | TRD, Hors-ligne (point 1) |
| `fuzzy-date.ts` | `fuzzyDateSchema`, `fuzzyDateSortKey`, `compareFuzzyDates`, `fuzzyDateSpan`, `isApproximate`, `birthDateFromAge`, `describeFuzzyDate` (T-005, voir plus bas) | TRD, Modèle de données ; VOX-14 ; CL-DON-05, CL-DON-06, CL-VOI-16 |
| `person.ts` | `personSchema`, `nameSchema`, `personRecordSchema`, `formatName` | UNI-01, UNI-02, UNI-22 ; CL-DON-01, CL-DON-02, CL-FAM-17, CL-FAM-18 |
| `union.ts` | `unionSchema` (deux conjoints, chacun avec son rang) | UNI-05 à UNI-08 |
| `filiation.ts` | `filiationSchema` (avec `recognitionStatus`), `parentCandidateSchema`, `proposesOnlyMeByDefault` | UNI-09 à UNI-11, CON-04 |
| `fact.ts` | `factSchema`, `titleRoleSchema`, `multipleBirthSchema`, `findMultipleBirth`, `projectMultipleBirth` | UNI-01, UNI-14, UNI-15, UNI-17 ; CL-FAM-11, CL-FAM-13, CL-FAM-19 |
| `place.ts` | `placeSchema`, `toPlaceSchema`, `usageNameSchema` | UNI-04 ; tables `lieux`, `a_placer`, `noms_usage` |
| `visibility.ts` | `visibilityRuleSchema`, `visibilityRuleSetSchema` (données seules) | CON-02, CON-03 ; le calcul est T-052 |
| `tree.ts` | `treeSchema`, `treeSettingsSchema` (`mapEnabled`) | CON-13 |

Les identifiants et valeurs sont en anglais ; correspondance avec les mots du cahier :

| Cahier | Modèle |
| --- | --- |
| nature connue, à compléter | `known`, `placeholder` |
| genre femme, homme, autre, non renseigné | `female`, `male`, `other`, `unspecified` |
| statut vital (vivant, décédé, inconnu) | `living`, `deceased`, `unknown` ; « présumée vivante » est calculée (T-007) |
| nom de naissance, d'usage, surnom, titre, variante, ancien | `birth`, `usage`, `nickname`, `title`, `variant`, `former` |
| union civile, coutumière, religieuse, union libre, PACS ou partenariat, non renseigné | `civil`, `customary`, `religious`, `free_union`, `civil_partnership`, `unspecified` |
| motif de fin décès, divorce, séparation, non renseigné | `death`, `divorce`, `separation`, `unspecified` |
| option déclarée monogamie, polygamie | `monogamy`, `polygamy` |
| filiation de naissance, adoptive, « a élevé », confié, tuteur, donneur, gestation pour autrui | `birth`, `adoptive`, `raised`, `fostered`, `guardian`, `donor`, `surrogacy` |
| certain, probable, hypothétique | `certain`, `probable`, `hypothetical` |
| lien officiel, non officiel (paternité non officielle), inconnu | `official`, `unofficial`, `unknown` (`recognitionStatus`, distinct de la certitude) |
| visibilité tout l'arbre, branche, personnes choisies, moi seul | `tree`, `branch`, `chosen_people`, `only_me` |
| portée du nom d'usage moi seul, famille | `only_me`, `family` |

Les tables absentes du TRD (titres et rôles datés, naissances multiples) et les autres compléments sont décrits dans l'ADR 0008 (proposée).

### Ce que les schémas garantissent, et ce qui vient après

- Une union a exactement deux conjoints distincts, chacun avec un rang entier positif ; seules les deux personnes sont obligatoires (le type vaut alors `unspecified`). Aucune limite de nombre, aucune règle de genre.
- Une filiation relie un parent et un enfant distincts. « Au plus deux parents de naissance » et « aucun cycle » portent sur tout l'arbre : T-007.
- Une personne connue a au moins un nom autre qu'un ancien prénom (`personRecordSchema`, UNI-22 : l'ancien prénom est masqué, la fiche doit garder un nom à afficher) ; une personne à compléter n'en a pas besoin. « Inconnu » n'est jamais un nom enregistré.
- Un nom a au moins des prénoms, un nom de famille ou une forme d'affichage. Aucun nom n'est recopié d'une fiche à l'autre (CL-POL-15).
- Une naissance multiple réunit au moins deux personnes distinctes ; l'ordre est facultatif et sans doublon.
- Un fait `recognition` (reconnaissance tardive, CL-FAM-13) désigne la filiation reconnue (`filiationId`), et lui seul.
- Une règle de visibilité par objet (`visibilityRuleSetSchema`).
- Tous les schémas d'objet sont stricts : un champ inconnu est refusé. Aucun champ « ethnie » ni « religion » (CON-13) : `src/tree.test.ts` inspecte le schéma JSON de chaque entrée de `modelSchemas`.

### Identifiants

UUIDv7 sous forme canonique (minuscules), créés sur le téléphone par `createId()`. Le générateur est strictement croissant, même dans la même milliseconde ou si l'horloge recule (RFC 9562, compteur de 12 bits). Dans la même milliseconde, le compteur avance d'un pas aléatoire de 1 à 64 : un trou entre deux identifiants voisins ne trahit pas un objet masqué créé entre eux. Risque résiduel accepté (ADR 0008) : l'horodatage de création reste lisible dans l'identifiant ; les exports partagés ne doivent donc pas contenir d'identifiants internes. La source par défaut utilise `crypto.getRandomValues` : l'app doit installer le polyfill d'Expo avant le premier identifiant.

### Date floue (T-005)

`fuzzy-date.ts` est le seul endroit où la date floue est définie ; faits, unions, noms et titres importent `fuzzyDateSchema` de là. Conventions que le cahier ne fixe pas : ADR 0009 (proposée).

- **Forme** : union discriminée sur `qualifier`. `exact`, `about`, `before`, `after`, `calculated` ont une borne `date` ; `between` a `from` et `to`, ordonnées et distinctes ; tous ont `precision` (`day`, `month`, `year`, `decade`), `calendar` (`gregorian` par défaut, `hijri`) et un `originalText` facultatif. La forme `text` de T-004 (`{ qualifier: 'text', originalText }`, `fuzzyDateFromText`) est inchangée.
- **Validation** : une précision par date ; mois et jour présents si et seulement si la précision les demande ; une décennie commence par une année en 0 ; le jour existe (grégorien réel, hégirien 30 au plus, sans conversion : CL-DON-07 est V2).
- **Tri** : `fuzzyDateSortKey` donne la colonne de tri (chaîne, collation « C ») ; `compareFuzzyDates` compare par elle. Une date qui finit avant qu'une autre commence passe avant ; au même jour, « après » d'abord, puis du moins précis au plus précis, « avant » en dernier ; texte libre et autre calendrier en fin, date absente tout au bout.
- **Approximation et calcul** : `isApproximate` est vrai pour tout sauf une date exacte ; `birthDateFromAge(80, <2010>)` donne une naissance `calculated` en 1930, approximative (VOX-14).
- **Affichage** : `describeFuzzyDate` renvoie une structure sans mots ; le texte (« vers 1940 ») viendra de `packages/i18n`.
- **Étendue** : `fuzzyDateSpan` donne le premier et le dernier jour possibles d'une date grégorienne, pour les contrôles de cohérence (T-007).

## Visibilité par défaut (relecture gardien-confidentialite)

T-004 ne calcule aucune visibilité : il donne à chaque donnée sensible sa propre place dans le modèle, pour qu'elle porte sa propre règle. Les valeurs par défaut ci-dessous sont celles du cahier (TRD, « Confidentialité appliquée », points 1 et 2 ; PRD, UNI-15, UNI-22, CON-03, CON-04) ; T-052 les applique, avec leurs tests de non-fuite. Règle générale : un objet sans règle prend la valeur par défaut de son type, jamais « tout l'arbre » quand ce type est protégé.

### Faits sensibles

| Donnée | Place dans le modèle | Valeur par défaut, sans règle | Garanti dès T-004 |
| --- | --- | --- | --- |
| Cause de décès | Fait distinct, `type: 'death_cause'`, séparé du fait `death` (date, lieu) | **Auteur seul** : un fait `death_cause` sans règle n'est visible que de son auteur (`authorAccountId` du fait), comme une règle `only_me` posée par lui. Jamais dans l'arbre, une notification ni un export partagé (UNI-15) | Le fait exige une valeur et un auteur ; il ne décrit qu'une personne ; il peut porter sa propre règle (`target.type: 'fact'`) |
| Ancien prénom | Nom distinct, `type: 'former'` | Masqué : visible de qui y a droit seulement, jamais dans la recherche des autres (UNI-22) | Le nom exige un auteur ; il peut porter sa propre règle (`target.type: 'name'`) ; il ne suffit pas à nommer une personne connue |

Point ouvert pour T-052, à trancher avec gardien-confidentialite : le cahier ne dit pas qui « a droit » à un ancien prénom masqué. Proposition à valider (ADR 0008) : par défaut, l'auteur du nom seulement (équivalent `only_me`) ; une règle explicite peut l'ouvrir.

### Liens pour lesquels « moi seul » est proposé (CON-04)

`proposesOnlyMeByDefault(filiation)` est vrai pour quatre cas, et seulement eux : filiation de **donneur** (`donor`), de **gestation pour autrui** (`surrogacy`), d'**adoption** (`adoptive`), et **paternité non officielle** (`recognitionStatus: 'unofficial'`, quel que soit le type). « Proposé » : le choix apparaît dans l'aperçu avant validation (T-052, T-072), l'utilisateur peut l'élargir.

### Objets sans règle propre

Ces objets ne portent pas de règle (`visibilityTargetTypeSchema` ne les vise pas) : leur visibilité se déduit d'autres objets. Ce qui est du modèle est encodé ici ; le reste est la consigne de T-052.

| Objet | Visible pour un lecteur quand… | Où |
| --- | --- | --- |
| Naissance multiple | Les enfants masqués en sont retirés ; l'enregistrement disparaît s'il reste moins de deux enfants visibles (« Jumeaux » trahirait l'autre) | Encodé : `projectMultipleBirth` (le module de droits fournit `isVisible`) |
| Candidat parent | Le candidat est visible, et l'union qui le relie au parent connu de l'enfant aussi (sinon « mère parmi ses épouses » révèle une union masquée) | T-052 |
| À placer | La personne de référence est visible, et aucun pas du chemin ne passe par une personne masquée ; sinon l'entrée n'est pas envoyée | T-052 |
| Fait `recognition` | Il prend la visibilité de la filiation qu'il désigne (`filiationId`, obligatoire) | Champ encodé ; calcul T-052 |
| Titre ou rôle daté | Il prend la visibilité de la personne (ADR 0008) | T-052 |
| Nom d'usage | Sa portée (`only_me` : son auteur seul ; `family` : les membres qui voient la personne) passe par le module de droits unique, comme une règle | T-052 |
| Règle `chosen_people` elle-même | La liste des comptes choisis n'est envoyée qu'à l'auteur de la règle ; les autres lecteurs reçoivent l'objet ou rien, jamais la règle | T-052, synchro (T-063) |

## Tests

```sh
corepack pnpm --filter @lignee/domain test
```

- Les cas limites de T-004 (CL-POL-15, CL-DON-01, CL-DON-02, CL-FAM-11, CL-FAM-17, CL-FAM-18, CL-FAM-19) sont joués par `src/scenarios/model-scenarios.test.ts`, ceux de T-005 (CL-DON-05, CL-DON-06, CL-VOI-16) par `src/scenarios/fuzzy-date-scenarios.test.ts`, CL-POL-03 (partie lecture) par `src/scenarios/action-scenarios.test.ts`. Chaque YAML dit dans `couverture` la partie testée et les tickets qui le compléteront. Le job `cas-limites` de la CI les compte comme joués parce que `loadScenario` les a réellement chargés pendant les tests (`test/scenarios/README.md`).
- `src/test-support/scenario-format.test.ts` valide le format de tous les fichiers de `test/scenarios` et construit leur arbre de départ.
- Tests de propriétés (fast-check) : croissance des identifiants, validité des unions ; dates floues générées par `src/test-support/fuzzy-date-arbitrary.ts` (tri total, indépendant de l'ordre d'arrivée et cohérent avec l'étendue, clé injective, aller-retour JSON) ; et, sur des milliers d'arbres générés (`src/properties/generated-trees.test.ts`) : chaque objet passe son schéma et chaque référence existe ; une union relie deux personnes distinctes, avec des rangs 1, 2, 3… par personne ; au plus deux parents de naissance ; aucun cycle de filiation.
- Noms générés seulement, jamais une vraie famille.

## Outils de test (T-006)

`src/test-support/`, exporté pour les tests des autres paquets sous `@lignee/domain/test-support` (jamais importé par l'app : ce code lit des fichiers avec Node). Exclu de `tsconfig.src.json` et des règles ESLint du code du paquet.

| Fichier | Contenu |
| --- | --- |
| `tree-generator.ts` | `generateTree({ seed, size, rates? })` : arbre reproductible de `size` personnes exactement ; `referenceTree(100 \| 1000 \| 5000)` : arbres types, graine fixe, mis en cache |
| `arbitraries.ts` | `treeArbitrary({ minSize?, maxSize?, rates? })`, `treeOptionsArbitrary`, `treeRatesArbitrary` (fast-check) |
| `tree-data.ts` | `TreeData` (tous les objets d'un arbre) et `treeDataIssues` : schémas Zod, références, identifiants uniques, fiches (personne et noms), règles de visibilité |
| `generated-names.ts`, `random.ts` | Noms faits de syllabes inventées ; aléa et identifiants UUIDv7 tirés de la graine |
| `scenario.ts`, `scenario-tree.ts`, `scenario-format.ts` | Lecture des scénarios (`loadScenario`, trace « joué »), section `arbre` et sa construction (`buildScenarioTree`), format complet, attendu partagé (`actionExpectedSchema`), `applyExpectedPlan` |

Ce que contient un arbre généré, chaque probabilité étant réglable (`DEFAULT_TREE_GENERATOR_RATES`) : lignées fondatrices nées entre 1870 et 1915 ; polygamie (unions simultanées, rangs 1, 2, 3… pour chaque conjoint, option « polygamie » parfois déclarée) ; unions successives après décès, divorce ou séparation ; lévirat (la veuve épouse le frère du défunt) ; sororat (épouse supplémentaire, ou nouvelle épouse d'un veuf, sœur de l'épouse) ; implexe (mariage entre cousins germains) ; enfant rattaché à son père seul, les épouses étant mères candidates (CL-POL-03) ; places à compléter (conjoint ou parents d'un conjoint) ; adoption, « a élevé », confiage, tutelle par une co-épouse, un oncle ou une tante ; jumeaux et triplés ; personnes « à placer » ; faits (naissance, décès, cause de décès, profession, reconnaissance d'une paternité non officielle) et titres ; dates floues simples (« 1952 », « vers 1952 », en texte jusqu'à T-005) ; noms de naissance, d'usage, surnoms seuls, formes uniques, anciens prénoms ; comptes membres reliés à des fiches distinctes ; et des objets (personnes, unions, filiations, faits, noms) masqués au hasard par une règle « moi seul », « personnes choisies » ou « branche », pour les tests de non-fuite (T-057). `features` compte ce qui a été produit ; `tree-generator.test.ts` le retrouve dans l'arbre par des vérifications indépendantes du générateur.

Mesure sur le poste de développement (Windows 11, Node 24) : arbre de 100 personnes en 7 ms, 1 000 en 76 ms, 5 000 en 395 ms. Le test échoue au-delà de 3 s par arbre.
