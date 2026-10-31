# Lignée — Cahier des charges

Oct 14, 2026 · @Lein

Lignée est une app mobile qui permet à une famille de construire son arbre à plusieurs, à la voix, en français ou en anglais, et d'y garder sa mémoire et ses antécédents de santé. Elle vise d'abord le Cameroun et l'Afrique francophone, avec leur diaspora : elle doit marcher sur un Android d'entrée de gamme, avec peu de réseau, et accueillir toutes les familles, polygames comprises. Ce cahier fixe le produit (onglet PRD), la technique (onglet TRD) et les scénarios à tester (onglet Cas limites), version par version.

## Contexte et problème

Dans beaucoup de familles camerounaises, l'arbre n'est écrit nulle part. Il est dans la tête des aînés, se transmet à l'oral et se perd un peu à chaque décès. Les familles sont grandes et dispersées : un grand-père à Bafoussam avec trois épouses, des enfants à Douala et à Yaoundé, des petits-enfants à Paris, Bruxelles ou Montréal. Aux funérailles, aux mariages et aux réunions de famille, on ne sait plus qui est qui.

Trois besoins reviennent :

- **Social** : savoir qui est qui, se retrouver entre cousins, ne plus manquer une naissance, un anniversaire ou un décès.
- **Santé** : connaître les antécédents de la famille pour en parler avec un médecin (drépanocytose, hypertension, diabète…).
- **Mémoire** : garder la voix, les récits, les photos et les recettes des aînés tant qu'ils sont là.

Les grands sites de généalogie (Geneanet, MyHeritage, FamilySearch) savent enregistrer plusieurs conjoints. Mais ils sont pensés pour quelqu'un qui travaille à partir d'archives écrites, au clavier, avec une connexion stable et, pour les offres payantes, une carte bancaire. Lignée part des réalités suivantes :

| Réalité | Ce que Lignée doit faire |
| --- | --- |
| La mémoire est orale, souvent chez des aînés qui écrivent peu | Saisie à la voix en français et en anglais, avec un aperçu avant chaque ajout |
| Les familles polygames et étendues sont fréquentes, surtout dans les générations précédentes | Unions simultanées, foyers, rang des épouses, liens exacts (« demi-frère, même père ») |
| Le réseau est irrégulier, la data coûte cher, les téléphones sont modestes | Hors-ligne d'abord, peu de données échangées, Android d'entrée de gamme comme référence |
| On paie surtout en mobile money | Mobile money partout où les règles des stores le permettent |
| Noms et dates ne suivent pas les habitudes européennes | Aucun nom transmis automatiquement, ordre NOM Prénom, dates approximatives |
| Certains liens sont des secrets, certaines unions sont pénalisées | Visibilité réglable par personne, par union et par lien |

## Objectifs et indicateurs

Le but de Lignée : qu'une famille construise un arbre juste, à plusieurs, sans avoir à taper. L'indicateur principal est le nombre de **familles actives** : des arbres où au moins deux membres ont ajouté, confirmé ou consulté quelque chose dans le mois. Les cibles ci-dessous sont des hypothèses de départ, à revoir après la bêta avec les familles pilotes.

| Version | Ce qu'elle doit prouver | Indicateur | Cible de départ |
| --- | --- | --- | --- |
| V1 | Un arbre juste, vite, sans clavier | Nouveaux arbres qui atteignent 10 personnes en 7 jours | 60 % |
| V1 | Un arbre juste, vite, sans clavier | Temps médian pour atteindre 10 personnes | Moins de 10 minutes |
| V1 | La voix comprend juste | Ajouts vocaux validés sans corriger le lien de parenté | 90 % sur le jeu de test, 85 % en usage réel |
| V1 | La voix comprend juste | Questions posées par dictée (médiane) | 1 au plus |
| V1 | La famille s'y retrouve à plusieurs | Arbres avec au moins 3 membres actifs à 30 jours | 35 % |
| V1 | L'app tient sur un petit Android | Taux de plantage perçu (seuil de Google Play : 1,09 %) | Moins de 0,5 % |
| V1 | L'app tient sur un petit Android | Taux d'ANR perçu, l'app qui ne répond plus (seuil de Google Play : 0,47 %) | Moins de 0,2 % |
| V1 | L'app ménage le forfait | Données échangées par session, hors photos et audio | Moins de 1 Mo |
| V2 | La mémoire est gardée | Arbres avec au moins un récit enregistré | 30 % |
| V2 | Les arbres existants entrent sans perte | Imports GEDCOM terminés sans erreur bloquante | 95 % |
| V3 | La santé reste privée | Incidents de confidentialité sur le calque santé | 0 |
| V3 | Lignée couvre ses frais | Revenus mensuels divisés par les coûts d'hébergement et de services | 1 ou plus |

Les indicateurs de la V4 seront fixés à la fin de la V3, avec les chiffres réels. Les seuils de Google Play viennent de la page Android vitals (voir Sources).

## Publics et personas

Lignée s'adresse à toute la famille, mais quatre profils décident de son succès : l'aîné est la source, l'organisatrice lance l'arbre, le responsable de branche le garde juste, la jeune active le fait vivre au quotidien.

| Persona | Situation | Ce qu'elle ou il attend | Ce qui la ou le fait renoncer |
| --- | --- | --- | --- |
| **Nadège, 34 ans, l'organisatrice** | Infirmière à Lyon, née à Douala. Veut reconstituer la famille de son grand-père paternel, polygame, à Bafoussam. iPhone, bonne connexion, peu de temps. | Lancer l'arbre en une soirée, inviter les cousins par WhatsApp, payer pour toute la famille | Devoir tout saisir seule ; un affichage qui mélange les foyers |
| **Papa Emmanuel, 81 ans, l'aîné** | Ancien instituteur près de Bafang. Connaît cinq générations de mémoire. Lit mal de près, utilise le téléphone de son petit-fils. Parle français et sa langue maternelle. | Raconter, être compris, voir les noms bien écrits | Les petits caractères, les questions qui se répètent, devoir écrire |
| **Comfort, 29 ans, la jeune active** | Enseignante à Buea, anglophone. Android d'entrée de gamme, forfait data limité, coupures d'électricité. | Savoir qui est qui avant des funérailles, retrouver des cousins, ne pas oublier un anniversaire | Une app lourde qui vide son forfait ; une interface seulement en français |
| **Tonton Paul, 58 ans, le responsable de branche** | Fonctionnaire à Yaoundé, chef de famille de sa branche. Tient à l'exactitude, au rang des épouses et à la discrétion. | Valider ce que les autres ajoutent, garder certains liens privés | Que n'importe qui modifie sa branche ; qu'un secret de famille devienne visible |

Deux autres publics comptent : les **proches invités** qui consultent sans contribuer, et les **mineurs**, présents dans l'arbre comme personnes mais qui n'ont un compte qu'avec l'accord d'un parent (voir PRD, Compte).

## Périmètre

Lignée est un espace privé par famille. Elle ne cherche pas à relier toute l'humanité, ni à remplacer l'état civil ou le médecin.

**Ce que Lignée fait** (le détail et les versions sont dans l'onglet PRD) :

- Un arbre privé par famille, construit à plusieurs, avec des rôles et des propositions.
- La saisie à la voix (français, anglais), au clavier et par scan de documents.
- Toutes les structures familiales : polygamie, unions successives, familles recomposées, adoption, confiage, parents de même sexe, liens incertains.
- Le lien de parenté exact entre deux personnes, et le nom d'usage que chacun donne à ses proches.
- La mémoire : récits enregistrés, photos, documents, recettes, capsules temporelles ; le parcours de vie de chaque personne, dont elle reste maître, et les événements de famille.
- Un calque santé visible par son seul auteur.
- Les rappels (anniversaires, commémorations), la carte des origines, le livre imprimé, l'import et l'export GEDCOM.
- Le fonctionnement hors-ligne, en français et en anglais.

**Ce que Lignée ne fait pas** :

- Pas d'arbre mondial ouvert à des inconnus, ni de recherche de « cousins » hors de la famille invitée.
- Pas de test ADN.
- Pas de diagnostic, de score de risque ni de conseil médical : le calque santé constate, il ne prédit pas.
- Pas de valeur juridique : Lignée n'établit ni filiation ni droit à succession, et ne remplace pas un acte d'état civil.
- Pas de messagerie instantanée : les échanges restent sur WhatsApp. Lignée a seulement des commentaires sur les fiches et les propositions.
- Pas de collecte d'argent pour la famille (cotisations, tontines, contributions aux obsèques) : c'est une activité de paiement réglementée. Lignée tient seulement le registre des tontines et des cotisations (Caisse de famille, V3) ; l'argent circule hors de l'app.
- Pas de publicité, ni de revente ou d'exploitation commerciale des données.
- Pas de visage généré ou animé par une IA, ni de photo « améliorée » présentée comme authentique.

## Contraintes du marché

Le Cameroun et l'Afrique francophone imposent des contraintes qui changent la conception elle-même, pas seulement la communication.

| Contrainte | Fait | Conséquence pour Lignée |
| --- | --- | --- |
| Téléphones | Android représente 83 % des usages mobiles au Cameroun, iOS 17 % (StatCounter, septembre 2026) | Un Android d'entrée de gamme sert d'appareil de référence pour les tests et les performances ; iOS a les mêmes fonctions |
| Coût de la data | 1 Go coûtait en moyenne 1,63 $ au Cameroun, 140e rang sur 237 pays (cable.co.uk, édition 2023, la plus récente) | Photos compressées et chargées à la demande, audio compressé, mode « Économie de données » |
| Réseau et électricité | Couverture irrégulière hors des villes, coupures fréquentes | Hors-ligne d'abord : tout se consulte et se saisit sans réseau, la synchronisation reprend seule |
| Paiement | Le paiement courant passe par le mobile money (Orange Money, MTN MoMo) ; Google Play n'y propose que la carte bancaire | Abonnement : achats intégrés des stores (le payeur est souvent dans la diaspora) et mobile money sur le site web. Livre imprimé : mobile money dans l'app (voir PRD, Offres et paiement) |
| Coût des SMS | Un SMS vers le Cameroun coûte 0,317 $ chez Twilio ; un message d'authentification WhatsApp coûte 0,0046 $ | Code de connexion envoyé par WhatsApp d'abord, SMS en secours par un agrégateur local |
| Langues | Français et anglais officiels, pidgin, nombreuses langues locales | Interface et voix en français et en anglais dès la V1 ; les récits dans d'autres langues gardés en audio, traduits à la main |
| Noms | Pas de nom de famille transmis systématiquement, ordre NOM Prénom fréquent, préfixes comme Ngo, titres (Chef, Fon, Lamido) | Plusieurs noms par personne, aucun nom recopié automatiquement, ordre d'affichage réglable, titres et rôles |
| Dates | Beaucoup d'aînés n'ont qu'une date de naissance approximative | Dates approximatives, intervalles, « avant » ou « après », texte libre |
| Unions | La polygamie est légale : l'acte de mariage mentionne l'option choisie, polygamie ou monogamie (ordonnance n° 81-02 du 29 juin 1981, art. 49) | Unions simultanées, rang des épouses, option déclarée à l'état civil en champ facultatif |
| Sécurité des personnes | Les relations entre personnes de même sexe sont pénalisées (Code pénal, section 347-1, jusqu'à 5 ans de prison) | Toute union et tout lien peuvent être limités à quelques personnes ; l'arbre n'est jamais public |
| Données personnelles | Loi n° 2024/017 du 23 décembre 2024, applicable depuis le 23 juin 2026 : consentement, autorisation préalable de l'Autorité, données sensibles (santé, origine ethnique ou régionale, vie sexuelle, religion…), autorisation pour tout transfert hors du Cameroun, amendes élevées | Consentement explicite, calque santé isolé, avis juridique avant le lancement (voir TRD, Conformité) |

La diaspora change aussi le cadre juridique. Si la société qui édite Lignée est établie en France, le RGPD s'applique à tous ses traitements, y compris pour les familles au Cameroun. Selon les premières analyses, la loi camerounaise ne vise pas les responsables établis hors du Cameroun, mais l'Autorité pourrait en juger autrement. Le lieu de création de la société se décide donc avec un juriste, avant le lancement public.

## Feuille de route

Lignée se construit en cinq versions. Comme vous n'êtes pas pressés, aucune date n'est fixée : chaque version démarre quand la porte qui la précède est franchie.

&#91;embedded content: feuille de route · 5 versions, 4 portes\]

La V1 porte le cœur du produit, l'arbre construit à la voix ; la santé attend la V3, car elle demande d'abord une analyse d'impact, un chiffrement audité et un avis juridique. Le détail de chaque fonction et de sa version est dans l'onglet PRD.

## Organisation du binôme

Deux développeurs, du temps partiel, pas d'échéance : l'organisation doit rendre chaque heure utile et garder l'arbre juste.

| Rôle | Qui | Périmètre |
| --- | --- | --- |
| Serveur et infrastructure | Daniel | API Hono, base PostgreSQL et Prisma, synchronisation, sécurité, paiement, déploiement |
| App mobile | Second développeur (à confirmer) | Écrans Expo, affichage de l'arbre, accessibilité, hors-ligne côté téléphone |
| Cœur partagé | Les deux | Moteur de parenté et pipeline vocal : chacun doit pouvoir les lire, les tester et les corriger |
| Familles pilotes | Les deux, à tour de rôle | Recrutement, séances de test, retours |

**Outils** : un dépôt GitHub unique (monorepo), les tickets et le tableau GitHub Projects, une pull request relue par l'autre pour chaque changement, GitHub Actions pour les tests et les builds. Chaque décision d'architecture s'écrit dans un fichier court du dossier `docs/adr/` : le contexte, la décision, ce qu'on a écarté. La charte graphique (Design System Lignée et `tokens.ts`) fait référence pour l'interface.

**Rituels**, au rythme d'un travail à temps partiel :

- Un cycle de 4 semaines : un objectif écrit au début, une démo enregistrée à la fin, 15 minutes de rétrospective.
- Un point de 30 minutes chaque semaine.
- À partir de la bêta : une séance par mois avec une famille pilote, de préférence avec un aîné.
- À chaque porte de la feuille de route : une revue de sécurité et de confidentialité.

**Définition de « terminé »**, valable pour chaque fonction :

- Les critères d'acceptation du PRD sont vérifiés et les tests liés à leurs identifiants passent.
- La fonction marche hors-ligne et se synchronise sans perte.
- Elle est testée sur l'Android de référence et sur un iPhone.
- Les textes existent en français et en anglais, avec le vocabulaire de la charte.
- Accessibilité : libellés pour le lecteur d'écran, zones touchables de 48 px, texte agrandi à 200 % sans troncature.
- Le budget de données est respecté.
- L'autre développeur a relu le code, et la documentation du module est à jour.

## Budget de fonctionnement

À 10 000 familles, Lignée coûterait environ 3 300 $ par mois, soit environ 0,33 $ (près de 200 FCFA) par famille et par mois. La voix et les codes de connexion pèsent le plus ; l'hébergement reste marginal. Hypothèses : 10 membres par famille, montants en dollars US arrondis, prix publics relevés en octobre 2026.

| Poste | Hypothèse | Bêta (20 familles) | 1 000 familles | 10 000 familles |
| --- | --- | --- | --- | --- |
| Comptes développeur | Apple : 99 $ par an ; Google Play : 25 $ une fois | 8 $ | 8 $ | 8 $ |
| Serveur et base de données | VPS Contabo : une machine à 4,40 € par mois (engagement de 24 mois) en bêta, deux à quatre ensuite | 5 $ | 25 $ | 100 $ |
| Stockage des médias | Cloudflare R2 : 0,015 $ par Go et par mois, sortie gratuite, 10 Go offerts ; 300 Mo par famille en V2 | 0 $ | 5 $ | 45 $ |
| Voix | 0,003 $ par dictée (transcription et compréhension) ; 20 dictées par membre et par mois en bêta, 5 ensuite | 12 $ | 150 $ | 1 500 $ |
| Récits transcrits (V2) | 0,003 $ par minute ; 30 minutes par famille et par mois | 2 $ | 90 $ | 900 $ |
| Codes de connexion | WhatsApp : 0,0046 $ par message ; 10 % en SMS de secours à 0,317 $ (prix Twilio, à négocier avec un agrégateur local) | 11 $ | 55 $ | 540 $ |
| Builds et mises à jour | Expo EAS : gratuit, puis Starter (19 $), puis Production (199 $) | 0 $ | 19 $ | 199 $ |
| Suivi des erreurs | GlitchTip auto-hébergé, compatible Sentry | 0 $ | 0 $ | 0 $ |
| Domaine et e-mail |  | 2 $ | 2 $ | 2 $ |
| **Total mensuel estimé** |  | **≈ 40 $** | **≈ 355 $** | **≈ 3 300 $** |

Dépenses ponctuelles à chiffrer : un avis juridique (Cameroun et RGPD) avant le lancement, l'analyse d'impact avant la V3, le dépôt de la marque à l'OAPI (Organisation africaine de la propriété intellectuelle, à Yaoundé) et, pour la diaspora, à l'INPI ou à l'EUIPO, ainsi qu'un Android d'entrée de gamme pour les tests. Le coût de la voix baisse si la transcription passe sur un modèle auto-hébergé (voir TRD, Pipeline vocal).

## Risques et parades

Les trois risques les plus lourds touchent la confiance : une voix qui place mal, un secret de famille révélé, une fuite de données sensibles. Chacun a une parade inscrite dans le PRD ou le TRD.

| Risque | Probabilité | Impact | Parade |
| --- | --- | --- | --- |
| La voix comprend mal les noms et les accents camerounais | Moyenne | Fort | Jeu de test de vraies voix avant la bêta ; noms de l'arbre fournis à la transcription ; texte toujours corrigeable ; clavier en secours |
| La voix place une personne au mauvais endroit | Moyenne | Fort | Le code place, pas l'IA ; aperçu obligatoire ; question dès que l'arbre ne tranche pas ; historique et annulation |
| Un secret de famille devient visible (paternité, second foyer, union de même sexe) | Moyenne | Fort | Visibilité par lien et par union ; calcul de parenté limité à ce que chacun peut voir ; propositions validées par le responsable de branche |
| Fuite de données sensibles (santé, origine, orientation) | Faible | Fort | Santé chiffrée à part ; droits vérifiés côté serveur ; test d'intrusion avant la V3 ; plan de réponse avec notification immédiate de l'Autorité et des personnes |
| Non-conformité juridique (autorisation préalable, transferts, données de mineurs) | Moyenne | Fort | Avis juridique avant le lancement ; registre des traitements ; consentements tracés ; aucune donnée de santé de mineur sans autorisation |
| Lenteurs et plantages sur les petits téléphones | Moyenne | Moyen | Android de référence ; budgets de performance vérifiés en intégration continue ; arbre dessiné par morceaux ; images réduites |
| Le coût de la data rebute | Moyenne | Moyen | Moins de 1 Mo par session hors médias ; mode Économie de données ; médias chargés à la demande |
| Peu de gens peuvent payer par carte | Forte | Moyen | Gratuit jusqu'à la V3 ; payeur dans la diaspora ; mobile money sur le web et pour le livre |
| Les coûts de la voix et des SMS s'envolent | Faible | Moyen | Quotas par famille ; WhatsApp avant le SMS ; alertes de dépense ; modèle auto-hébergé si le volume le justifie |
| Conflits dans la famille (désaccords, modifications malveillantes) | Moyenne | Moyen | Rôles et propositions ; historique et restauration ; versions divergentes avec leurs sources ; exclusion d'un membre |
| Le binôme manque de temps, le périmètre dérive | Forte | Moyen | Portes de la feuille de route ; cycles de 4 semaines ; rien de la V2 avant la porte 2 |
| Dépendance à des services tiers (transcription, IA, stores, Expo) | Moyenne | Moyen | Une interface interne par fournisseur pour pouvoir en changer ; données toujours exportables |
| Le nom « Lignée » est déjà pris | Moyenne | Moyen | Recherche d'antériorité à l'OAPI, à l'INPI et sur les stores avant tout dépôt ou toute dépense de marque |
| Faux compte qui se fait passer pour un proche | Faible | Moyen | Invitation nominative ; validation par un responsable ; signalement et exclusion |

## Décisions prises et questions ouvertes

Décisions prises le 14 octobre 2026 :

| Décision | Raison |
| --- | --- |
| Marché de lancement : Cameroun et Afrique francophone, avec la diaspora | C'est là que la mémoire orale et les familles étendues rendent Lignée la plus utile |
| Interface et voix en français et en anglais dès la V1 | Le Cameroun est bilingue ; la région anglophone ne doit pas attendre |
| Enfants d'épouses différentes : « demi-frère, même père », plus un nom d'usage libre | Le lien exact, comme le veut la charte, sans empêcher chacun de dire « mon frère » |
| Toutes les fonctions sont prévues, réparties en versions, sans date | Le binôme n'est pas pressé et avance porte après porte |
| Expo (React Native), Hono, Prisma, PostgreSQL | La stack que Daniel maîtrise déjà, et une seule base de code pour iOS et Android |
| L'IA comprend la phrase, le code place la personne, l'utilisateur valide | Un lien faux dans un arbre familial coûte cher en confiance |
| Gratuit jusqu'à la V3 | Construire l'usage avant de faire payer |
| Le calque santé arrive en V3 | Il exige une analyse d'impact, un chiffrement audité et un avis juridique |
| Pas de reconnaissance faciale automatique | Les données biométriques sont sensibles au Cameroun comme dans le RGPD ; on identifie les personnes à la main |
| Parcours de vie sur chaque fiche (V2) : tout membre peut publier un moment sur un proche, mais la personne concernée en est maître (31 octobre 2026) | Transmettre le vécu de chacun sans déposséder personne de son histoire ; consentement exigé par la loi n° 2024/017 |
| Listes d'inclusion et d'exclusion, visibilité changeable et ouverture programmée pour tout objet (V2) | Montrer d'abord à quelques proches, puis ouvrir à tous quand on le décide |
| Événements de famille (V2), reliés au Parcours et à la Caisse de famille | Réunions, mariages et funérailles sont les moments où la famille se retrouve et où l'on ne sait plus qui est qui |
| Abonnement familial par paliers de membres connectés : gratuit jusqu'à 20, puis 21 à 50, puis au-delà de 50 ; fiches illimitées (V3) | Ne jamais faire payer une famille parce qu'elle complète son arbre ; les coûts réels viennent de la voix et des photos, pas des fiches |
| Caisse de famille (V3, après avis juridique) : registre des tontines et cotisations, sans argent qui passe par Lignée | Répondre au besoin sans exercer une activité de paiement réglementée (agrément COBAC et BEAC) |

Questions ouvertes :

- [ ] Où créer la société, en France ou au Cameroun ? À trancher avec un juriste, avant la bêta.
- [ ] Quels traitements demandent une autorisation préalable de l'Autorité camerounaise, et faut-il l'obtenir avant la bêta ?
- [ ] Où héberger les données (Union européenne ou Afrique), au vu des règles de transfert ?
- [ ] Quel fournisseur de transcription, après un banc d'essai sur des voix camerounaises ?
- [ ] Quel prix pour l'abonnement famille et pour le livre, en FCFA et en euros ?
- [ ] Quel imprimeur pour le livre, au Cameroun et en France ?
- [ ] Le nom « Lignée » est-il libre à l'OAPI, à l'INPI et sur les stores ?
- [ ] Quel rôle et quelle disponibilité pour le second développeur ?
- [ ] Faut-il ajouter le pidgin à la saisie vocale dès la V2 ?

## Sources

Pages consultées le 14 octobre 2026. Les textes juridiques camerounais sont cités d'après des analyses publiées : le texte officiel de la loi et ses décrets restent à vérifier avec un juriste.

**Droit et données personnelles**

- [Data Protection in Cameroon](https://www.dlapiperdataprotection.com/?c=CM&t=law) (DLA Piper)
- [Operationalising Cameroon's data protection law](https://techhiveadvisory.africa/insights/operationalising-cameroons-data-protection-law-a-review-of-key-provisions-and-impacts) (Tech Hive Advisory)
- [Cameroon data protection law compliance](https://lexafrica.com/2025/10/cameroon-data-protection-law-compliance/) (Lex Africa)
- [La loi sur la protection des données à caractère personnel entre en vigueur ce 23 juin 2026](https://droitmediasfinance.com/index.php/actualites/droit-tech-fintech/1297-cameroun-la-loi-sur-la-protection-des-donnees-a-caractere-personnel-entre-en-vigueur-ce-23-juin-2026) (Droit Médias Finance)
- [L'autorité de protection des données à caractère personnel créée](https://www.digitalbusiness.africa/cameroun-lautorite-de-protection-des-donnees-a-caractere-personnel-creee/) et [amendes d'un milliard de FCFA](https://www.digitalbusiness.africa/cameroun-bientot-des-peines-damende-d-un-milliard-de-francs-cfa-pour-violation-des-donnees-personnelles/) (Digital Business Africa)
- [Protection des données au Cameroun : la course contre la montre avant juin 2026](https://cio-mag.com/protection-des-donnees-au-cameroun-la-course-contre-la-montre-avant-juin-2026/) (CIO Mag)
- [Peut-on changer un mariage monogamique en mariage polygamique ?](https://www.camer.be/55754/33:30/cameroun-peut-on-changer-un-mariage-monogamique-en-mariage-polygamiqueg-cameroon.html) (Camer.be, ordonnance n° 81-02, art. 49)
- [Cameroon: Rising Violence Against LGBTI People](https://www.hrw.org/news/2022/05/11/cameroon-rising-violence-against-lgbti-people) (Human Rights Watch, section 347-1 du Code pénal)
- [Hébergement HDS d'une application de santé : obligations](https://agence-scroll.com/blog/hebergement-hds-application-sante-obligations) (Agence Scroll)

**Marché, stores et paiement**

- [Mobile operating system market share, Cameroon](https://gs.statcounter.com/os-market-share/mobile/cameroon) (StatCounter)
- [Worldwide mobile data pricing](https://bestbroadbanddeals.co.uk/mobiles/worldwide-data-pricing/) (cable.co.uk, édition 2023)
- [Moyens de paiement acceptés sur Google Play](https://support.google.com/googleplay/answer/2651410?hl=en) et [politique de paiement de Google Play](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en) (Google)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) et [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app) (Apple)
- [Coût d'intégration du mobile money au Cameroun en 2026](https://kolonell.com/fr/blog/cout-integration-mobile-money-site-web-cameroun-2026) (Kolonell)
- [SMS pricing, Cameroon](https://www.twilio.com/en-us/sms/pricing/cm) (Twilio)
- [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) (Meta) et [tarifs par région](https://help.sleekflow.io/en_US/whatsapp/pricing) (SleekFlow)
- [Android vitals](https://developer.android.com/google/play/vitals) (Google, seuils de plantage et d'ANR)

**Technique et coûts**

- [Voxtral Transcribe 2 offers speech recognition at $0.003 per minute](https://the-decoder.com/voxtral-transcribe-2-offers-speech-recognition-at-0-003-per-minute/) (The Decoder) et [Voxtral Transcribe 2](https://www.gend.co/blog/voxtral-transcribe-2) (Generation Digital)
- [Tarifs des modèles Claude](https://platform.claude.com/docs/en/about-claude/pricing) et [sorties structurées](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) (Anthropic)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) et [expo-background-task](https://docs.expo.dev/versions/latest/sdk/background-task/) (Expo)
- [Atlas Device SDKs Deprecation](https://www.mongodb.com/docs/atlas/device-sdks/deprecation/) (MongoDB)
- [PowerSync Open Edition](https://powersync.com/blog/powersync-open-edition-release) (PowerSync)
- [Cloud VPS](https://contabo.com/en/vps/) (Contabo), [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (Cloudflare), [Expo pricing](https://expo.dev/pricing) (Expo)
