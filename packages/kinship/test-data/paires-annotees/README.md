# Jeu de 200 paires annotées (T-023, plan V1)

Jeu de test de PAR-02 (« 100 % du jeu de test de 200 paires, en français et en anglais ») et du TRD (« Moteur de parenté », Tests). Joué par `src/annotated-pairs.test.ts` ; lu et contrôlé par `src/test-support/annotated-pairs.ts`. Arbres générés, ou composés avec des prénoms générés (`generateGivenName`, graine 2300) : jamais une vraie famille.

## Fichiers

- `jeu.yaml` : version, total exact (200) et quota minimal par catégorie.
- `F01-….yaml` à `F10-….yaml` : une famille par fichier (`famille`, `titre`, `origine`, `arbre` au format des scénarios, `test/scenarios/README.md`, et `paires`).
  - `origine: composee` : famille écrite à la main pour une catégorie (F01 à F08).
  - `origine: { generateur: generateTree, graine, taille, commit }` (F09, F10) : arbre tiré de `generateTree` de `@lignee/domain` à graine figée, puis **figé** dans le fichier par `freezeGeneratedFamily` (`src/test-support/generated-family.ts`) : le jeu ne dépend plus du générateur, qui peut changer sans fausser les paires. Seule la structure lue par le moteur est gardée (personnes, places à compléter et « distincte de », unions avec rangs, dates et motif, filiations avec type et certitude, candidats, réponses de simultanéité, décès datés) ; ni noms d'usage, ni lieux, ni type d'union, ni règles de visibilité (tout est visible du lecteur). `src/generated-family.test.ts` vérifie l'outil : la famille figée donne les mêmes liens que l'arbre généré, sur toutes les paires de personnes. Pour tirer une nouvelle famille : `freezeGeneratedFamily(generateTree({ seed, size })).arbre`, écrit en YAML.

## Une paire

```yaml
- id: F03-01 # famille, puis numéro
  de: nugeou # A
  vers: sovee # B
  categorie: levirat_sororat
  masques: [zolae] # facultatif : retirées du graphe du lecteur, comme par le filtre
  pourquoi: '…' # justification : règle du cahier, ADR ou cas limite
  attendu: # `aucun` (« Lien non disponible »), `meme_personne`, ou les liens dans l'ordre
    - chemin: '1/1[zolae]'
      fratrie: { type: birth, partage: half, cote: mother }
      fr: # T-026 : forme courte et forme expliquée (PAR-11)
        court: 'demi-frère, même mère'
        explique: 'fils de votre mère et de Yalom'
      en: à rédiger # T-027
    - chemin: '2/2[kwengim+noe]'
      cote_de: { par: yemui, cote: father }
      cote_vers: { par: yalom, cote: father }
      fr:
        court: 'cousin germain par votre père'
        explique: 'fils de Yalom, frère de votre père'
      en: à rédiger
```

Attendu structurel de chaque lien présenté (`presentRelationships`, ADR 0021), indépendant des mots, comparé **en entier** au calcul (une clé absente vaut « rien ») :

| Clé                    | Contenu                                                                                                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chemin`               | Segments : `2/1[a+b]` pour le sang (générations montées et descendues, ancêtres au sommet triés), `=x` pour une union vers x ; un segment immobile (0/0) n'est pas écrit. Une fratrie réunit ses chemins, séparés par `\|`, dans l'ordre du moteur                                                        |
| `fratrie`              | Seulement pour un chemin de sang 1 et 1 : `type` (`birth`, `birth_and_adoption`, `adoption`, `other`), `partage` (`full`, `half`, `full_or_half`), `cote` (`father`, `mother`, `parent` ; jamais pour `full`)                                                                                             |
| `alliance`             | Seulement pour un chemin par une union : `type` (nature de l'ADR 0020), `simultaneite` (deux conjoints d'une même personne), `autre_parent` (pour chaque passage depuis ou vers l'enfant d'un conjoint, dans l'ordre : son union face à celle avec l'autre parent de l'enfant ; `none` s'il n'y en a pas) |
| `base`                 | Types non biologiques du lien affiché (`adoptive`, `raised`, `fostered`, `guardian`, `donor`, `surrogacy`) ; absent : naissance (PAR-06)                                                                                                                                                                  |
| `certitude`            | `probable` ou `hypothetical` ; absente : certain (PAR-08)                                                                                                                                                                                                                                                 |
| `cote_de`, `cote_vers` | Hors fratrie : parent par lequel monte A (et B, lu de B vers A), son `cote`, et `type` s'il n'est pas de naissance                                                                                                                                                                                        |
| `fr`, `en`             | Mots du lien : `{ court, explique }` (forme courte et forme expliquée, PAR-11), ou « à rédiger » tant que le ticket de la langue ne les a pas écrits (T-027 pour l’anglais). Noms de la forme expliquée : la clé de la personne avec une majuscule, aucun pour une place à compléter ni pour `sans_prenom` |

Non comparés : la fin des unions, leur type, l'état de l'autre parent d'une fratrie. À distance égale, l'ordre des liens suit les identifiants (ADR 0010, point 5) : il dépend de l'ordre des personnes dans le fichier.

## Ce que vérifie le test

- forme : schéma strict ; chaque personne citée existe dans la famille ; segments lisibles, ancêtres triés ; fratrie si et seulement si 1 et 1, alliance si et seulement si une union ; identifiants et paires uniques ; total exact. Des paires mal formées sont refusées (tests dédiés) ;
- quotas : chaque catégorie au moins à son quota, et la table ci-dessous identique à `jeu.yaml` et aux comptes ;
- partie structurelle : 100 % des paires, liens dans l'ordre ; le sens inverse est exactement l'inverse ; retirer le chemin principal d'une paire change sa signature (le jeu voit un lien changé) ;
- mots : français (T-026) : chaque lien écrit, forme courte et forme expliquée, et identique aux mots du dictionnaire (`describeResult` de `src/words.ts`, messages `kinship` de `@lignee/i18n`), 100 % des 264 liens ; anglais : comptés, « à rédiger » accepté, un mot écrit fait échouer le test tant que T-027 n'a pas branché son dictionnaire.
- vocabulaire : chaque forme de base de PAR-02 (ligne directe et collatéraux jusqu'aux issus de germains, petite-nièce, « à la mode de Bretagne », degré civil, fratries, alliances), pour une personne visée homme et femme, une personne de genre « autre » et chaque lien non biologique, reste couverte par au moins une paire (`vocabularyKeys`).

Pour T-027 : remplir chaque `en: à rédiger` par `{ court, explique }`, et brancher le dictionnaire anglais dans le test des mots, comme le français.

Un attendu ne se recopie jamais du moteur sans être relu : une paire dont le calcul change est relue contre les règles (cahier, ADR) avant toute correction du fichier.

## Répartition

Une seule catégorie par paire : sa raison d'être dans le jeu.

| Catégorie                  | Quota | Paires |
| -------------------------- | ----- | ------ |
| `polygamie`                | 30    | 34     |
| `levirat_sororat`          | 20    | 26     |
| `alliance`                 | 28    | 29     |
| `degres_civils`            | 36    | 39     |
| `non_biologique_certitude` | 28    | 33     |
| `implexe`                  | 14    | 16     |
| `places_a_completer`       | 14    | 16     |
| `visibilite`               | 6     | 7      |

Contenu : polygamie (co-épouses par réponse ou par dates, « autre épouse » sans simultanéité établie, demi-frères même père ou même mère, mère parmi les candidates, épouse du père jamais « belle-mère », enfant de l'épouse du père jamais « demi-frère ») ; lévirat et sororat (double lien, demi-frère puis cousin) ; alliance (conjoint, parents du conjoint, gendre et bru, trois sens de « beau-frère », couple remarié, conjoint d'un oncle, limite de l'alliance atteinte puis dépassée) ; degrés civils (ligne directe jusqu'à 5 générations, oncles et grands-oncles, neveux, cousins germains, issus de germains, 4 et 4, 5 et 5, « à la mode de Bretagne », générations décalées, genres non renseigné et « autre », fille, petite-fille, arrière-petits-enfants, petite-nièce) ; liens non biologiques et certitude (adoption, « a élevé », confiage, tutelle, donneur, gestation pour autrui, co-mère adoptive, probable, hypothétique) ; implexe (cousins mariés, union entre générations, doubles cousins) ; places à compléter (partagée, deux places, place face à une personne connue, « distincte de ») ; visibilité (personne masquée, comme jamais saisie). 264 liens au total, 6 paires sans lien, 1 paire « même personne ».
