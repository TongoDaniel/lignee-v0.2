# 0010 — Chemins de parenté : définition, alliance et limites

Date : 16 octobre 2026 · Statut : proposée (T-013)

## Contexte

Le TRD (« Moteur de parenté », question 1) dit ce que le moteur calcule : remonter les filiations depuis A et B jusqu'aux ancêtres communs les plus proches, compter les générations de chaque côté, distinguer frères et demi-frères, ne jamais confondre deux personnes à compléter, passer par les unions pour l'alliance (conjoint, parents du conjoint, conjoint d'un parent, co-épouse), garder tous les chemins du plus proche au plus lointain, le sang avant l'alliance, avec la certitude la plus faible du chemin. Il ne dit pas ce qu'est exactement un « chemin », jusqu'où va l'alliance, ni quels types de filiation sont suivis. Sans règle, un arbre de 5 000 personnes relie presque tout le monde à tout le monde par des alliances lointaines. T-013 fixe ces règles dans `packages/kinship` ; les mots restent à T-026 et T-027.

## Décision proposée

1. **Chemin de sang** : on monte de A par des filiations jusqu'à un ancêtre, puis on descend jusqu'à B, sans passer deux fois par la même personne. Cette seule condition donne les ancêtres communs les plus proches de chaque chemin (les grands-parents de deux frères ne sont atteints qu'en repassant par le parent commun) et garde les chemins supplémentaires de l'implexe et du lévirat (UNI-21 : un enfant du lévirat est demi-frère par sa mère et cousin par les pères).
2. **Frères et demi-frères** : deux chemins qui ne diffèrent que par l'ancêtre au sommet, atteint de chaque côté par des filiations de mêmes types, sont réunis en un seul (`sharing: 'full'`, deux parents communs) ; sinon, un seul ancêtre au sommet (`half`). Un père de naissance commun et une mère qui n'a qu'élevé l'un des deux donnent deux liens « demi » de types différents, jamais un « frère ». Deux personnes à compléter sont deux personnes : seul le moteur de fratrie (T-020) dit « frère ou demi-frère » en lisant leur nature et les parents candidats.
3. **Types de filiation** : tous sont suivis par défaut, et chaque chemin rend les types traversés (`filiationTypes`, PAR-06) et chaque filiation avec son type. Le degré de santé (V3) passe `filiationTypes: ['birth']`.
4. **Alliance** : des segments de sang (éventuellement vides) reliés par une ou deux unions.
   - Une union : degré de sang total au plus 4 (conjoint, beaux-parents et grands-parents du conjoint, frère et sœur du conjoint, conjoint d'un parent, d'un frère, d'un enfant, d'un oncle ou d'un cousin germain, enfant du conjoint d'un parent…).
   - Deux unions : degré de sang total au plus 2 (co-épouse, conjoint du frère du conjoint, conjoint du conjoint d'un parent…).
   - Pas de redondance avec le sang : quand on arrive à X en montant depuis son enfant, puis qu'on passe l'union X–Y, cet enfant ne doit pas être aussi l'enfant de Y (sinon Y est son autre parent, et le chemin n'est que « parent ») ; de même pour l'enfant de Y où l'on descend ensuite. Ainsi la mère n'est jamais aussi « épouse de votre père », ni un demi-frère aussi « fils de l'épouse de votre père » (PAR-04, CL-FAM-01).
   - La simultanéité des unions (co-épouse ou épouse successive) n'est pas décidée ici : la structure donne les unions et les rangs, T-021 lit les dates et la simultanéité dans le graphe.
5. **Ordre** : le sang avant l'alliance ; puis le chemin le plus court (générations et unions), le moins d'unions, le plus équilibré (cousins avant « à la mode de Bretagne »), le plus certain ; à égalité, une clé identique pour un chemin et son inverse. Le lien de B vers A est ainsi exactement l'inverse de celui de A vers B, dans le même ordre (propriété du TRD, vérifiée sur des arbres générés).
6. **Visibilité** : le moteur ne reçoit que des objets visibles. Une union ou une filiation qui cite une personne absente est ignorée. A ou B absent, ou aucun chemin : une seule réponse, `none` (« Lien non disponible », sans autre indice, PAR-09, CL-SEC-02).
7. **Garde-fous** : au plus 32 chemins rendus (les plus proches), au plus 4 096 chaînes explorées par requête ; une limite atteinte est signalée (`truncated`). Un cycle dans des données corrompues n'arrête pas le calcul (chemin simple, parcours d'ancêtres avec ensemble visité). Toutes les limites sont des options.

## Conséquences

- T-020 (fratrie), T-021 (alliance nommée), T-022 (chemins multiples, non biologiques, certitude), T-026 et T-027 (mots) lisent la structure `Relationship` et le graphe, sans refaire de parcours.
- Un lien d'alliance plus lointain que ces limites n'est pas proposé : à revoir avec le jeu de 200 paires (T-023) et les familles pilotes.
- Mesure (poste de développement, Node 24) : graphe de 5 000 personnes en 31 ms, lien en 0,3 ms en moyenne ; sur près de 13 000 paires, dont 12 000 proches (fratrie, oncles, cousins), 9 ms au pire, aucune limite atteinte et au plus 13 chemins par paire ; chef de famille à 8 épouses et 40 enfants, 2 ms au pire. Le budget sur l'Android de référence est T-028.

## Écarté

- **Ancêtres communs les plus proches au sens strict** (aucun descendant commun plus proche) : perd le second lien du lévirat et de l'implexe, contraire à UNI-21 et PAR-05.
- **Alliance sans limite de degré** : des centaines de chemins sans intérêt dans un grand arbre, et un temps de calcul non borné.
- **Ne suivre que les filiations de naissance** : « fils adoptif », « l'a élevé », « confié à » doivent apparaître (PAR-06) ; le type de chaque pas les distingue de la naissance.
- **Distinguer « personne absente » de « aucun chemin »** : donnerait un indice sur une fiche masquée.
