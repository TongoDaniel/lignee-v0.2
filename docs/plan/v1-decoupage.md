# Découpage de la V1 de Lignée

Date : 15 octobre 2026 · Statut : proposition, à relire avant toute création de tickets GitHub.

Sources : `docs/cahier-des-charges/` (présentation, PRD, TRD, cas limites), `docs/charte/`, `docs/adr/0001-socle-technique.md`. Aucune autre source.

## Comment lire ce document

- Un ticket = une pull request. Les numéros suivent l'ordre de travail : un ticket ne dépend que de tickets aux numéros plus petits.
- Les critères d'acceptation sont repris tels quels du PRD, entre guillemets. Quand une exigence est répartie sur plusieurs tickets, la mention « (partie …) » dit ce qui est fait ici.
- Les tickets du socle n'ont pas d'exigence PRD. Leurs critères viennent du TRD ou de la charte.
- Tailles : S = une à trois soirées ; M = environ une semaine à temps partiel ; L = environ deux semaines. Rien n'est plus gros que L.
- Qui : le code est écrit par Claude et ses agents, relu et fusionné par Claude (ADR 0019). Les repères disent seulement la nature du ticket : **Sv** = serveur et infrastructure ; **Mo** = app mobile ; **2** = cœur partagé.
- Étiquettes GitHub prévues : `V1` sur chaque ticket, plus une étiquette de module parmi `domain`, `kinship`, `layout`, `sync`, `voice`, `ui`, `i18n`, `db`, `api`, `worker`, `mobile`, `admin`, `exploitation`. J'ajoute `web` pour `apps/web` (pages d'invitation et formulaire de droits), absent de la liste de départ.
- Relecture `gardien-confidentialite` : obligatoire dès qu'un ticket touche les droits, la visibilité, la synchronisation, l'authentification, les exports, les notifications ou le contexte envoyé à la voix (CLAUDE.md).

En chiffres : **111 tickets** (13 S, 81 M, 17 L), **25 étapes**, environ **11 cycles** de 4 semaines (code écrit, relu et fusionné par Claude), 142 exigences V1, 114 cas limites V1.

---

## 1. Exigences V1 du PRD, par module

Chaque exigence V1 a un module principal et au moins un ticket. Le total fait 142 exigences.

### domain (16)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| UNI-01 | Fiche : plusieurs noms, genre, naissance, décès, lieux, profession, notes | T-004, T-031 |
| UNI-05 | Union : type, début, fin, motif, option déclarée, lieu, notes | T-004, T-032 |
| UNI-06 | Unions simultanées sans limite, sans jugement | T-004, T-032 |
| UNI-08 | Simultanées ou successives, déduit des dates, sinon une question | T-007, T-032, T-065 |
| UNI-09 | Filiation parent par parent, avec un type | T-007, T-033 |
| UNI-14 | Jumeaux et naissances multiples | T-004, T-024, T-033 |
| UNI-15 | Décès ; cause visible par son seul auteur | T-031, T-052 |
| UNI-16 | Présumée vivante si née il y a moins de 100 ans sans décès | T-007, T-052 |
| UNI-17 | Titres et rôles datés | T-004, T-024 |
| UNI-18 | Contrôles de cohérence | T-007 |
| UNI-22 | Personne trans ou non binaire : ancien prénom masqué | T-024, T-052 |
| CON-02 | Niveaux de visibilité | T-052, T-072 |
| CON-03 | Visibilité par personne, union, lien et fait | T-052, T-072 |
| CON-04 | Valeurs par défaut protectrices | T-052, T-066, T-072, T-079 |
| CON-05 | Masquage cohérent partout | T-056, T-057 |
| CON-13 | Pas de champ ethnie ni religion ; carte désactivable | T-004, T-048, T-050 |

### kinship (17)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| UNI-02 | Personne à compléter | T-036, T-037 |
| UNI-10 | Certitude de chaque lien | T-022, T-033 |
| UNI-11 | Parent non précisé, avec des candidats | T-008, T-033 |
| UNI-12 | Fratrie sans parents connus : parents à compléter communs | T-036, T-037 |
| UNI-13 | Fratrie calculée, jamais saisie | T-020 |
| UNI-21 | Lévirat, sororat, mariage entre cousins | T-022 |
| PAR-01 | « Qui est-ce pour moi ? » | T-013, T-028, T-029 |
| PAR-02 | Vocabulaire complet FR et EN | T-023, T-026, T-027 |
| PAR-03 | Fratrie : frère, demi-frère même père ou même mère | T-020 |
| PAR-04 | Conjoint d'un parent, co-épouse | T-021 |
| PAR-05 | Plusieurs chemins | T-022 |
| PAR-06 | Liens non biologiques signalés | T-022 |
| PAR-07 | Nom d'usage | T-041, T-090 |
| PAR-08 | Liens probables signalés | T-022 |
| PAR-09 | Calcul limité à ce que la personne peut voir | T-056, T-057 |
| PAR-10 | Lien entre deux personnes quelconques | T-029, T-038 |
| PAR-11 | Accord en genre et en nombre ; formes courte et expliquée | T-026, T-027, T-107 |

### layout (6)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| ARB-03 | Foyers d'une personne aux unions simultanées | T-008, T-012, T-017 |
| ARB-04 | Unions successives dans l'ordre | T-008 |
| ARB-05 | Enfant dont un parent n'est pas précisé | T-008, T-033 |
| ARB-06 | Implexe : la personne apparaît une fois | T-019 |
| ARB-14 | Vue descendance d'un ancêtre | T-019, T-025 |
| UNI-07 | Rang propre à chaque conjoint | T-008, T-032 |

### sync (6)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| HOL-01 | Tout le texte de l'arbre disponible hors-ligne | T-016, T-030, T-060, T-104 |
| HOL-02 | Synchronisation automatique, indicateur discret | T-067 |
| HOL-03 | Aucune perte après une longue période hors-ligne | T-070 |
| HOL-05 | Moins de 1 Mo par session ; premier chargement de 1 000 personnes sous 2 Mo | T-063, T-064 |
| COL-07 | Conflits après une saisie hors-ligne | T-067, T-070, T-071, T-093 |
| UNI-19 | Historique de chaque fiche, retour à une version | T-071 |

### voice (17)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| VOX-02 | Français et anglais, mélange accepté | T-069, T-109, T-110 |
| VOX-04 | Jusqu'à 15 personnes par dictée | T-062, T-079 |
| VOX-06 | Personne de référence, « Qui parle ? » | T-062, T-082 |
| VOX-07 | Générations manquantes | T-036, T-062 |
| VOX-08 | Questions : une à la fois, trois au plus | T-065, T-082 |
| VOX-09 | Mots ambigus | T-035, T-065 |
| VOX-10 | Mots de la famille | T-058, T-066 |
| VOX-11 | Doute : lien probable | T-066 |
| VOX-12 | Correction dans la phrase | T-066 |
| VOX-13 | Doublons : « Est-ce elle ? » | T-040, T-062 |
| VOX-14 | Dates floues et calculs | T-005, T-066 |
| VOX-17 | Questions à l'arbre | T-090 |
| VOX-19 | Avant la V3, la santé dite à voix haute n'est pas gardée | T-066 |
| VOX-21 | Audio effacé, transcription 30 jours, pas d'entraînement | T-075 |
| VOX-22 | Hors périmètre : rien n'est créé | T-066 |
| VOX-23 | Dicter dans la branche d'un autre produit des propositions | T-060, T-079 |
| PAY-02 | Quotas de voix par famille | T-076 |

### ui (2)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| ARB-12 | Couleur d'avatar par branche | T-015 |
| ACC-01 | Seuils de la charte (contraste, 48 × 48, 200 %) | T-014, T-015, T-107 |

### i18n (2)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| ACC-04 | Interface FR et EN, formats de la langue | T-010 |
| ACC-05 | Ton : vouvoiement, vocabulaire de la charte | T-010, T-107 |

### db (0)

Aucune exigence en propre. Le schéma Prisma sert les tickets `api` (T-042, T-044).

### api (32)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| CPT-01 | Compte par téléphone, code WhatsApp, SMS en secours | T-044, T-047 |
| CPT-02 | E-mail, Google, Apple liés au même compte | T-053 |
| CPT-04 | Un compte dans plusieurs arbres | T-048, T-050 |
| CPT-05 | Créer un arbre et ses réglages | T-048, T-050 |
| CPT-06 | Relier son compte à sa fiche | T-048, T-050, T-084 |
| CPT-07 | Quatre rôles | T-049, T-054 |
| CPT-08 | Responsable de branche | T-049, T-054, T-080 |
| CPT-09 | Transférer la propriété | T-048, T-054 |
| CPT-10 | Mineurs : accord parental | T-059 |
| CPT-11 | Supprimer son compte | T-061 |
| CPT-13 | Exclure un membre, bloquer un compte | T-048, T-054, T-067, T-100 |
| CON-01 | L'arbre n'est jamais public | T-083 |
| CON-06 | « Voir comme » | T-073 |
| CON-07 | Demande de masquage ou d'effacement par un non-membre | T-097 |
| CON-08 | Demandes pour les personnes décédées | T-097 |
| CON-09 | Export de ses propres données | T-096 |
| COL-01 | Inviter depuis une fiche | T-081, T-083 |
| COL-02 | La personne invitée se reconnaît | T-084 |
| COL-03 | Invitation à usage unique, 30 jours, révocable | T-081 |
| COL-04 | Propositions | T-080, T-085 |
| COL-05 | Commentaires écrits ou vocaux courts | T-092 |
| COL-06 | Fil d'activité | T-094 |
| COL-11 | Tableau de bord du propriétaire | T-094 |
| COL-12 | Saisir pour un proche sans smartphone | T-095 |
| EXP-01 | Export de toutes ses données | T-096 |
| HOL-07 | Envois interrompus repris | T-086 |
| MEM-01 | Photo de profil | T-086, T-091 |
| ADM-02 | Signaler un contenu ou un membre | T-100 |
| ADM-04 | Demandes d'accès, rectification, effacement, opposition | T-097 |
| ADM-05 | Mesure d'usage anonyme, avec accord | T-103 |
| ADM-07 | Contenus interdits | T-100 |
| ADM-08 | Conditions et politique de confidentialité | T-102 |

### worker (11)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| NOT-01 | Anniversaires à 8 h | T-089 |
| NOT-02 | Commémorations, désactivées par défaut | T-089 |
| NOT-03 | Propositions, invitation acceptée, nouveau membre | T-093 |
| NOT-04 | Résumé de la semaine | T-093 |
| NOT-05 | Jamais de donnée sensible dans une notification | T-088 |
| NOT-06 | Réglages par type et heures calmes | T-089 |
| NOT-07 | Au plus une notification non demandée par jour | T-089 |
| NOT-08 | Canaux ; WhatsApp réservé aux codes et invitations | T-044, T-088 |
| NOT-09 | Plus de rappel d'anniversaire après un décès | T-089 |
| CPT-14 | Divorce d'un membre : propriétaire prévenu | T-093 |
| VOX-18 | Dictée hors-ligne traitée au retour du réseau | T-075, T-077 |

### mobile (29)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| ARB-01 | Vue centrée sur « Vous » | T-012, T-017, T-105 |
| ARB-02 | Trois niveaux de zoom | T-017, T-105 |
| ARB-07 | Personne à compléter en pointillés | T-037 |
| ARB-08 | Liste « À placer » | T-039 |
| ARB-09 | Recentrer, fil d'Ariane | T-018 |
| ARB-10 | Recherche tolérante | T-034, T-038, T-105 |
| ARB-11 | Filtres | T-025, T-057 |
| ARB-13 | L'arbre « pousse » ; réduction des animations | T-018 |
| UNI-03 | Fusionner deux fiches | T-040, T-045 |
| UNI-04 | Liste « À placer » avec ce qu'on sait | T-039 |
| CPT-03 | Session longue, verrouillage facultatif | T-047, T-055 |
| CPT-12 | Profil : photo, nom d'usage, langue, taille, mode Aînés | T-051, T-091 |
| VOX-01 | Bouton micro partout | T-077 |
| VOX-03 | Transcription corrigeable | T-077 |
| VOX-05 | Aperçu obligatoire | T-079 |
| VOX-15 | Modifier à la voix | T-087 |
| VOX-16 | Supprimer : jamais à la voix seule | T-087 |
| VOX-24 | Mode Aînés : réponses lues à voix haute | T-090 |
| ACC-02 | Lecteur d'écran | T-046, T-107 |
| ACC-03 | Mode Aînés | T-051, T-107 |
| ACC-06 | Chaque geste a son bouton | T-017 |
| HOL-04 | Mode Économie de données | T-091 |
| HOL-08 | Réseau 2G ou 3G : rien ne bloque | T-106 |
| CON-10 | Mode discret | T-055, T-088 |
| CON-12 | Pas de reconnaissance faciale | T-002 |
| CAR-01 | Lieux en texte libre, jamais la position du téléphone | T-031 |
| ADM-03 | Aide intégrée, contact | T-101 |
| PAY-01 | Gratuit jusqu'à la V3 | Porte (section 5) |
| PAY-08 | Rien de sécurité ou d'accessibilité derrière un paiement | Porte (section 5) |

### admin (1)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| ADM-01 | Console interne, métadonnées seulement | T-099 |

### exploitation (3)

| ID | Exigence (résumé) | Tickets |
| --- | --- | --- |
| EXP-02 | Sauvegarde et restauration à une date | T-098 |
| ADM-06 | Procédure d'incident | T-108 |
| HOL-06 | Moins de 40 Mo à l'installation | T-078, T-105 |

### Ce qui n'entre pas en V1 (contrôle)

Aucun ticket ne porte ces identifiants.

- **V2** : ARB-15, UNI-20, SCN-01 à SCN-07, MEM-02 à MEM-11, MEM-13, MEM-14, COL-08, CAR-02 à CAR-07, EXP-03, EXP-04, EXP-05.
- **V3** : VOX-20, PAR-12, MEM-12, SAN-01 à SAN-13, COL-09, CON-11, LIV-01 à LIV-08, EXP-06, EXP-07, PAY-03 à PAY-07.
- **V4** : CPT-15, VOX-25, COL-10, COL-13, ACC-07.
- **Cas limites hors V1** : CL-POL-16, CL-POL-19, CL-SEC-06, CL-SEC-16, CL-DON-07, CL-DON-12, CL-DON-13, CL-DON-14, CL-DON-16, CL-DON-17, CL-RES-02 (V2) ; CL-POL-20, CL-VOI-22, CL-SEC-13, CL-RES-11 à CL-RES-15 (V3) ; CL-FAM-21 (V4).

Des critères V1 font référence à des fonctions V2. Ils sont listés dans la section 4 (doutes).

---

## 2. Tickets

### Bloc A — Socle

#### T-001 — Configurer l'outillage du monorepo
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Choix techniques (Code et livraison) ; TRD, Organisation du code (Conventions) ; ADR 0001.
- Exigences : aucune. Critères (TRD) : « TypeScript strict partout ; ESLint et Prettier ; messages de commit conventionnels » ; « Monorepo pnpm et Turborepo ».
- Contenu : Turborepo, `tsconfig` strict par paquet, ESLint (avec les règles d'accessibilité), Prettier, Vitest, commitlint, paquets vides qui compilent.
- Cas limites : aucun.
- Dépend de : aucun.
- Agent : exploitation.
- Taille : S.

#### T-002 — Mettre en place l'intégration continue
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Environnements, CI/CD et livraison ; TRD, Tests et qualité (Sécurité).
- Exigences :
  - CON-12 : « Aucune bibliothèque de reconnaissance faciale dans l'app » (contrôle automatique des dépendances).
  - Critères (TRD) : « lint, vérification des types, tests unitaires et de propriétés, cas limites, intégration avec PostgreSQL, taille des réponses de synchronisation, construction des images Docker » ; « Analyse des dépendances, CodeQL » ; « Un test qui échoue bloque la fusion de la pull request ». Branche principale protégée.
- Cas limites : aucun (l'étape « cas limites » joue tous les `test/scenarios/*.yaml`).
- Dépend de : T-001.
- Agent : exploitation.
- Taille : M.

#### T-003 — Monter l'environnement local Docker Compose
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Environnements (Local) ; TRD, Choix techniques (Base de référence).
- Exigences : aucune. Critère (TRD) : « Docker Compose : PostgreSQL, API, worker, MinIO à la place de R2, faux fournisseurs de voix et de messages ». PostgreSQL avec pg_trgm, unaccent, fuzzystrmatch. L'API et le worker s'y branchent dans T-043 et T-075.
- Cas limites : aucun.
- Dépend de : T-001.
- Agent : exploitation.
- Taille : S.

#### T-004 — Définir les types et les schémas Zod du modèle
- Module : domain · Étiquettes : `V1`, `domain` · Qui : 2
- Source : TRD, Modèle de données ; PRD, Personnes, unions et filiations.
- Exigences :
  - UNI-01 : « Seul un nom, ou « Inconnu », est obligatoire »
  - UNI-05 : « Seules les deux personnes sont obligatoires »
  - UNI-06 (partie modèle) : « Douze unions simultanées s'enregistrent et s'affichent »
  - UNI-14 (partie modèle) : « « Jumeaux » affiché sur les deux fiches »
  - UNI-17 (partie modèle) : « Affichés sous le nom sur la fiche »
  - CON-13 (partie modèle : aucun champ ethnie ni religion, réglage « carte » dans l'arbre) : « Le propriétaire peut couper la carte pour tout l'arbre »
  - TRD : « une union relie exactement deux personnes », « une filiation relie un parent et un enfant », « une personne peut exister « à compléter » » ; identifiants UUIDv7.
- Cas limites : CL-POL-15, CL-DON-01, CL-DON-02, CL-FAM-11, CL-FAM-17, CL-FAM-18, CL-FAM-19.
- Dépend de : T-001.
- Agent : modele-domaine ; relecture gardien-confidentialite (cause de décès, ancien prénom).
- Taille : M.

#### T-005 — Implémenter les dates floues
- Module : domain · Étiquettes : `V1`, `domain` · Qui : 2
- Source : TRD, Modèle de données (date floue).
- Exigences :
  - VOX-14 (partie calcul) : « Une date calculée est marquée approximative »
  - TRD : « qualificatif (exacte, vers, avant, après, entre, calculée, texte), précision (jour, mois, année, décennie), une ou deux bornes, le texte d'origine et le calendrier ; une colonne de tri en est déduite ». Le champ calendrier existe, sans conversion (CL-DON-07 est V2).
- Cas limites : CL-DON-05 (sans la chronologie, V2), CL-DON-06, CL-VOI-16.
- Dépend de : T-004.
- Agent : modele-domaine.
- Taille : S.

#### T-006 — Écrire le générateur d'arbres et le lecteur de scénarios
- Module : domain (outils de test) · Étiquettes : `V1`, `domain` · Qui : 2
- Source : TRD, Tests et qualité ; TRD, Moteur de parenté (Tests).
- Exigences : aucune. Critères (TRD) : « des propriétés vérifiées sur des milliers d'arbres générés, polygamie, lévirat et implexe compris » ; arbres types de 100, 1 000 et 5 000 personnes ; « Un fichier de scénario par identifiant de l'onglet Cas limites ». Lecture du format de `test/scenarios/CL-POL-03.yaml`. Noms générés, jamais réels.
- Cas limites : CL-POL-03 (fichier existant, lu et validé).
- Dépend de : T-004.
- Agent : testeur-qualite.
- Taille : M.

### Bloc B — Cohérence, disposition et socle d'interface

#### T-007 — Contrôler la cohérence et les invariants
- Module : domain · Étiquettes : `V1`, `domain` · Qui : 2
- Source : PRD, Personnes, unions et filiations ; TRD, Modèle de données (règles clés).
- Exigences :
  - UNI-09 (partie règle) : « Au plus deux parents « de naissance » ; les autres types sans limite »
  - UNI-18 : « Alerte expliquée, qu'on peut passer outre ; le cycle est refusé »
  - UNI-16 (partie règle) : « Règle appliquée aussi aux imports » (les imports sont V2 ; ici, le calcul « présumée vivante »)
  - UNI-08 (partie déduction depuis les dates) : « La réponse est gardée et reste modifiable »
- Cas limites : CL-DON-08, CL-DON-09, CL-DON-10, CL-DON-11, CL-POL-05 (déduction).
- Dépend de : T-004, T-005, T-006.
- Agent : modele-domaine.
- Taille : M.

#### T-008 — Calculer les générations et les foyers
- Module : layout · Étiquettes : `V1`, `layout` · Qui : 2
- Source : TRD, Disposition de l'arbre (étapes 1 et 2) ; PRD, L'arbre.
- Exigences :
  - ARB-03 (partie structure) : « Un homme avec 8 épouses et 40 enfants reste lisible au niveau « branche » (revue visuelle sur l'Android de référence) »
  - ARB-04 : « Ordre correct avec des dates, ou avec un rang saisi à la main »
  - ARB-05 : « Préciser la mère déplace l'enfant dans le bon foyer »
  - UNI-07 (partie ordre) : « Changer un rang réordonne les foyers immédiatement »
  - UNI-11 (partie affichage : colonne « parent non précisé »)
- Cas limites : CL-POL-01, CL-POL-04, CL-POL-06, CL-POL-13, CL-POL-14, CL-POL-18.
- Dépend de : T-004, T-006.
- Agent : moteur-parente.
- Taille : L.

#### T-009 — Générer `tokens.ts` et les thèmes Jour et Nuit
- Module : ui · Étiquettes : `V1`, `ui` · Qui : Mo
- Source : charte, `11-react-native.md` et README ; CLAUDE.md.
- Exigences : aucune. Critère (charte) : « Ne tapez jamais une couleur, une taille ou un rayon dans un composant : importez-les de `tokens.ts`. » Script reproductible depuis `docs/charte/tokens.json`.
- Blocage matériel : les polices TTF ne sont pas dans le dépôt (seulement des WOFF2). Voir section 4.
- Cas limites : aucun.
- Dépend de : T-001.
- Agent : ecrans-lignee.
- Taille : S.

#### T-010 — Mettre en place les textes français et anglais
- Module : i18n · Étiquettes : `V1`, `i18n` · Qui : Mo
- Source : TRD, Choix techniques (Langues) ; charte, `08-ton.md`.
- Exigences :
  - ACC-04 : « Aucun texte écrit en dur dans le code »
  - ACC-05 (partie cadre ; la relecture se fait dans T-107) : « Chaque texte relu par un locuteur natif »
  - i18next, pluriels ICU, formats de dates et de nombres, règle de lint contre les textes en dur.
- Cas limites : aucun.
- Dépend de : T-001.
- Agent : ecrans-lignee.
- Taille : S.

#### T-011 — Initialiser l'app Expo
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Choix techniques (App) ; TRD, Performance (Pratiques) ; charte, `11-react-native.md`.
- Exigences : aucune. Critères : Expo Router, Hermes, nouvelle architecture, build de développement EAS (Skia et SQLCipher l'exigent), polices, thème, i18n, barre d'onglets. L'app se lance sur l'Android de référence et sur un iPhone.
- Cas limites : aucun.
- Dépend de : T-009, T-010.
- Agent : ecrans-lignee (avec exploitation pour EAS).
- Taille : M.

#### T-012 — Ordonner, placer et replier l'arbre
- Module : layout · Étiquettes : `V1`, `layout` · Qui : 2
- Source : TRD, Disposition de l'arbre (étapes 3 à 5, Budget).
- Exigences :
  - ARB-03 (partie repli) : « Un homme avec 8 épouses et 40 enfants reste lisible au niveau « branche » (revue visuelle sur l'Android de référence) »
  - ARB-01 (partie calcul) : « S'ouvre en moins de 1 s pour 500 personnes sur l'Android de référence » ; budget TRD : « moins de 100 ms de calcul pour 500 personnes visibles ».
- Cas limites : CL-POL-12, CL-SEC-03 (le compteur ne compte que les enfants présents dans le graphe reçu).
- Dépend de : T-008.
- Agent : moteur-parente.
- Taille : L.

#### T-013 — Construire le graphe de parenté et les ancêtres communs
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 1, Tests).
- Exigences :
  - PAR-01 (partie moteur ; budget tenu dans T-028) : « Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000 personnes »
  - TRD : paquet pur, sans réseau ni base ; propriété « le lien de A vers B est l'inverse de celui de B vers A ».
- Cas limites : aucun en propre (socle des suivants).
- Dépend de : T-004, T-006.
- Agent : moteur-parente.
- Taille : M.

#### T-014 — Créer les composants de base de la charte
- Module : ui · Étiquettes : `V1`, `ui` · Qui : Mo
- Source : charte, `components/` (Bouton, Champ, Carte, EnTete, Feuille, Toast, Puce, Interrupteur, LigneReglage, Icones, Logo) ; `09-accessibilite.md`.
- Exigences :
  - ACC-01 (partie composants) : « Audit d'accessibilité avant la bêta ». Ici : zones de 48 et 56, contrastes, texte à 200 % sans troncature, libellés.
- Cas limites : aucun.
- Dépend de : T-009, T-010.
- Agent : ecrans-lignee.
- Taille : M.

#### T-015 — Créer les composants de personne et de navigation
- Module : ui · Étiquettes : `V1`, `ui` · Qui : Mo
- Source : charte, `components/` (Avatar, NoeudArbre, MentionPrivee, OngletsFiche, BarreOnglets, Notification) ; `03-couleurs.md`.
- Exigences :
  - ARB-12 : « Une branche garde sa couleur sur tous les écrans » (voir le doute sur la règle de couleur, section 4).
- Cas limites : aucun.
- Dépend de : T-014.
- Agent : ecrans-lignee.
- Taille : M.

#### T-016 — Créer la base locale chiffrée et y charger un arbre généré
- Module : sync · Étiquettes : `V1`, `sync` · Qui : Mo
- Source : TRD, Choix techniques (Base sur le téléphone) ; TRD, Hors-ligne et synchronisation (Sur le téléphone).
- Exigences :
  - HOL-01 (partie fondation) : « En mode avion, les parcours de la V1 passent ; seuls les invitations et l'analyse de la voix attendent le réseau »
  - TRD : « base SQLite chiffrée avec SQLCipher, clé dans le trousseau du système (expo-secure-store) ; migrations Drizzle versionnées ». Chargement d'un arbre généré (T-006) en développement seulement.
  - Obligations reçues des relectures : ADR 0017, Conséquences (`distinctFrom`).
- Cas limites : CL-SEC-14 (partie base locale chiffrée).
- Dépend de : T-004, T-006, T-011.
- Agent : sync-hors-ligne ; relecture gardien-confidentialite.
- Taille : M.

### Bloc C — Premier arbre sur le téléphone et liens de parenté

#### T-017 — Dessiner l'arbre avec Skia
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Disposition de l'arbre (Dessin) ; charte, `06-arbre.md`.
- Exigences :
  - ARB-01 : « S'ouvre en moins de 1 s pour 500 personnes sur l'Android de référence »
  - ARB-02 : « Zoom par pincement sans saccade : 60 images par seconde visées, 30 au minimum »
  - ARB-03 (partie dessin) : « Un homme avec 8 épouses et 40 enfants reste lisible au niveau « branche » (revue visuelle sur l'Android de référence) »
  - ACC-06 : « Tout l'arbre se parcourt sans pincer ni glisser »
- Cas limites : CL-POL-01, CL-POL-12, CL-POL-18.
- Dépend de : T-012, T-015, T-016.
- Agent : ecrans-lignee.
- Taille : L.

#### T-018 — Recentrer l'arbre, revenir à « Vous » et le faire pousser
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, L'arbre ; TRD, Disposition (Dessin) ; charte, `07-mouvement.md`.
- Exigences :
  - ARB-09 : « Retour à « Vous » en une touche »
  - ARB-13 : « Réglage du système respecté sur iOS et Android »
- Cas limites : aucun.
- Dépend de : T-017.
- Agent : ecrans-lignee.
- Taille : M.

#### T-019 — Gérer l'implexe, l'union entre générations et la descendance
- Module : layout · Étiquettes : `V1`, `layout` · Qui : 2
- Source : TRD, Disposition de l'arbre (étapes 1 et 6).
- Exigences :
  - ARB-06 : « Mariage entre cousins germains : aucune fiche en double »
  - ARB-14 (partie calcul) : « La descendance de Pierre montre ses trois foyers et leurs petits-enfants »
- Cas limites : CL-FAM-09, CL-FAM-10.
- Dépend de : T-012.
- Agent : moteur-parente.
- Taille : M.

#### T-020 — Calculer la fratrie et les liens de sang
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 1) ; PRD, Lien de parenté.
- Exigences :
  - UNI-13 : « Changer un parent met à jour tous les liens de fratrie »
  - PAR-03 : « Le lien change dès que la mère est précisée »
- Cas limites : CL-POL-02, CL-POL-03 (lien), CL-GEN-07 (lien), CL-VOI-08 (lien), CL-FAM-08.
- Dépend de : T-013.
- Agent : moteur-parente.
- Taille : M.

#### T-021 — Calculer les liens par alliance et les co-épouses
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 1, alliance).
- Exigences :
  - PAR-04 : « Aucun « belle-mère » affiché pour l'épouse d'un père »
- Cas limites : CL-POL-08, CL-FAM-01.
- Dépend de : T-013.
- Agent : moteur-parente.
- Taille : M.

#### T-022 — Gérer les chemins multiples, les liens non biologiques et la certitude
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté ; PRD, Lien de parenté.
- Exigences :
  - PAR-05 : « Les deux liens d'un enfant du lévirat sont affichés »
  - PAR-06 : « Jamais confondus avec un lien de naissance »
  - PAR-08 : « La certitude du lien le plus faible du chemin est affichée »
  - UNI-10 (partie calcul) : « Un lien probable s'affiche « Peut-être son frère » »
  - UNI-21 : « Un enfant né d'un lévirat apparaît à la fois demi-frère et cousin de ses aînés »
- Cas limites : CL-POL-09, CL-POL-10, CL-POL-11, CL-FAM-02, CL-FAM-03, CL-FAM-04, CL-FAM-05, CL-FAM-09, CL-FAM-14.
- Dépend de : T-020, T-021.
- Agent : moteur-parente.
- Taille : M.

#### T-023 — Constituer le jeu de 200 paires annotées
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : PRD, PAR-02 ; TRD, Moteur de parenté (Tests).
- Exigences :
  - PAR-02 (partie jeu de test) : « 100 % du jeu de test de 200 paires, en français et en anglais »
  - Paires tirées d'arbres générés : polygamie, lévirat, alliance, degrés civils.
- Cas limites : aucun en propre.
- Dépend de : T-006, T-013.
- Agent : testeur-qualite, avec moteur-parente.
- Taille : M.

#### T-024 — Afficher la fiche d'une personne
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Personnes, unions et filiations ; charte, OngletsFiche.
- Exigences :
  - UNI-14 : « « Jumeaux » affiché sur les deux fiches »
  - UNI-17 : « Affichés sous le nom sur la fiche »
  - UNI-22 (partie affichage) : « L'ancien prénom n'apparaît que pour qui y a droit, et jamais dans la recherche des autres »
- Cas limites : CL-FAM-11, CL-FAM-15, CL-FAM-17, CL-FAM-19, CL-DON-01 (ordre d'affichage).
- Dépend de : T-015, T-016.
- Agent : ecrans-lignee.
- Taille : M.

#### T-025 — Filtrer l'arbre et ouvrir la vue descendance
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, L'arbre.
- Exigences :
  - ARB-11 : « Les filtres n'affichent jamais une personne masquée »
  - ARB-14 : « La descendance de Pierre montre ses trois foyers et leurs petits-enfants »
- Cas limites : aucun en propre.
- Dépend de : T-013, T-017, T-019.
- Agent : ecrans-lignee.
- Taille : S.

#### T-026 — Rédiger le vocabulaire français de parenté
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 2) ; PRD, Lien de parenté.
- Exigences :
  - PAR-02 (partie FR) : « 100 % du jeu de test de 200 paires, en français et en anglais »
  - PAR-11 (partie FR : accords, formes courte et expliquée ; le critère vise l'anglais, T-027) : « Relu par un locuteur natif anglais avant la sortie »
  - Degré civil au-delà des cousins issus de germains.
- Cas limites : CL-POL-02, CL-POL-03, CL-POL-08, CL-POL-09, CL-POL-10, CL-FAM-01, CL-FAM-08.
- Dépend de : T-010, T-022, T-023.
- Agent : moteur-parente.
- Taille : L.

#### T-027 — Rédiger le vocabulaire anglais de parenté
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 2).
- Exigences :
  - PAR-02 (partie EN) : « 100 % du jeu de test de 200 paires, en français et en anglais »
  - PAR-11 : « Relu par un locuteur natif anglais avant la sortie »
- Cas limites : les mêmes que T-026, en anglais (« half-brother », « co-wife », « first cousin once removed »).
- Dépend de : T-026.
- Agent : moteur-parente.
- Taille : M.

#### T-028 — Tenir le budget de temps du moteur
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (Performance) ; TRD, Performance (Pratiques).
- Exigences :
  - PAR-01 (partie budget) : « Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000 personnes »
  - TRD : « moins de 50 ms pour un lien dans un arbre de 5 000 personnes sur l'Android de référence » ; calculs « découpés pour ne jamais bloquer l'interface plus de 50 ms ».
- Cas limites : CL-FAM-20 (partie moteur).
- Dépend de : T-022.
- Agent : moteur-parente.
- Taille : M.

#### T-029 — Afficher « Qui est-ce pour moi ? »
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Lien de parenté ; parcours « Savoir qui est qui avant des funérailles ».
- Exigences :
  - PAR-01 : « Réponse en moins de 200 ms hors-ligne pour un arbre de 5 000 personnes »
  - PAR-10 (partie : choix des deux fiches dans l'arbre ; la recherche arrive avec T-038) : « Choisir deux fiches dans la recherche suffit »
  - Chemin surligné en or (`chemin`).
  - Obligations reçues des relectures : ADR 0020 (le contexte d'alliance vient de l'arbre filtré).
  - Obligations reçues des relectures (T-026, ADR 0031, Conséquences) : les noms passés aux mots des liens (`nameOf` de `describeLink`) viennent de `chooseDisplayName` de `@lignee/domain`, appliqué aux seuls noms de l'instantané du lecteur : jamais un ancien prénom, jamais une personne qu'il ne voit pas. Un texte de lien construit avec le nom d'usage « moi seul » d'un auteur ne sert qu'à cet auteur (jamais une notification, un export partagé, le contexte de la voix d'un autre lecteur, un journal). Le contexte d'alliance se construit depuis le même arbre filtré que le graphe, pas comme les tests de `packages/kinship/src/words.test.ts` (arbre non filtré).
- Cas limites : aucun en propre.
- Dépend de : T-017, T-024, T-027, T-028.
- Agent : ecrans-lignee.
- Taille : M.

### Bloc D — Saisir à la main, hors-ligne

#### T-030 — Définir les mutations et la file de changements locale
- Module : sync · Étiquettes : `V1`, `sync` · Qui : Mo
- Source : TRD, Hors-ligne et synchronisation (points 1 et 2).
- Exigences :
  - HOL-01 (partie saisie locale) : « En mode avion, les parcours de la V1 passent ; seuls les invitations et l'analyse de la voix attendent le réseau »
  - TRD : « chaque modification devient une mutation (identifiant, entité, opération, champs modifiés, version de départ, date). Un plan vocal devient un lot de mutations appliqué d'un seul bloc. »
- Cas limites : aucun en propre.
- Dépend de : T-016.
- Agent : sync-hors-ligne ; relecture gardien-confidentialite.
- Taille : M.

#### T-031 — Saisir et modifier une personne à la main
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Personnes ; PRD, Carte (CAR-01) ; charte, Champ.
- Exigences :
  - UNI-01 : « Seul un nom, ou « Inconnu », est obligatoire »
  - UNI-15 (partie saisie ; voir doute section 4) : « La cause n'apparaît ni dans l'arbre, ni dans une notification, ni dans un export partagé »
  - CAR-01 : « Aucune permission de localisation demandée »
  - Obligations reçues des relectures : ADR 0020 (le contexte d'alliance vient de l'arbre filtré).
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : une suppression liste ses dépendants (noms, faits, liens, unions) dans le même lot de `recordLocalChanges` ; codes de refus (`MUTATION_ISSUE_CODES`) traduits par `packages/i18n`.
- Cas limites : CL-POL-15, CL-DON-01, CL-DON-02, CL-DON-05, CL-DON-06, CL-FAM-12 (ajout), CL-FAM-17, CL-FAM-18, CL-FAM-19.
- Dépend de : T-005, T-024, T-030.
- Agent : ecrans-lignee ; relecture gardien-confidentialite (cause de décès).
- Taille : M.

#### T-032 — Ajouter et modifier une union
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Personnes, unions et filiations.
- Exigences :
  - UNI-05 : « Seules les deux personnes sont obligatoires »
  - UNI-06 : « Douze unions simultanées s'enregistrent et s'affichent »
  - UNI-07 : « Changer un rang réordonne les foyers immédiatement »
  - UNI-08 : « La réponse est gardée et reste modifiable »
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : une suppression liste ses dépendants (noms, faits, liens, unions) dans le même lot de `recordLocalChanges` ; codes de refus (`MUTATION_ISSUE_CODES`) traduits par `packages/i18n`.
- Cas limites : CL-POL-01, CL-POL-04, CL-POL-05, CL-POL-06, CL-POL-07 (fin d'union), CL-POL-13, CL-POL-14.
- Dépend de : T-007, T-019, T-031.
- Agent : ecrans-lignee.
- Taille : M.

#### T-033 — Ajouter une filiation
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Personnes, unions et filiations.
- Exigences :
  - UNI-09 : « Au plus deux parents « de naissance » ; les autres types sans limite »
  - UNI-10 : « Un lien probable s'affiche « Peut-être son frère » »
  - UNI-11 : « Choisir la mère plus tard déplace l'enfant dans son foyer »
  - UNI-14 (partie saisie) : « « Jumeaux » affiché sur les deux fiches »
  - ARB-05 : « Préciser la mère déplace l'enfant dans le bon foyer »
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : une suppression liste ses dépendants (noms, faits, liens, unions) dans le même lot de `recordLocalChanges` ; codes de refus (`MUTATION_ISSUE_CODES`) traduits par `packages/i18n`.
- Cas limites : CL-POL-03, CL-POL-11, CL-GEN-14, CL-FAM-02, CL-FAM-03, CL-FAM-04, CL-FAM-05, CL-FAM-06, CL-FAM-07, CL-FAM-08, CL-FAM-11, CL-FAM-13, CL-DON-11.
- Dépend de : T-032.
- Agent : ecrans-lignee.
- Taille : M.

#### T-034 — Normaliser les noms et calculer la clé phonétique
- Module : domain · Étiquettes : `V1`, `domain` · Qui : 2
- Source : TRD, Recherche (Index, Clé phonétique, Fautes de frappe).
- Exigences :
  - ARB-10 (partie normalisation) : « « Ngo Biyong », « ngo biyon » et « Biyong » trouvent la même personne ; moins de 300 ms hors-ligne pour 5 000 personnes »
  - TRD : clé « testée sur une liste de noms réels fournie par les familles pilotes » (voir doute section 4 ; en attendant, noms générés).
- Cas limites : CL-DON-03, CL-DON-04.
- Dépend de : T-004.
- Agent : moteur-parente.
- Taille : M.

### Bloc E — Compléter, placer et retrouver

#### T-035 — Traduire les termes de parenté en expressions de chemin
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 3 et son tableau).
- Exigences :
  - VOX-09 (partie sens possibles) : « « Ma belle-mère » propose « épouse de votre père » et « mère de votre conjoint » »
- Cas limites : CL-VOI-04, CL-VOI-05, CL-VOI-06, CL-VOI-08 (expressions).
- Dépend de : T-013.
- Agent : moteur-parente, avec pipeline-vocal.
- Taille : M.

#### T-036 — Évaluer une expression depuis une personne de référence
- Module : kinship · Étiquettes : `V1`, `kinship` · Qui : 2
- Source : TRD, Moteur de parenté (question 3) ; TRD, Pipeline vocal (étape 5).
- Exigences :
  - UNI-02 (partie création) : « Donner son nom remplit la place sans créer de doublon »
  - UNI-12 : « « Ma sœur Lucienne » sans parents dans l'arbre crée deux places à compléter partagées »
  - VOX-07 : « « Ajoute ma grand-mère Odette » sans parents : une question, une place à compléter, puis Odette »
- Cas limites : CL-GEN-01, CL-GEN-03, CL-GEN-04, CL-GEN-06, CL-GEN-07, CL-GEN-08, CL-GEN-09, CL-GEN-10, CL-GEN-12.
- Dépend de : T-007, T-020, T-035.
- Agent : moteur-parente.
- Taille : L.

#### T-037 — Créer et compléter les personnes à compléter
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, L'arbre (ARB-07) ; PRD, Personnes (UNI-02, UNI-12).
- Exigences :
  - ARB-07 : « Compléter le nom transforme la place sans changer ses liens »
  - UNI-02 : « Donner son nom remplit la place sans créer de doublon »
  - UNI-12 : « « Ma sœur Lucienne » sans parents dans l'arbre crée deux places à compléter partagées »
- Cas limites : CL-GEN-03, CL-GEN-07, CL-GEN-12.
- Dépend de : T-033, T-036.
- Agent : ecrans-lignee.
- Taille : M.

#### T-038 — Rechercher hors-ligne
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Recherche ; PRD, L'arbre (ARB-10) ; parcours « Savoir qui est qui avant des funérailles ».
- Exigences :
  - ARB-10 : « « Ngo Biyong », « ngo biyon » et « Biyong » trouvent la même personne ; moins de 300 ms hors-ligne pour 5 000 personnes »
  - PAR-10 : « Choisir deux fiches dans la recherche suffit »
  - Index FTS5, Jaro-Winkler, classement (exact, début de mot, phonétique, approché ; puis proximité de « Vous »).
- Obligations reçues des relectures (T-016, ADR 0023, point 1) : l'index FTS5 ne contient jamais la valeur d'un fait `death_cause` ni l'ancien prénom d'un autre auteur ; il se construit sur les noms autorisés, depuis le corps JSON ; aucune colonne de valeur saisie dans les tables du modèle, et la table FTS5 est déclarée comme seule exception dans `packages/sync/src/local-db/schema.test.ts`, avec un test qu'elle ne contient ni cause de décès ni ancien prénom d'un autre auteur.
- Cas limites : CL-DON-03, CL-DON-04, CL-SEC-04 (partie locale).
- Dépend de : T-016, T-029, T-034.
- Agent : ecrans-lignee, avec sync-hors-ligne (FTS5).
- Taille : M.

#### T-039 — Gérer la liste « À placer »
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Personnes (UNI-04) ; PRD, L'arbre (ARB-08) ; TRD, Modèle de données (`a_placer`).
- Exigences :
  - UNI-04 : « Dès qu'un parent de Nora est ajouté, Lignée propose d'y placer la grand-mère »
  - ARB-08 : « Placer une personne propose seulement les positions compatibles avec ce qu'on sait d'elle »
- Cas limites : CL-GEN-02, CL-GEN-13.
- Dépend de : T-037.
- Agent : ecrans-lignee, avec moteur-parente.
- Taille : M.

#### T-040 — Calculer le score de doublon
- Module : domain · Étiquettes : `V1`, `domain` · Qui : 2
- Source : TRD, Recherche (Doublons).
- Exigences :
  - VOX-13 (partie score) : « 95 % des doublons du jeu de test détectés »
  - UNI-03 (partie détection ; jamais de fusion automatique) : « Aucun lien perdu sur un jeu de 20 fusions de test »
- Cas limites : CL-DON-15, CL-FAM-16, CL-GEN-04, CL-GEN-11 (après synchronisation, rejoué dans T-070).
- Dépend de : T-034.
- Agent : moteur-parente.
- Taille : M.

#### T-041 — Gérer les noms d'usage
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Lien de parenté (PAR-07) ; TRD, Modèle de données (`noms_usage`).
- Exigences :
  - PAR-07 (partie saisie et affichage ; la voix dans T-090) : « « Ajoute un souvenir avec Maman Fatou » trouve la bonne fiche »
  - TRD : « Jamais utilisé dans le calcul du lien ». Portée « moi seul » ou « famille ».
- Cas limites : CL-POL-02 (nom d'usage), CL-POL-08 (« Maman Fatou »).
- Dépend de : T-031.
- Agent : ecrans-lignee ; relecture gardien-confidentialite (portée « moi seul »).
- Taille : S.

### Bloc F — Serveur, connexion et arbres

#### T-042 — Créer le schéma Prisma de l'arbre et du journal
- Module : db · Étiquettes : `V1`, `db` · Qui : Sv
- Source : TRD, Modèle de données ; TRD, Authentification et sécurité (Base de données).
- Exigences : aucune en propre. Critères (TRD) : tables V1 seulement (aucune table V3) ; « utilisateur applicatif sans droit de modifier le schéma, utilisateur de migration séparé ; sécurité au niveau des lignes de PostgreSQL sur l'identifiant d'arbre, en seconde barrière » ; migrations « toujours compatibles avec la version précédente ».
- Cas limites : aucun en propre.
- Dépend de : T-003, T-004.
- Agent : api-serveur ; relecture gardien-confidentialite (sécurité au niveau des lignes).
- Taille : M.

#### T-043 — Initialiser l'API Hono
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, API (Conventions) ; TRD, Observabilité (Journaux).
- Exigences :
  - Critères (TRD) : préfixe `/v1`, OpenAPI depuis Zod, erreurs `application/problem+json`, clé d'idempotence sur chaque `POST`, pagination par curseur, compression, limites de débit, version minimale de l'app annoncée ; journaux pino avec masquage des noms et numéros.
- Cas limites : CL-RES-08.
- Dépend de : T-042.
- Agent : api-serveur.
- Taille : M.

#### T-044 — Authentifier par code WhatsApp, avec SMS en secours
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, Authentification et sécurité ; TRD, Notifications et messages (Codes de connexion) ; TRD, API (Authentification).
- Exigences :
  - CPT-01 : « Code reçu en moins de 30 s dans 95 % des cas ; 5 essais au plus, puis 15 minutes d'attente »
  - NOT-08 (partie codes) : « Aucun message WhatsApp promotionnel »
  - TRD : code de 6 chiffres valable 5 minutes, haché avec un sel secret ; jeton d'accès JWT ES256 de 15 minutes ; jeton de rafraîchissement tournant de 90 jours, lié à l'appareil ; « La réutilisation d'un ancien jeton révoque toute la session ». Interface interne par fournisseur, faux fournisseurs en local.
- Cas limites : CL-RES-09 (côté serveur).
- Dépend de : T-043.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : L.
- Bloqué en production par : compte WhatsApp Business Platform et modèle d'authentification, agrégateur SMS local, nom d'expéditeur « Lignee » (section 4).

#### T-045 — Fusionner deux fiches
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Personnes (UNI-03) ; TRD, Moteur de parenté (Tests : « une fusion ne change aucun lien »).
- Exigences :
  - UNI-03 : « Aucun lien perdu sur un jeu de 20 fusions de test »
- Cas limites : CL-DON-18, CL-GEN-04, CL-GEN-05.
- Dépend de : T-030, T-033, T-040.
- Agent : moteur-parente, avec ecrans-lignee.
- Taille : M.

#### T-046 — Proposer la vue liste de l'arbre pour les lecteurs d'écran
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Disposition de l'arbre (Accessibilité) ; charte, `09-accessibilite.md`.
- Exigences :
  - ACC-02 (partie arbre) : « Le parcours « Premier arbre » se fait entièrement au lecteur d'écran »
- Cas limites : aucun en propre.
- Dépend de : T-017, T-026.
- Agent : ecrans-lignee.
- Taille : M.

#### T-047 — Créer les écrans d'inscription et de connexion
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Compte ; parcours « Premier arbre » (étape 2).
- Exigences :
  - CPT-01 : « Code reçu en moins de 30 s dans 95 % des cas ; 5 essais au plus, puis 15 minutes d'attente »
  - CPT-03 (partie session) : « L'app s'ouvre sans réseau sur une session existante ; Lignée ne stocke aucune donnée biométrique »
- Cas limites : CL-RES-09.
- Dépend de : T-011, T-044.
- Agent : ecrans-lignee ; relecture gardien-confidentialite (stockage des jetons).
- Taille : M.

#### T-048 — Créer et gérer les arbres et les membres (API)
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, API (Arbres et membres) ; PRD, Compte, arbres et rôles.
- Exigences :
  - CPT-04 (partie serveur) : « Changer d'arbre en deux touches ; aucune donnée ne passe d'un arbre à l'autre »
  - CPT-05 : « Réglages modifiables par le propriétaire à tout moment »
  - CPT-06 : « Relier une fiche déjà reliée est refusé et transmis au propriétaire »
  - CPT-09 : « Confirmation par l'ancien et le nouveau propriétaire »
  - CPT-13 (partie serveur) : « Accès retiré à la synchronisation suivante ; ses ajouts restent dans l'arbre »
  - CON-13 (partie réglage) : « Le propriétaire peut couper la carte pour tout l'arbre »
- Cas limites : aucun en propre.
- Dépend de : T-043, T-044.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-049 — Écrire le module unique de droits
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, Authentification et sécurité (Droits) ; TRD, Modèle de données (`branches`, `branche_personnes`) ; PRD, tableau « Droits par rôle ».
- Exigences :
  - CPT-07 : « Chaque droit est vérifié par le serveur ; un test par rôle et par action »
  - CPT-08 : « Une proposition dans sa branche lui est envoyée, et à lui seul avec le propriétaire »
  - TRD : « un module unique de règles (rôle, branche, visibilité, propriété) appelé par toutes les routes, la synchronisation, les exports et les notifications » ; table de fermeture des branches recalculée à chaque changement de filiation ou d'union.
- Cas limites : aucun en propre.
- Dépend de : T-042, T-048.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : L.

#### T-050 — Créer un arbre, se placer comme « Vous » et changer d'arbre
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Compte, arbres et rôles ; parcours « Premier arbre » (étapes 3 et 4).
- Exigences :
  - CPT-04 : « Changer d'arbre en deux touches ; aucune donnée ne passe d'un arbre à l'autre »
  - CPT-05 : « Réglages modifiables par le propriétaire à tout moment »
  - CPT-06 : « Relier une fiche déjà reliée est refusé et transmis au propriétaire »
  - CON-13 : « Le propriétaire peut couper la carte pour tout l'arbre »
- Cas limites : aucun en propre.
- Dépend de : T-047, T-048.
- Agent : ecrans-lignee.
- Taille : M.

#### T-051 — Régler le profil et le mode Aînés
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Compte (CPT-12) ; PRD, Accessibilité (ACC-03) ; charte, `09-accessibilite.md`.
- Exigences :
  - CPT-12 (sans la photo, faite dans T-091) : « Changement de langue immédiat, sans redémarrer »
  - ACC-03 (partie réglages ; voir doute section 4) : « Testé avec trois personnes de plus de 70 ans avant la bêta publique »
- Cas limites : aucun en propre.
- Dépend de : T-014, T-047.
- Agent : ecrans-lignee.
- Taille : M.

### Bloc G — Droits et visibilité

#### T-052 — Écrire les règles de visibilité et leurs valeurs par défaut
- Module : domain · Étiquettes : `V1`, `domain` · Qui : Sv
- Source : TRD, Confidentialité appliquée (points 1 et 2) ; PRD, Confidentialité et visibilité.
- Exigences :
  - CON-02 : « Chaque niveau vérifié par le serveur »
  - CON-03 : « Masquer une union cache aussi le foyer qu'elle forme »
  - CON-04 (partie règles) : « Le choix est affiché dans l'aperçu avant validation »
  - UNI-15 : « La cause n'apparaît ni dans l'arbre, ni dans une notification, ni dans un export partagé »
  - UNI-16 : « Règle appliquée aussi aux imports »
  - UNI-22 : « L'ancien prénom n'apparaît que pour qui y a droit, et jamais dans la recherche des autres »
  - Obligations reçues des relectures (T-020 à T-022) :
    - Renvois : ADR 0017, Conséquences (`distinctFrom`) ; ADR 0020 (point 6 et Choix laissés à Daniel) ; ADR 0021, point 8.
    - `distinctFrom` : retirer les identifiants de personnes non visibles (API, synchro, base locale, exports, contexte voix). Valider à l'écriture contre l'ensemble visible du rédacteur : même réponse pour « inexistant » et « masqué ».
    - Alliance (ADR 0020) : le filtre retire toute réponse de simultanéité dont une union est masquée, et tout fait de décès masqué par sa propre règle ou par celle de sa personne. Si le motif ou la date de fin d'une union devient masquable à part, le filtre les retire de l'union (relecture gardien-confidentialite de T-021, hors ADR). Le contexte d'alliance se construit depuis le même arbre filtré que le graphe.
    - Question ouverte pour Daniel : masquer aussi le statut vital « décédé » quand le fait de décès est masqué ?
    - CL-FAM-14 : la projection rend l'ancienne filiation avec son type d'avant le test ADN (« naissance ») pour un lecteur qui ne voit pas le nouveau lien. Test de non-fuite par canal : ceux de l'ADR 0021, auxquels s'ajoutent notifications et recherche. Condition : le modèle garde le type antérieur de la filiation (voir plus bas).
    - Question de produit pour Daniel (CL-FAM-03) : une adoption tenue secrète se projette-t-elle en « naissance » pour l'enfant (comme CL-FAM-14) ou en « lien non disponible », ou une autre règle de visibilité au choix (ligne CL-FAM-03 du cahier) ? T-052 fournira `test/scenarios/CL-FAM-03.yaml` (relecture gardien-confidentialite de T-022, hors ADR).
    - Si la certitude ou le type non biologique d'une filiation visible deviennent masquables à part (CON-03), la projection les réécrit avant de construire le graphe (relecture gardien-confidentialite de T-022, hors ADR).
    - Exports, notifications et contexte voix construits depuis la présentation d'un auteur (« moi seul ») ne partent jamais vers un autre lecteur (relecture gardien-confidentialite de T-022, hors ADR).
    - Mots des liens (T-026, ADR 0031, Conséquences) : la forme expliquée rend lisibles la mention « distincte de » (« fils de votre père et d'un autre parent »), la fin d'une union (« union terminée », y compris par un décès masqué lu dans le statut vital), son motif et sa date, la nature non biologique et la certitude d'une filiation. Ce qui est masquable pour un lecteur est réécrit par la projection avant le calcul.
    - ADR 0017, Conséquences, dernier point : la mention « distincte de » sur la mère à compléter d'un enfant peut trahir une paternité ou maternité tenue secrète. À trancher en T-052.
    - ADR 0021, point 8 : le modèle garde le type antérieur de la filiation (champ de la filiation, ou entrée d'historique UNI-19 rattachée au test ADN). À trancher en T-052 ; c'est la condition de l'obligation CL-FAM-14.
    - ADR 0017, synchronisation montante : une mention reçue vers une personne que le rédacteur ne voit pas est refusée comme inexistante (appliquée côté serveur par T-060).
    - Base locale (ADR 0023, Conséquences ; relectures de T-016) : si une règle explicite peut ouvrir une cause de décès ou un ancien prénom à d'autres lecteurs, la seconde barrière de `packages/sync/src/local-db/snapshot.ts` (refus d'une cause de décès ou d'un ancien prénom d'un autre auteur) suit la règle. Un nom d'usage « moi seul » n'entre jamais dans l'instantané d'un autre lecteur. Un chemin « À placer » qui traverse une personne masquée est traité par le filtre (entrée retirée ou chemin coupé).
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : les règles « personnes choisies » restent dans la file chiffrée de leur seul auteur (`mutation_queue`) : acceptable parce que la file est lue, comptée et envoyée par compte, vidée au changement de lecteur, et purgée par T-067.
- Cas limites : CL-SEC-01, CL-SEC-07, CL-SEC-11 (visibilité), CL-POL-17, CL-FAM-03, CL-FAM-06, CL-FAM-07, CL-FAM-12 (visibilité), CL-FAM-14, CL-FAM-15.
- Dépend de : T-004, T-007.
- Agent : modele-domaine, avec api-serveur ; relecture gardien-confidentialite.
- Taille : L.

#### T-053 — Lier e-mail, Google et Apple, et changer de numéro
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, Authentification et sécurité (Autres connexions) ; PRD, CPT-02.
- Exigences :
  - CPT-02 : « Lier un e-mail à un compte téléphone ne crée pas de second compte »
- Cas limites : CL-RES-10.
- Dépend de : T-044.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.
- Bloqué par : compte Apple Developer (Sign in with Apple), fournisseur d'e-mails transactionnels (lien magique).

#### T-054 — Gérer les rôles, les responsables de branche, l'exclusion et le transfert
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Compte, arbres et rôles.
- Exigences :
  - CPT-07 : « Chaque droit est vérifié par le serveur ; un test par rôle et par action »
  - CPT-08 : « Une proposition dans sa branche lui est envoyée, et à lui seul avec le propriétaire »
  - CPT-09 : « Confirmation par l'ancien et le nouveau propriétaire »
  - CPT-13 : « Accès retiré à la synchronisation suivante ; ses ajouts restent dans l'arbre »
- Obligations reçues des relectures (T-016, ADR 0023) : vérifier que `trees.reader_account_id` de la base locale est le compte connecté avant toute lecture ; à l'exclusion, `eraseLocalTree` ou `destroyLocalDatabase`.
- Cas limites : CL-SEC-08 (partie exclusion).
- Dépend de : T-049, T-050.
- Agent : ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

#### T-055 — Verrouiller l'app et gérer les appareils connectés
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Authentification et sécurité (Sur le téléphone) ; PRD, CPT-03, CON-10.
- Exigences :
  - CPT-03 : « L'app s'ouvre sans réseau sur une session existante ; Lignée ne stocke aucune donnée biométrique »
  - CON-10 (partie sélecteur d'apps ; les notifications dans T-088) : « Aucun nom visible sur l'écran verrouillé »
- Obligations reçues des relectures (T-016, ADR 0023, Conséquences) : brancher `rotateDatabaseKey` et `destroyLocalDatabase` de `@lignee/sync` (appareil retrouvé, déconnexion, appareil déconnecté à distance) ; avant toute lecture, vérifier que `trees.reader_account_id` est le compte connecté (aussi T-054 et T-063) ; jamais l'arbre généré de développement avec un compte réel.
- Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : à la déconnexion, `destroyLocalDatabase` emporte les changements non envoyés de la file : prévenir l'utilisateur avant (forme de l'avertissement à décider par Daniel).
- Cas limites : CL-SEC-14.
- Dépend de : T-047.
- Agent : ecrans-lignee, avec api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-056 — Projeter l'arbre par lecteur sur le serveur
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, Confidentialité appliquée (points 3 et 4) ; TRD, Architecture d'ensemble.
- Exigences :
  - CON-05 (partie projection ; le test dans T-057) : « Test automatique de non-fuite sur chaque écran et chaque réponse de l'API »
  - PAR-09 : « Avec une fiche masquée sur le seul chemin : « Lien non disponible », sans autre indice »
  - Obligations reçues des relectures (T-016, ADR 0023, Conséquences) : les instantanés produits passent `parseLocalTreeSnapshot` de `@lignee/sync` sans compter sur son refus (la seconde barrière n'est pas le filtre) ; les tests de non-fuite couvrent aussi la base locale (aller-retour `replaceTreeSnapshot` puis `readTreeSnapshot`) ; `packages/sync/src/dev-seed/projection.ts` n'est pas un modèle du filtrage.
- Cas limites : CL-SEC-01, CL-SEC-02, CL-POL-17.
- Dépend de : T-042, T-049, T-052.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : L.

#### T-057 — Tester la non-fuite sur des arbres générés
- Module : api · Étiquettes : `V1`, `api` · Qui : 2
- Source : TRD, Confidentialité appliquée (point 5) ; TRD, Tests et qualité (Propriétés).
- Exigences :
  - CON-05 : « Test automatique de non-fuite sur chaque écran et chaque réponse de l'API »
  - PAR-09 : « Avec une fiche masquée sur le seul chemin : « Lien non disponible », sans autre indice »
  - ARB-11 : « Les filtres n'affichent jamais une personne masquée »
  - Obligations reçues des relectures : les tests de non-fuite par canal exigés par l'ADR 0017 (`distinctFrom`) et l'ADR 0021.
- Cas limites : CL-SEC-01, CL-SEC-02, CL-SEC-03, CL-SEC-04.
- Dépend de : T-028, T-038, T-056.
- Agent : testeur-qualite ; relecture gardien-confidentialite.
- Taille : M.

#### T-058 — Définir le schéma d'extraction et le glossaire
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : TRD, Pipeline vocal (étape 4).
- Exigences :
  - VOX-10 (partie glossaire) : « « Mon frère de même père » crée un demi-frère, même père »
  - TRD : schéma plat (mentions, liens, unions, faits, sensible) reliés par des références ; glossaire FR, EN et usages camerounais.
- Cas limites : aucun en propre.
- Dépend de : T-004.
- Agent : pipeline-vocal.
- Taille : M.

#### T-059 — Recueillir l'accord parental pour un mineur
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, CPT-10 ; TRD, Conformité (Mineurs).
- Exigences :
  - CPT-10 : « Accord parental enregistré avec sa date ; aucune donnée de santé saisie par un mineur »
- Cas limites : CL-SEC-11.
- Dépend de : T-054.
- Agent : api-serveur, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.
- Bloqué par : avis juridique sur la forme de l'accord parental (section 4).

### Bloc H — Synchronisation et compréhension de la voix

#### T-060 — Recevoir les mutations sur le serveur
- Module : sync · Étiquettes : `V1`, `sync` · Qui : Sv
- Source : TRD, Hors-ligne et synchronisation (point 3 et tableau des situations).
- Exigences :
  - HOL-01 (partie serveur) : « En mode avion, les parcours de la V1 passent ; seuls les invitations et l'analyse de la voix attendent le réseau »
  - VOX-23 (partie conversion en proposition) : « Le responsable de la branche reçoit la proposition »
  - TRD : par lots de 100 ; droits, visibilité et invariants vérifiés ; réponse par mutation (appliquée, convertie en proposition, refusée avec la raison) ; identifiant de mutation idempotent.
  - Obligations reçues des relectures : ADR 0017, Conséquences (`distinctFrom`), synchronisation montante : une mention `distinctFrom` vers une personne que le rédacteur ne voit pas est refusée comme inexistante.
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) :
    - accepter un lot de plus de 100 mutations envoyé seul (un lot ne se coupe jamais, écart au TRD point 3).
    - neutraliser les oracles de `applyMutationBatch` sur l'arbre complet (réponse générique ou conversion en proposition, test de non-fuite sur arbres générés) : `duplicate_id` (identifiants de tout l'arbre), `person_without_name` (tous les noms), réponse de simultanéité (réponses et unions complètes), suppression refusée parce qu'un objet masqué la cite, `checkNewFiliation` sur l'arbre complet (`third_birth_parent` révèle une paternité secrète), fusion d'une modification contre l'objet complet (la faire contre la projection du rédacteur en conservant ce qu'il ne voit pas).
    - `canWriterSee` branché sur la projection du rédacteur (T-056), vrai pour les objets créés dans le lot ; suppression d'une règle : même réponse pour un non-auteur et une règle inexistante ; un objet et sa règle « moi seul » appliqués d'un seul bloc.
    - ne jamais journaliser une ZodError brute (clé de champ inconnue fournie par le client) ; état « convertie en proposition » face à la contrainte CHECK de `mutation_queue.status` (migration qui recrée la table).
- Cas limites : CL-DON-10, CL-DON-11 (refus serveur), CL-VOI-28 (conversion), CL-SEC-08 (refus).
- Dépend de : T-030, T-049, T-056.
- Agent : sync-hors-ligne, avec api-serveur ; relecture gardien-confidentialite.
- Taille : L.

#### T-061 — Supprimer son compte
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, CPT-11 ; TRD, Authentification (révocation des jetons Apple) ; TRD, Conformité (Stores).
- Exigences :
  - CPT-11 : « Effacement sous 30 jours ; la fiche devient « Personne vivante, masquée » et garde sa place dans l'arbre »
- Cas limites : aucun en propre.
- Dépend de : T-048, T-053.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-062 — Résoudre une extraction en plan
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : TRD, Pipeline vocal (étape 5) ; parcours « Premier arbre » et « Dicter une branche polygame ».
- Exigences :
  - VOX-04 (partie résolveur) : « Le parcours « Dicter une branche polygame » passe sans clavier »
  - VOX-06 : « Sur le téléphone de Comfort, Papa Emmanuel dit « ma sœur » : la sœur créée est la sienne »
  - VOX-07 : « « Ajoute ma grand-mère Odette » sans parents : une question, une place à compléter, puis Odette »
  - VOX-13 : « 95 % des doublons du jeu de test détectés »
  - Obligations reçues des relectures : ADR 0017, Conséquences (`distinctFrom`) : le résolveur ne construit `distinctFrom` qu'à partir du graphe visible du locuteur. Le contexte d'alliance vient de l'arbre filtré (ADR 0020).
- Cas limites : CL-VOI-01, CL-VOI-02, CL-VOI-15, CL-VOI-18 (plan), CL-POL-03, CL-GEN-03, CL-GEN-06, CL-GEN-07.
- Dépend de : T-036, T-040, T-058.
- Agent : pipeline-vocal, avec moteur-parente.
- Taille : L.

#### T-063 — Servir l'instantané et le tirage par curseur
- Module : sync · Étiquettes : `V1`, `sync` · Qui : Sv
- Source : TRD, Hors-ligne et synchronisation (points 4 et 5).
- Exigences :
  - HOL-05 (partie instantané) : « Mesuré à chaque build en intégration continue » ; « première synchronisation d'un arbre de 1 000 personnes en moins de 2 Mo ».
  - TRD : changements filtrés pour ce lecteur ; suppression locale quand une donnée devient invisible.
  - Obligations reçues des relectures (T-016, ADR 0023) : vérifier que `trees.reader_account_id` est le compte connecté avant d'écrire ou de lire un tirage ; instantanés écrits par `replaceTreeSnapshot` (seconde barrière).
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : ne rejouer sur un nouvel instantané ou après un tirage que les mutations dont l'auteur est le lecteur, par `recordLocalChanges` ou une fonction de rejeu dédiée qui garde la seconde barrière (pas `applyLocalMutationBatch`).
- Cas limites : CL-SEC-08 (effacement).
- Dépend de : T-056, T-060.
- Agent : sync-hors-ligne, avec api-serveur ; relecture gardien-confidentialite.
- Taille : L.

#### T-064 — Mesurer le budget de données en intégration continue
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Médias et économie de données (Contrôle).
- Exigences :
  - HOL-05 : « Mesuré à chaque build en intégration continue »
  - TRD : arbres types de 100, 1 000 et 5 000 personnes ; « un dépassement du budget fait échouer le build ».
- Cas limites : aucun en propre.
- Dépend de : T-006, T-063.
- Agent : exploitation.
- Taille : S.

#### T-065 — Poser les questions du résolveur
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : TRD, Pipeline vocal (étape 5, boucle de question) ; PRD, Principes (règle 3).
- Exigences :
  - VOX-08 : « Médiane d'une question par dictée sur le jeu de test »
  - VOX-09 : « « Ma belle-mère » propose « épouse de votre père » et « mère de votre conjoint » »
  - UNI-08 (partie question) : « La réponse est gardée et reste modifiable »
- Cas limites : CL-VOI-03, CL-VOI-04, CL-VOI-05, CL-VOI-06, CL-GEN-01, CL-GEN-02, CL-GEN-08, CL-GEN-09, CL-GEN-10, CL-POL-05.
- Dépend de : T-062.
- Agent : pipeline-vocal.
- Taille : M.

#### T-066 — Traiter le doute, les corrections, les mots de la famille, les dates et le hors sujet
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : PRD, Saisie vocale ; TRD, Pipeline vocal.
- Exigences :
  - VOX-10 : « « Mon frère de même père » crée un demi-frère, même père »
  - VOX-11 : « L'aperçu affiche « Peut-être son frère » »
  - VOX-12 : « Aucune fiche « Marc » créée »
  - VOX-14 : « Une date calculée est marquée approximative »
  - VOX-19 : « Aucune donnée de santé enregistrée par la voix en V1 et en V2 »
  - VOX-22 : « Aucune fiche créée sur le jeu de test « hors sujet » »
  - CON-04 (partie liens sensibles proposés « moi seul ») : « Le choix est affiché dans l'aperçu avant validation »
  - Obligations reçues des relectures : ADR 0017, Conséquences (`distinctFrom`) : « frère de même père » ne construit `distinctFrom` qu'à partir du graphe visible du locuteur. Le contexte d'alliance de la voix vient du même arbre filtré (ADR 0020).
- Cas limites : CL-VOI-07, CL-VOI-08, CL-VOI-09, CL-VOI-10, CL-VOI-11, CL-VOI-16, CL-VOI-17, CL-VOI-19, CL-VOI-21, CL-VOI-23, CL-VOI-27.
- Dépend de : T-062.
- Agent : pipeline-vocal ; relecture gardien-confidentialite (santé, liens sensibles).
- Taille : M.

#### T-067 — Synchroniser depuis le téléphone
- Module : sync · Étiquettes : `V1`, `sync` · Qui : Mo
- Source : TRD, Hors-ligne et synchronisation (point 6 et tableau).
- Exigences :
  - HOL-02 : « Aucune action demandée à l'utilisateur »
  - COL-07 (partie téléphone) : « Aucune saisie perdue sur le scénario de test à deux téléphones »
  - CPT-13 (partie téléphone) : « Accès retiré à la synchronisation suivante ; ses ajouts restent dans l'arbre »
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : ne lire, n'envoyer et ne compter que les saisies du compte connecté (`listQueuedBatches`, `countPendingMutations` l'exigent) ; noter les réponses par `recordQueueOutcomes` ; purger les entrées `sent` après le tirage qui les reflète ; annuler localement une mutation refusée ; ne jamais couper un lot.
- Cas limites : CL-RES-06, CL-RES-07, CL-SEC-08.
- Dépend de : T-047, T-063.
- Agent : sync-hors-ligne ; relecture gardien-confidentialite.
- Taille : L.

#### T-068 — Déployer la préproduction
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Environnements, CI/CD et livraison.
- Exigences : aucune. Critères (TRD) : images sur GitHub Container Registry ; Docker Compose derrière Caddy ; migrations dans une étape à part ; « Vérification de santé après chaque mise en ligne, retour arrière en une commande » ; secrets chiffrés avec SOPS ; numéro WhatsApp de test.
- Cas limites : aucun.
- Dépend de : T-002, T-043.
- Agent : exploitation.
- Taille : L.
- Bloqué en partie par : lieu d'hébergement, si la préproduction accueille la bêta fermée avec des données réelles (section 4).

#### T-069 — Jouer le jeu de test vocal enregistré à chaque pull request
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : TRD, Pipeline vocal (Tests) ; TRD, Tests et qualité (Voix).
- Exigences :
  - VOX-02 (partie outillage) : « Jeu de test de 300 phrases réelles, accents camerounais compris : 90 % de liens corrects »
  - VOX-08 : « Médiane d'une question par dictée sur le jeu de test »
  - VOX-13 : « 95 % des doublons du jeu de test détectés »
  - Phrases écrites et réponses du modèle enregistrées, sur des arbres générés, en attendant les phrases réelles (T-109).
- Cas limites : CL-VOI-12, CL-VOI-13, CL-VOI-14, CL-VOI-29.
- Dépend de : T-065, T-066.
- Agent : testeur-qualite, avec pipeline-vocal.
- Taille : M.

### Bloc I — Hors-ligne à deux téléphones, visibilité à l'écran

#### T-070 — Jouer le simulateur à deux téléphones
- Module : sync · Étiquettes : `V1`, `sync` · Qui : 2
- Source : TRD, Hors-ligne et synchronisation (Test de référence) ; TRD, Tests et qualité (Synchronisation).
- Exigences :
  - HOL-03 : « 7 jours hors-ligne sur deux téléphones, puis synchronisation : test automatisé à chaque version »
  - COL-07 : « Aucune saisie perdue sur le scénario de test à deux téléphones »
- Cas limites : CL-RES-01, CL-GEN-11.
- Dépend de : T-040, T-067.
- Agent : testeur-qualite, avec sync-hors-ligne.
- Taille : M.

#### T-071 — Afficher et restaurer l'historique d'une fiche
- Module : sync · Étiquettes : `V1`, `sync` · Qui : Mo
- Source : PRD, UNI-19 ; TRD, Modèle de données (`journal`).
- Exigences :
  - UNI-19 : « Restaurer une version ne touche pas aux autres fiches »
  - COL-07 (partie historique) : « Aucune saisie perdue sur le scénario de test à deux téléphones »
- Cas limites : aucun en propre.
- Dépend de : T-067.
- Agent : ecrans-lignee, avec api-serveur ; relecture gardien-confidentialite (historique filtré par lecteur).
- Taille : M.

#### T-072 — Régler la visibilité d'une fiche, d'une union, d'un lien et d'un fait
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Confidentialité et visibilité ; charte, MentionPrivee (règle 9).
- Exigences :
  - CON-02 : « Chaque niveau vérifié par le serveur »
  - CON-03 : « Masquer une union cache aussi le foyer qu'elle forme »
  - CON-04 : « Le choix est affiché dans l'aperçu avant validation »
- Cas limites : CL-SEC-07, CL-FAM-03, CL-FAM-06, CL-FAM-07, CL-FAM-14.
- Dépend de : T-052, T-067.
- Agent : ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

#### T-073 — Voir l'arbre comme un membre
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, CON-06.
- Exigences :
  - CON-06 : « Même résultat que sur le téléphone de ce membre »
- Cas limites : CL-SEC-12.
- Dépend de : T-056, T-072.
- Agent : api-serveur, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

#### T-074 — Brancher le suivi des erreurs et les alertes
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Observabilité, sauvegardes et exploitation.
- Exigences : aucune. Critères (TRD) : GlitchTip pour l'app et l'API, avec source maps ; Uptime Kuma ; alertes e-mail et Telegram (API indisponible plus de 2 minutes, plus de 2 % d'erreurs). Permet de suivre les indicateurs « taux de plantage perçu » et « taux d'ANR perçu ».
- Cas limites : aucun.
- Dépend de : T-068.
- Agent : exploitation.
- Taille : M.

### Bloc J — La voix de bout en bout

#### T-075 — Exécuter les tâches vocales sur le serveur
- Module : worker · Étiquettes : `V1`, `worker`, `voice` · Qui : Sv
- Source : TRD, Pipeline vocal (étapes 2 et 4, Sécurité, Pannes) ; TRD, API (Voix) ; TRD, Choix techniques (Tâches de fond).
- Exigences :
  - VOX-18 (partie serveur) : « Dix dictées faites hors-ligne sont toutes traitées au retour du réseau »
  - VOX-21 : « Clause signée avec chaque fournisseur ; purge vérifiée chaque mois »
  - TRD : initialise `apps/worker` avec pg-boss ; interfaces transcription et compréhension, faux fournisseurs ; « Le modèle ne reçoit ni donnée de santé, ni personne masquée » ; audio effacé dès la transcription.
- Cas limites : CL-VOI-29.
- Dépend de : T-043, T-056, T-058.
- Agent : pipeline-vocal, avec api-serveur ; relecture gardien-confidentialite (contexte envoyé à la voix).
- Taille : L.
- Bloqué pour les adaptateurs réels par : choix du fournisseur de transcription, clauses signées (section 4).

#### T-076 — Appliquer les quotas de dictées par famille
- Module : voice · Étiquettes : `V1`, `voice` · Qui : Sv
- Source : PRD, PAY-02 ; TRD, Pipeline vocal (Pannes).
- Exigences :
  - PAY-02 : « Alerte à 80 % du quota ; le clavier reste toujours disponible »
- Cas limites : CL-VOI-30.
- Dépend de : T-075.
- Agent : pipeline-vocal.
- Taille : S.

#### T-077 — Enregistrer une dictée, l'envoyer plus tard et relire la transcription
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Pipeline vocal (étapes 1 et 3) ; PRD, Saisie vocale.
- Exigences :
  - VOX-01 : « Accessible en une touche depuis chaque écran principal »
  - VOX-03 : « Corriger le texte relance l'analyse sans réenregistrer »
  - VOX-18 : « Dix dictées faites hors-ligne sont toutes traitées au retour du réseau »
- Cas limites : CL-VOI-14, CL-VOI-25, CL-VOI-26.
- Dépend de : T-011, T-075.
- Agent : ecrans-lignee, avec pipeline-vocal.
- Taille : M.

#### T-078 — Construire et distribuer l'app avec EAS
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Environnements, CI/CD et livraison (App).
- Exigences :
  - HOL-06 (partie préparation ; mesure dans T-105) : « Mesuré sur le paquet publié par le Play Store »
  - TRD : profils développement, préproduction, production ; EAS Update avec version d'exécution ; pistes internes, TestFlight.
- Cas limites : aucun.
- Dépend de : T-011.
- Agent : exploitation.
- Taille : M.
- Bloqué par : comptes développeur Apple et Google (au nom de quelle société), nom sur les stores (section 4).

#### T-079 — Afficher l'aperçu et appliquer le plan
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Pipeline vocal (étapes 6 et 7) ; parcours « Premier arbre » (étapes 5 à 7).
- Exigences :
  - VOX-05 : « Rien n'est écrit avant « Oui, ajouter » »
  - VOX-04 : « Le parcours « Dicter une branche polygame » passe sans clavier »
  - VOX-23 : « Le responsable de la branche reçoit la proposition »
  - CON-04 : « Le choix est affiché dans l'aperçu avant validation »
  - Obligations reçues des relectures (T-030, ADR 0027, Conséquences) : le plan validé passe par `recordLocalChanges`, en un seul lot ; une suppression liste ses dépendants dans le même lot.
- Cas limites : CL-VOI-18, CL-VOI-19, CL-VOI-23, CL-VOI-28.
- Dépend de : T-062, T-067, T-077.
- Agent : ecrans-lignee, avec pipeline-vocal ; relecture gardien-confidentialite.
- Taille : L.

#### T-080 — Traiter les propositions (API)
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, API (Propositions) ; PRD, Collaboration.
- Exigences :
  - COL-04 : « La proposition montre l'avant et l'après »
  - CPT-08 : « Une proposition dans sa branche lui est envoyée, et à lui seul avec le propriétaire »
  - TRD : « Acceptation appliquée en une transaction ».
- Cas limites : aucun en propre.
- Dépend de : T-049, T-060.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-081 — Créer, partager et révoquer une invitation
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, API (Invitations) ; TRD, Notifications et messages (Invitations) ; TRD, Authentification (Abus).
- Exigences :
  - COL-01 (partie création et partage ; le lien dans T-083) : « Si l'app n'est pas installée, le lien mène au store puis à l'invitation »
  - COL-03 : « Un lien utilisé ou expiré affiche une explication claire »
  - Jetons de 128 bits stockés hachés ; invitation d'un membre validée par un responsable ; QR code.
- Cas limites : aucun en propre.
- Dépend de : T-048, T-049.
- Agent : api-serveur, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

#### T-082 — Poser les questions à l'écran et choisir « Qui parle ? »
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Saisie vocale ; TRD, Pipeline vocal.
- Exigences :
  - VOX-06 : « Sur le téléphone de Comfort, Papa Emmanuel dit « ma sœur » : la sœur créée est la sienne »
  - VOX-08 : « Médiane d'une question par dictée sur le jeu de test »
- Cas limites : CL-VOI-01, CL-GEN-02.
- Dépend de : T-065, T-079.
- Agent : ecrans-lignee.
- Taille : M.

### Bloc K — Inviter et collaborer

#### T-083 — Ouvrir une invitation depuis un lien
- Module : web · Étiquettes : `V1`, `web`, `exploitation` · Qui : Sv
- Source : TRD, Notifications et messages (Liens d'invitation) ; TRD, API (Invitations).
- Exigences :
  - COL-01 : « Si l'app n'est pas installée, le lien mène au store puis à l'invitation »
  - CON-01 : « Aucune page publique, aucun référencement par les moteurs de recherche »
  - TRD : la page « n'affiche que le prénom de l'invitant et le nom de la famille » ; App Links, Universal Links, Play Install Referrer, code de 6 caractères.
- Cas limites : aucun en propre.
- Dépend de : T-068, T-081.
- Agent : api-serveur, avec exploitation ; relecture gardien-confidentialite.
- Taille : M.
- Bloqué par : nom de domaine (disponibilité du nom « Lignée »).

#### T-084 — Accepter une invitation et se reconnaître
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : parcours « Inviter la famille au pays » ; PRD, Collaboration.
- Exigences :
  - COL-02 : « Aucun compte relié à une fiche sans confirmation »
  - CPT-06 : « Relier une fiche déjà reliée est refusé et transmis au propriétaire »
- Cas limites : aucun en propre.
- Dépend de : T-050, T-083.
- Agent : ecrans-lignee, avec api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-085 — Afficher, accepter et refuser les propositions
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Collaboration.
- Exigences :
  - COL-04 : « La proposition montre l'avant et l'après »
- Cas limites : CL-VOI-28 (réception).
- Dépend de : T-080.
- Agent : ecrans-lignee.
- Taille : M.

#### T-086 — Envoyer des fichiers par parties, avec reprise
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : TRD, Médias et économie de données ; TRD, API (Médias).
- Exigences :
  - HOL-07 (voir doute section 4) : « Un audio de 20 minutes envoyé malgré trois coupures »
  - TRD : URL signées valables 10 minutes, délivrées après contrôle de la visibilité ; envois abandonnés purgés après 7 jours ; MinIO en local.
- Cas limites : aucun en propre en V1 (CL-RES-02 est V2).
- Dépend de : T-043, T-056.
- Agent : api-serveur, avec sync-hors-ligne ; relecture gardien-confidentialite.
- Taille : M.

#### T-087 — Modifier et supprimer à la voix
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : PRD, Saisie vocale.
- Exigences :
  - VOX-15 : « Annulation possible depuis l'historique »
  - VOX-16 : « Aucune suppression sans toucher le bouton « Supprimer » »
- Cas limites : CL-VOI-20.
- Dépend de : T-071, T-079.
- Agent : pipeline-vocal, avec ecrans-lignee.
- Taille : M.

### Bloc L — Notifications, voix lue, photo, commentaires

#### T-088 — Envoyer des notifications à partir de modèles fermés
- Module : worker · Étiquettes : `V1`, `worker` · Qui : Sv
- Source : TRD, Notifications et messages ; PRD, Rappels et notifications.
- Exigences :
  - NOT-05 : « Test automatique sur tous les modèles de notification »
  - NOT-08 : « Aucun message WhatsApp promotionnel »
  - CON-10 : « Aucun nom visible sur l'écran verrouillé »
- Cas limites : CL-SEC-05.
- Dépend de : T-056, T-075.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-089 — Planifier les rappels
- Module : worker · Étiquettes : `V1`, `worker` · Qui : Sv
- Source : TRD, Notifications et messages (Planificateur).
- Exigences :
  - NOT-01 : « Heure locale du membre, pas celle du serveur »
  - NOT-02 : « Désactivées par défaut »
  - NOT-06 : « Par défaut, rien entre 21 h et 8 h »
  - NOT-07 : « Limite vérifiée côté serveur »
  - NOT-09 : « Les rappels déjà programmés sont annulés »
- Cas limites : CL-FAM-12 (aucun rappel).
- Dépend de : T-088.
- Agent : api-serveur, avec ecrans-lignee (réglages) ; relecture gardien-confidentialite.
- Taille : M.

#### T-090 — Répondre aux questions sur l'arbre et lire à voix haute
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : PRD, Saisie vocale ; parcours « Savoir qui est qui avant des funérailles ».
- Exigences :
  - VOX-17 : « Une personne masquée n'est jamais comptée ni nommée »
  - VOX-24 : « Fonctionne sans réseau »
  - PAR-07 (partie voix ; voir doute section 4) : « « Ajoute un souvenir avec Maman Fatou » trouve la bonne fiche »
  - Obligations reçues des relectures (T-026, ADR 0031, Conséquences) : lecture à voix haute, réponses et contexte de la voix utilisent le même résolveur de noms que T-029 ; les noms passés aux mots des liens (`nameOf` de `describeLink`) viennent de `chooseDisplayName` de `@lignee/domain`, appliqué aux seuls noms de l'instantané du lecteur : jamais un ancien prénom, jamais une personne qu'il ne voit pas. Un texte de lien construit avec le nom d'usage « moi seul » d'un auteur ne sert qu'à cet auteur (jamais une notification, un export partagé, le contexte de la voix d'un autre lecteur, un journal).
- Cas limites : CL-VOI-24.
- Dépend de : T-029, T-041, T-079.
- Agent : pipeline-vocal, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

#### T-091 — Ajouter une photo de profil légère et le mode Économie de données
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : TRD, Médias et économie de données ; PRD, MEM-01, HOL-04.
- Exigences :
  - MEM-01 : « Moins de 60 Ko par photo de profil »
  - CPT-12 (partie photo) : « Changement de langue immédiat, sans redémarrer »
  - HOL-04 : « Activable et désactivable en une touche »
- Cas limites : CL-RES-04.
- Dépend de : T-051, T-086.
- Agent : ecrans-lignee, avec sync-hors-ligne.
- Taille : M.

#### T-092 — Commenter une fiche ou une proposition
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, COL-05 ; TRD, API (Propositions).
- Exigences :
  - COL-05 : « Visibles par ceux qui voient la fiche »
- Cas limites : aucun en propre.
- Dépend de : T-080, T-086.
- Agent : api-serveur, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

#### T-093 — Notifier les propositions, les invitations, les divorces et le résumé de la semaine
- Module : worker · Étiquettes : `V1`, `worker` · Qui : Sv
- Source : PRD, Rappels et notifications ; PRD, CPT-14.
- Exigences :
  - NOT-03 : « Une notification mène directement à l'écran concerné »
  - NOT-04 : « Le premier nom vient d'abord, l'action ensuite »
  - CPT-14 : « Notification au propriétaire dès qu'une union d'un membre passe à « divorce » »
  - COL-07 (partie « son auteur prévenu ») : « Aucune saisie perdue sur le scénario de test à deux téléphones »
- Cas limites : CL-SEC-09, CL-POL-07.
- Dépend de : T-080, T-084, T-088.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

### Bloc M — Activité, droits des personnes, administration

#### T-094 — Afficher le fil d'activité et le tableau de bord du propriétaire
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, Collaboration.
- Exigences :
  - COL-06 : « Ne montre jamais une donnée masquée pour celui qui regarde »
  - COL-11 : « Mis à jour à chaque synchronisation »
- Cas limites : aucun en propre.
- Dépend de : T-063, T-080.
- Agent : ecrans-lignee, avec api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-095 — Saisir pour un proche sans smartphone
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, COL-12.
- Exigences :
  - COL-12 : « L'historique indique les deux noms »
- Cas limites : aucun en propre.
- Dépend de : T-071.
- Agent : ecrans-lignee.
- Taille : S.

#### T-096 — Exporter ses données
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, EXP-01, CON-09 ; TRD, API (Imports et exports, `POST /me/export`).
- Exigences :
  - EXP-01 : « Archive complète en moins de 24 h »
  - CON-09 : « Archive complète disponible en moins de 24 h »
- Cas limites : aucun en propre.
- Dépend de : T-056, T-086, T-088.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-097 — Recevoir les demandes de droits, y compris des non-membres
- Module : api · Étiquettes : `V1`, `api`, `web` · Qui : Sv
- Source : PRD, CON-07, CON-08, ADM-04 ; TRD, API (`POST /privacy-requests`) ; TRD, Conformité (Droits des personnes).
- Exigences :
  - CON-07 : « Réponse sous 30 jours ; la place dans l'arbre est gardée sans les données »
  - CON-08 : « Demande traitée par le propriétaire de l'arbre, puis par le support »
  - ADM-04 : « Traitées sous 30 jours et journalisées »
- Cas limites : CL-SEC-10.
- Dépend de : T-061, T-083.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-098 — Sauvegarder la base et restaurer une fiche ou un arbre à une date
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : PRD, EXP-02 ; TRD, Observabilité, sauvegardes et exploitation (Sauvegardes).
- Exigences :
  - EXP-02 : « Restauration testée chaque mois »
  - TRD : pgBackRest, sauvegarde complète quotidienne et archivage continu, chiffrés et copiés sur R2 ; perte maximale de 15 minutes ; remise en service en 4 heures.
- Cas limites : aucun en propre.
- Dépend de : T-068, T-071.
- Agent : exploitation, avec api-serveur.
- Taille : M.

#### T-099 — Ouvrir la console d'administration
- Module : admin · Étiquettes : `V1`, `admin` · Qui : Sv
- Source : PRD, ADM-01 ; TRD, API (Administration) ; TRD, Confidentialité appliquée (point 4).
- Exigences :
  - ADM-01 : « Aucun accès au contenu d'un arbre sans demande écrite du propriétaire, tracée »
  - TRD : rôle interne, double authentification, chaque accès journalisé (conservé 1 an).
- Cas limites : CL-SEC-15.
- Dépend de : T-049.
- Agent : api-serveur ; relecture gardien-confidentialite.
- Taille : M.

#### T-100 — Signaler un contenu ou un membre et modérer
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, ADM-02, ADM-07, CPT-13.
- Exigences :
  - ADM-02 : « Réponse sous 72 h »
  - ADM-07 : « Règles publiées dans les conditions d'utilisation »
  - CPT-13 (partie blocage) : « Accès retiré à la synchronisation suivante ; ses ajouts restent dans l'arbre »
- Cas limites : aucun en propre.
- Dépend de : T-099.
- Agent : api-serveur, avec ecrans-lignee.
- Taille : M.

#### T-101 — Intégrer l'aide et les contacts
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : Mo
- Source : PRD, ADM-03 ; `docs/cahier-des-charges/guide-utilisation.md`.
- Exigences :
  - ADM-03 : « Réponse sous 72 h »
  - Une aide limitée aux fonctions V1 (voir doute section 4 sur le guide).
- Cas limites : aucun.
- Dépend de : T-011.
- Agent : ecrans-lignee.
- Taille : S.
- Bloqué par : numéro WhatsApp de contact et adresse e-mail du support.

#### T-102 — Recueillir les consentements versionnés et publier les conditions
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, ADM-08 ; TRD, Conformité (Base légale) ; TRD, Modèle de données (`consentements`).
- Exigences :
  - ADM-08 : « Validées par le juriste avant la bêta »
  - TRD : « Consentements séparés et versionnés : conditions, enregistrement d'un récit, calque santé, mesure d'usage » (en V1 : conditions et mesure d'usage).
- Cas limites : aucun.
- Dépend de : T-047.
- Agent : api-serveur, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : S.
- Bloqué par : avis juridique, lieu de la société (responsable du traitement).

#### T-103 — Mesurer l'usage de façon anonyme et calculer les indicateurs V1
- Module : api · Étiquettes : `V1`, `api` · Qui : Sv
- Source : PRD, ADM-05 ; présentation, Objectifs et indicateurs ; TRD, Confidentialité appliquée (Minimisation).
- Exigences :
  - ADM-05 : « Refuser la mesure ne change rien au fonctionnement »
  - Indicateurs V1 calculables : arbres à 10 personnes en 7 jours, temps médian, ajouts vocaux validés sans corriger le lien, questions par dictée, membres actifs à 30 jours, données par session.
  - Outil non fixé par le TRD : une ADR avant de coder.
- Cas limites : aucun.
- Dépend de : T-068, T-102.
- Agent : api-serveur, avec ecrans-lignee ; relecture gardien-confidentialite.
- Taille : M.

### Bloc N — Porte de fin de V1

#### T-104 — Automatiser les parcours V1 avec Maestro
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : 2
- Source : TRD, Tests et qualité (Parcours) ; PRD, Parcours clés.
- Exigences :
  - HOL-01 : « En mode avion, les parcours de la V1 passent ; seuls les invitations et l'analyse de la voix attendent le réseau »
  - Parcours : « Premier arbre », « Dicter une branche polygame », « Inviter la famille au pays », « Savoir qui est qui avant des funérailles ». Chaque nuit sur émulateur.
- Cas limites : aucun en propre.
- Dépend de : T-082, T-084.
- Agent : testeur-qualite.
- Taille : M.

#### T-105 — Mesurer la performance sur les téléphones de référence
- Module : mobile · Étiquettes : `V1`, `mobile` · Qui : 2
- Source : TRD, Performance et appareils cibles.
- Exigences :
  - ARB-01 : « S'ouvre en moins de 1 s pour 500 personnes sur l'Android de référence »
  - ARB-02 : « Zoom par pincement sans saccade : 60 images par seconde visées, 30 au minimum »
  - ARB-03 : « Un homme avec 8 épouses et 40 enfants reste lisible au niveau « branche » (revue visuelle sur l'Android de référence) »
  - ARB-10 (partie temps) : « moins de 300 ms hors-ligne pour 5 000 personnes »
  - HOL-06 : « Mesuré sur le paquet publié par le Play Store »
- Cas limites : CL-RES-05, CL-FAM-20, CL-POL-12.
- Dépend de : T-078.
- Agent : testeur-qualite.
- Taille : M.

#### T-106 — Tester sur un réseau lent
- Module : sync · Étiquettes : `V1`, `sync` · Qui : 2
- Source : PRD, HOL-08.
- Exigences :
  - HOL-08 : « Test avec un réseau simulé à 50 kbit/s »
- Cas limites : CL-RES-03.
- Dépend de : T-067, T-079.
- Agent : testeur-qualite, avec sync-hors-ligne.
- Taille : S.

#### T-107 — Auditer l'accessibilité et tester le mode Aînés
- Module : ui · Étiquettes : `V1`, `ui` · Qui : Mo
- Source : PRD, Accessibilité, mode Aînés et langues ; charte, `09-accessibilite.md`.
- Exigences :
  - ACC-01 : « Audit d'accessibilité avant la bêta »
  - ACC-02 : « Le parcours « Premier arbre » se fait entièrement au lecteur d'écran »
  - ACC-03 : « Testé avec trois personnes de plus de 70 ans avant la bêta publique »
  - ACC-05 : « Chaque texte relu par un locuteur natif »
  - PAR-11 : « Relu par un locuteur natif anglais avant la sortie »
- Cas limites : aucun en propre.
- Dépend de : T-104.
- Agent : ecrans-lignee, avec testeur-qualite.
- Taille : M.

#### T-108 — Écrire les runbooks et faire l'exercice d'incident
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : PRD, ADM-06 ; TRD, Observabilité (Procédures) ; TRD, Conformité (Violation de données).
- Exigences :
  - ADM-06 : « Un exercice d'incident par an »
  - TRD : procédures dans `docs/runbooks/` : panne, restauration, violation de données, rotation des secrets, demande d'effacement.
- Cas limites : aucun.
- Dépend de : T-098.
- Agent : exploitation ; relecture gardien-confidentialite.
- Taille : M.
- Bloqué par : lieu de la société (CNIL ou non), contact de l'Autorité camerounaise.

#### T-109 — Enregistrer le jeu de 300 phrases réelles
- Module : voice · Étiquettes : `V1`, `voice` · Qui : 2
- Source : PRD, VOX-02 ; TRD, Pipeline vocal (Tests) ; présentation, Risques (« Jeu de test de vraies voix avant la bêta »).
- Exigences :
  - VOX-02 : « Jeu de test de 300 phrases réelles, accents camerounais compris : 90 % de liens corrects »
- Cas limites : rejoue CL-VOI-01 à CL-VOI-30 (sauf CL-VOI-22) sur de vraies voix.
- Dépend de : T-069.
- Agent : pipeline-vocal ; relecture gardien-confidentialite.
- Taille : M.
- Bloqué par : règle de stockage des enregistrements réels (conflit CLAUDE.md et TRD), modèle d'accord des locuteurs, avis juridique (section 4).

#### T-110 — Faire tourner la chaîne vocale complète chaque nuit
- Module : voice · Étiquettes : `V1`, `voice`, `exploitation` · Qui : Sv
- Source : TRD, Pipeline vocal (Tests) ; TRD, Tests et qualité (Voix).
- Exigences :
  - VOX-02 : « Jeu de test de 300 phrases réelles, accents camerounais compris : 90 % de liens corrects »
  - TRD : « chaque nuit, la chaîne complète tourne sur les vrais services et publie le taux de liens corrects. Une baisse bloque la sortie. »
- Cas limites : aucun en propre.
- Dépend de : T-075, T-109.
- Agent : exploitation, avec pipeline-vocal.
- Taille : M.
- Bloqué par : choix du fournisseur de transcription.

#### T-111 — Préparer la production
- Module : exploitation · Étiquettes : `V1`, `exploitation` · Qui : Sv
- Source : TRD, Environnements (Production) ; TRD, Observabilité ; TRD, Hébergement et coûts.
- Exigences : aucune en propre. Critères (TRD) : « VPS dans l'Union européenne, sauvegardes chiffrées hors du VPS » ; Prometheus et Grafana « à partir de la V1 publique » ; alertes de dépense au-delà de 120 % du budget ; HTTPS seul avec HSTS, ports fermés sauf 443 et SSH par clé.
- Cas limites : aucun.
- Dépend de : T-068, T-074, T-098.
- Agent : exploitation ; relecture gardien-confidentialite.
- Taille : L.
- Bloqué par : lieu d'hébergement, lieu de la société, autorisation préalable de l'Autorité (section 4).

---

## 3. Étapes et cycles de 4 semaines

Le code est écrit, relu et fusionné par Claude et ses agents ; Daniel teste sur téléphone quand il veut (ADR 0019). La relecture humaine n'est donc plus la limite : ce sont l'usage et la CI. L'hypothèse ci-dessous date de l'ADR 0005 et sera remesurée. Hypothèse de départ : environ **12 « unités » par cycle de 4 semaines** (S = 0,5 ; M = 1 ; L = 2), soit environ trois pull requests relues par semaine. On la mesure à la fin du premier cycle et on corrige ce tableau.

Le travail reste découpé en 25 **étapes**, dans l'ordre des dépendances, chacune avec son objectif et sa démo. Le total fait environ 121 unités, soit **environ 11 cycles**, un peu moins d'un an.

| Étape | Objectif court | Unités | Cycle(s) |
| --- | --- | --- | --- |
| 1 | Poser le socle | 4,5 | 1 |
| 2 | Préparer la disposition et l'app vide | 5 | 1 |
| 3 | Charger un arbre dans le téléphone | 6 | 1 à 2 |
| 4 | Montrer le premier arbre sur le téléphone | 5 | 2 |
| 5 | Calculer les liens justes | 4,5 | 2 à 3 |
| 6 | Dire le lien en français et en anglais | 5 | 3 |
| 7 | Saisir à la main, hors-ligne | 5 | 3 |
| 8 | Retrouver qui est qui | 5 | 3 à 4 |
| 9 | Placer, dédoublonner, démarrer le serveur | 4,5 | 4 |
| 10 | Se connecter par code | 5 | 4 à 5 |
| 11 | Créer l'arbre de la famille | 5 | 5 |
| 12 | Régler qui voit quoi | 5 | 5 |
| 13 | Ne rien trahir | 5 | 5 à 6 |
| 14 | Recevoir les saisies et comprendre une dictée | 5 | 6 |
| 15 | Poser les bonnes questions, tirer les changements | 4,5 | 6 à 7 |
| 16 | Synchroniser deux téléphones | 5 | 7 |
| 17 | Tenir 7 jours hors-ligne et régler la visibilité | 5 | 7 |
| 18 | Dicter, même sans réseau | 4,5 | 8 |
| 19 | Premier arbre à la voix | 5 | 8 |
| 20 | Inviter la famille et dicter une branche polygame | 5 | 8 à 9 |
| 21 | Répondre, rappeler, montrer les visages | 5 | 9 |
| 22 | Collaborer et rendre ses données | 4,5 | 9 |
| 23 | Administrer sans lire les arbres | 5 | 10 |
| 24 | Vérifier la qualité de la porte | 4,5 | 10 |
| 25 | Préparer la bêta | 4 | 10 à 11 |

L'arbre généré apparaît sur le téléphone au cycle 2 (étape 4). Le premier parcours V1 complet (« Savoir qui est qui », hors-ligne) se montre au cycle 4 (étape 8). « Premier arbre » de bout en bout arrive au cycle 8 (étape 19).

**Le chemin critique est humain.** Ces actions de Daniel doivent démarrer dès le cycle 1 pour ne pas bloquer le code :

| Action de Daniel | Nécessaire pour | Au plus tard |
| --- | --- | --- |
| ~~Android de référence et iPhone de test~~ : fait, un itel et un iPhone (noter le modèle exact, la mémoire et la version d'Android) | Démos sur téléphone (étape 4) | — |
| Créer la société au Cameroun | Comptes stores, Apple, WhatsApp Business (étapes 10, 20) | Cycle 4 |
| Ouvrir les comptes Mistral et Anthropic, demander la conservation nulle, signer les DPA | Chaîne vocale réelle (étape 14) | Cycle 6 |
| Compte WhatsApp Business et agrégateur SMS | Connexion par code en préproduction (étape 10, puis 16) | Cycle 7 |
| Juriste, dossier d'autorisation de transfert, représentant dans l'UE (ADR 0002) | Toute donnée réelle sur le serveur, bêta (étape 25) | Dépôt du dossier au cycle 3 |
| Recruter les locuteurs du jeu vocal, recueillir leur accord | Banc d'essai de transcription (ADR 0003), mesure VOX-02 | Cycle 6 |
| Conseil en marques, réservation de lignee.cm (ADR 0004) | Liens d'invitation et fiches des stores (étapes 20, 25) | Cycle 5 |
| Recruter 20 familles pilotes, dont 5 polygames, et 3 personnes de plus de 70 ans | Bêta et mode Aînés (étapes 24, 25) | Cycle 8 |

### Étape 1 — Poser le socle
- Objectif : un monorepo qui compile, une CI qui bloque, un modèle de données typé.
- Tickets : T-001, T-002, T-003, T-004, T-005, T-006.
- Démo : la CI est verte. Le scénario CL-POL-03 est lu et validé. Un arbre généré de 500 personnes passe les schémas.
- Laissé de côté : toute interface, tout serveur.
- Téléphones de test : l'itel de Daniel sert d'Android de référence, avec son iPhone.

### Étape 2 — Préparer la disposition et l'app vide
- Objectif : calculer les foyers et lancer une app vide aux couleurs de la charte.
- Tickets : T-007, T-008, T-009, T-010, T-011.
- Démo : l'app s'ouvre sur l'Android de référence et sur un iPhone, en français puis en anglais. Les tests de foyers passent (CL-POL-01, CL-POL-04, CL-POL-06).
- Laissé de côté : le dessin de l'arbre, les liens de parenté.

### Étape 3 — Charger un arbre dans le téléphone
- Objectif : un arbre généré dans la base chiffrée du téléphone, et une disposition complète.
- Tickets : T-012, T-013, T-014, T-015, T-016.
- Démo : un arbre généré est chargé dans la base chiffrée. Les composants de la charte s'affichent. La disposition d'un chef à 8 épouses et 40 enfants est calculée en test (CL-POL-12).
- Laissé de côté : le dessin Skia.

### Étape 4 — Montrer le premier arbre sur le téléphone
- Objectif : voir et parcourir un arbre généré sur l'Android de référence.
- Tickets : T-017, T-018, T-019, T-020.
- Démo : un arbre généré de 500 personnes, foyers polygames, trois niveaux de zoom, boutons + et −, retour à « Vous », cousins germains mariés sans fiche en double.
- Laissé de côté : les mots de parenté, la saisie.

### Étape 5 — Calculer les liens justes
- Objectif : un moteur qui trouve tous les liens, et une fiche lisible.
- Tickets : T-021, T-022, T-023, T-024, T-025.
- Démo : ouvrir une fiche depuis l'arbre. Afficher la descendance de Pierre. Les tests du lévirat et de la co-épouse passent (CL-POL-08, CL-POL-09).
- Laissé de côté : les mots affichés à l'écran.

### Étape 6 — Dire le lien en français et en anglais
- Objectif : « Qui est-ce pour moi ? » sur le téléphone, hors-ligne, dans les deux langues.
- Tickets : T-026, T-027, T-028, T-029.
- Démo : étape du parcours « Savoir qui est qui » sans la recherche. Toucher Thérèse : « Épouse de votre grand-père », chemin surligné, en mode avion, en français puis en anglais.
- Laissé de côté : la recherche, la saisie.

### Étape 7 — Saisir à la main, hors-ligne
- Objectif : construire une branche polygame au clavier, sans réseau.
- Tickets : T-030, T-031, T-032, T-033, T-034.
- Démo : en mode avion, saisir la branche de Pierre : trois unions de rang 1 à 3, un enfant dont la mère est inconnue parmi les épouses (CL-POL-03).
- Laissé de côté : le serveur, la voix.

### Étape 8 — Retrouver qui est qui
- Objectif : premier parcours V1 complet, hors-ligne.
- Tickets : T-035, T-036, T-037, T-038.
- Démo : parcours « Savoir qui est qui avant des funérailles » de bout en bout, en mode avion, sur un arbre généré : chercher « Thérèse », « Qui est-ce pour moi ? », ouvrir son foyer.
- Laissé de côté : « À placer », les doublons.

### Étape 9 — Placer, dédoublonner, démarrer le serveur
- Objectif : ranger ce qu'on ne sait pas placer, détecter les doublons, poser l'API.
- Tickets : T-039, T-040, T-041, T-042, T-043.
- Démo : placer Odette depuis « À placer » (CL-GEN-13). « Est-ce elle ? » sur « Mbarga » et « Mbaraga » (CL-DON-15). L'API répond en local.
- Laissé de côté : la connexion.

### Étape 10 — Se connecter par code
- Objectif : un compte ouvert par numéro de téléphone.
- Tickets : T-044, T-045, T-046, T-047.
- Démo : étape 2 de « Premier arbre » : numéro de téléphone, code reçu (faux fournisseur WhatsApp en local), puis l'app rouverte sans réseau. Fusion d'un doublon, puis annulation.
- Laissé de côté : l'envoi réel par WhatsApp (compte non ouvert).

### Étape 11 — Créer l'arbre de la famille
- Objectif : créer un arbre, s'y placer, et poser les droits.
- Tickets : T-048, T-049, T-050, T-051.
- Démo : étapes 3 et 4 de « Premier arbre » : « Créer l'arbre de la famille Kamga », se placer comme « Vous ». Changer de langue sans redémarrer. Activer le mode Aînés.
- Laissé de côté : la visibilité, la synchronisation.

### Étape 12 — Régler qui voit quoi
- Objectif : des règles de visibilité testées et des rôles gérables.
- Tickets : T-052, T-053, T-054, T-055.
- Démo : Tonton Paul est désigné responsable de sa branche. Une union limitée à « personnes choisies » (CL-SEC-07) passe les tests. Un appareil est déconnecté à distance (CL-SEC-14).
- Laissé de côté : la projection serveur.

### Étape 13 — Ne rien trahir
- Objectif : le serveur ne renvoie que ce que chacun peut voir.
- Tickets : T-056, T-057, T-058, T-059.
- Démo : les tests de non-fuite passent sur des arbres générés (CL-SEC-01 à CL-SEC-04). Un mineur rejoint l'arbre avec l'accord d'un parent (CL-SEC-11).
- Laissé de côté : la synchronisation.

### Étape 14 — Recevoir les saisies et comprendre une dictée
- Objectif : le serveur accepte les mutations ; le résolveur produit un plan.
- Tickets : T-060, T-061, T-062.
- Démo : la dictée « Mes parents sont Jean Kamga et Hélène Ngo Biyong, j'ai deux frères, Marc et Simon » (réponse du modèle enregistrée) donne le bon plan. Le serveur refuse un troisième parent de naissance (CL-DON-11).
- Laissé de côté : le tirage, l'écran de la voix.

### Étape 15 — Poser les bonnes questions, tirer les changements
- Objectif : un résolveur qui questionne juste, et un tirage léger.
- Tickets : T-063, T-064, T-065, T-066.
- Démo : « Ajoute ma grand-mère Odette » déclenche « Du côté de votre père ou de votre mère ? » (CL-GEN-01). L'instantané d'un arbre de 1 000 personnes tient sous 2 Mo, mesuré en CI.
- Laissé de côté : la synchronisation côté téléphone.

### Étape 16 — Synchroniser deux téléphones
- Objectif : deux téléphones, un serveur de préproduction, le même arbre.
- Tickets : T-067, T-068, T-069.
- Démo : deux téléphones reliés à la préproduction voient le même arbre. Saisie en mode avion, puis synchronisation sans rien toucher.
- Laissé de côté : les conflits poussés, l'historique.

### Étape 17 — Tenir 7 jours hors-ligne et régler la visibilité
- Objectif : aucune perte, et la visibilité réglable à l'écran.
- Tickets : T-070, T-071, T-072, T-073, T-074.
- Démo : CL-RES-01 (7 jours simulés hors-ligne sur deux téléphones, aucune perte). Masquer une union, puis « Voir comme » Comfort (CL-SEC-12).
- Laissé de côté : la voix sur le téléphone.

### Étape 18 — Dicter, même sans réseau
- Objectif : la dictée part du téléphone et revient transcrite.
- Tickets : T-075, T-076, T-077, T-078.
- Démo : dicter en mode avion, puis retrouver la transcription au retour du réseau (CL-VOI-25). Le build de préproduction s'installe depuis la piste interne.
- Laissé de côté : l'aperçu, les propositions.

### Étape 19 — Premier arbre à la voix
- Objectif : le parcours « Premier arbre » de bout en bout.
- Tickets : T-079, T-080, T-081, T-082.
- Démo : parcours « Premier arbre » complet : installer, code, créer l'arbre, « Vous », dicter, vérifier l'aperçu, « Oui, ajouter ». On chronomètre les 10 personnes.
- Laissé de côté : l'invitation par lien, les écrans de propositions.

### Étape 20 — Inviter la famille et dicter une branche polygame
- Objectif : faire entrer Comfort et dicter le foyer de Pierre.
- Tickets : T-083, T-084, T-085, T-086, T-087.
- Démo : parcours « Inviter la famille au pays » et « Dicter une branche polygame ».
- Laissé de côté : les notifications.

### Étape 21 — Répondre, rappeler, montrer les visages
- Objectif : la voix répond, les rappels partent, les photos de profil arrivent.
- Tickets : T-088, T-089, T-090, T-091, T-092.
- Démo : « Qui est Ibrahim pour moi ? » à la voix, réponse lue en mode Aînés (CL-VOI-24). Un rappel d'anniversaire à 8 h, heure locale. Une photo de profil sous 60 Ko.
- Laissé de côté : le résumé de la semaine.

### Étape 22 — Collaborer et rendre ses données
- Objectif : la collaboration complète et les droits des personnes.
- Tickets : T-093, T-094, T-095, T-096, T-097.
- Démo : Comfort dicte dans la branche de Tonton Paul. Il reçoit la proposition, la commente et l'accepte (CL-VOI-28). Export de ses données.
- Laissé de côté : la console d'administration.

### Étape 23 — Administrer sans lire les arbres
- Objectif : support, consentements, mesure d'usage et restauration.
- Tickets : T-098, T-099, T-100, T-101, T-102, T-103.
- Démo : restauration d'un arbre à une date sur la préproduction. Console d'administration sans contenu d'arbre (CL-SEC-15). Consentements versionnés.
- Laissé de côté : la production.

### Étape 24 — Vérifier la qualité de la porte
- Objectif : prouver les parcours, la performance et l'accessibilité.
- Tickets : T-104, T-105, T-106, T-107, T-108.
- Démo : les quatre parcours V1 tournent dans Maestro. Mesures sur l'Android de référence. Rapport d'audit d'accessibilité.
- Laissé de côté : les vraies voix.

### Étape 25 — Préparer la bêta
- Objectif : vraies voix mesurées et production prête.
- Tickets : T-109, T-110, T-111.
- Démo : rapport du jeu de 300 phrases réelles (taux de liens corrects, médiane des questions). Production en place. Dossier de porte prêt (section 5).
- Laissé de côté : tout ce qui est V2.

---

## 4. Questions ouvertes et doutes

### Questions du cahier qui bloquent un ticket

État au 15 octobre 2026, après les ADR 0002 à 0005.

| Question ouverte (présentation) | État | Tickets bloqués |
| --- | --- | --- |
| Où créer la société, en France ou au Cameroun ? | **Tranchée** : au Cameroun (ADR 0002). Comptes au nom de la société camerounaise ; représentant dans l'UE à désigner | T-078, T-053, T-044 attendent la création de la société ; T-102 et T-108 suivent l'ADR 0002 |
| Quels traitements demandent une autorisation préalable de l'Autorité, avant la bêta ? | **Plus pressante** : l'hébergement dans l'UE est un transfert, soumis à autorisation (ADR 0002) | T-109 (enregistrements réels), T-111, T-068 avec des données réelles, la bêta elle-même |
| Où héberger les données (Union européenne ou Afrique) ? | **Tranchée** : Union européenne (ADR 0002) | Plus aucun, hors autorisation de transfert |
| Quel fournisseur de transcription ? | **Proposée** : Voxtral par défaut, Scribe v2 en challenger, choix figé après le banc d'essai (ADR 0003) | T-075 (adaptateur), T-109 (banc d'essai), T-110 |
| Le nom « Lignée » est-il libre (OAPI, INPI, stores) ? | **Vérifié en partie** : marque INPI « LIGNEE » en vêtements, site lignee.net de généalogie, lignee.cm probablement libre (ADR 0004) | T-083, T-078, T-044, T-111, jusqu'à l'avis d'un conseil |
| Quel rôle et quelle disponibilité pour le second développeur ? | **Tranchée** : pas de second développeur ; Claude écrit le code, Daniel relit et fusionne (ADR 0005) | Plus aucun ; calendrier recalculé en section 3 |
| Prix, imprimeur, pidgin | Ouvertes | Aucun ticket V1 |

Prérequis externes non listés comme questions dans le cahier, mais qui bloquent aussi :

- Compte WhatsApp Business Platform et validation du modèle d'authentification : T-044 (en production), T-101 (contact).
- Agrégateur SMS local et enregistrement de l'expéditeur « Lignee » : T-044.
- Fournisseur d'e-mails transactionnels européen (le TRD ne le nomme pas) : T-053 (lien magique), NOT-08.
- Outil de mesure d'usage anonyme (le TRD ne le nomme pas) : T-103, une ADR d'abord.
- Avis juridique sur la forme de l'accord parental : T-059.
- Locuteur natif anglais pour PAR-11 et ACC-05 : T-027, T-107.
- Trois personnes de plus de 70 ans pour ACC-03 : T-107.

### Doutes d'interprétation du cahier

1. **La porte de fin de V1 n'est pas lisible.** La feuille de route est une figure intégrée (« feuille de route · 5 versions, 4 portes »), absente du texte. La section 5 est reconstruite à partir du reste du cahier.
2. **« 5 versions » pour V1 à V4.** Le cahier ne nomme que quatre versions. Il existe peut-être une V0 ou une étape « bêta » à part. À confirmer.
3. **Couleur des avatars.** ARB-12 dit « par branche, selon la règle de la charte ». La charte (`03-couleurs.md`) calcule la teinte à partir du nom de naissance. Ce n'est pas la même règle.
4. **Mode Aînés (ACC-03).** L'accueil doit montrer « voir l'arbre, raconter, regarder les photos ». Raconter (récits) et les photos d'album sont V2. Que montrer en V1 ?
5. **Barre d'onglets.** La charte prévoit Arbre, Famille, Santé, Mémoire. Santé est V3, Mémoire est V2. Quels onglets en V1 ?
6. **HOL-07.** Le critère parle d'« un audio de 20 minutes ». En V1, il n'y a que des dictées de 2 minutes et des commentaires vocaux courts. Les récits sont V2.
7. **Mode Économie (HOL-04) et carte (CON-13).** En V1, le mode Économie ne touche que les photos de profil. La carte est V2 : en V1, seul le réglage existe.
8. **CL-DON-05** parle de la chronologie, qui est V2 (MEM-11). Le test V1 se limite à la date approximative.
9. **PAR-07.** Le critère « Ajoute un souvenir avec Maman Fatou » s'appuie sur les souvenirs, qui sont V2 (MEM-10). Il faut un autre exemple de test en V1.
10. **Cause de décès (UNI-15).** C'est une donnée de santé saisie dès la V1, alors que la santé attend la V3 et que VOX-19 interdit toute santé par la voix. Faut-il la saisir en V1, avant l'AIPD et l'avis juridique ? À trancher avec `gardien-confidentialite`.
11. **Données réelles.** Le TRD range « 300 phrases réelles » dans `test/voice-golden/` et teste la clé phonétique sur « une liste de noms réels fournie par les familles pilotes ». CLAUDE.md interdit les données réelles de familles dans le dépôt. Il faut une ADR sur l'endroit où ces données vivent.
12. **Règle de conflit.** Le PRD (COL-07) dit « la plus récente gagne ». Le TRD dit « la dernière modification reçue par le serveur gagne ». Ce n'est pas pareil après une longue période hors-ligne. Une ADR est à écrire dans T-067.
13. **Guide d'utilisation.** Il décrit trois rôles (Administrateur, Contributeur, Lecteur) alors que le PRD en fixe quatre. Il décrit aussi des fonctions V2 à V4 (scan, GEDCOM, santé, version web). L'aide intégrée de la V1 (ADM-03) en demande une version mise à jour.
14. **Polices.** La charte parle d'un kit avec `code/tokens.ts` et des fichiers TTF. Le dépôt ne contient que `tokens.json` et des WOFF2. React Native et Skia ont besoin des TTF (T-009, T-011, T-017).
15. **`apps/web` en V1.** Le TRD y range les pages d'invitation. La V1 en a besoin (T-083), ainsi que du formulaire de droits ouvert aux non-membres (T-097). J'ai ajouté l'étiquette `web`.
16. **Préproduction.** Le TRD dit qu'elle sert aussi à la bêta fermée. Elle contiendra alors des données réelles, et les questions d'hébergement et d'autorisation s'y appliquent.

---

## 5. Franchir la porte de fin de V1

La figure de la feuille de route n'est pas lisible. Cette liste rassemble ce que le cahier exige avant la bêta, avant la V1 publique, ou « à chaque porte ». À valider par Daniel.

**Produit**
- Les 142 exigences V1 vérifiées, avec des tests liés à leurs identifiants.
- Les 114 cas limites V1 ont chacun un fichier `test/scenarios/<ID>.yaml` et un test vert.
- Les quatre parcours V1 passent dans Maestro, sur l'Android de référence et sur un iPhone, y compris en mode avion (HOL-01).
- PAY-01 : « Aucun écran de paiement avant la V3 ». PAY-08 : « Mode Aînés, export de ses données et réglages de visibilité gratuits pour toujours ».
- Aucune fonction V2, V3 ou V4 livrée.

**Mesures**
- Voix : 90 % de liens corrects sur les 300 phrases réelles (VOX-02), médiane d'une question au plus (VOX-08), 95 % des doublons détectés (VOX-13).
- Parenté : 100 % des 200 paires en français et en anglais (PAR-02).
- Performance : le tableau du TRD tenu sur les deux téléphones de référence ; moins de 40 Mo installé (HOL-06) ; moins de 1 Mo par session et moins de 2 Mo pour le premier chargement de 1 000 personnes (HOL-05).
- Hors-ligne : 7 jours sur deux téléphones sans perte (HOL-03, CL-RES-01).

**Accessibilité et langues**
- Audit d'accessibilité fait (ACC-01) ; « Premier arbre » au lecteur d'écran (ACC-02).
- Mode Aînés testé avec trois personnes de plus de 70 ans (ACC-03, avant la bêta publique).
- Textes relus par des locuteurs natifs (ACC-05, PAR-11).

**Confidentialité et conformité**
- Revue de sécurité et de confidentialité de la porte (présentation, Rituels).
- Tests de non-fuite verts (CON-05).
- Analyse d'impact (AIPD) pour la voix et les personnes vivantes, « avant la bêta publique de la V1 » (TRD, Conformité) ; registre des traitements dans `docs/conformite/`.
- Avis juridique ; lieu de la société décidé ; autorisation préalable de l'Autorité si elle est requise.
- Conditions et politique validées par le juriste (ADM-08).
- Clause « pas d'entraînement, conservation minimale » signée avec chaque fournisseur de voix (VOX-21).
- Formulaires des stores : étiquettes de confidentialité d'Apple, « Sécurité des données » de Google Play ; suppression du compte dans l'app.

**Exploitation**
- Production en place, sauvegardes chiffrées, restauration testée (EXP-02).
- Runbooks écrits et un exercice d'incident fait (ADM-06).
- Suivi des erreurs et alertes actifs ; taux de plantage et d'ANR suivis.

**Bêta**
- Piste fermée Google Play et TestFlight, 20 familles pilotes dont 5 polygames, « avant la V1 publique » (TRD, Tests).
- Une séance par mois avec une famille pilote, de préférence avec un aîné.
- Indicateurs V1 mesurés (ADM-05, T-103), puis cibles revues avec les familles pilotes, comme le prévoit la présentation.
- Recherche d'antériorité du nom « Lignée » avant toute dépense de marque (présentation, Risques).
