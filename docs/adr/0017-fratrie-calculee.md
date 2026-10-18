# 0017 — Fratrie calculée : frère, demi-frère, « frère ou demi-frère »

Date : 17 octobre 2026 · Statut : proposée (T-020)

## Contexte

Le PRD veut une fratrie calculée, jamais saisie (UNI-13 : frère, demi-frère même père, demi-frère même mère, enfant du conjoint d'un parent ; « changer un parent met à jour tous les liens de fratrie ») et des mots exacts (PAR-03 : « frère », « demi-frère, même père », « demi-sœur, même mère » ; « frère ou demi-frère » tant qu'un parent n'est pas précisé). Le TRD (« Moteur de parenté », question 1) dit : « deux parents communs font des frères ; un seul, des demi-frères, même père ou même mère ; deux personnes à compléter différentes ne sont jamais supposées identiques, d'où « frère ou demi-frère » ». Sa grammaire de chemins traduit « mon frère de même père » par P[M].C[M], « sans mère commune », et CL-VOI-08 attend alors « demi-frère, même père », puis « frère » après « même père même mère ». CL-FAM-08 demande « parent » quand le mot genré ne convient pas.

Le cahier ne dit pas ce que vaut une place à compléter face à une personne connue, si les parents candidats (UNI-11) ferment la liste, quels types de filiation font une fratrie, ni comment dire le côté quand un enfant a deux mères. T-020 fixe ces règles dans `packages/kinship/src/siblings.ts`, sans mots (T-026, T-027).

## Décision proposée

1. **Calcul direct sur les parents** : la fratrie se lit dans les parents de A et de B du graphe du lecteur (déjà filtré : un parent masqué est un parent jamais saisi, PAR-09), pas dans les chemins. Le résultat s'accorde avec `findRelationships` limité à la naissance : fratrie de naissance si et seulement s'il existe un chemin 1/1 de naissance, « frère » si et seulement si ce chemin est `full` (propriété vérifiée sur des arbres générés).
2. **Base** : si A et B ont un parent commun par la naissance des deux côtés, la fratrie est de naissance (`basis: 'birth'`), sur les seuls parents de naissance ; les autres parents communs (« a élevé » l'un et mis l'autre au monde, adoption…) sont rendus à part (`alsoShared`). Sinon, un parent commun par un autre type fait une fratrie `basis: 'other'` (deux enfants adoptés par le même couple), avec les types de chaque filiation : jamais confondue avec la naissance (PAR-06, mots en T-022). Les règles du point 3 s'y appliquent, l'autre parent de chacun étant pris parmi ses parents du même type que son lien au parent commun (sans candidats, qui ne valent que pour la naissance) : deux enfants adoptés par Anne seule sont « frère ou demi-frère », pas demi-frères par supposition.
3. **Partage** sur la naissance :
   - deux parents communs ou plus : `full` (une même place à compléter partagée compte, UNI-12, CL-GEN-07) ;
   - un seul parent commun, et l'autre parent de chacun est :
     - connu des deux côtés (deux personnes différentes) : `half` ;
     - à compléter d'au moins un côté : `full_or_half`, sauf si la place à compléter est dite distincte de l'autre parent (point 4), auquel cas `half`. Une place à compléter peut se révéler être le parent connu (UNI-02, fusion UNI-03) : « demi-frère » serait une supposition (« un arbre juste avant un arbre complet », principe n° 1 du PRD) ;
     - absent d'un côté, avec ou sans candidats (« mère parmi ses épouses », UNI-11) : `full_or_half`.
   - Le résultat dit l'état de l'autre parent de chacun (`known`, `placeholder`, `unspecified` avec les candidats), pour que l'écran propose de préciser.
4. **Mention « distincte de »** (complément au modèle, `Person.distinctFrom`) : une place à compléter peut porter la liste des personnes qu'elle n'est pas, dites explicitement. « Mon frère de même père » (TRD : P[M].C[M], sans mère commune) crée la mère de Bruno à compléter, dite distincte de la mère du locuteur : « demi-frère, même père » (CL-VOI-08). Règles du schéma : seulement sur une place à compléter, jamais elle-même, sans doublon, au moins une personne. La mention disparaît avec la place quand elle est précisée, même comme une personne de la liste (correction dictée : « en fait, même mère », T-066). Le graphe de parenté n'en garde que les personnes présentes : une mention vers une personne masquée ne laisse aucune trace (PAR-09). Deux places à compléter différentes font des demi-frères si l'une est dite distincte de l'autre.
5. **Candidats** : la liste des candidats n'est pas tenue pour fermée. Un enfant dont la mère est « parmi Rose et Odile » reste « frère ou demi-frère » même d'un enfant d'une troisième épouse : le graphe retire déjà un candidat dont l'union est masquée au lecteur, et une liste raccourcie par le filtre conclurait à tort « demi-frère ».
6. **Côté** (`father`, `mother`, `parent`) : le genre du parent commun ; `parent` si ce genre est autre ou non renseigné, ou si l'un des deux enfants a un autre parent de naissance ou adoptif du même genre (deux mères : « même mère » ne dirait pas laquelle, CL-FAM-08). Le côté est le même vu des deux enfants : si l'un dit « mère » et l'autre « parent », c'est `parent`. `parentSide` donne le côté d'un parent pour un enfant ; le côté d'un lien de sang plus lointain (« cousin par votre père », PAR-05) ira avec le ticket de PAR-05 (T-022).
7. **Enfant du conjoint d'un parent** (`step_sibling`) : aucun parent commun, de quelque type que ce soit, ni l'un parent de l'autre, et un parent de A uni à un parent de B. Chaque passage donne les deux parents, leur côté et les unions (T-021 nomme : « fils de l'épouse de votre père », jamais « demi-frère », CL-FAM-01).
8. **Certitude** : la plus faible des filiations vers les parents communs (PAR-08) ; les mots (« Peut-être son frère ») sont T-022.
9. **Mots proposés pour T-026 et T-027**, utilisés par les scénarios en attendant les dictionnaires : « demi-frère, même parent » / « half-brother, same parent » pour le côté `parent` ; « half-brother, same father », « half-sister, same mother », « brother or half-brother » (TRD), « sister or half-sister » en anglais. À relire par un locuteur natif (PAR-11).
10. **Format des scénarios** (test/scenarios/README.md) : section `a_completer` de l'arbre ; pas de plan `a_completer` (créer une place, avec `distincte_de` facultatif) et `preciser` (une place est en fait telle personne) ; dictées successives (`action.etapes`, `attendu.etapes`, CL-VOI-08) ; partie de couverture `lien` (la structure du lien attendu est vérifiée, les mots restent à T-026 et T-027).

## Choix laissés à Daniel

- **Place à compléter face à une personne connue** (points 3 et 4), tranché par le maître d'œuvre, à valider : `full_or_half` par défaut, `half` seulement avec la mention explicite `distinctFrom`. Écarté : `half` par défaut (une place créée faute d'avoir reconnu la personne connue serait une autre personne), qui supposait ce que l'arbre ne dit pas. Autres formes écartées pour la mention : un attribut de la filiation (« mère différente de celle de X ») qui dépend d'un tiers et ne survit pas à un changement de parent ; un objet « personnes distinctes » à part (nouvelle table, synchronisation et droits pour un seul usage aujourd'hui). Le champ pourra servir à la fusion (UNI-03 : ne pas proposer de fusionner deux personnes dites distinctes).
- **Candidats** (point 5) : liste ouverte. Alternative : liste fermée (« demi-frère » si l'autre parent de B n'est pas parmi les candidats de A), au risque d'une conclusion fausse quand le filtre de visibilité a retiré un candidat.
- **Co-mère adoptive** : deux enfants nés de la même mère et adoptés par sa conjointe ont un seul parent commun par la naissance et pas d'autre parent de naissance : « frère ou demi-frère », la co-mère étant rendue dans `alsoShared`. T-022 peut en faire « frère » ; sinon, compter l'adoption comme la naissance pour l'autre parent.

## Conséquences

- Modèle (`packages/domain`) : champ facultatif `distinctFrom` sur `Person`, vérifié par le schéma et par `treeDataIssues` (référence à une personne existante). L'entrée réduite du graphe (ADR 0010, point 6) comprend désormais ce champ ; le graphe n'en garde que les personnes présentes. Le générateur d'arbres en produit (dont des mentions vers des personnes ensuite masquées), et la propriété « masqué équivaut à jamais saisi » couvre la fratrie.
- **Obligations hors du moteur** (relecture `gardien-confidentialite`), car `distinctFrom` désigne d'autres personnes :
  - le module de droits (T-052) retire de `distinctFrom` les identifiants que le lecteur ne peut pas voir, sur chaque canal : API, synchronisation (T-016), base locale, exports (GEDCOM, PDF), contexte envoyé à la voix ; un test de non-fuite par canal ;
  - à l'écriture, chaque identifiant est validé contre l'ensemble visible du rédacteur, avec la même réponse pour un identifiant inexistant et pour un identifiant masqué ;
  - la voix (T-062, T-066) ne construit `distinctFrom` qu'à partir du graphe visible du locuteur ;
  - la synchronisation filtre aussi ce qui remonte du téléphone (une mention vers une personne que le rédacteur ne voit pas est refusée comme inexistante) ;
  - une mention « distincte de la mère de X » sur la mère à compléter d'un enfant peut être un indice faible d'une paternité ou d'une maternité tenue secrète : à trancher en T-052 (masquer la mention avec la filiation qu'elle accompagne, par exemple).
- **CL-FAM-14** (paternité révélée par un test ADN : nouveau lien de naissance, l'ancien devient « a élevé », « moi seul » proposé) : le changement de type de l'ancien lien doit suivre la visibilité du nouveau. Un lecteur qui ne voit pas le nouveau lien doit continuer à voir l'ancien comme avant ; sinon, voir le père légal passer de « naissance » à « a élevé » (et la fratrie passer de « frère » à « frère ou demi-frère ») révélerait la paternité masquée. À reprendre avec T-052.
- T-021 lit `step_sibling` ; T-022 lit `basis`, `alsoShared`, `filiationTypes` et `certainty` ; T-026 et T-027 traduisent `sharing`, `side` et `toGender` ; l'écran de fiche (T-029, T-031) liste `siblingsOf` et propose de préciser l'autre parent quand il est `unspecified`.
- Chef de famille à 8 épouses et 40 enfants : fratrie complète de chaque enfant en quelques millisecondes sur le poste de développement (budget sur l'Android de référence : T-028).

## Écarté

- **Lire la fratrie dans les chemins de `findRelationships`** : le regroupement par types de l'ADR 0010 ne dit pas l'état de l'autre parent, et le calcul direct est plus simple et plus rapide.
- **Supposer « frère » quand l'autre parent manque d'un côté** : contraire à PAR-03.
- **Côté « mère » pour un enfant de deux mères** : ne dirait pas laquelle (CL-FAM-08).
