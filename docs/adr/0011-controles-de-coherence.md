# 0011 — Contrôles de cohérence : seuils, marges et cas non écrits

Date : 16 octobre 2026 · Statut : proposée (T-007)

## Contexte

Le PRD fixe les contrôles de cohérence (UNI-18) : « parent plus jeune que son enfant ou âgé de moins de 12 ans à sa naissance, enfant né plus de 10 mois après la mort de son père ou après celle de sa mère, personne qui deviendrait son propre ancêtre » ; « Alerte expliquée, qu'on peut passer outre ; le cycle est refusé ». UNI-09 : « Au plus deux parents « de naissance » ; les autres types sans limite ». UNI-16 et le TRD : « Présumée vivante » calculée : « née il y a moins de 100 ans et sans décès ». Le TRD (synchronisation) refuse les mutations qui violent un invariant : « deux conjoints par union, au plus deux parents de naissance, aucun cycle ».

Le cahier ne dit pas : comment juger une date floue, à quels types de lien s'appliquent les contrôles d'âge et de décès, quoi faire d'un âge invraisemblable (relevé à la relecture de T-005 : `birthDateFromAge` accepte 150 ans), ni ce que vaut « présumée vivante » quand la naissance est inconnue. ADR 0009 (point 5) laisse à T-007 la marge des dates « vers » et « calculée ». Le code est `packages/domain/src/coherence.ts` et `vital-status.ts`.

## Décision proposée

1. **Deux sévérités, des codes stables.** Un constat porte un code (`coherenceCodeSchema`), une sévérité qui ne dépend que du code, et les objets en cause, ordonnés pour l'explication ; aucun texte (les mots viennent de `packages/i18n`). Refus : `third_birth_parent`, `filiation_cycle`, `union_with_self`. Alertes qu'on peut passer outre : `parent_younger_than_child`, `parent_too_young`, `born_long_after_father_death`, `born_after_mother_death`, et les deux du point 6.
2. **Une alerte seulement quand elle est certaine.** Chaque date est lue comme une étendue (premier et dernier jour possibles, `fuzzyDateSpan`) ; l'alerte part si la règle est enfreinte pour tous les jours possibles. Un texte libre ou une date hégirienne ne déclenche rien ; « avant » et « après » sont ouverts d'un côté. Plusieurs faits de naissance (versions, V2) : l'étendue qui les réunit.
3. **Marges des dates approximatives**, ajoutées de chaque côté de l'étendue nominale : « vers » 5 ans (« vers 1940 » : 1935 à 1945) ; « vers » à la décennie 10 ans ; « calculée » 2 ans (le calcul depuis un âge a déjà un an d'incertitude, et l'âge dit est souvent arrondi). « Exacte », « entre », « avant », « après » : aucune marge. Ces marges servent aussi à « présumée vivante » et à la déduction de la simultanéité (ADR 0012).
4. **Seuils** : moins de 12 ans à la naissance (strictement : 12 ans tout juste ne déclenche rien) ; plus de 10 mois après la mort du père, en mois du calendrier (né le 14 janvier après une mort le 14 mars : rien ; le 15 : l'alerte) ; après la mort de la mère, dès le lendemain.
5. **Types de lien concernés.**
   - « Plus jeune que l'enfant » : naissance, donneur, gestation pour autrui, adoption. Pas « a élevé », confié, tuteur : un aîné peut élever un cadet ou être son tuteur.
   - « Moins de 12 ans » : liens biologiques seulement (naissance, donneur, gestation pour autrui).
   - Décès : gestation pour autrui, règle de la mère (la personne qui porte l'enfant) ; lien de naissance d'une personne de genre « femme », règle de la mère, sauf si l'enfant a aussi un lien de gestation pour autrui (embryon porté par une autre) ; tout autre parent de naissance (homme, autre, non renseigné), règle des 10 mois, la plus large quand le genre ne dit pas qui a porté l'enfant. Donneur (gamètes conservés), adoption et autres liens : aucune.
6. **Contrôles ajoutés au cahier**, en alertes : `death_before_birth` (décès certainement avant la naissance) ; `implausible_age` : plus de 120 ans révolus, la même limite partout (121 ans révolus au décès, dite vivante et âgée de 121 ans révolus au jour donné, ou âge dit de 121 ans ou plus avec `checkStatedAge` ; un âge dit négatif aussi). 120 ans couvre les doyens connus ; au-delà, c'est presque toujours une erreur de saisie ou de calcul.
7. **Cycle** : tous types de lien confondus (on ne peut être ni l'adoptant ni le tuteur de son ancêtre). Le refus donne le chemin (personne, lien, personne… lien qui revient). Un lien d'une personne vers elle-même est un cycle.
8. **Troisième parent de naissance** : compté en parents distincts (le même parent saisi deux fois n'en fait pas un troisième) ; une place « à compléter » compte comme un parent. Le refus propose les six autres types de lien (CL-DON-11).
9. **Passer outre** : la clé d'un constat (`coherenceIssueKey` : code et objets) permet de garder qu'on a passé outre et de ne plus reposer la même alerte tant que les mêmes objets sont en cause. Où la garder (sur le téléphone ou dans le modèle) reste à décider avec l'écran de saisie (T-031, T-033). Si elle est synchronisée, elle n'est envoyée qu'à un lecteur qui voit tous ses objets ; sinon elle reste sur le téléphone qui l'a créée.
10. **Présumée vivante** (UNI-16), dans cet ordre : statut saisi « vivante » ; statut saisi « décédée » ; un fait de décès enregistré (`death`, même sans date) ; sinon présumée vivante, sauf si elle est certainement née il y a 100 ans ou plus (100 ans tout juste au jour donné : plus présumée vivante). **Naissance inconnue, en texte libre ou « après » : présumée vivante.** Une cause de décès seule (`death_cause`) ne compte pas : c'est une donnée de santé visible de son seul auteur, et le calcul se fait aussi sur le serveur ; elle ne doit pas lever la protection d'une personne vivante pour les autres. Une cause saisie sans décès se traite à la saisie : proposer d'ajouter le décès (T-031). Le jour de référence est un paramètre, jamais l'horloge. Seul le booléen `presumedLiving` peut être envoyé au client (T-052), jamais la raison (`reason`).
11. **Confidentialité.**
    - **Les alertes ne viennent jamais du serveur.** Une alerte (`warning`) se calcule sur le téléphone, sur la copie du lecteur, qui ne contient que ce qu'il voit ; le serveur ne renvoie jamais d'alerte, seulement des refus.
    - **Un refus est un oracle.** Un refus de cycle ou de troisième parent de naissance confirme l'existence d'un lien masqué, même si les objets en cause sont filtrés : refuser « troisième parent » à quelqu'un qui ne voit qu'un parent lui apprend qu'il en existe un deuxième, masqué ; refuser un cycle lui apprend un chemin de descendance qu'il ne voit pas. La décision revient à T-052 et T-060, à relire par gardien-confidentialite ; pistes : quand un objet en cause est invisible pour l'auteur de la mutation, un refus générique indistinguable d'un refus de droits, sans objets ni `suggestedFiliationTypes` qui en découlent ; prévenir un propriétaire qui voit tout ; limiter le nombre de refus par membre (contre les essais répétés) ; option de mise en attente arbitrée (proposition) au lieu du refus. Ces mesures réduisent la fuite, elles ne la suppriment pas : l'invariant reste appliqué, et un refus, même générique, dit qu'un obstacle existe.
    - Des tests de non-fuite sur ces refus sont exigés dans T-060.

## Écarté

- Alerter dès qu'une incohérence est possible (au milieu de l'étendue, ou sans marge) : de fausses alertes sur des dates de mémoire (« vers 1940 »), et des familles qui apprennent à les ignorer.
- Une marge proportionnelle à la date (10 % de l'âge) : difficile à expliquer, sans gain réel.
- Refuser l'âge invraisemblable ou la mère trop jeune : le cahier ne refuse que le cycle ; une erreur de saisie se corrige après coup.
- Naissance inconnue traitée comme « non vivante » : un ancêtre sans date serait protégé à tort, mais l'inverse ferait sortir une personne vivante dans un export partagé. Option ouverte : déduire une naissance plafond des enfants (un parent est né au moins 12 ans avant son enfant) ; non retenue, parce qu'une erreur de date d'un enfant rendrait visible une personne vivante.

## Conséquences

- `packages/i18n` (T-010 et les écrans) traduit chaque code, avec le vouvoiement de la charte ; l'explication s'appuie sur les objets en cause (« Esso serait née après sa fille Kanga »).
- T-031 et T-033 appellent `checkPersonDates` et `checkNewFiliation` à la saisie ; T-060 appelle `checkNewFiliation` et `checkUnion` pour chaque mutation et refuse sur `hasRefusal`.
- T-052 utilise `assessVitalStatuses` (avec le jour du serveur) pour la visibilité protégée et n'envoie au client que `presumedLiving` ; gardien-confidentialite relit le point 10 (naissance inconnue).
- T-031 propose d'ajouter le décès quand une cause de décès est saisie sans lui.
- T-060 refuse sans servir d'oracle (point 11) et le prouve par des tests de non-fuite.
- Les seuils et marges sont des constantes exportées (`MIN_PARENT_AGE_YEARS`, `POSTHUMOUS_BIRTH_MAX_MONTHS`, `MAX_PLAUSIBLE_AGE_YEARS`, `APPROXIMATE_DATE_MARGIN_YEARS`, `PRESUMED_LIVING_YEARS`) ; les changer est une décision, avec mise à jour de cette ADR.
