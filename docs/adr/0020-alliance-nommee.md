# 0020 — Alliance nommée : conjoint, conjoint d'un parent, co-épouse

Date : 18 octobre 2026 · Statut : proposée (T-021)

## Contexte

Le TRD (« Moteur de parenté », question 1) dit que « les liens par alliance passent par les unions : conjoint, parents du conjoint, conjoint d'un parent, et co-épouse (deux unions simultanées avec la même personne) », le sang avant l'alliance, tous les chemins gardés. PAR-04 : « épouse de votre père », « mari de votre mère », jamais « belle-mère » ni « beau-père », ambigus ; « co-épouse » entre épouses d'un même homme. PAR-02 cite « beau-père, belle-sœur, gendre, bru ». CL-POL-08 : « la co-épouse de ma mère » s'affiche « épouse de votre père ». CL-FAM-01 : « fils de l'épouse de votre père », jamais « demi-frère ».

L'ADR 0010 donne déjà les chemins par une ou deux unions (`findRelationships`), sans les nommer, et laisse la simultanéité hors du graphe (points 4 et 6) ; l'ADR 0012 la garde par paire d'unions et la déduit avec `resolveSimultaneity`. Le cahier ne dit pas comment nommer une forme d'alliance, ce qui fait une « co-épouse » quand rien ne date les unions, ni ce que vaut une union sans fin.

## Décision proposée

1. **Le lien nommé se lit dans le chemin, sans nouveau parcours.** Chaque chemin par alliance de `findRelationships` porte un champ `alliance` (`AllianceLink`) ; un chemin de sang n'en a jamais. Le champ ne change ni les chemins ni leur ordre (le sang avant l'alliance, ADR 0010, point 5). `classifyAlliance(graph, chemin, contexte)` le calcule aussi pour un chemin donné.
2. **Nature (`kind`) selon la forme des segments de sang** (générations montées/descendues) :
   - une union : `spouse` (0/0, 0/0) ; `parent_of_spouse` (0/0, 1/0) ; `child_of_spouse` (0/0, 0/1) ; `spouse_of_parent` (1/0, 0/0) ; `spouse_of_child` (0/1, 0/0 : gendre, bru) ; `sibling_of_spouse` (0/0, 1/1) ; `spouse_of_sibling` (1/1, 0/0) ; `step_sibling` (1/0, 0/1 : enfant du conjoint d'un parent) ;
   - deux unions : `co_spouse` ou `spouse_of_spouse` (0/0, 0/0, 0/0, point 4) ; `spouse_of_sibling_of_spouse` (0/0, 1/1, 0/0) ;
   - toute autre forme : `other` (conjoint d'un oncle, grand-parent du conjoint, « la 2e femme de mon grand-père »…), nommée plus tard d'après ses segments.
   L'inverse est exact : `spouse_of_parent` ↔ `child_of_spouse`, `parent_of_spouse` ↔ `spouse_of_child`, `sibling_of_spouse` ↔ `spouse_of_sibling`, les autres sont leur propre inverse (`INVERSE_ALLIANCE_KIND`, `invertAlliance`).
3. **Passages (`crossings`)** : pour chaque union traversée, ses conjoints et chacune de leurs unions (couple remarié : toutes) avec son type et sa fin (`UnionEnding`) : `ended` avec le motif saisi ; `unspecified` pour une date de fin sans motif ; `death` si un conjoint est décédé (fait de décès ou statut vital) ; sinon `no_end_known`. Une union sans fin n'est **pas** dite en cours (ADR 0012, point 5) : les mots disent « épouse », sans affirmer plus.
4. **Co-épouse seulement si la simultanéité est établie.** Pour A, union, M, union, B : chaque paire (union de A avec M, union de M avec B) est résolue par `resolveSimultaneity` (dates d'abord, puis réponse gardée). `co_spouse` si une paire au moins est établie simultanée ; sinon `spouse_of_spouse` (« autre épouse de votre mari »), avec le résumé `successive` ou `unknown`, jamais supposé. Aucune règle de genre : deux maris d'une femme, deux épouses d'une femme sont `co_spouse` au même titre ; les mots (« co-épouse », « co-époux ») suivent les genres (T-026).
5. **Conjoint d'un parent : simultané ou successif avec l'union de l'autre parent.** Quand le chemin arrive à un conjoint en montant depuis son enfant (ou en redescend vers lui), le passage porte le côté enfant (`fromChild`, `toChild`) : l'union traversée comparée à chaque union du parent avec un autre parent de l'enfant (tous types de filiation), résumée en `simultaneous`, `successive`, `unknown` ou `none` (aucune union visible avec l'autre parent). Pour CL-POL-08, l'épouse du père est « épouse de votre père » dans tous les cas ; la forme expliquée peut dire « co-épouse de votre mère » quand c'est établi.
6. **Contexte** (`createAllianceContext({ facts, simultaneityAnswers, people })`) : construit une fois par arbre, à partir de l'arbre **déjà filtré** du lecteur, comme le graphe. Il s'appuie sur `simultaneityResolver` de `@lignee/domain` (même déduction que `resolveSimultaneity`, faits et réponses lus une fois). Le graphe ne porte toujours pas la simultanéité (ADR 0010). Le moteur ne compare que des unions présentes dans le graphe : une réponse ou un décès qui citerait une union ou une personne masquée n'est jamais lu (vérifié sur des arbres générés avec un contexte non filtré). Sans contexte, seules les dates des unions comptent.
7. **Mots proposés pour T-026 et T-027** (utilisés par les scénarios en attendant les dictionnaires, `src/test-support/alliance-words.ts`) : « épouse de votre père » / « your father's wife », « mari de votre mère » / « your mother's husband », « fils de l'épouse de votre père » / « son of your father's wife », « fille du mari de votre mère », « fille de votre mari » / « your husband's daughter », « co-épouse » / « co-wife », « autre épouse de votre mari » / « your husband's other wife ». À relire par un locuteur natif (PAR-11).

## Choix laissés à Daniel

- **« beau-père », « belle-mère »** : jamais pour le conjoint d'un parent (PAR-04). Pour le parent du conjoint (`parent_of_spouse`), PAR-02 les cite ; proposition : forme courte « belle-mère » permise seulement là, forme expliquée « mère de votre épouse ». Alternative : ne jamais les afficher, et dire toujours « mère de votre épouse ».
- **« beau-fils », « belle-fille »** : ambigus (enfant du conjoint, ou conjoint de l'enfant). Proposition : « fils de votre épouse » pour `child_of_spouse`, « gendre », « bru » pour `spouse_of_child` (PAR-02), jamais « beau-fils ».
- **« beau-frère », « belle-sœur »** (PAR-02, trois sens, CL-VOI-05) : la structure dit lequel (`sibling_of_spouse`, `spouse_of_sibling`, `spouse_of_sibling_of_spouse`). Proposition : forme courte « beau-frère », forme expliquée « frère de votre épouse », « mari de votre sœur »… Le partage du segment de fratrie (« frère ou demi-frère ») se lit avec `siblingLink` si T-026 le veut.
- **Anglais « stepmother »** (cité par le TRD) : proposé seulement en forme secondaire, pour une union établie successive ; « your father's wife » en forme courte, car une co-épouse de la mère n'est pas une « stepmother ».
- **Couple remarié** : toutes les unions sont rendues ; T-022 choisit laquelle nommer (la plus récente ?).

## Conséquences

- `@lignee/domain` : nouvelle fonction `simultaneityResolver(arbre)` (même règle que `resolveSimultaneity`), sans effet sur la visibilité.
- `@lignee/kinship` : `alliance.ts` (`createAllianceContext`, `classifyAlliance`), option `allianceContext` de `findRelationships`, champ `Relationship.alliance`, `invertAlliance`. Les propriétés existantes tiennent : inverse exact, masqué équivaut à jamais saisi (le contexte compris), complétude.
- Appelants (T-029, T-031, voix) : construire le contexte avec l'arbre filtré, une fois, à côté du graphe. T-052 : le filtre retire déjà les réponses dont une union est masquée (ADR 0012) ; les faits de décès suivent la visibilité de leur personne.
- CL-POL-08 et CL-FAM-01 : partie `lien` jouée ; mots en T-026 et T-027, nom d'usage « Maman Fatou » en T-041.

## Écarté

- **Co-épouse par défaut sans dates ni réponse** (polygamie présumée) : contraire à l'ADR 0012, point 5, et au principe « un arbre juste avant un arbre complet ».
- **Simultanéité recopiée dans le graphe** : trahirait un foyer masqué (ADR 0010, point 6).
- **Nommer par mots dans le moteur** : T-026 et T-027.
