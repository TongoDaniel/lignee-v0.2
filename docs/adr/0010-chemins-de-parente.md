# 0010 — Chemins de parenté : définition, alliance et limites

Date : 16 octobre 2026, révisée le 17 octobre 2026 après relecture (relecteur-code, gardien-confidentialite) · Statut : proposée (T-013)

## Contexte

Le TRD (« Moteur de parenté », question 1) dit ce que le moteur calcule : remonter les filiations depuis A et B jusqu'aux ancêtres communs les plus proches, compter les générations de chaque côté, distinguer frères et demi-frères, ne jamais confondre deux personnes à compléter, passer par les unions pour l'alliance (conjoint, parents du conjoint, conjoint d'un parent, co-épouse), garder tous les chemins du plus proche au plus lointain, le sang avant l'alliance, avec la certitude la plus faible du chemin. Il ne dit pas ce qu'est exactement un « chemin », jusqu'où va l'alliance, quels types de filiation sont suivis, ni comment borner le calcul. Sans règle, un arbre de 5 000 personnes relie presque tout le monde à tout le monde par des alliances lointaines, et l'implexe multiplie les chemins. T-013 fixe ces règles dans `packages/kinship` ; les mots restent à T-026 et T-027.

## Décision proposée

1. **Chemin de sang** : on monte de A par des filiations jusqu'à un ancêtre, puis on descend jusqu'à B, sans passer deux fois par la même personne. Les grands-parents de deux frères ne sont atteints qu'en repassant par le parent commun : ils ne sont au sommet d'aucun chemin. Les chemins supplémentaires de l'implexe et du lévirat sont gardés (UNI-21 : un enfant du lévirat est demi-frère par sa mère et cousin par les pères). Les sommets de ces chemins ne sont donc pas « les ancêtres communs les plus proches au sens strict » : `commonAncestorsOfPaths` les rend tous, chacun une fois, avec un drapeau `truncated`.
2. **Frères et demi-frères** : deux chemins qui ne diffèrent que par l'ancêtre au sommet, atteint de chaque côté par des filiations de mêmes types, sont réunis en un seul (`sharing: 'full'`, deux parents communs) ; sinon, un seul ancêtre au sommet (`half`). Deux personnes à compléter sont deux personnes : seul le moteur de fratrie (T-020) dit « frère ou demi-frère » en lisant leur nature et les parents candidats.
3. **Types de filiation** : tous sont suivis par défaut, et chaque chemin rend les types traversés (`filiationTypes`, PAR-06) et chaque filiation avec son type. Le degré de santé (V3) passe `filiationTypes: ['birth']`.
4. **Alliance** : des segments de sang (éventuellement vides) reliés par une ou deux unions.
   - Une union : degré de sang total au plus 4 (conjoint, beaux-parents et grands-parents du conjoint, frère et sœur du conjoint, conjoint d'un parent, d'un frère, d'un enfant, d'un oncle ou d'un cousin germain, enfant du conjoint d'un parent…).
   - Deux unions : degré de sang total au plus 2 (co-épouse, conjoint du frère du conjoint, conjoint du conjoint d'un parent…).
   - Pas de redondance avec le sang : quand on arrive à X en montant depuis son enfant, puis qu'on passe l'union X–Y, cet enfant ne doit pas être aussi l'enfant de Y (sinon Y est son autre parent, et le chemin n'est que « parent ») ; de même pour l'enfant de Y où l'on descend ensuite. Ainsi la mère n'est jamais aussi « épouse de votre père », ni un demi-frère aussi « fils de l'épouse de votre père » (PAR-04, CL-FAM-01).
   - Deux personnes unies plusieurs fois (divorce puis remariage) n'ont qu'un passage : le chemin n'est pas dédoublé, et le passage (`UnionLink.unions`) porte toutes leurs unions, triées par identifiant, avec les rangs. T-021 et T-022 choisissent l'union à nommer.
   - La simultanéité des unions (co-épouse ou épouse successive) n'est pas décidée ici, et le graphe ne la transporte pas : elle se garde par paire d'unions (`SimultaneityAnswer`, ADR 0012), et T-021 la lit avec `resolveSimultaneity` de `@lignee/domain` sur l'arbre déjà filtré du lecteur, où une réponse ne figure que si ses deux unions sont visibles (ADR 0012, point 3).
5. **Ordre et symétrie** : le sang avant l'alliance ; puis le chemin le plus court (générations et unions), le moins d'unions, le plus équilibré (cousins avant « à la mode de Bretagne »), le plus certain ; à égalité, une clé identique pour un chemin et son inverse. Le calcul se fait toujours dans le même sens (A et B rangés par identifiant), puis s'inverse : le lien de B vers A est exactement l'inverse de celui de A vers B, dans le même ordre, même quand une limite est atteinte (propriété du TRD, vérifiée sur des arbres générés, avec et sans limites).
6. **Visibilité** (relecture gardien-confidentialite) : le moteur ne reçoit que des objets visibles, et n'en garde que la structure.
   - Entrée réduite (`KinshipGraphInput`) : personne (identifiant, nature, genre) ; union (conjoints, rangs, type, dates, motif de fin) ; filiation (parent, enfant, type, certitude, union d'origine) ; parent candidat. Ni notes, ni lieux, ni sources, ni statut de reconnaissance : même si l'appelant passe l'objet complet, le graphe n'en recopie que ces champs. Une simultanéité recopiée sur l'union trahirait un second foyer masqué : elle n'en fait pas partie.
   - Propriété vérifiée sur des arbres générés : retirer des personnes, des unions et des filiations comme le ferait le filtre donne exactement les mêmes réponses, sur tous les accesseurs publics et sur les liens, qu'un arbre où ces objets n'ont jamais été saisis.
   - Une union ou une filiation qui cite une personne absente est ignorée ; l'union d'origine d'une filiation est retirée si cette union est absente.
   - **Rangs renumérotés** : le rang d'une union pour une personne est sa place (1, 2, 3…) parmi les unions de cette personne présentes dans le graphe, triées par rang saisi puis par identifiant. Un rang 3 sans rang 2 trahirait un foyer masqué ; la projection de la base locale du téléphone (T-016, T-052) doit renuméroter de la même façon partout où un rang est montré.
   - Un parent candidat n'est gardé que si une union présente le relie à un parent présent de l'enfant (« mère parmi ses épouses » révélerait sinon une union masquée).
   - A ou B absent, ou aucun chemin : une seule réponse, `none` (« Lien non disponible », sans autre indice, PAR-09, CL-SEC-02).
7. **Garde-fous** (relecture relecteur-code) :
   - Les montées sont élaguées par recoupement des ensembles d'ancêtres (en cache dans le graphe) : on ne monte que vers des ancêtres qui mènent à un ancêtre commun aux deux.
   - Puis seulement vers un sommet possible : un ancêtre commun que A et B atteignent par deux montées sans personne commune. Par le théorème de Menger, c'est le cas si et seulement si aucune personne ne se trouve sur toutes leurs montées vers lui, ce que donne l'arbre des dominateurs depuis une racine fictive reliée à A et à B (algorithme de Cooper, Harvey et Kennedy, un passage dans l'ordre topologique). Sous une échelle d'implexe, deux frères ne déclenchent plus de fausse limite. Sur des données corrompues avec un cycle, ce filtre est sauté.
   - Chaque côté a son budget de chaînes (4 096), le sang et chaque recherche d'alliance ont des budgets séparés, et les paires de chaînes sont examinées de la plus proche à la plus lointaine, avec leur propre budget (65 536) ; au plus 32 chemins sont rendus.
   - Une limite atteinte est signalée par `truncated` ; si aucun chemin n'a été trouvé avant, la réponse est `incomplete` (un chemin peut exister), jamais `none`. Les limites ne dépendent que du graphe visible : elles ne révèlent rien d'un objet masqué.
   - Un cycle dans des données corrompues n'arrête pas le calcul. Toutes les limites sont des options.

## Choix laissés à Daniel

- **Groupement selon les types** : deux parents communs ne font des frères (`full`) que si chaque côté les atteint par des filiations de mêmes types. Conséquence : un enfant adopté par le conjoint de son parent (adoption de l'enfant du conjoint) est `half` deux fois (naissance par l'un, adoption par l'autre) avec les autres enfants du couple, et non « frère ». Alternative : grouper tous les types, et laisser T-022 dire « frère (adoptif) ».
- **Limites de l'alliance (degrés 4 et 2)** : au-delà, aucun lien d'alliance n'est proposé. À confirmer avec le jeu de 200 paires (T-023) et les familles pilotes.

## Conséquences

- T-020 (fratrie), T-021 (alliance nommée), T-022 (chemins multiples, non biologiques, certitude), T-026 et T-027 (mots) lisent la structure `Relationship` et le graphe, sans refaire de parcours. T-029 affiche `incomplete` comme il l'entend (par exemple « Lien non trouvé »), distinct de « Lien non disponible ».
- Mesure (poste de développement, Windows 11, Node 24) : graphe de 5 000 personnes en 40 à 120 ms (construit une fois, à l'ouverture de l'arbre) ; sur près de 12 000 paires distinctes, dont 11 000 proches (fratrie, oncles, cousins), 0,16 ms en moyenne et 19 ms au pire, aucune limite atteinte, au plus 13 chemins par paire ; chef de famille à 8 épouses et 40 enfants, 2 ms au pire ; deux lignées de 150 générations, 5 ms au premier appel (cache froid) ; échelle d'implexe de 30 générations : deux frères, réponse complète sans limite atteinte ; deux cousins dans l'échelle (chemins réellement innombrables), 32 chemins en moins d'une seconde, limite signalée. Complétude vérifiée contre une énumération naïve sur 300 graphes tirés au hasard (implexe, plusieurs types de filiation) : mêmes chemins, aucune limite atteinte. Le budget sur l'Android de référence est T-028.

## Écarté

- **Ancêtres communs les plus proches au sens strict** (aucun descendant commun plus proche) : perd le second lien du lévirat et de l'implexe, contraire à UNI-21 et PAR-05.
- **Alliance sans limite de degré** : des centaines de chemins sans intérêt dans un grand arbre, et un temps de calcul non borné.
- **Ne suivre que les filiations de naissance** : « fils adoptif », « l'a élevé », « confié à » doivent apparaître (PAR-06) ; le type de chaque pas les distingue de la naissance.
- **Distinguer « personne absente » de « aucun chemin »** : donnerait un indice sur une fiche masquée.
- **Un budget unique partagé par les deux côtés** : le côté exploré en premier l'épuisait, et B vers A pouvait trouver un lien que A vers B ne trouvait pas.
- **Rangs saisis exposés tels quels** : un trou dans la numérotation trahit une union masquée.
