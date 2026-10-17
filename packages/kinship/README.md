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

Ce qui se branche dessus : fratrie détaillée et « frère ou demi-frère » (T-020, avec la nature des personnes et les parents candidats du graphe), alliance nommée et co-épouse selon la simultanéité des unions (T-021), chemins multiples et liens non biologiques (T-022), mots (T-026, T-027), budget sur le téléphone (T-028).

## Tests

```sh
corepack pnpm --filter @lignee/kinship test
```

- `src/relationships.test.ts` : degrés du TRD, frères et demi-frères, places à compléter jamais confondues, polygamie et co-épouses, lévirat et implexe (tous les chemins, chaque ancêtre une fois), alliance, certitude, types de filiation, personne masquée sur le seul chemin, cycle dans des données corrompues. Arbres écrits au format des scénarios.
- `src/safeguards.test.ts` : échelle d'implexe de 30 générations (frères et demi-frères trouvés, dans les deux sens), chaque limite (`maxChains`, `maxPathChecks`, `maxRelationships`) signalée, `incomplete` au lieu de `none`.
- `src/privacy.test.ts` : union masquée entre deux personnes visibles (réponse et rangs identiques à un arbre où elle n'a jamais existé), objets réduits, union d'origine retirée, parents candidats filtrés, paternité non officielle masquée (PAR-09), unions répétées.
- `src/properties.test.ts` (fast-check, 2 100 arbres générés avec polygamie, lévirat, sororat, implexe, places à compléter) : le lien de B vers A est l'inverse de celui de A vers B, dans le même ordre ; chaque chemin est bien formé, simple et trié ; un ancêtre commun est ancêtre des deux, une seule fois ; ancêtres sans doublon ; aucun chemin ne traverse une personne absente du graphe ; le résultat ne dépend pas de l'ordre des objets ; l'inverse reste exact sous des limites tirées au hasard. La forme d'un chemin est vérifiée par `src/test-support/fixtures.ts`, sans se fier au moteur.
- `src/performance.test.ts` (PAR-01, partie moteur) : arbre type de 5 000 personnes, chef de famille à 8 épouses et 40 enfants, deux lignées de 150 générations : moins de 200 ms par lien (paires d'une personne avec elle-même exclues) ; graphe en moins de 1 s (construit une fois, à l'ouverture de l'arbre). Mesure sur le poste de développement (Windows 11, Node 24), test lancé seul : graphe en 118 ms, lien en 0,53 ms en moyenne, 10,9 ms au pire sur 432 paires ; chef de famille, 2,2 ms au pire ; cas profond, 6,8 ms.
