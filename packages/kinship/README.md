# kinship

Moteur de parenté : graphe, chemins, vocabulaire FR et EN. Agent : moteur-parente.

Paquet pur, à l'identique sur le téléphone (hors-ligne) et sur le serveur : il ne dépend que de `@lignee/domain`. Hors des tests, ESLint (`eslint.config.mjs`, `kinshipSourceRules`, à toute profondeur sous `src/`) interdit tout autre import, tout import relatif qui sort de `src/` (règle locale `lignee/no-relative-import-outside`), les outils de test et les globales de Node ou du réseau ; `tsconfig.src.json` vérifie le code sans types de Node.

## Graphe et lien structurel (T-013)

| Fichier | Contenu |
| --- | --- |
| `graph.ts` | `createKinshipGraph({ people, unions, filiations, parentCandidates? })` : graphe immuable des objets visibles du lecteur, réduits à leur structure (ni notes, ni lieux, ni sources), rangs d'union renumérotés parmi les unions présentes, union d'origine et parents candidats retirés s'ils citent un objet absent. Consultation par identifiant (`person`, `union`, `filiation`, `parentsOf`, `childrenOf`, `unionsOf`, `parentCandidatesOf`) ; `ancestors(id, types?)` : chaque ancêtre une seule fois (implexe), à sa génération la plus proche, mis en cache |
| `kinship.ts` | `findRelationships(graph, a, b, options?)` : tous les chemins de A vers B ; `commonAncestorsOfPaths(graph, a, b)` : sommets des chemins de sang (pas « au sens strict », voir ADR 0010), avec `truncated` |
| `relationship.ts` | Structure du résultat, sans mots ; `invertRelationship`, `relationshipKey` |

Règles (définition d'un chemin, alliance, limites, ordre) : ADR 0010 (proposée).

### Résultat

`findRelationships` rend `same_person`, `none` (aucun chemin, ou personne absente du graphe : « Lien non disponible », sans autre indice), `incomplete` (aucun chemin trouvé avant une limite de calcul : un chemin peut exister) ou `related` avec la liste des chemins, du plus proche au plus lointain, le sang avant l'alliance, et `truncated` si une limite a été atteinte.

Un chemin (`Relationship`) est une suite de segments :

- segment de sang (`BloodSegment`) : `generationsUp` et `generationsDown` (1 et 1 : fratrie ; 2 et 1 : oncle ; 2 et 2 : cousins germains ; 3 et 3 : issus de germains ; 3 et 2 : « à la mode de Bretagne »), `commonAncestors` (avec la filiation de chaque côté), `ascent` et `descent` (filiations traversées, avec type et certitude), `sharing` (`full` : deux parents communs ; `half` : un seul ; `direct_line` ; `same_person` dans une alliance) ;
- union (`UnionLink`) : conjoints, et toutes leurs unions (`unions`, plusieurs si mariés deux fois) avec le rang renuméroté de chacun.

Résumé : `kind` (`blood`, `alliance`), `degree`, `unionCount`, `certainty` (la plus faible du chemin), `filiationTypes`, `unionIds`, `personIds` (pour surligner le chemin).

Ce qui se branche dessus : fratrie détaillée et « frère ou demi-frère » (T-020, `siblings.ts`, ci-dessous), alliance nommée et co-épouse selon la simultanéité des unions (T-021, `alliance.ts`, ci-dessous ; le graphe ne la transporte pas, ADR 0012), chemins multiples et liens non biologiques (T-022), mots (T-026, T-027), budget sur le téléphone (T-028).

## Fratrie (T-020)

| Fichier | Contenu |
| --- | --- |
| `siblings.ts` | `siblingLink(graph, a, b)` : fratrie de A vers B, ou `undefined` ; `siblingsOf(graph, a)` : toute la fratrie de A, triée (UNI-13) ; `invertSiblingLink` ; `parentSide(graph, enfant, parent)` : côté père, mère ou « parent » (CL-FAM-08) |

Règles : ADR 0017 (proposée). Sans mots (T-026, T-027).

- `sibling` : `basis` (`birth`, ou `other` quand les parents communs ne le sont pas par la naissance, PAR-06), `sharing` (`full` : frère ; `half` : demi-frère ; `full_or_half` : « frère ou demi-frère », un seul parent commun et l'autre non précisé, candidats compris, ou une place à compléter que rien ne dit distincte de l'autre parent : `Person.distinctFrom`), `side` du parent commun, état de l'autre parent de chacun (`known`, `placeholder`, `unspecified` avec les candidats), `sharedParents` et `alsoShared` (autres types), genres des deux personnes, `certainty` et `filiationTypes`.
- `step_sibling` : enfant du conjoint d'un parent, aucun parent commun (alliance, nommée par T-021, jamais « demi-frère ») : passages par un parent de chacun et leurs unions.

## Alliance nommée (T-021)

| Fichier | Contenu |
| --- | --- |
| `alliance.ts` | `createAllianceContext({ facts, simultaneityAnswers, people })` : contexte construit une fois par arbre, à partir de l'arbre filtré du lecteur ; `classifyAlliance(graph, chemin, contexte)` : lien par alliance d'un chemin, sans mots |

Règles : ADR 0020 (proposée). `findRelationships(graph, a, b, { allianceContext })` joint à chaque chemin par alliance son champ `alliance` (`AllianceLink`), sans changer les chemins ni leur ordre :

- `kind` : `spouse`, `parent_of_spouse`, `spouse_of_parent` (« épouse de votre père », jamais « belle-mère », PAR-04), `child_of_spouse`, `spouse_of_child` (gendre, bru), `sibling_of_spouse`, `spouse_of_sibling`, `step_sibling` (« fils de l'épouse de votre père », CL-FAM-01), `co_spouse` (seulement si une paire d'unions est établie simultanée, par les dates ou la réponse gardée), `spouse_of_spouse` (« autre épouse de votre mari »), `spouse_of_sibling_of_spouse`, `other` ;
- `crossings` : chaque union traversée, sa fin (`no_end_known`, ou `ended` avec le motif) et le côté enfant (`fromChild`, `toChild` : union du parent simultanée, successive, inconnue avec celle de l'autre parent de l'enfant, ou `none`) ;
- `sharedSpouse` : pour deux conjoints d'une même personne, la simultanéité de chaque paire d'unions (`resolveSimultaneity`).

Sans contexte, seules les dates des unions comptent : jamais de co-épouse supposée. Une union ou une personne masquée n'est jamais lue, même si le contexte en garde une réponse ou un décès.

## Tests

```sh
corepack pnpm --filter @lignee/kinship test
```

- `src/relationships.test.ts` : degrés du TRD, frères et demi-frères, places à compléter jamais confondues, polygamie et co-épouses, lévirat et implexe (tous les chemins, chaque ancêtre une fois), alliance, certitude, types de filiation, personne masquée sur le seul chemin, cycle dans des données corrompues. Arbres écrits au format des scénarios.
- `src/completeness.test.ts` : contre une énumération naïve, sur 300 graphes tirés au hasard (implexe, plusieurs types de filiation), le moteur rend exactement les chemins de sang simples, sommet et générations compris, sans limite atteinte.
- `src/safeguards.test.ts` : échelle d'implexe de 30 générations (frères et demi-frères trouvés, dans les deux sens, sans fausse limite grâce au filtre des sommets par deux montées disjointes ; cousins dans l'échelle, limite réellement atteinte et signalée), chaque limite (`maxChains`, `maxPathChecks`, `maxRelationships`) signalée, `incomplete` au lieu de `none`.
- `src/privacy.test.ts` : union masquée entre deux personnes visibles (réponse et rangs identiques à un arbre où elle n'a jamais existé), objets réduits, union d'origine retirée, parents candidats filtrés, paternité non officielle masquée (PAR-09), unions répétées.
- `src/masking.test.ts` (fast-check, 200 arbres générés) : masqué équivaut à jamais saisi. Des personnes, unions et filiations retirées comme par le filtre donnent les mêmes réponses, sur tous les accesseurs publics, sur les liens sur la fratrie (`siblingsOf`, `siblingLink`) et sur l'alliance nommée (contexte non filtré), qu'un arbre où elles n'ont jamais été saisies (rangs 1, 2, 3… ; mentions `distinctFrom` vers une personne masquée retirées).
- `src/properties.test.ts` (fast-check, 2 100 arbres générés avec polygamie, lévirat, sororat, implexe, places à compléter) : le lien de B vers A est l'inverse de celui de A vers B, dans le même ordre ; chaque chemin est bien formé, simple et trié ; un ancêtre commun est ancêtre des deux, une seule fois ; ancêtres sans doublon ; aucun chemin ne traverse une personne absente du graphe ; le résultat ne dépend pas de l'ordre des objets ; l'inverse reste exact sous des limites tirées au hasard. La forme d'un chemin est vérifiée par `src/test-support/fixtures.ts`, sans se fier au moteur.
- `src/siblings.test.ts` : frère, demi-frère par le père ou la mère, côté « parent », « frère ou demi-frère » (mère non précisée avec candidates, place à compléter face à une autre place ou à une mère connue), « demi-frère » quand la place est dite distincte (`distinctFrom`, mention vers une personne masquée ignorée), lien qui change quand la mère est précisée (PAR-03) ou changée (UNI-13), enfant du conjoint d'un parent, adoption (adoptés par la même personne seule : « frère ou demi-frère ») et « a élevé », filiation masquée avec le père visible (CL-POL-17), certitude, parent masqué (comme jamais saisi), inverse.
- `src/siblings-scenarios.test.ts` : CL-POL-02, CL-POL-03, CL-GEN-07, CL-VOI-08, CL-FAM-08 joués depuis `test/scenarios` ; le lien attendu en mots est ramené à sa structure par `src/test-support/sibling-words.ts` (à remplacer par les dictionnaires de T-026 et T-027).
- `src/siblings-properties.test.ts` (fast-check, arbres générés) : symétrie ; jamais « frère » sans deux parents communs ni avec une place à compléter propre à l'un ; accord avec les chemins 1/1 de naissance ; `siblingsOf` égal à `siblingLink` sur toutes les personnes ; retirer puis préciser un parent donne « frère ou demi-frère », puis « frère » ou « demi-frère ».
- `src/alliance.test.ts` : conjoint et fin de l'union (divorce, séparation, décès, fin sans motif, jamais « en cours » présumé), couple remarié, parent du conjoint et gendre, conjoint d'un parent (simultané, successif, inconnu, sans union avec l'autre parent ; sans règle de genre ; conjoint d'un grand-parent), la mère jamais « épouse de votre père », enfant du conjoint d'un parent jamais demi-frère, beau-frère dans ses trois sens, co-épouse par réponse ou par dates, « autre épouse » sinon, chevauchement en chaîne, sang avant alliance (sororat), union masquée, inverse exact.
- `src/alliance-scenarios.test.ts` : CL-FAM-01 et CL-POL-08 joués depuis `test/scenarios` ; mots ramenés à leur structure par `src/test-support/alliance-words.ts` (à remplacer par T-026 et T-027) ; CL-POL-08 rejoué avec des unions successives puis sans réponse : jamais « co-épouse ».
- `src/alliance-properties.test.ts` (fast-check, arbres générés dont des familles très polygames) : symétrie (co-épouse ↔ co-épouse, conjoint d'un parent ↔ enfant du conjoint…), nature et passages revérifiés sans le moteur, co-épouse si et seulement si `resolveSimultaneity` établit une paire simultanée ; sans dates ni réponses, aucune co-épouse ; union masquée : aucun lien d'alliance, masqué équivaut à jamais saisi même avec réponses et faits masqués laissés dans le contexte.
- `src/performance.test.ts` (PAR-01, partie moteur) : arbre type de 5 000 personnes, chef de famille à 8 épouses et 40 enfants, deux lignées de 150 générations : moins de 200 ms par lien (paires d'une personne avec elle-même exclues) ; graphe en moins de 1 s (construit une fois, à l'ouverture de l'arbre). Mesure sur le poste de développement (Windows 11, Node 24), test lancé seul : graphe en 118 ms, lien en 0,53 ms en moyenne, 10,9 ms au pire sur 432 paires ; chef de famille, 2,2 ms au pire ; cas profond, 5 ms au premier appel (cache froid).
