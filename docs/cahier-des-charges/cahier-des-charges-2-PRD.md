# PRD — Exigences produit

Chaque exigence porte un identifiant, une version (V1 à V4) et un critère d'acceptation vérifiable. Les identifiants sont repris dans les tests automatiques et dans l'onglet Cas limites. Dans l'interface, Lignée vouvoie, comme le veut la charte.

## Principes produit

Quand deux exigences se contredisent, ces dix règles tranchent, dans cet ordre.

1. **Un arbre juste avant un arbre complet.** Une place « à compléter » vaut mieux qu'un lien deviné.
2. **La voix propose, la personne décide.** L'IA comprend la phrase, le code place les personnes, l'utilisateur valide un aperçu. Rien n'est écrit avant « Oui, ajouter ».
3. **Une question seulement quand l'arbre ne tranche pas.** Une à la fois, avec des boutons, et toujours la réponse « Je ne sais pas ».
4. **Toutes les familles ont leur place.** Polygamie, recompositions, adoption, confiage, parents de même sexe, liens incertains : aucun mot ne juge, aucune structure n'est refusée.
5. **Le lien exact, le nom d'usage à côté.** « Demi-frère, même père », et « Ibrahim, mon frère » si c'est ainsi qu'on l'appelle.
6. **Le sensible est privé par défaut.** Santé, paternité, adoption, donneur, unions cachées : chacun voit seulement ce qu'il a le droit de voir, calculs et compteurs compris.
7. **Hors-ligne d'abord, léger toujours.** Tout se consulte et se saisit sans réseau ; une session coûte moins de 1 Mo hors photos et audio.
8. **Pensé pour l'aîné.** Grands caractères, voix partout, aucune action irréversible sans confirmation, aucun délai qui presse.
9. **La famille décide de son arbre.** Rôles, propositions, responsables de branche : Lignée n'arbitre pas les désaccords, elle garde les versions et leurs sources.
10. **Aucune manipulation.** Pas de publicité, pas de revente de données, pas de notification pour faire revenir, pas de fonction de sécurité ou d'accessibilité derrière un paiement.

## Parcours clés

Sept parcours de bout en bout servent de référence pour les tests utilisateurs et les démos de fin de cycle. Chacun cite les personas de l'onglet Cahier des charges.

| Parcours | Étapes | Résultat attendu | Version |
| --- | --- | --- | --- |
| **Premier arbre** (Nadège) | Installer → numéro de téléphone, code reçu par WhatsApp → « Créer l'arbre de la famille Kamga » → se placer comme « Vous » → dicter « Mes parents sont Jean Kamga et Hélène Ngo Biyong, j'ai deux frères, Marc et Simon » → vérifier l'aperçu → « Oui, ajouter » | 10 personnes en moins de 10 minutes, sans clavier | V1 |
| **Dicter une branche polygame** (Tonton Paul) | « Mon père Pierre avait trois femmes : Mama Rose, Mama Odile et Mama Thérèse. Avec Rose, il a eu Jeanne, Marc et moi. Avec Odile, Joseph et Martine… » → aperçu en mini-arbre par foyer → corriger un nom → valider | Trois unions de rang 1 à 3, enfants rangés par foyer, demi-frères calculés | V1 |
| **Inviter la famille au pays** (Nadège, Comfort) | Toucher la fiche de Comfort → « Inviter par WhatsApp » → Comfort installe l'app depuis le lien → « Vous êtes Comfort Kamga ? » → elle confirme et arrive sur sa fiche | Comfort est membre, reliée à sa fiche, sans doublon | V1 |
| **Savoir qui est qui avant des funérailles** (Comfort) | Chercher « Thérèse » → « Qui est-ce pour moi ? » → « Épouse de votre grand-père », chemin surligné → ouvrir son foyer et voir ses enfants | Le lien exact en deux touches, même hors-ligne | V1 |
| **Entretien avec un aîné** (Comfort, Papa Emmanuel) | « Qui parle ? Papa Emmanuel » → enregistrer son récit → transcription → Lignée repère 4 personnes citées → Comfort en valide 2 et en met une dans « À placer » | Le récit est gardé avec sa transcription ; les liens sont calculés depuis Papa Emmanuel | V2 |
| **Noter un antécédent de santé** (Nadège) | Activer le calque santé (accord explicite) → « Mon père avait de l'hypertension » → enregistré en privé → résumé « Hypertension : 2 proches du côté paternel » → PDF pour le médecin | Visible par Nadège seule, jamais dans une notification | V3 |
| **Commander le livre** (Tonton Paul) | Choisir la descendance de Pierre → aperçu page par page → dédicace → payer en mobile money → suivre la livraison | Un livre sans aucune donnée de santé ni fiche privée d'autrui | V3 |

## Compte, arbres et rôles

Un compte s'ouvre avec un numéro de téléphone, appartient à un ou plusieurs arbres, et y a un rôle qui fixe ce qu'il peut faire.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| CPT-01 | Création de compte par numéro de téléphone, code à usage unique envoyé par WhatsApp, SMS en secours | V1 | Code reçu en moins de 30 s dans 95 % des cas ; 5 essais au plus, puis 15 minutes d'attente |
| CPT-02 | Connexion possible aussi par e-mail, Google ou Apple, liés au même compte | V1 | Lier un e-mail à un compte téléphone ne crée pas de second compte |
| CPT-03 | Session longue sur l'appareil ; verrouillage facultatif par le code ou la biométrie du téléphone | V1 | L'app s'ouvre sans réseau sur une session existante ; Lignée ne stocke aucune donnée biométrique |
| CPT-04 | Un compte peut appartenir à plusieurs arbres (sa famille, celle de son conjoint) | V1 | Changer d'arbre en deux touches ; aucune donnée ne passe d'un arbre à l'autre |
| CPT-05 | Créer un arbre : nom de la famille, langue par défaut, ordre d'affichage des noms (Prénom NOM ou NOM Prénom) | V1 | Réglages modifiables par le propriétaire à tout moment |
| CPT-06 | Relier son compte à sa fiche dans l'arbre (« Vous ») ; une fiche n'est reliée qu'à un seul compte | V1 | Relier une fiche déjà reliée est refusé et transmis au propriétaire |
| CPT-07 | Quatre rôles : propriétaire, responsable de branche, membre, lecteur (tableau ci-dessous) | V1 | Chaque droit est vérifié par le serveur ; un test par rôle et par action |
| CPT-08 | Un responsable de branche est désigné sur une personne : il gère cette personne, ses unions et toute sa descendance | V1 | Une proposition dans sa branche lui est envoyée, et à lui seul avec le propriétaire |
| CPT-09 | Transférer la propriété de l'arbre | V1 | Confirmation par l'ancien et le nouveau propriétaire |
| CPT-10 | Mineurs (moins de 18 ans) : compte seulement avec l'accord d'un parent membre de l'arbre, rôle membre ou lecteur | V1 | Accord parental enregistré avec sa date ; aucune donnée de santé saisie par un mineur |
| CPT-11 | Supprimer son compte : le compte disparaît, sa fiche reste dans l'arbre comme mémoire de la famille, sauf demande d'effacement de ses données | V1 | Effacement sous 30 jours ; la fiche devient « Personne vivante, masquée » et garde sa place dans l'arbre |
| CPT-12 | Profil : photo, nom d'usage, langue, taille du texte, mode Aînés | V1 | Changement de langue immédiat, sans redémarrer |
| CPT-13 | Exclure un membre ou bloquer un compte | V1 | Accès retiré à la synchronisation suivante ; ses ajouts restent dans l'arbre |
| CPT-14 | Divorce d'un membre : le propriétaire est prévenu et décide si l'ex-conjoint garde son accès ; les enfants restent reliés à leurs deux parents | V1 | Notification au propriétaire dès qu'une union d'un membre passe à « divorce » |
| CPT-15 | Version web (navigateur) pour la diaspora : consulter l'arbre et saisir, avec les mêmes droits et la même visibilité que dans l'app | V4 | Mêmes réponses de l'API que pour l'app ; rien n'est gardé sur un ordinateur partagé sans l'accord de l'utilisateur |

**Droits par rôle**

| Action | Propriétaire | Responsable de branche | Membre | Lecteur |
| --- | --- | --- | --- | --- |
| Voir l'arbre, selon les réglages de visibilité | Oui | Oui | Oui | Oui |
| Ajouter ou modifier autour de sa fiche et des fiches qu'il a créées | Oui | Oui | Oui | Non |
| Ajouter ou modifier dans la branche d'un autre | Oui | Dans sa branche | Par proposition | Non |
| Valider une proposition | Oui | Dans sa branche | Non | Non |
| Inviter un proche | Oui | Oui | Oui, validé par un responsable | Non |
| Régler la visibilité d'une fiche, d'une union ou d'un lien | Oui | Dans sa branche | Ses fiches | Non |
| Gérer les rôles et exclure un membre | Oui | Non | Non | Non |
| Exporter (GEDCOM, PDF) | Tout l'arbre | Sa branche | Non | Non |
| Supprimer l'arbre | Oui | Non | Non | Non |

## L'arbre : affichage, navigation et recherche

L'arbre se lit en partant de « Vous ». Une personne qui a plusieurs unions simultanées s'affiche au centre de ses foyers : chaque conjoint avec ses enfants, dans l'ordre des rangs.

&#91;embedded content: foyers d'un grand-père polygame · 3 épouses\]

Le foyer de la personne qui regarde est ouvert, les autres sont repliés avec leur nombre d'enfants ; un enfant dont la mère n'est pas précisée reste relié au père seul.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| ARB-01 | Vue centrée sur « Vous » : ascendants au-dessus, descendants en dessous, une génération par rangée | V1 | S'ouvre en moins de 1 s pour 500 personnes sur l'Android de référence |
| ARB-02 | Trois niveaux de zoom : famille proche (photo, nom, années), branche (photo, prénom), vue d'ensemble (points colorés par branche) | V1 | Zoom par pincement sans saccade : 60 images par seconde visées, 30 au minimum |
| ARB-03 | Foyers : une personne qui a plusieurs unions simultanées est au centre, chaque conjoint forme un foyer avec ses enfants, dans l'ordre des rangs ; le foyer de la personne qui regarde est ouvert, les autres sont repliés avec leur nombre d'enfants | V1 | Un homme avec 8 épouses et 40 enfants reste lisible au niveau « branche » (revue visuelle sur l'Android de référence) |
| ARB-04 | Unions successives : de la plus ancienne à la plus récente, l'union en cours la plus proche de la personne | V1 | Ordre correct avec des dates, ou avec un rang saisi à la main |
| ARB-05 | Enfant dont un parent n'est pas précisé : sous le parent connu, dans une zone « mère non précisée » ou « père non précisé » | V1 | Préciser la mère déplace l'enfant dans le bon foyer |
| ARB-06 | Implexe (le même ancêtre par deux chemins) : la personne apparaît une fois, reliée aux deux branches ; si le dessin devient illisible, un renvoi « voir aussi » | V1 | Mariage entre cousins germains : aucune fiche en double |
| ARB-07 | Personne à compléter : cercle en pointillés avec son lien (« Votre père »), qu'on touche pour la compléter | V1 | Compléter le nom transforme la place sans changer ses liens |
| ARB-08 | Liste « À placer » accessible depuis l'arbre, avec un compteur | V1 | Placer une personne propose seulement les positions compatibles avec ce qu'on sait d'elle |
| ARB-09 | Recentrer l'arbre sur n'importe quelle personne, avec un fil d'Ariane pour revenir | V1 | Retour à « Vous » en une touche |
| ARB-10 | Recherche par nom, variante, surnom, nom d'usage, lieu ou année, sans tenir compte des accents ni des fautes courantes | V1 | « Ngo Biyong », « ngo biyon » et « Biyong » trouvent la même personne ; moins de 300 ms hors-ligne pour 5 000 personnes |
| ARB-11 | Filtres : côté paternel ou maternel, vivants ou décédés, foyer, branche | V1 | Les filtres n'affichent jamais une personne masquée |
| ARB-12 | Couleur d'avatar par branche, selon la règle de la charte | V1 | Une branche garde sa couleur sur tous les écrans |
| ARB-13 | L'arbre « pousse » à l'ouverture ; pas d'animation si le téléphone demande de réduire les animations | V1 | Réglage du système respecté sur iOS et Android |
| ARB-14 | Vue « descendance » d'un ancêtre : tous ses descendants, foyer par foyer | V1 | La descendance de Pierre montre ses trois foyers et leurs petits-enfants |
| ARB-15 | Vue « ascendance » en éventail, jusqu'à 7 générations | V2 | Lisible sur un écran de 5 pouces |

## Personnes, unions et filiations

Tout repose sur trois idées : une union est une fiche à part, la filiation se note parent par parent, et une personne peut exister dans l'arbre avant d'être connue. C'est ce qui rend possibles la polygamie, les générations manquantes et les liens incertains.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| UNI-01 | Fiche d'une personne : plusieurs noms (de naissance, d'usage, surnom, titre, variantes d'écriture), genre (femme, homme, autre, non renseigné), naissance, décès, lieux, profession, notes | V1 | Seul un nom, ou « Inconnu », est obligatoire |
| UNI-02 | Personne à compléter : son existence est certaine, son identité inconnue ; créée à la main ou par la voix pour relier deux générations | V1 | Donner son nom remplit la place sans créer de doublon |
| UNI-03 | Fusionner deux fiches (un doublon, ou une personne à compléter enfin identifiée) : liens, unions, médias et sources réunis, avec aperçu et annulation | V1 | Aucun lien perdu sur un jeu de 20 fusions de test |
| UNI-04 | Liste « À placer » : une personne attend avec ce qu'on sait d'elle (« grand-mère de Nora, côté inconnu ») | V1 | Dès qu'un parent de Nora est ajouté, Lignée propose d'y placer la grand-mère |
| UNI-05 | Union entre deux personnes : type (civil, coutumier, religieux, union libre, PACS ou partenariat, non renseigné), début, fin, motif de fin (décès, divorce, séparation, non renseigné), option déclarée à l'état civil (monogamie, polygamie), lieu, notes | V1 | Seules les deux personnes sont obligatoires |
| UNI-06 | Unions simultanées sans limite de nombre, quel que soit le genre des conjoints, sans avertissement ni jugement | V1 | Douze unions simultanées s'enregistrent et s'affichent |
| UNI-07 | Rang propre à chaque conjoint : la même union est la 2e de Moussa et la 1re de Fatou ; ordre modifiable à la main quand les dates manquent | V1 | Changer un rang réordonne les foyers immédiatement |
| UNI-08 | Unions simultanées ou successives : déduit des dates de début et de fin ; sans dates, Lignée pose la question une seule fois | V1 | La réponse est gardée et reste modifiable |
| UNI-09 | Filiation notée parent par parent, avec un type : de naissance, adoptif, « a élevé », confié (confiage, kafala), tuteur, donneur, gestation pour autrui ; un enfant peut cumuler des liens de types différents | V1 | Au plus deux parents « de naissance » ; les autres types sans limite |
| UNI-10 | Certitude de chaque lien : certain, probable ou hypothétique, avec une source facultative | V1 | Un lien probable s'affiche « Peut-être son frère » |
| UNI-11 | Parent non précisé, avec des candidats : « enfant de Moussa, mère parmi ses épouses » | V1 | Choisir la mère plus tard déplace l'enfant dans son foyer |
| UNI-12 | Frères et sœurs dont on ne connaît pas les parents : reliés par des parents à compléter communs | V1 | « Ma sœur Lucienne » sans parents dans l'arbre crée deux places à compléter partagées |
| UNI-13 | Fratrie calculée, jamais saisie : frère (mêmes parents), demi-frère même père, demi-frère même mère, enfant du conjoint d'un parent | V1 | Changer un parent met à jour tous les liens de fratrie |
| UNI-14 | Jumeaux et naissances multiples : même naissance, ordre de naissance facultatif | V1 | « Jumeaux » affiché sur les deux fiches |
| UNI-15 | Décès : date, lieu, cause facultative ; la cause est une donnée de santé, visible par son seul auteur par défaut | V1 | La cause n'apparaît ni dans l'arbre, ni dans une notification, ni dans un export partagé |
| UNI-16 | Une personne sans date de décès et née il y a moins de 100 ans est traitée comme vivante (visibilité protégée) | V1 | Règle appliquée aussi aux imports |
| UNI-17 | Titres et rôles datés : chef, notable, successeur, Fon, Lamido, responsable d'association | V1 | Affichés sous le nom sur la fiche |
| UNI-18 | Contrôles de cohérence : parent plus jeune que son enfant ou âgé de moins de 12 ans à sa naissance, enfant né plus de 10 mois après la mort de son père ou après celle de sa mère, personne qui deviendrait son propre ancêtre | V1 | Alerte expliquée, qu'on peut passer outre ; le cycle est refusé |
| UNI-19 | Historique de chaque fiche : qui a changé quoi, et quand ; retour à une version précédente | V1 | Restaurer une version ne touche pas aux autres fiches |
| UNI-20 | Versions divergentes d'un même fait (deux dates de naissance), chacune avec sa source et son auteur ; une version retenue par défaut | V2 | Les deux versions restent consultables sur la fiche |
| UNI-21 | Lévirat, sororat, mariage entre cousins : aucune règle ne les empêche, le calcul de parenté montre tous les liens | V1 | Un enfant né d'un lévirat apparaît à la fois demi-frère et cousin de ses aînés |
| UNI-22 | Personne trans ou non binaire : prénom et genre actuels affichés, ancien prénom masqué par défaut | V1 | L'ancien prénom n'apparaît que pour qui y a droit, et jamais dans la recherche des autres |

## Saisie vocale

La voix est le premier moyen de saisie. Elle suit toujours le même chemin : transcription, compréhension de la phrase, placement des personnes par le code, questions si besoin, aperçu, validation (voir TRD, Pipeline vocal). Le guide actuel demande « une seule personne par phrase » : cette règle disparaît, le guide sera mis à jour.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| VOX-01 | Bouton micro sur l'arbre, sur chaque fiche et dans la recherche ; toucher pour parler, toucher pour finir | V1 | Accessible en une touche depuis chaque écran principal |
| VOX-02 | Français et anglais, langue détectée seule, mélange accepté dans une même phrase ; noms propres de toutes origines | V1 | Jeu de test de 300 phrases réelles, accents camerounais compris : 90 % de liens corrects |
| VOX-03 | Transcription affichée et corrigeable avant l'analyse ; on peut épeler un nom (« N, G, O ») | V1 | Corriger le texte relance l'analyse sans réenregistrer |
| VOX-04 | Plusieurs personnes et liens par dictée, jusqu'à 15 personnes, y compris une branche polygame entière | V1 | Le parcours « Dicter une branche polygame » passe sans clavier |
| VOX-05 | Aperçu obligatoire : mini-arbre des changements (personnes nouvelles, à compléter, déjà présentes), chaque ligne décochable et modifiable | V1 | Rien n'est écrit avant « Oui, ajouter » |
| VOX-06 | Personne de référence : par défaut celle qui utilise l'app ; « Qui parle ? » permet d'en choisir une autre ; « la sœur de Mamie » change la référence au fil de la phrase | V1 | Sur le téléphone de Comfort, Papa Emmanuel dit « ma sœur » : la sœur créée est la sienne |
| VOX-07 | Générations manquantes : Lignée crée les personnes à compléter nécessaires, après une question sur le côté si besoin | V1 | « Ajoute ma grand-mère Odette » sans parents : une question, une place à compléter, puis Odette |
| VOX-08 | Questions : seulement si l'arbre ne tranche pas, une à la fois, trois au plus par dictée, par boutons ou à la voix ; « Je ne sais pas » crée une place à compléter ou envoie dans « À placer » | V1 | Médiane d'une question par dictée sur le jeu de test |
| VOX-09 | Mots ambigus (belle-mère, beau-frère, neveu, oncle, cousin, parrain) : une question qui propose les sens possibles | V1 | « Ma belle-mère » propose « épouse de votre père » et « mère de votre conjoint » |
| VOX-10 | Mots de la famille (tonton, tantine, Maman Fatou, le vieux, grand frère, même père même mère) : indices pour le lien, gardés comme nom d'usage | V1 | « Mon frère de même père » crée un demi-frère, même père |
| VOX-11 | Doute (« je crois », « peut-être ») : le lien est noté probable | V1 | L'aperçu affiche « Peut-être son frère » |
| VOX-12 | Correction dans la phrase (« non, pas Marc, Marcel ») : seule la dernière version compte | V1 | Aucune fiche « Marc » créée |
| VOX-13 | Doublons : une personne citée qui ressemble à une fiche existante (nom proche, place compatible) est proposée : « Est-ce elle ? » | V1 | 95 % des doublons du jeu de test détectés |
| VOX-14 | Dates floues et calculs : « vers 1940 », « mort à 80 ans en 2010 » (né vers 1930) ; une date relative à un pays (« à l'indépendance ») déclenche une question | V1 | Une date calculée est marquée approximative |
| VOX-15 | Modifier à la voix (nom, date, lieu, décès) : aperçu avant et après | V1 | Annulation possible depuis l'historique |
| VOX-16 | Supprimer : jamais à la voix seule ; la voix ouvre l'écran de suppression | V1 | Aucune suppression sans toucher le bouton « Supprimer » |
| VOX-17 | Questions à l'arbre (« Qui est Ibrahim pour moi ? », « Combien d'enfants avait Pierre ? ») : réponse écrite et lue, limitée à ce que la personne a le droit de voir | V1 | Une personne masquée n'est jamais comptée ni nommée |
| VOX-18 | Hors-ligne : l'audio attend sur le téléphone, il est traité au retour du réseau, et une notification annonce l'aperçu | V1 | Dix dictées faites hors-ligne sont toutes traitées au retour du réseau |
| VOX-19 | Avant la V3, une information de santé dite à voix haute n'est pas gardée, et Lignée le dit | V1 | Aucune donnée de santé enregistrée par la voix en V1 et en V2 |
| VOX-20 | À partir de la V3, une information de santé dite à voix haute va seulement dans le calque santé, après accord | V3 | Jamais dans une fiche partagée |
| VOX-21 | Audio des commandes effacé après traitement ; transcription gardée 30 jours dans l'historique ; jamais utilisée pour entraîner un modèle | V1 | Clause signée avec chaque fournisseur ; purge vérifiée chaque mois |
| VOX-22 | Hors périmètre (animal, célébrité, phrase sans rapport) : réponse polie, rien n'est créé | V1 | Aucune fiche créée sur le jeu de test « hors sujet » |
| VOX-23 | Un membre qui dicte dans la branche d'un autre produit des propositions | V1 | Le responsable de la branche reçoit la proposition |
| VOX-24 | En mode Aînés, réponses et confirmations lues à voix haute par la synthèse vocale du téléphone | V1 | Fonctionne sans réseau |
| VOX-25 | Pidgin et langues locales | V4 | Banc d'essai sur des enregistrements réels avant toute promesse |

## Scan de documents

Les actes, les lettres et le dos des photos portent des noms et des dates que personne n'a le temps de recopier. Le scan les lit et propose les champs, comme la voix : rien n'est écrit sans aperçu.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| SCN-01 | Photographier un document (acte de naissance, de mariage ou de décès, jugement supplétif, livret de famille, lettre, faire-part) avec recadrage automatique | V2 | Recadrage correct sur 9 documents sur 10 du jeu de test |
| SCN-02 | Lecture du texte imprimé ou manuscrit, en français et en anglais ; champs proposés dans un aperçu : noms, dates, lieux, parents, option polygamie ou monogamie d'un acte de mariage | V2 | Aucun champ écrit sans validation |
| SCN-03 | Le document devient la source des faits qu'il prouve | V2 | La fiche affiche « Source : acte de mariage, 1974 » |
| SCN-04 | Pièces d'identité (carte nationale d'identité, passeport) : Lignée les reconnaît, propose de garder seulement les noms et les dates, et ne conserve l'image qu'avec un accord explicite | V2 | Aucun numéro de pièce d'identité enregistré |
| SCN-05 | Dos de photo annoté : le texte est lu et proposé comme légende | V2 | La légende reste modifiable |
| SCN-06 | Prise de vue hors-ligne, lecture au retour du réseau | V2 | Les scans en attente sont listés avec leur état |
| SCN-07 | Un document prend la visibilité de la personne la plus protégée qu'il cite | V2 | Un acte qui cite une personne masquée reste invisible pour qui ne la voit pas |

## Lien de parenté

Lignée dit le lien exact, puis le nom d'usage que chacun donne à ses proches. Dans une famille polygame, l'enfant d'une autre épouse du père est un « demi-frère, même père » ; s'il est appelé « mon frère », ce nom s'affiche à côté.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| PAR-01 | « Qui est-ce pour moi ? » depuis toute fiche : lien exact en français ou en anglais, chemin surligné dans l'arbre | V1 | Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000 personnes |
| PAR-02 | Vocabulaire complet : parents, grands-parents et arrière-grands-parents, oncles et tantes, grands-oncles, neveux, cousins germains et issus de germains, « oncle à la mode de Bretagne », puis le degré civil au-delà (« cousin au 8e degré ») ; liens par alliance (beau-père, belle-sœur, gendre, bru) | V1 | 100 % du jeu de test de 200 paires, en français et en anglais |
| PAR-03 | Fratrie : « frère », « demi-frère, même père », « demi-sœur, même mère » ; tant qu'un parent n'est pas précisé : « frère ou demi-frère » | V1 | Le lien change dès que la mère est précisée |
| PAR-04 | Conjoint d'un parent : « épouse de votre père », « mari de votre mère », jamais « belle-mère » ni « beau-père », qui sont ambigus ; entre épouses d'un même homme : « co-épouse » | V1 | Aucun « belle-mère » affiché pour l'épouse d'un père |
| PAR-05 | Plusieurs chemins (lévirat, sororat, mariage entre cousins) : le lien le plus proche d'abord, les autres dessous (« aussi : cousin par votre père ») | V1 | Les deux liens d'un enfant du lévirat sont affichés |
| PAR-06 | Liens non biologiques signalés : « fils adoptif », « l'a élevé », « confié à » | V1 | Jamais confondus avec un lien de naissance |
| PAR-07 | Nom d'usage : chaque membre peut nommer un proche à sa façon (« Maman Fatou », « Tonton Paul »), pour lui seul ou pour toute la famille ; la voix comprend ces noms | V1 | « Ajoute un souvenir avec Maman Fatou » trouve la bonne fiche |
| PAR-08 | Liens probables signalés : « Peut-être son frère » | V1 | La certitude du lien le plus faible du chemin est affichée |
| PAR-09 | Calcul limité à ce que la personne peut voir : aucun chemin ne passe par une personne, une union ou un lien masqués pour elle | V1 | Avec une fiche masquée sur le seul chemin : « Lien non disponible », sans autre indice |
| PAR-10 | Lien entre deux personnes quelconques, pas seulement depuis soi | V1 | Choisir deux fiches dans la recherche suffit |
| PAR-11 | Accord en genre et en nombre (« cousine », « vos grands-parents »), forme courte et forme expliquée ; en anglais : « half-brother », « first cousin once removed » | V1 | Relu par un locuteur natif anglais avant la sortie |
| PAR-12 | Degré de parenté pour le calque santé (1er, 2e, 3e degré), calculé sur les seuls liens de naissance | V3 | Un demi-frère compte au 2e degré |

## Mémoire

La mémoire, ce sont les voix, les récits, les photos et les recettes des aînés. Elle arrive en V2, une fois l'arbre solide : un récit n'a de valeur que s'il est rattaché aux bonnes personnes.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| MEM-01 | Photo de profil sur chaque fiche, recadrée et compressée | V1 | Moins de 60 Ko par photo de profil |
| MEM-02 | Photos depuis la galerie ou l'appareil photo, compressées avant l'envoi, rangées en albums avec date et lieu ; personnes identifiées à la main sur la photo | V2 | Une photo de 4 Mo part en moins de 400 Ko |
| MEM-03 | Récits audio : jusqu'à 60 minutes, pause et reprise, reprise après une coupure ou un appel entrant | V2 | Aucun enregistrement perdu sur 20 coupures simulées |
| MEM-04 | Transcription des récits en français et en anglais, réécoute synchronisée avec le texte | V2 | Toucher une phrase relance l'audio à cet endroit |
| MEM-05 | « Entretien avec un aîné » : questions guidées (enfance, parents, mariage, village, métier, départs), avec « Qui parle ? » | V2 | Les liens cités sont calculés depuis la personne qui parle |
| MEM-06 | Accord de la personne enregistrée, recueilli à voix haute au début et gardé avec le récit | V2 | Pas d'enregistrement sans cette étape |
| MEM-07 | Personnes, liens et dates repérés dans un récit : proposés dans un aperçu, jamais ajoutés seuls | V2 | Chaque proposition se valide ou se rejette une par une |
| MEM-08 | Récit dans une autre langue (langue locale, chant) : l'audio est gardé, la transcription s'écrit ou se traduit à la main | V2 | Le récit reste écoutable sans transcription |
| MEM-09 | Recettes : ingrédients, étapes, photos, « transmise par » | V2 | Une recette se rattache à une ou plusieurs personnes |
| MEM-10 | Souvenirs écrits ou dictés, rattachés à une ou plusieurs personnes | V2 | Visibles selon la personne la plus protégée qu'ils citent |
| MEM-11 | Chronologie de la famille : naissances, unions, décès, départs, récits, dans l'ordre des dates | V2 | Les dates approximatives sont placées et signalées |
| MEM-12 | Capsules temporelles : texte, audio, photo ou courte vidéo, scellés jusqu'à une date ou un événement (18 ans, mariage), pour des destinataires choisis | V3 | Inaccessibles aux destinataires avant l'ouverture, même sur le serveur |
| MEM-13 | Aucun visage généré ou animé, aucune voix imitée d'une personne | V2 | Aucune fonction de ce type dans l'app |
| MEM-14 | Médias chargés à la demande, vignettes légères, envois repris après une coupure | V2 | Le mode Économie de données ne télécharge que les vignettes |

## Calque santé

Le calque santé note les antécédents de la famille pour en parler avec un médecin. Il ne prédit rien, il reste visible par son seul auteur, et il est chiffré sur le téléphone avant tout envoi. Il arrive en V3, après l'analyse d'impact, l'audit du chiffrement et l'avis juridique.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| SAN-01 | Activation séparée : écran d'explication, accord explicite et révocable, date et version de l'accord gardées | V3 | Aucune donnée de santé possible avant l'accord |
| SAN-02 | Visible par son seul auteur : jamais partagé, jamais dans une notification, un e-mail, un export de l'arbre ou le livre | V3 | Test automatique de non-fuite sur chaque export et chaque notification |
| SAN-03 | Antécédents par personne : affection (liste courante ou texte libre), âge au début, source (« dit par », document), certitude | V3 | Tous les champs sauf l'affection sont facultatifs |
| SAN-04 | Liste courante adaptée : drépanocytose (et statut AS ou SS s'il est connu), hypertension, diabète, AVC, maladies cardiaques, glaucome, cancers (sein, prostate, côlon…), asthme, épilepsie | V3 | Liste relue par un médecin avant la sortie |
| SAN-05 | Résumé par affection et par côté : « Hypertension : 3 proches du côté paternel, dont 1 au 1er degré » ; des comptes, jamais de score | V3 | Aucun pourcentage ni niveau de risque affiché |
| SAN-06 | Sous chaque résumé, la phrase : « C'est une information à évoquer avec votre médecin, pas un diagnostic. » | V3 | Présente sur l'écran et dans le PDF |
| SAN-07 | Résumé pour le médecin : PDF créé sur le téléphone et partagé par l'utilisateur | V3 | Le PDF ne passe jamais par le serveur |
| SAN-08 | Mineurs : aucun antécédent pour un mineur tant que l'autorisation de l'Autorité camerounaise n'est pas obtenue ; ensuite, saisi par un parent seulement | V3 | Saisie bloquée pour une personne de moins de 18 ans |
| SAN-09 | Chiffrement sur le téléphone avant l'envoi : le serveur ne peut pas lire ces données ; une clé de récupération est remise à l'utilisateur | V3 | Audit du chiffrement avant la sortie (porte 3) |
| SAN-10 | Suppression immédiate et totale du calque, sur tous les appareils | V3 | Plus aucune donnée de santé sur le serveur après la suppression |
| SAN-11 | Pas de score de risque, de prédiction ni de conseil médical : le calque constate | V3 | Revue des textes par un médecin |
| SAN-12 | Liens de naissance seulement ; un demi-frère compte au 2e degré | V3 | Un enfant adopté n'entre pas dans les comptes de ses parents adoptifs |
| SAN-13 | Écrans du calque protégés contre les captures sur Android et masqués dans le sélecteur d'apps | V3 | Vérifié sur l'Android de référence et sur iPhone |

## Collaboration

Un arbre se construit à plusieurs. L'invitation passe par WhatsApp, et chaque changement dans la branche d'un autre devient une proposition que son responsable valide.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| COL-01 | Inviter depuis une fiche : lien nominatif partagé par WhatsApp, SMS ou copie, ou QR code pour inviter en personne | V1 | Si l'app n'est pas installée, le lien mène au store puis à l'invitation |
| COL-02 | La personne invitée se reconnaît : « Vous êtes Comfort Kamga ? » ; si ce n'est pas elle, elle le dit et l'invitation est signalée | V1 | Aucun compte relié à une fiche sans confirmation |
| COL-03 | Invitation à usage unique, valable 30 jours, révocable | V1 | Un lien utilisé ou expiré affiche une explication claire |
| COL-04 | Propositions : un ajout ou une modification dans la branche d'un autre devient une proposition ; le responsable accepte, refuse ou commente ; l'auteur est prévenu | V1 | La proposition montre l'avant et l'après |
| COL-05 | Commentaires écrits ou vocaux courts sur une fiche ou une proposition | V1 | Visibles par ceux qui voient la fiche |
| COL-06 | Fil d'activité de l'arbre : qui a ajouté ou modifié quoi | V1 | Ne montre jamais une donnée masquée pour celui qui regarde |
| COL-07 | Conflits après une saisie hors-ligne : deux modifications du même champ, la plus récente gagne et l'autre reste dans l'historique, son auteur prévenu ; deux créations de la même personne, un doublon proposé à la fusion | V1 | Aucune saisie perdue sur le scénario de test à deux téléphones |
| COL-08 | Désaccord sur un fait : chacun ajoute sa version avec sa source (voir UNI-20) | V2 | Le responsable choisit la version retenue par défaut |
| COL-09 | Annonces de famille : naissance, mariage, décès, programme des obsèques, envoyées aux membres concernés | V3 | Formulation sobre pour un décès, aucune animation |
| COL-10 | Familles alliées : deux arbres reliés par un mariage, chaque famille garde la main sur le sien | V4 | Aucune donnée ne passe d'un arbre à l'autre sans accord des deux propriétaires |
| COL-11 | Tableau de bord du propriétaire : personnes, membres, propositions en attente | V1 | Mis à jour à chaque synchronisation |
| COL-12 | Saisir pour un proche sans smartphone, avec son accord, tracé dans l'historique (« saisi par Comfort pour Papa Emmanuel ») | V1 | L'historique indique les deux noms |
| COL-13 | Statistiques et rapports de la famille : générations, dispersion géographique, longévité, sans aucune donnée de santé | V4 | Calculés seulement sur ce que la personne peut voir |

## Confidentialité et visibilité

Chacun voit seulement ce qu'il a le droit de voir, et cela vaut aussi pour les calculs : un lien de parenté, un compteur ou un résultat de recherche ne doit jamais trahir une donnée masquée. C'est la condition pour que les familles y mettent leurs secrets, comme un second foyer ou une paternité non officielle.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| CON-01 | L'arbre n'est jamais public : seuls les membres invités y accèdent | V1 | Aucune page publique, aucun référencement par les moteurs de recherche |
| CON-02 | Niveaux de visibilité : tout l'arbre, une branche, des personnes choisies, moi seul | V1 | Chaque niveau vérifié par le serveur |
| CON-03 | Visibilité réglable par personne, par union, par lien de filiation et par fait (cause de décès, ancien prénom) | V1 | Masquer une union cache aussi le foyer qu'elle forme |
| CON-04 | Valeurs par défaut protectrices : personne vivante visible des seuls membres de l'arbre, et absente des exports partagés et du livre sans son accord ; liens de donneur, de gestation pour autrui, d'adoption et de paternité non officielle proposés « moi seul » à la création | V1 | Le choix est affiché dans l'aperçu avant validation |
| CON-05 | Masquage cohérent : une donnée masquée n'apparaît ni dans l'arbre, ni dans la recherche, ni dans le calcul de parenté, ni dans les compteurs (« + 4 enfants » devient « + 3 ») | V1 | Test automatique de non-fuite sur chaque écran et chaque réponse de l'API |
| CON-06 | « Voir comme » : le propriétaire voit l'arbre tel qu'un membre donné le voit | V1 | Même résultat que sur le téléphone de ce membre |
| CON-07 | Une personne vivante, même non membre, peut demander le masquage ou l'effacement de ses données par un formulaire | V1 | Réponse sous 30 jours ; la place dans l'arbre est gardée sans les données |
| CON-08 | Personnes décédées : leurs proches peuvent demander une mise à jour ou un masquage | V1 | Demande traitée par le propriétaire de l'arbre, puis par le support |
| CON-09 | Export de ses propres données | V1 | Archive complète disponible en moins de 24 h |
| CON-10 | Mode discret : notifications sans contenu, aperçu masqué dans le sélecteur d'apps | V1 | Aucun nom visible sur l'écran verrouillé |
| CON-11 | Journal des accès aux données sensibles, consultable par la personne concernée | V3 | Chaque lecture d'une donnée sensible y figure |
| CON-12 | Pas de reconnaissance faciale ni de donnée biométrique | V1 | Aucune bibliothèque de reconnaissance faciale dans l'app |
| CON-13 | Pas de champ « ethnie » ni « religion » ; la carte des origines est réservée aux membres et désactivable, car l'origine régionale est une donnée sensible au Cameroun | V1 | Le propriétaire peut couper la carte pour tout l'arbre |

## Rappels et notifications

Une notification doit rendre service, jamais faire revenir. Elle ne contient jamais de donnée sensible, et un décès change aussitôt le ton des rappels.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| NOT-01 | Anniversaires des proches vivants, choisis par chaque membre, le jour même à 8 h | V1 | Heure locale du membre, pas celle du serveur |
| NOT-02 | Commémorations des défunts (date du décès, anniversaire de naissance), seulement si le membre les active, avec une formulation sobre | V1 | Désactivées par défaut |
| NOT-03 | Propositions à valider, invitation acceptée, nouveau membre | V1 | Une notification mène directement à l'écran concerné |
| NOT-04 | Résumé de la semaine, facultatif : « Tante Awa a ajouté 12 personnes » | V1 | Le premier nom vient d'abord, l'action ensuite |
| NOT-05 | Jamais de donnée de santé, de lien sensible ni de cause de décès dans une notification ; contenu masqué en mode discret | V1 | Test automatique sur tous les modèles de notification |
| NOT-06 | Réglages par type et heures calmes | V1 | Par défaut, rien entre 21 h et 8 h |
| NOT-07 | Au plus une notification non demandée par jour | V1 | Limite vérifiée côté serveur |
| NOT-08 | Canaux : notifications de l'app, e-mail facultatif ; WhatsApp réservé aux codes de connexion et aux invitations | V1 | Aucun message WhatsApp promotionnel |
| NOT-09 | Dès qu'un décès est enregistré, plus aucun rappel d'anniversaire pour cette personne | V1 | Les rappels déjà programmés sont annulés |

## Carte et origines

La carte montre d'où vient la famille et comment elle s'est dispersée. Comme l'origine régionale est une donnée sensible au Cameroun, elle reste réservée aux membres et le propriétaire peut la couper.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| CAR-01 | Lieux saisis en texte libre, avec des suggestions tirées des lieux déjà dans l'arbre ; Lignée ne demande jamais la position du téléphone | V1 | Aucune permission de localisation demandée |
| CAR-02 | Lieux de naissance, de vie et de décès sur une carte, génération par génération | V2 | Un filtre par génération |
| CAR-03 | Village absent des cartes : placé à la main ou laissé en texte | V2 | Un lieu sans position apparaît dans une liste à côté de la carte |
| CAR-04 | Anciens noms de lieux : nom d'époque et nom actuel (Victoria, aujourd'hui Limbé) | V2 | La recherche trouve les deux noms |
| CAR-05 | Départs et migrations : trajets d'une génération à l'autre (village, ville, étranger) | V2 | Trajets calculés à partir des lieux de naissance et de vie |
| CAR-06 | Carte réservée aux membres, désactivable par le propriétaire pour tout l'arbre | V2 | Carte coupée : aucune donnée de lieu agrégée n'est calculée |
| CAR-07 | Fonds de carte légers, mis en cache, chargés seulement à l'ouverture de la carte | V2 | Moins de 2 Mo à la première ouverture |

## Livre de famille imprimé

Le livre transforme l'arbre et les récits en un objet qu'on offre et qu'on garde. C'est un bien physique : il peut se payer en mobile money directement dans l'app, hors des achats intégrés des stores.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| LIV-01 | Choisir le contenu : une branche, la descendance d'un ancêtre, des récits, des photos, des recettes | V3 | Le nombre de pages et le prix s'affichent avant le paiement |
| LIV-02 | Mise en page automatique selon la charte (couverture forêt et or, Fraunces Lignee, Instrument Sans), aperçu page par page | V3 | Aucune page coupée ni photo déformée sur le jeu de test |
| LIV-03 | Exclusion automatique des données de santé, des données masquées pour l'acheteur et des personnes vivantes qui ont refusé d'y figurer | V3 | Contrôle automatique avant l'envoi à l'imprimeur |
| LIV-04 | Dédicace, titre et photo de couverture au choix | V3 | Aperçu fidèle à l'impression |
| LIV-05 | Paiement en mobile money (Orange Money, MTN MoMo) ou par carte, dans l'app, hors achats intégrés | V3 | Paiement confirmé par le serveur, jamais par le téléphone seul |
| LIV-06 | Livraison au Cameroun et en France, avec suivi de commande | V3 | Chaque étape notifiée |
| LIV-07 | Version PDF du livre offerte avec l'impression | V3 | Disponible dès la validation de la commande |
| LIV-08 | Épreuve couleur validée avec l'imprimeur avant le premier tirage, comme le demande la charte | V3 | Épreuve conservée comme référence |

## Import, export, sauvegarde et « Après moi »

La famille doit pouvoir partir avec son arbre, en faire venir un déjà construit ailleurs, et le transmettre quand son propriétaire disparaît.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| EXP-01 | Export de toutes ses données : un fichier JSON lisible et les médias | V1 | Archive complète en moins de 24 h |
| EXP-02 | Sauvegarde automatique côté serveur ; restauration d'une fiche ou de tout l'arbre à une date donnée | V1 | Restauration testée chaque mois |
| EXP-03 | Import GEDCOM 5.5.1 et 7.0, avec un rapport avant validation (personnes, unions, erreurs) ; les unions multiples et la polygamie sont conservées | V2 | Aller-retour avec Geneanet et Heredis sans perte d'union |
| EXP-04 | Export GEDCOM de l'arbre ou d'une branche, selon les droits et la visibilité | V2 | Aucune donnée masquée pour l'exportateur dans le fichier |
| EXP-05 | Export PDF de l'arbre en A4 ou A3 | V2 | Lisible imprimé en A4 jusqu'à 4 générations |
| EXP-06 | « Après moi » : désigner un successeur qui reprendra l'arbre et recevra les capsules qui lui sont destinées ; déclenché après 12 mois d'inactivité et une vérification | V3 | Le titulaire est prévenu trois fois avant le transfert |
| EXP-07 | Compte d'un membre décédé : figé en mémoire, ses contributions restent, son successeur gère ses réglages | V3 | Plus aucune notification envoyée à ce compte |

## Accessibilité, mode Aînés et langues

Lignée doit se lire et se toucher sans effort à 90 ans, en français comme en anglais. Les seuils viennent de la charte (section Accessibilité et mode Aînés).

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| ACC-01 | Seuils de la charte : texte à 4,5:1 de contraste, éléments graphiques à 3:1, zones touchables de 48 × 48, texte agrandi jusqu'à 200 % sans troncature | V1 | Audit d'accessibilité avant la bêta |
| ACC-02 | Lecteur d'écran (TalkBack, VoiceOver) : un libellé complet pour chaque élément (« Claire Martin, votre mère, née en 1968 ») | V1 | Le parcours « Premier arbre » se fait entièrement au lecteur d'écran |
| ACC-03 | Mode Aînés : texte × 1,3, zones de 56, trois actions à l'accueil (voir l'arbre, raconter, regarder les photos), confirmations qui restent affichées, micro partout | V1 | Testé avec trois personnes de plus de 70 ans avant la bêta publique |
| ACC-04 | Interface en français et en anglais, langue changeable à tout moment ; dates et nombres au format de la langue | V1 | Aucun texte écrit en dur dans le code |
| ACC-05 | Ton : vouvoiement en français, anglais simple et chaleureux, vocabulaire de la charte | V1 | Chaque texte relu par un locuteur natif |
| ACC-06 | Chaque geste a son équivalent en bouton (zoom de l'arbre par boutons + et −, par exemple) | V1 | Tout l'arbre se parcourt sans pincer ni glisser |
| ACC-07 | Pidgin et langues locales dans l'interface | V4 | Traductions faites et relues par des locuteurs |

## Hors-ligne et économie de données

Au Cameroun, le réseau tombe et la data se paie : Lignée fonctionne d'abord sur le téléphone, et le réseau ne sert qu'à synchroniser.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| HOL-01 | Tout le texte de l'arbre est disponible hors-ligne : consulter, chercher, ajouter, modifier sans réseau | V1 | En mode avion, les parcours de la V1 passent ; seuls les invitations et l'analyse de la voix attendent le réseau |
| HOL-02 | Synchronisation automatique au retour du réseau, en arrière-plan, avec un indicateur discret (« 3 changements en attente ») | V1 | Aucune action demandée à l'utilisateur |
| HOL-03 | Aucune perte de données après une longue période hors-ligne | V1 | 7 jours hors-ligne sur deux téléphones, puis synchronisation : test automatisé à chaque version |
| HOL-04 | Mode « Économie de données » : vignettes seulement, médias en Wi-Fi seulement, aucune lecture automatique ; proposé au premier lancement | V1 | Activable et désactivable en une touche |
| HOL-05 | Budget : moins de 1 Mo par session hors médias ; première synchronisation d'un arbre de 1 000 personnes en moins de 2 Mo | V1 | Mesuré à chaque build en intégration continue |
| HOL-06 | Moins de 40 Mo à l'installation sur Android | V1 | Mesuré sur le paquet publié par le Play Store |
| HOL-07 | Envois interrompus (photos, audio) repris là où ils se sont arrêtés | V1 | Un audio de 20 minutes envoyé malgré trois coupures |
| HOL-08 | Sur un réseau 2G ou 3G, aucune action ne bloque l'interface ; les attentes sont expliquées | V1 | Test avec un réseau simulé à 50 kbit/s |

## Offres et paiement

Lignée reste gratuite jusqu'à la V3. Ensuite, les règles des stores décident du canal : un abonnement numérique vendu dans l'app passe par les achats intégrés d'Apple et de Google (par carte seulement au Cameroun), tandis qu'un bien physique comme le livre peut se payer en mobile money. Le payeur de l'abonnement sera souvent un membre de la diaspora.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| PAY-01 | Gratuit jusqu'à la V3 : arbre, voix, collaboration, export de ses données | V1 | Aucun écran de paiement avant la V3 |
| PAY-02 | Quotas de voix par famille pour maîtriser les coûts (par exemple 200 dictées par mois), annoncés avant d'être atteints | V1 | Alerte à 80 % du quota ; le clavier reste toujours disponible |
| PAY-03 | Abonnement famille : un seul payeur, toute la famille en profite (récits illimités, stockage étendu, livre à prix réduit ; contenu exact à décider) | V3 | Tous les membres de l'arbre voient l'abonnement actif |
| PAY-04 | Dans l'app, l'abonnement passe par les achats intégrés (règle 3.1.1 d'Apple, politique de paiement de Google Play) | V3 | Validation des reçus côté serveur |
| PAY-05 | Sur le site web, l'abonnement se paie en mobile money ; l'app le reconnaît mais n'oriente jamais vers le site, et l'abonnement reste aussi achetable dans l'app (règles 3.1.3 et 3.1.3(b) d'Apple, politique de Google Play) ; on peut en parler hors de l'app, par e-mail ou WhatsApp | V3 | Revue des règles des stores juste avant la sortie |
| PAY-06 | Livre : mobile money ou carte, dans l'app, hors achats intégrés (règle 3.1.3(e) d'Apple ; biens physiques exclus de Google Play Billing) | V3 | Paiement confirmé par le serveur après le retour signé de l'agrégateur |
| PAY-07 | Prix affichés en FCFA et en euros ; reçus par e-mail ou WhatsApp | V3 | Reçu envoyé dans la minute |
| PAY-08 | Aucune fonction de sécurité, de confidentialité ou d'accessibilité derrière un paiement | V1 | Mode Aînés, export de ses données et réglages de visibilité gratuits pour toujours |

## Administration, support et modération

L'équipe de Lignée ne lit pas les arbres. Elle gère les comptes, les signalements et les demandes des personnes, avec une trace de chaque accès.

| ID | Exigence | Version | Critère d'acceptation |
| --- | --- | --- | --- |
| ADM-01 | Console interne : comptes, arbres (métadonnées seulement), signalements, quotas | V1 | Aucun accès au contenu d'un arbre sans demande écrite du propriétaire, tracée |
| ADM-02 | Signaler un contenu ou un membre depuis l'app | V1 | Réponse sous 72 h |
| ADM-03 | Aide intégrée (le guide), contact par WhatsApp et par e-mail | V1 | Réponse sous 72 h |
| ADM-04 | Demandes d'accès, de rectification, d'effacement et d'opposition | V1 | Traitées sous 30 jours et journalisées |
| ADM-05 | Mesure d'usage anonyme (aucun nom, aucun contenu), avec l'accord de l'utilisateur | V1 | Refuser la mesure ne change rien au fonctionnement |
| ADM-06 | Procédure d'incident : notification sans délai de l'Autorité camerounaise et des personnes concernées ; de la CNIL sous 72 heures si le RGPD s'applique | V1 | Un exercice d'incident par an |
| ADM-07 | Contenus interdits (haine, harcèlement, exposition d'un enfant, usurpation) : retrait et exclusion | V1 | Règles publiées dans les conditions d'utilisation |
| ADM-08 | Conditions d'utilisation et politique de confidentialité en français et en anglais, écrites simplement | V1 | Validées par le juriste avant la bêta |
