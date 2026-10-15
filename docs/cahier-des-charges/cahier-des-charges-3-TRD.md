# TRD — Exigences techniques

Lignée se construit avec Expo (React Native), Hono, Prisma et PostgreSQL : un client qui fonctionne hors-ligne d'abord, un serveur qui garde la référence et applique les droits, et un moteur de parenté partagé entre les deux, couvert par les tests des cas limites.

## Architecture d'ensemble

Lignée a trois étages. Le téléphone garde une copie de la partie de l'arbre que son utilisateur a le droit de voir, et y travaille sans réseau. Le serveur garde la référence et applique tous les droits. Les services externes (transcription, IA, messages, paiement) ne sont appelés que par le serveur.

&#91;embedded content: architecture · téléphone, serveur, services externes\]

Deux règles en découlent. Aucune donnée qu'un utilisateur n'a pas le droit de voir n'arrive sur son téléphone, si bien que la recherche, le calcul de parenté et l'arbre ne peuvent rien trahir. Et le moteur de parenté est un seul paquet TypeScript, utilisé à l'identique sur le téléphone et sur le serveur.

## Choix techniques

La stack reste celle que Daniel maîtrise, et chaque brique doit marcher hors-ligne sur un petit Android. Chaque choix ci-dessous fera l'objet d'une note de décision dans `docs/adr/`.

| Couche | Choix | Pourquoi | Écarté |
| --- | --- | --- | --- |
| App | Expo (React Native), TypeScript strict, Expo Router, moteur Hermes | Une seule base de code pour iOS et Android, builds et mises à jour par EAS | Flutter (autre langage), deux apps natives (double travail) |
| Base sur le téléphone | expo-sqlite avec Drizzle ORM ; FTS5 pour la recherche ; SQLCipher pour chiffrer la base | Requêtes SQL, migrations typées, recherche plein texte et chiffrement déjà pris en charge par expo-sqlite | WatermelonDB (plus lourd, synchronisation à écrire quand même) ; Realm, dont la synchronisation Atlas Device Sync a pris fin le 30 septembre 2025 |
| Synchronisation | Protocole maison : file de changements côté téléphone, journal côté serveur, tirage par curseur | La visibilité se calcule par lecteur, par personne, par union et par lien : trop fin pour des règles de synchronisation génériques | PowerSync (bonne option, à réévaluer si le protocole maison coûte trop), ElectricSQL |
| Dessin de l'arbre | React Native Skia, Gesture Handler, Reanimated | Des milliers de nœuds dessinés vite, gestes fluides | react-native-svg seul, trop lent au-delà de quelques centaines de nœuds |
| État et formulaires | TanStack Query, Zustand, React Hook Form, Zod (schémas partagés avec l'API) | Validation identique sur le téléphone et le serveur | Redux, plus verbeux |
| Langues | i18next, pluriels ICU, français et anglais | Chaînes séparées du code dès le premier jour | — |
| Audio | expo-audio : commandes en mono 16 kHz, récits en AAC mono 32 kbit/s (environ 14 Mo par heure) | Fichiers légers pour un forfait limité | Audio non compressé |
| Chiffrement côté téléphone (V3) | libsodium (XChaCha20-Poly1305, Argon2id) | Calque santé illisible par le serveur | Chiffrement fait maison |
| API | Node.js (version LTS), Hono, Zod, documentation OpenAPI générée | Léger, typé, déjà utilisé par Daniel sur NkamVa | NestJS, plus lourd |
| Base de référence | PostgreSQL avec Prisma ; extensions pg\_trgm, unaccent, fuzzystrmatch | Requêtes récursives pour les branches, recherche approchée des noms | Base orientée graphe (une brique de plus à exploiter) |
| Tâches de fond | pg-boss, une file de tâches stockée dans PostgreSQL | Pas de Redis à maintenir | BullMQ avec Redis |
| Médias | Cloudflare R2 (compatible S3), URL signées, vignettes faites par un worker avec sharp | Sortie gratuite, stockage à 0,015 $ par Go et par mois | Disque du VPS (pas de sauvegarde séparée) |
| Transcription | Voxtral Mini Transcribe 2 (Mistral), avec jusqu'à 100 noms de l'arbre fournis pour l'orthographe | Français et anglais, environ 0,003 $ la minute, fournisseur européen | Whisper auto-hébergé, à réévaluer au-delà de 100 000 dictées par mois |
| Compréhension | Claude Haiku 5.5 avec sorties structurées en JSON | 0,10 $ par million de jetons en entrée, 0,50 $ en sortie ; schéma JSON garanti | Modèle plus gros, inutile pour extraire des mentions |
| Messages | WhatsApp Business Platform pour les codes, agrégateur SMS local en secours, Expo Notifications (FCM, APNs) | 0,0046 $ le code WhatsApp contre 0,317 $ le SMS chez Twilio | SMS seul |
| Paiement (V3) | Achats intégrés (StoreKit 2, Google Play Billing) ; agrégateur mobile money (CinetPay ou Notch Pay) avec retours signés | Les règles des stores et le marché l'imposent | Carte bancaire seule |
| Suivi des erreurs | GlitchTip auto-hébergé (compatible avec les SDK Sentry), journaux JSON avec pino | Gratuit, données chez nous | Service payant dès le départ |
| Code et livraison | Monorepo pnpm et Turborepo, GitHub Actions, EAS Build et Submit, Docker Compose et Caddy sur le VPS | Outils déjà connus du binôme | Kubernetes, surdimensionné |
| Tests | Vitest, fast-check (tests de propriétés), Maestro (parcours sur téléphone), Testcontainers (PostgreSQL réel) | Le moteur de parenté et la visibilité se testent sur des milliers d'arbres générés | Tests manuels seuls |

Les services externes sont appelés derrière une interface interne (transcription, compréhension, messages, paiement), pour pouvoir changer de fournisseur sans toucher au reste.

## Modèle de données

Le modèle tient en trois règles : une union relie exactement deux personnes (la polygamie, ce sont plusieurs unions), une filiation relie un parent et un enfant (pas un couple), et une personne peut exister « à compléter ». C'est aussi la structure du format GEDCOM, ce qui garantit l'import et l'export.

&#91;embedded content: modèle de données · entités centrales\]

Une personne en attente de placement est une vraie fiche, sans lien, accompagnée d'un « À placer » qui garde la personne de référence et le chemin connu (par exemple « parent du parent », côté inconnu).

| Table | Contenu | Règles clés |
| --- | --- | --- |
| `comptes`, `identites` | Téléphone au format international, e-mail, langue, année de naissance ; identités téléphone, e-mail, Google, Apple | Une identité n'appartient qu'à un compte |
| `sessions`, `appareils` | Jetons de rafraîchissement hachés, jeton de notification, plateforme, version de l'app | Révoqués à la déconnexion et à l'exclusion |
| `arbres` | Nom de la famille, langue, ordre des noms, réglages (carte activée…) | Un seul propriétaire |
| `membres` | Compte, arbre, rôle, fiche « Vous », statut | Une fiche est reliée à un seul compte par arbre |
| `branches`, `branche_personnes` | Responsable, personne racine ; table de fermeture des personnes de chaque branche | Recalculée à chaque changement de filiation ou d'union |
| `personnes` | Identifiant UUIDv7 créé sur le téléphone, nature (connue ou à compléter), genre, statut vital, version | « Présumée vivante » calculée : née il y a moins de 100 ans et sans décès |
| `noms` | Type (naissance, usage, surnom, titre, variante, ancien), prénoms, nom, forme d'affichage, écriture | L'ancien prénom est masqué par défaut |
| `unions` | Type, début et fin (dates floues), motif de fin, option déclarée (monogamie, polygamie), simultanéité | Simultanéité déduite des dates, saisie sinon |
| `conjoints_union` | Union, personne, rang de l'union pour cette personne | Exactement deux lignes par union |
| `filiations` | Enfant, parent, type (naissance, adoptif, a élevé, confié, tuteur, donneur, gestation pour autrui), certitude, union d'origine facultative | Au plus deux parents « de naissance » ; aucun cycle |
| `candidats_parent` | Enfant, personne candidate (« mère parmi ses épouses ») | Supprimés quand le parent est précisé |
| `faits` | Personne ou union, type, date floue, lieu, valeur, certitude, version retenue | Plusieurs versions d'un fait possibles (V2) |
| `lieux` | Nom, nom actuel, anciens noms, pays, coordonnées facultatives | Partagés dans un arbre |
| `a_placer` | Personne en attente, personne de référence, chemin, côté, statut | Fermé dès que la personne est placée |
| `noms_usage` | Auteur, personne, libellé (« Maman Fatou »), portée (moi seul ou famille) | Jamais utilisé dans le calcul du lien |
| `visibilites`, `visibilite_comptes` | Objet visé, niveau (arbre, branche, personnes choisies, moi seul), racine de branche, comptes choisis | Une règle par objet ; sans règle, la valeur par défaut du type |
| `sources`, `medias`, `etiquettes_photo`, `recits` | Fichiers, vignettes, personnes repérées sur une photo, locuteur et accord d'un récit, transcription découpée | Un média prend la visibilité de la personne la plus protégée qu'il cite |
| `propositions`, `commentaires` | Changements proposés (liste JSON), auteur, branche, statut, relecteur | Appliqués en une seule transaction à l'acceptation |
| `journal` | Numéro de séquence par arbre, entité, opération, différence, auteur, appareil, identifiant de mutation | Identifiant de mutation unique : un envoi répété n'est appliqué qu'une fois |
| `dictees` | Statut, transcription, extraction, plan, questions | Effacées après 30 jours, l'audio dès la transcription |
| `invitations` | Arbre, fiche, jeton haché, téléphone facultatif, expiration | Usage unique, 30 jours |
| `consentements`, `demandes_droits`, `journal_acces` | Type et version de l'accord, demandes d'accès ou d'effacement, accès sensibles et actions d'administration | Conservés comme preuve |
| `calque_sante` (V3) | Compte propriétaire, contenu chiffré, nonce, version de clé | Le serveur ne détient aucune clé de déchiffrement |
| `abonnements`, `commandes`, `paiements` (V3) | Payeur, arbre bénéficiaire, canal (store ou mobile money), montants en FCFA et en centimes d'euro | Un paiement n'est validé que par un retour signé vérifié |

Une **date floue** est un objet : qualificatif (exacte, vers, avant, après, entre, calculée, texte), précision (jour, mois, année, décennie), une ou deux bornes, le texte d'origine et le calendrier ; une colonne de tri en est déduite. Sur le téléphone, la base SQLite reprend les mêmes tables, limitées à ce que l'utilisateur peut voir.

## Moteur de parenté

Le moteur est un paquet TypeScript pur (`packages/kinship`), sans réseau ni base de données. Il reçoit un graphe (personnes, unions, filiations) déjà limité à ce que l'utilisateur peut voir : il ne peut donc rien révéler de masqué. Il tourne à l'identique sur le téléphone, hors-ligne, et sur le serveur. Il répond à quatre questions.

1. **Quel lien entre A et B ?** Le moteur remonte les filiations depuis A et depuis B jusqu'aux ancêtres communs les plus proches. Pour chacun, le nombre de générations de chaque côté donne le terme : 1 et 1 pour la fratrie, 2 et 1 pour oncle et neveu, 2 et 2 pour les cousins germains, 3 et 3 pour les cousins issus de germains, 3 et 2 pour l'oncle « à la mode de Bretagne ». Deux parents communs font des frères ; un seul, des demi-frères, même père ou même mère ; deux personnes à compléter différentes ne sont jamais supposées identiques, d'où « frère ou demi-frère ». Les liens par alliance passent par les unions : conjoint, parents du conjoint, conjoint d'un parent, et co-épouse (deux unions simultanées avec la même personne). Tous les chemins sont gardés, du plus proche au plus lointain, le sang avant l'alliance, avec la certitude la plus faible du chemin.
2. **Comment le dire ?** Un dictionnaire par langue transforme le résultat (générations, demi, genre, alliance, type de filiation) en mots, en forme courte (« demi-frère, même père ») et en forme expliquée (« fils de votre père et de Mama Rose »). En anglais : half-brother, first cousin once removed, stepmother, co-wife. Au-delà des cousins issus de germains, le terme donne le degré civil (« cousin au 8e degré »).
3. **Qui désigne « ma grand-mère maternelle » ?** Une grammaire de chemins traduit chaque terme en expression, évaluée depuis la personne de référence (tableau ci-dessous). Chaque pas renvoie des personnes connues, des places à compléter à créer, ou plusieurs candidats qui demandent une question.
4. **Quel degré pour la santé (V3) ?** Sur les seuls liens de naissance : 1er degré pour les parents, enfants, frères et sœurs ; 2e pour les demi-frères et demi-sœurs, grands-parents, petits-enfants, oncles, tantes, neveux et nièces ; 3e pour les cousins germains et les arrière-grands-parents.

Notation : P pour parent, C pour enfant, S pour conjoint, Fr pour frère ou sœur (enfant d'un parent, sauf soi), \[F\] ou \[M\] pour le genre.

| Ce qui est dit | Expression | Ce que fait le résolveur |
| --- | --- | --- |
| « ma mère » | P\[F\] | Une réponse, ou une place à compléter |
| « ma grand-mère maternelle » | P\[F\].P\[F\] | Crée la mère à compléter si elle manque |
| « ma grand-mère » | P.P\[F\] | Deux places possibles : une question sur le côté |
| « mon arrière-grand-père » | P.P.P\[M\] | Quatre places possibles : « père de quel grand-parent ? » |
| « ma sœur » | Fr\[F\] | Sans parents connus : deux parents à compléter partagés |
| « mon frère de même père » | P\[M\].C\[M\], sans mère commune | Demi-frère, même père |
| « ma tante » | P.Fr\[F\] ou P.Fr.S\[F\] | Par le sang ou par alliance : une question |
| « ma grand-tante » | P.P.Fr\[F\] ou P.P.Fr.S\[F\] | Côté, puis sang ou alliance |
| « mon cousin » | P.Fr.C\[M\] | « Fils de quel oncle ou de quelle tante ? » |
| « ma belle-mère » | S.P\[F\] ou P\[M\].S\[F\] (hors mère) | Deux sens : une question |
| « mon beau-frère » | S.Fr\[M\] ou Fr.S\[M\] ou S.Fr.S\[M\] | Trois sens : une question |
| « la co-épouse de ma mère » | P\[F\].S.S\[F\], union simultanée, hors P\[F\] | Épouse de votre père |
| « la 2e femme de mon grand-père » | P.P\[M\].S\[F\], rang 2 | Côté du grand-père à préciser |

**Performance** : moins de 50 ms pour un lien dans un arbre de 5 000 personnes sur l'Android de référence, grâce aux ensembles d'ancêtres mis en cache et recalculés seulement pour la partie modifiée.

**Tests** : des propriétés vérifiées sur des milliers d'arbres générés, polygamie, lévirat et implexe compris (le lien de A vers B est l'inverse de celui de B vers A ; une fusion ne change aucun lien ; aucun nœud masqué n'est jamais traversé), un jeu de 200 paires annotées en français et en anglais, et un test par cas limite.

## Pipeline vocal

La voix suit un seul chemin, qu'il s'agisse d'ajouter une personne, de corriger une date ou de poser une question. Le modèle de langue ne fait qu'une chose : transformer la phrase en mentions et en liens. Le placement dans l'arbre, les questions et les contrôles sont du code déterministe, testé comme le reste.

&#91;embedded content: pipeline vocal · 7 étapes, 1 boucle de question\]

**1. Enregistrer.** expo-audio, mono 16 kHz, 2 minutes au plus par commande (au-delà, c'est un récit). Sans réseau, l'audio attend sur le téléphone avec la personne de référence (« Qui parle ? ») et l'écran d'où il vient.

**2. Transcrire.** Un worker envoie l'audio à Voxtral Mini Transcribe 2, langue détectée automatiquement, avec jusqu'à 100 noms de l'arbre en indices d'orthographe (les plus proches du locuteur d'abord) ; cette fonction est annoncée comme optimisée pour l'anglais, son effet sur les noms camerounais sera mesuré sur le jeu de test avant d'en dépendre. L'audio est effacé dès que la transcription est enregistrée.

**3. Relire.** Le texte s'affiche aussitôt. Une correction relance seulement l'étape 4.

**4. Comprendre.** Claude Haiku 5.5 reçoit la transcription, le locuteur, un glossaire des termes de parenté (français, anglais, usages camerounais) et les noms des proches visibles, avec leur lien au locuteur. Il répond dans un schéma JSON imposé par les sorties structurées. Le schéma est plat, car les schémas récursifs ne sont pas acceptés : des listes de mentions, de liens, d'unions et de faits, reliées par des références. Exemple pour « Ajoute ma grand-mère Odette, née vers 1940 à Bafang » :

```json
{
  "intention": "ajouter",
  "mentions": [
    { "ref": "m1", "dit": "ma grand-mère Odette", "prenoms": "Odette", "nom": null, "genre": "F", "fiche_existante": null }
  ],
  "liens": [
    { "de": "locuteur", "terme": "grand-mère", "cote": "inconnu", "demi": null, "vers": "m1", "certitude": "certaine" }
  ],
  "unions": [],
  "faits": [
    { "sur": "m1", "type": "naissance", "date": { "qualificatif": "vers", "annee": 1940 }, "lieu": "Bafang" }
  ],
  "sensible": []
}
```

**5. Placer.** Le résolveur traduit chaque terme en expression de chemin (voir Moteur de parenté), l'évalue depuis la personne de référence, rapproche les mentions des fiches existantes (nom, surnom, nom d'usage, place compatible), crée les places à compléter manquantes et applique les contrôles de cohérence. Ici, la grand-mère peut être de deux côtés : une question.

**6. Aperçu.** Le plan s'affiche en mini-arbre : « Votre mère, à compléter » (nouvelle place) et « Odette, née vers 1940 à Bafang » (nouvelle personne), avec la visibilité proposée pour chaque ligne.

**7. Appliquer.** « Oui, ajouter » passe le plan dans la même file de changements qu'une saisie à la main : même contrôle des droits, même synchronisation, et une proposition si la branche appartient à un autre responsable.

| Étape | Budget de temps | Coût par dictée |
| --- | --- | --- |
| Envoi de 15 s d'audio (environ 45 Ko) en 3G | Moins de 1 s | — |
| Transcription | 1 à 2 s | Environ 0,0008 $ (0,003 $ la minute) |
| Compréhension (environ 4 000 jetons en entrée, 600 en sortie) | 1 à 2 s | Environ 0,0007 $ |
| Placement et aperçu | Moins de 0,2 s | — |
| **Total** | **Moins de 6 s** | **Environ 0,002 $, compté 0,003 $ avec les reprises** |

**Sécurité.** La transcription est traitée comme une donnée d'utilisateur, jamais comme une instruction : la réponse du modèle est contrainte par le schéma, puis revérifiée par le résolveur, qui applique les droits. Le modèle ne reçoit ni donnée de santé, ni personne masquée. Chaque fournisseur signe des conditions sans réutilisation des données pour l'entraînement, avec une conservation minimale.

**Pannes.** Transcription en échec : la personne tape son texte. Compréhension en échec : une nouvelle tentative, puis le formulaire manuel prérempli avec la transcription. Quota de la famille atteint : le clavier reste disponible.

**Tests.** Un jeu de 300 phrases réelles, enregistrées avec l'accord de locuteurs camerounais de tous âges, avec le plan attendu pour chacune. À chaque pull request, le résolveur est testé sur les réponses du modèle enregistrées ; chaque nuit, la chaîne complète tourne sur les vrais services et publie le taux de liens corrects. Une baisse bloque la sortie.

## Hors-ligne et synchronisation

Le serveur fait autorité ; chaque téléphone garde, pour chaque arbre, une copie de la partie qu'il a le droit de voir. Toute saisie s'applique d'abord sur le téléphone, entre dans une file de changements, puis part au serveur, qui l'accepte, la transforme en proposition ou la refuse.

1. **Identifiants créés sur le téléphone** : UUIDv7 (uniques et triés dans le temps), donc aucune collision entre deux téléphones hors-ligne.
2. **File de changements** : chaque modification devient une mutation (identifiant, entité, opération, champs modifiés, version de départ, date). Un plan vocal devient un lot de mutations appliqué d'un seul bloc.
3. **Envoi** (`POST /sync/push`) : dans l'ordre, par lots de 100 au plus. Le serveur vérifie pour chaque mutation les droits, la visibilité et les invariants (deux conjoints par union, au plus deux parents de naissance, aucun cycle). Réponse par mutation : appliquée, convertie en proposition, ou refusée avec la raison. L'identifiant de mutation rend l'envoi répétable sans double application.
4. **Tirage** (`GET /sync/pull?curseur=`) : les changements depuis le dernier curseur, déjà filtrés pour ce lecteur. Quand une donnée devient invisible pour lui (une union masquée, une exclusion), il reçoit sa suppression locale.
5. **Premier chargement** : un instantané compressé de la partie visible ; un arbre de 1 000 personnes tient en moins de 2 Mo.
6. **Moments de synchronisation** : à l'ouverture de l'app, au retour du réseau, après chaque saisie quand le réseau est là, et en arrière-plan avec expo-background-task (WorkManager sur Android, au mieux toutes les 15 minutes ; BGTaskScheduler sur iOS, quand le système le décide).

| Situation | Règle |
| --- | --- |
| Deux téléphones modifient le même champ | La dernière modification reçue par le serveur gagne ; l'autre reste dans l'historique et son auteur est prévenu |
| Deux téléphones modifient des champs différents de la même fiche | Les deux modifications sont gardées (fusion champ par champ) |
| Deux téléphones créent la même personne | Deux fiches ; une tâche de détection des doublons propose la fusion |
| Une fiche est supprimée d'un côté et modifiée de l'autre | La suppression l'emporte ; la modification est gardée dans l'historique et peut être restaurée |
| Une mutation viole un invariant (troisième parent de naissance, cycle) | Refusée ; le téléphone annule le changement local et explique pourquoi |
| Un membre modifie la branche d'un autre | Mutation convertie en proposition, marquée « en attente » sur le téléphone |
| Le compte a été exclu pendant qu'il était hors-ligne | Ses mutations sont refusées et ses données locales de l'arbre sont effacées |

**Médias** : seules les métadonnées se synchronisent ; les fichiers se chargent à la demande par URL signée, et les envois se font en plusieurs parties qui reprennent après une coupure.

**Sur le téléphone** : base SQLite chiffrée avec SQLCipher, clé dans le trousseau du système (expo-secure-store) ; migrations Drizzle versionnées ; un arbre retiré à l'utilisateur est effacé localement.

**Test de référence** : deux téléphones simulés, 7 jours de saisies aléatoires hors-ligne, puis synchronisation. Les deux copies et le serveur doivent être identiques, sans aucune saisie perdue.

## API

Une API REST en JSON, préfixée `/v1`, décrite en OpenAPI à partir des schémas Zod. Les écritures sur l'arbre passent toutes par la synchronisation ; les autres routes servent l'authentification, les invitations, la voix, les médias et les traitements longs.

| Domaine | Routes principales | Notes |
| --- | --- | --- |
| Authentification | `POST /auth/code` (téléphone, canal WhatsApp ou SMS), `POST /auth/verify`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/google`, `POST /auth/apple` | Jeton d'accès de 15 minutes, jeton de rafraîchissement tournant de 90 jours |
| Compte | `GET` et `PATCH /me`, `DELETE /me`, `POST /me/export`, `PUT /me/notifications`, `POST /me/devices` | Suppression du compte possible dans l'app, comme l'exige Apple |
| Arbres et membres | `POST /trees`, `GET /trees`, `PATCH /trees/:id`, `POST /trees/:id/transfer`, `GET /trees/:id/members`, `PATCH` et `DELETE /trees/:id/members/:mid` | Rôles et branches modifiables par le propriétaire seulement |
| Invitations | `POST /trees/:id/invitations`, `GET /invitations/:jeton`, `POST /invitations/:jeton/accept` | La page publique d'une invitation n'affiche que le prénom de l'invitant et le nom de la famille |
| Synchronisation | `GET /trees/:id/sync/snapshot`, `GET /trees/:id/sync/pull`, `POST /trees/:id/sync/push` | Seul chemin d'écriture sur l'arbre |
| Propositions | `GET /trees/:id/proposals`, `POST /proposals/:id/accept`, `POST /proposals/:id/reject`, `POST /proposals/:id/comments` | Acceptation appliquée en une transaction |
| Voix | `POST /trees/:id/voice-jobs`, `GET /voice-jobs/:id`, `POST /voice-jobs/:id/transcript`, `POST /voice-jobs/:id/answers`, `POST /voice-jobs/:id/discard` | Le plan validé repart par `sync/push` |
| Médias | `POST /trees/:id/media/uploads` (URL signées par partie), `POST /media/:id/complete`, `GET /media/:id/url` | URL de lecture valables 10 minutes |
| Imports et exports | `POST /trees/:id/imports` (GEDCOM), `POST /imports/:id/confirm`, `POST /trees/:id/exports` (GEDCOM, PDF, JSON), `GET /exports/:id` | Traitements en tâche de fond, rapport avant validation |
| Droits des personnes | `POST /privacy-requests` | Ouvert aux non-membres, avec vérification par code |
| Paiement (V3) | `POST /orders`, `POST /payments/mobile-money`, `GET /me/entitlements`, `POST /webhooks/:fournisseur` | Retours vérifiés par signature, traités une seule fois |
| Administration | Routes `/admin` séparées | Rôle interne, double authentification, chaque accès journalisé |

**Conventions** : dates floues sous forme d'objet ; erreurs au format `application/problem+json` (RFC 9457) avec un code stable et un message traduisible ; clé d'idempotence sur chaque `POST` ; pagination par curseur ; réponses compressées ; limites de débit par compte et par adresse IP (5 demandes de code par heure et par numéro). Une version minimale de l'app est annoncée par l'API : en dessous, l'app demande une mise à jour.

## Disposition de l'arbre

La disposition est calculée par une fonction pure (`packages/layout`), testée à part, puis dessinée avec Skia. Elle part d'une personne centrale et d'un niveau de zoom, et respecte trois contraintes : les foyers restent groupés, une personne n'apparaît qu'une fois, et seul ce qui est à l'écran est dessiné.

1. **Générations** : un parcours en largeur depuis la personne centrale donne à chacun une rangée (ascendants au-dessus, descendants en dessous). Si une personne est atteinte par deux chemins de longueurs différentes (implexe, union entre générations), elle garde la rangée la plus proche et l'autre lien devient un trait long.
2. **Unités familiales** : un couple sans autre union se dessine côte à côte. Une personne qui a plusieurs unions simultanées forme un groupe : elle sur sa rangée, ses conjoints sur une demi-rangée juste en dessous, dans l'ordre des rangs, chacun en tête de la colonne de ses enfants. Les enfants dont un parent n'est pas précisé forment une colonne « parent non précisé » rattachée au parent connu.
3. **Ordre** : frères et sœurs par date de naissance (ou ordre saisi), foyers par rang, puis réduction des croisements par la méthode des barycentres, rangée par rangée, sans jamais séparer un foyer.
4. **Placement** : chaque sous-arbre est compacté à la manière de Reingold et Tilford pour les descendants, en miroir pour les ascendants.
5. **Repli** : par défaut, les foyers qui ne mènent pas à la personne centrale sont repliés, avec leur nombre d'enfants visibles ; au-delà de 3 générations, les branches se replient aussi.
6. **Implexe** : quand un trait traverserait plus de deux rangées ou trop d'autres traits, il est remplacé par un renvoi « voir aussi » vers la fiche déjà dessinée.

**Dessin** : React Native Skia, avec un index spatial pour savoir quelle fiche est touchée. Seuls les nœuds dans l'écran et sa marge sont dessinés ; trois niveaux de détail suivent le zoom (fiche complète, photo et prénom, simple point coloré). Les polices de la charte sont chargées dans Skia ; l'animation de pousse utilise Reanimated et s'efface si le téléphone demande de réduire les animations.

**Accessibilité** : un dessin Skia n'est pas lu par TalkBack ni VoiceOver. L'arbre a donc une vue liste équivalente, navigable personne par personne (parents, conjoints dans l'ordre des rangs, enfants par foyer), proposée automatiquement quand un lecteur d'écran est actif.

**Budget** : moins de 100 ms de calcul pour 500 personnes visibles sur l'Android de référence, 60 images par seconde visées pendant le déplacement, 30 au minimum. Le résultat est mis en cache et recalculé seulement pour la partie modifiée.

## Médias et économie de données

Chaque octet se paie au Cameroun : les médias sont réduits sur le téléphone avant l'envoi, et rien de lourd ne se télécharge sans action de l'utilisateur.

| Média | Traitement sur le téléphone | Stockage et lecture | Taille visée |
| --- | --- | --- | --- |
| Photo de profil | Recadrage carré, 256 px, WebP ou JPEG qualité 0,7 | Vignette mise en cache avec expo-image | Moins de 60 Ko |
| Photo d'album | 1 600 px au plus sur le grand côté, qualité 0,7 | Vignettes de 128, 256 et 512 px créées par un worker avec sharp | Moins de 400 Ko |
| Document scanné | Recadrage, niveaux de gris si possible | Original gardé en privé | Moins de 500 Ko par page |
| Dictée | Mono 16 kHz, 2 minutes au plus | Effacée dès la transcription (règle de cycle de vie d'un jour en sécurité) | Environ 45 Ko pour 15 s |
| Récit | AAC mono 32 kbit/s, enregistré par morceaux de 1 minute | Envoi en plusieurs parties, repris après une coupure | Environ 14 Mo par heure |
| Vidéo de capsule (V3) | 480p, 30 secondes au plus | Lue à la demande seulement | Moins de 8 Mo |

**Stockage** : Cloudflare R2, compartiments privés, une clé par arbre et par média ; lecture par URL signée valable 10 minutes, délivrée après contrôle de la visibilité. Les envois abandonnés sont purgés après 7 jours.

**Mode Économie de données** : vignettes seulement, médias envoyés et reçus en Wi-Fi seulement, aucune lecture automatique. L'app affiche la consommation du mois dans les réglages.

**Contrôle** : la taille des réponses de synchronisation est mesurée en intégration continue sur des arbres types (100, 1 000 et 5 000 personnes) ; un dépassement du budget fait échouer le build.

## Authentification et sécurité

La connexion se fait par numéro de téléphone, comme le reste des services utilisés au Cameroun. Les droits sont vérifiés au même endroit pour toutes les routes, et rien n'est autorisé par défaut.

- **Code de connexion** : 6 chiffres, valable 5 minutes, 5 essais au plus, envoyé par un modèle d'authentification WhatsApp, SMS en secours. Le code est stocké haché avec un sel secret ; limites par numéro, par adresse IP et par appareil.
- **Autres connexions** : e-mail par lien magique, Google, Apple. Si Google est proposé sur iOS, Apple demande une option équivalente comme Sign in with Apple (règle 4.8) ; à la suppression du compte, les jetons Apple sont révoqués.
- **Jetons** : jeton d'accès JWT de 15 minutes signé en ES256 avec rotation des clés ; jeton de rafraîchissement opaque, tournant, lié à l'appareil, valable 90 jours et stocké haché. La réutilisation d'un ancien jeton révoque toute la session.
- **Sur le téléphone** : jetons et clé de la base dans le trousseau du système (expo-secure-store), base SQLite chiffrée, verrouillage facultatif par la biométrie du téléphone (expo-local-authentication).
- **Droits** : un module unique de règles (rôle, branche, visibilité, propriété) appelé par toutes les routes, la synchronisation, les exports et les notifications ; un test par rôle et par action.
- **Base de données** : utilisateur applicatif sans droit de modifier le schéma, utilisateur de migration séparé ; sécurité au niveau des lignes de PostgreSQL sur l'identifiant d'arbre, en seconde barrière.
- **Transport et serveur** : HTTPS seul avec HSTS, Caddy en frontal, ports fermés sauf 443 et SSH par clé, mises à jour de sécurité automatiques, secrets hors du dépôt.
- **Retours de paiement** : signature HMAC vérifiée, horodatage contrôlé contre le rejeu, puis confirmation par un appel à l'API du fournisseur avant toute mise à jour.
- **Référentiels** : OWASP MASVS pour l'app, OWASP ASVS niveau 2 pour l'API ; analyse des dépendances et analyse statique à chaque pull request ; test d'intrusion avant la V3.
- **Abus** : jetons d'invitation de 128 bits, limites de débit, détection des créations de comptes en rafale, signalement depuis l'app.

## Confidentialité appliquée

La visibilité est calculée une fois, sur le serveur, à la source : chaque téléphone ne reçoit que ce que son utilisateur peut voir. Tous les calculs se font ensuite sur cette copie, si bien qu'aucun lien, compteur ou résultat de recherche ne peut trahir une donnée masquée.

1. **Une règle par objet** : niveau (arbre, branche, personnes choisies, moi seul). Valeurs par défaut : une personne est visible de tout l'arbre, mais une personne vivante n'entre ni dans un export partagé ni dans le livre sans son accord ; filiation de donneur, de gestation pour autrui, d'adoption ou de paternité non officielle, « moi seul » proposé ; cause de décès, son auteur ; ancien prénom, masqué.
2. **Dépendances** : un lien n'est visible que si ses deux extrémités le sont ; une union masquée masque les filiations qui en dépendent ; une personne créée dans un foyer masqué reçoit la même visibilité.
3. **Projection par lecteur** : une requête combine les règles, les membres et la table de fermeture des branches. Quand une règle change, le journal émet un événement de visibilité et le tirage suivant envoie aux lecteurs concernés les ajouts ou les suppressions.
4. **Points d'application** : synchronisation, exports, notifications, contexte envoyé pour la voix, statistiques, console d'administration (métadonnées seulement).
5. **Tests de non-fuite** : des arbres générés avec des objets masqués au hasard ; pour chaque lecteur, aucune réponse, aucun export, aucune notification ne contient un identifiant, un nom ou un compteur qui trahisse un objet masqué.
6. **Santé (V3), chiffrée de bout en bout** : une clé par utilisateur (XChaCha20-Poly1305), protégée par une clé dérivée d'une phrase de récupération (Argon2id) et gardée dans le trousseau du téléphone. Le serveur ne stocke que des blocs chiffrés, sans identifiant de personne lisible. Résumés et PDF sont calculés sur le téléphone. Perdre la phrase de récupération, c'est perdre ces données : l'écran d'activation le dit clairement.
7. **Minimisation** : pas de champ « ethnie » ni « religion », journaux techniques sans noms ni numéros (masqués automatiquement), mesure d'usage anonyme et facultative.

| Donnée | Durée de conservation |
| --- | --- |
| Code de connexion | 5 minutes |
| Audio d'une dictée | Jusqu'à la transcription, 24 heures au plus |
| Transcription, extraction et plan d'une dictée | 30 jours |
| Journaux techniques | 14 jours |
| Sauvegardes | 30 jours glissants |
| Compte supprimé | Effacé sous 30 jours ; la fiche reste dans l'arbre, masquée |
| Journal des accès sensibles et des actions d'administration | 1 an |
| Arbre, récits, photos | Tant que l'arbre existe, ou jusqu'à une demande d'effacement |

## Conformité : loi camerounaise et RGPD

Lignée traite des données de personnes vivantes, parfois sensibles, des deux côtés de la Méditerranée. Le plus sûr est d'appliquer dès le départ la règle la plus stricte des deux textes. Ce tableau résume des analyses publiées de la loi camerounaise (le texte officiel et ses décrets restent à vérifier) ; il ne remplace pas l'avis d'un juriste, prévu avant la bêta.

| Sujet | Cameroun, loi n° 2024/017 | RGPD, si la société est en France | Mesure dans Lignée |
| --- | --- | --- | --- |
| Champ d'application | Selon une première analyse, ne vise pas les responsables établis hors du Cameroun ; exclut les activités purement personnelles ou domestiques | S'applique à tout traitement d'une société établie dans l'Union, où que vivent les personnes | Lieu de la société décidé avec un juriste ; règles des deux textes appliquées d'office |
| Base légale | Le consentement est au centre du texte | Contrat pour le service ; consentement explicite pour les données sensibles | Consentements séparés et versionnés : conditions, enregistrement d'un récit, calque santé, mesure d'usage |
| Formalités | Autorisation préalable de l'Autorité (art. 19) ; registre des traitements (art. 39) | Registre (art. 30) ; analyse d'impact pour les traitements à risque (art. 35) | Demande d'autorisation dès que l'Autorité instruit les dossiers ; registre et analyses d'impact dans `docs/conformite/` |
| Données sensibles | Santé, génétique, origine ethnique, linguistique ou régionale, vie sexuelle, religion… interdites sauf consentement préalable ou autorisation (art. 48 à 51) | Interdites sauf exception, dont le consentement explicite (art. 9) | Calque santé séparé et chiffré ; aucun champ ethnie ni religion ; carte des origines désactivable |
| Mineurs | Moins de 18 ans : accord parental ; données sensibles d'un mineur soumises à autorisation | En France, consentement seul à partir de 15 ans | Comptes de mineurs avec accord parental ; aucune donnée de santé de mineur sans autorisation |
| Transferts | Autorisation préalable pour tout transfert hors du Cameroun (art. 32) | Hors de l'Union : décision d'adéquation ou clauses contractuelles types | Hébergement dans l'Union ; liste des sous-traitants et de leurs pays ; demande d'autorisation si la loi camerounaise s'applique |
| Violation de données | Notification immédiate à l'Autorité et aux personnes (art. 22) | 72 heures pour la CNIL (art. 33) ; les personnes si le risque est élevé (art. 34) | Procédure d'incident, exercice une fois par an |
| Droits des personnes | Accès, rectification, effacement, portabilité, opposition ; droits des ayants droit après un décès (art. 45) | Art. 15 à 22 | Formulaire ouvert aux non-membres, réponse sous 30 jours |
| Délégué à la protection des données | Pas obligatoire dans le texte final, recommandé | Obligatoire si l'activité principale traite des données sensibles à grande échelle (art. 37) | Un référent dès la V1 ; la question d'un délégué tranchée avant la V3 |
| Sanctions | Jusqu'à 1 milliard de FCFA pour une personne morale (projet adopté par l'Assemblée nationale), peines de prison | Jusqu'à 20 M€ ou 4 % du chiffre d'affaires mondial (art. 83) | — |
| Données de santé en France | — | L'hébergeur certifié HDS est obligatoire pour des données recueillies lors d'activités de prévention, de diagnostic ou de soins ; a priori pas pour un calque rempli par l'utilisateur hors de ce cadre | À confirmer par le juriste avant la V3 |
| Stores | — | — | Suppression du compte dans l'app (exigée par Apple depuis le 30 juin 2022), étiquettes de confidentialité d'Apple, formulaire « Sécurité des données » de Google Play |

Une analyse d'impact (AIPD) est réalisée avant la bêta publique de la V1, pour la voix et les données de personnes vivantes, puis complétée avant la V3 pour le calque santé.

## Paiement

Deux canaux, imposés par les règles des stores : les achats intégrés pour l'abonnement vendu dans l'app, un agrégateur de mobile money pour le site web et pour le livre imprimé. Un seul modèle de droits côté serveur réunit les deux : l'app demande seulement « cet arbre a-t-il un abonnement actif ? ».

- **Achats intégrés** : StoreKit 2 et Google Play Billing, par une bibliothèque (react-native-iap ou expo-iap) ou par RevenueCat, à trancher en V3. Reçus validés par le serveur (App Store Server API, Google Play Developer API) ; renouvellements, remboursements et expirations suivis par les notifications serveur des deux stores.
- **Abonnement famille** : un payeur, un arbre bénéficiaire. Si le payeur quitte l'arbre, l'abonnement court jusqu'à son échéance et le propriétaire est prévenu.
- **Mobile money** (site web et livre) : le serveur crée la transaction (montant en FCFA, référence unique) ; l'utilisateur valide sur son téléphone auprès d'Orange Money ou de MTN MoMo ; l'agrégateur renvoie un retour signé ; le serveur vérifie la signature et l'horodatage, reconfirme auprès de l'API de l'agrégateur, met à jour la commande une seule fois et envoie le reçu.
- **Agrégateur** : CinetPay, déjà intégré par Daniel pour NkamVa, ou Notch Pay. Un agrégateur prend environ 3 % ; l'intégration directe de MTN MoMo et d'Orange Money coûte 1,5 à 2 %, mais ne devient rentable qu'au-delà d'environ 2,5 millions de FCFA de paiements par mois.
- **Montants** : entiers en FCFA, centimes pour l'euro, jamais un montant envoyé par le téléphone.
- **Exploitation** : rapprochement quotidien avec les relevés des fournisseurs, procédure de remboursement, fiscalité (TVA au Cameroun et en France) à valider avec un comptable.
- **Dans l'app** : aucun lien ni message qui oriente vers le paiement sur le site ; on peut en parler hors de l'app, par e-mail ou WhatsApp.

## Notifications et messages

Lignée n'envoie elle-même que deux sortes de messages : les codes de connexion et les notifications de l'app. Les invitations partent du téléphone de l'invitant, par sa propre messagerie.

- **Notifications de l'app** : expo-notifications et le service Expo Push (FCM pour Android, APNs pour iOS), un jeton par appareil, contenu générique en mode discret.
- **Planificateur** : un worker calcule chaque jour les rappels dans le fuseau horaire de chaque membre, les envoie à 8 h, respecte les heures calmes (21 h à 8 h) et le plafond d'une notification non demandée par jour, et annule tout rappel d'anniversaire dès qu'un décès est enregistré.
- **Modèles fermés** : chaque notification vient d'une liste de modèles traduits, chacun couvert par un test « aucune donnée sensible ». Aucune notification n'est rédigée librement par une IA.
- **Codes de connexion** : un modèle d'authentification de la WhatsApp Business Platform ; SMS de secours par un agrégateur local, avec un nom d'expéditeur « Lignee » à faire enregistrer. Aucun message promotionnel.
- **Invitations** : la feuille de partage du téléphone ouvre WhatsApp ou les SMS avec un texte préparé (« Nadège vous invite dans l'arbre de la famille Kamga ») et le lien. C'est gratuit et plus personnel qu'un message envoyé par Lignée.
- **Liens d'invitation** : un domaine de Lignée avec App Links (Android) et Universal Links (iOS). App installée : elle s'ouvre sur l'invitation. Sinon : une page légère mène au store ; sur Android, le jeton passe par le Play Install Referrer ; sur iOS, l'invitation est retrouvée à l'inscription par le numéro invité, ou par un code de 6 caractères affiché sur la page.
- **E-mail** (facultatif) : un fournisseur d'e-mails transactionnels européen, pour les reçus et les exports.

## Recherche

La recherche se fait sur le téléphone, hors-ligne, et doit retrouver un nom même mal écrit ou mal transcrit : c'est aussi elle qui évite les doublons.

- **Index** : une table FTS5 alimentée par tous les noms (naissance, usage, surnoms, variantes, titres), les noms d'usage, les lieux et les années. Le texte est normalisé avant l'indexation : minuscules, sans accents, sans apostrophes ni traits d'union.
- **Clé phonétique** : une clé maison, pensée pour le français et les noms camerounais (« ou » et « u », « c », « k » et « q », « tch » et « ch », lettres doublées, finales muettes), calculée en TypeScript et stockée dans une colonne indexée. Elle rapproche « Nkoulou » et « Nkulu », ou « Biyong » et « Biyon » ; elle est testée sur une liste de noms réels fournie par les familles pilotes.
- **Fautes de frappe** : une distance de Jaro-Winkler sur les formes normalisées, calculée sur les candidats (rapide jusqu'à 5 000 personnes).
- **Classement** : exact, puis début de mot, puis phonétique, puis approché ; à score égal, les personnes les plus proches de « Vous » d'abord.
- **Doublons** : un score combine la ressemblance des noms, la proximité des dates et la cohérence des liens (mêmes parents, même conjoint). Au-dessus d'un seuil, Lignée propose une fusion, jamais automatique. Le même calcul sert à la voix (« Est-ce elle ? ») et à une tâche de fond sur le serveur, avec pg\_trgm et unaccent.

## Performance et appareils cibles

L'appareil de référence est un Android d'entrée de gamme acheté au Cameroun : 2 Go de mémoire, Android 10 ou plus récent (par exemple un Tecno, un Infinix, un itel ou un Samsung Galaxy A d'entrée de gamme). Côté iOS, un iPhone d'au moins cinq ans encore mis à jour. Chaque version est mesurée sur ces deux téléphones.

| Mesure | Cible |
| --- | --- |
| Démarrage à froid jusqu'à l'arbre (500 personnes déjà sur le téléphone) | Moins de 3 s |
| Ouverture de l'arbre | Moins de 1 s |
| Déplacement et zoom | 60 images par seconde visées, 30 au minimum |
| Mémoire utilisée | Moins de 250 Mo |
| Taille à l'installation sur Android | Moins de 40 Mo |
| Lien de parenté, arbre de 5 000 personnes | Moins de 50 ms |
| Recherche locale, 5 000 personnes | Moins de 300 ms |
| API hors voix, 95 % des requêtes, côté serveur | Moins de 300 ms |
| Fin de la dictée jusqu'à l'aperçu, en 3G | Moins de 6 s |
| Taux de plantage perçu (seuil de Google Play : 1,09 %) | Moins de 0,5 % |
| Taux d'ANR perçu (seuil de Google Play : 0,47 %) | Moins de 0,2 % |

**Pratiques** : moteur Hermes et nouvelle architecture de React Native ; listes virtualisées (FlashList) ; images avec expo-image ; lecture de la base à la demande au démarrage ; calculs du moteur de parenté et de la disposition découpés pour ne jamais bloquer l'interface plus de 50 ms ; taille du bundle surveillée à chaque pull request. Les Android vitals de la Play Console sont suivies chaque semaine après la sortie.

## Tests et qualité

Le cœur de Lignée (parenté, visibilité, synchronisation, voix) se teste automatiquement, sur des milliers d'arbres générés et sur chaque cas de l'onglet Cas limites. Un test qui échoue bloque la fusion de la pull request.

| Niveau | Outil | Ce qui est testé | Quand |
| --- | --- | --- | --- |
| Unitaire | Vitest | Moteur de parenté, vocabulaire français et anglais, grammaire des chemins, dates floues, règles de visibilité, contrôles de cohérence | Chaque pull request |
| Propriétés | fast-check | Sur des arbres générés (polygamie, lévirat, implexe, places à compléter) : liens symétriques, aucune fuite, fusion sans perte, aucun cycle | Chaque pull request |
| Cas limites | Un fichier de scénario par identifiant de l'onglet Cas limites | Arbre de départ, action ou phrase, résultat attendu | Chaque pull request |
| Intégration | Vitest et Testcontainers (PostgreSQL réel) | Droits par rôle et par action, synchronisation, propositions, imports | Chaque pull request |
| Synchronisation | Simulateur à deux téléphones | 7 jours hors-ligne, conflits, exclusion en cours de route | Chaque nuit |
| Voix | Jeu de 300 phrases réelles | Résolveur sur des réponses enregistrées ; chaîne complète sur les vrais services, avec le taux de liens corrects | Pull request, puis chaque nuit |
| Parcours | Maestro | Les sept parcours du PRD | Chaque nuit sur émulateur, avant chaque version sur l'Android de référence |
| Accessibilité | Règles ESLint d'accessibilité, passage manuel avec TalkBack et VoiceOver | Libellés, ordre de lecture, texte à 200 % | Avant chaque version |
| Performance | Mesures sur les deux téléphones de référence | Tableau de la section Performance | Avant chaque version |
| Sécurité | Analyse des dépendances, CodeQL, test d'intrusion | Failles connues, code dangereux | Chaque pull request ; test d'intrusion avant la V3 |
| Bêta | Piste de test fermée de Google Play, TestFlight | 20 familles pilotes, dont 5 polygames | Avant la V1 publique |

Un scénario se décrit en quelques lignes, lisibles par les deux développeurs :

```yaml
id: CL-POL-03
titre: Enfant du grand-père, mère inconnue parmi ses épouses
arbre:
  personnes: [pierre/M, rose/F, odile/F, joseph/M, comfort/F]
  unions:
    - { conjoints: [pierre, rose], rang_pierre: 1 }
    - { conjoints: [pierre, odile], rang_pierre: 2 }
  filiations:
    - { parents: [pierre, odile], enfant: joseph }
    - { parents: [joseph], enfant: comfort }
action:
  locuteur: comfort
  dictee: "Samuel est un fils de mon grand-père Pierre, je ne sais pas de quelle femme"
attendu:
  questions: 0
  plan:
    - creer: samuel
    - filiation: { parent: pierre, enfant: samuel, type: naissance }
    - candidats_mere: { enfant: samuel, candidates: [rose, odile] }
  lien: { de: joseph, vers: samuel, fr: "frère ou demi-frère", en: "brother or half-brother" }
```

## Environnements, CI/CD et livraison

Trois environnements, un déploiement automatique du serveur, et des sorties mobiles progressives : un binôme à temps partiel ne doit jamais passer une soirée à déployer à la main.

| Environnement | Contenu | Usage |
| --- | --- | --- |
| Local | Docker Compose : PostgreSQL, API, worker, MinIO à la place de R2, faux fournisseurs de voix et de messages | Développement et tests, sans coût ni réseau |
| Préproduction | Un VPS séparé, sa propre base, un numéro WhatsApp de test, pistes internes des stores | Démos de fin de cycle, bêta fermée |
| Production | VPS dans l'Union européenne, sauvegardes chiffrées hors du VPS | Familles réelles |

- **Branches** : développement sur la branche principale par pull requests courtes, relues par l'autre développeur ; branche principale protégée, vérifications obligatoires.
- **Intégration continue** (GitHub Actions) : lint, vérification des types, tests unitaires et de propriétés, cas limites, intégration avec PostgreSQL, taille des réponses de synchronisation, construction des images Docker.
- **Déploiement du serveur** : images publiées sur GitHub Container Registry, déployées sur le VPS par SSH et Docker Compose derrière Caddy. Migrations Prisma (`prisma migrate deploy`) dans une étape à part, toujours compatibles avec la version précédente (on ajoute une colonne avant d'en retirer une). Vérification de santé après chaque mise en ligne, retour arrière en une commande.
- **App** : EAS Build (profils développement, préproduction, production) et EAS Submit vers les stores. EAS Update pour les correctifs JavaScript, avec une version d'exécution qui empêche d'envoyer du code incompatible. Sortie progressive sur Google Play (10 %, puis 50 %, puis 100 %) ; TestFlight et piste fermée pour la bêta.
- **Versions** : numérotation sémantique ; API versionnée (`/v1`) ; version minimale de l'app imposée par l'API.
- **Drapeaux de fonction** : par arbre, pour ouvrir une nouveauté aux familles pilotes d'abord.
- **Secrets** : dans GitHub Actions et EAS, et chiffrés avec SOPS sur le serveur ; jamais dans le dépôt.

## Observabilité, sauvegardes et exploitation

Deux développeurs à temps partiel ne peuvent pas surveiller un serveur en continu : les alertes doivent être rares et justes, et la restauration doit être répétée avant d'en avoir besoin.

- **Erreurs** : GlitchTip (compatible avec les SDK Sentry) pour l'app et l'API, avec les source maps ; une alerte par nouvelle erreur.
- **Journaux** : JSON avec pino, masquage automatique des noms, des numéros et des transcriptions ; 14 jours de conservation.
- **Métriques** : requêtes, latence, erreurs, attente dans les files, durée des dictées, dépense par fournisseur ; Prometheus et Grafana sur le VPS à partir de la V1 publique, Uptime Kuma pour la disponibilité.
- **Alertes** (e-mail et Telegram aux deux développeurs) : API indisponible plus de 2 minutes, plus de 2 % d'erreurs, dictées en attente depuis plus de 5 minutes, dépense de voix ou de SMS au-delà de 120 % du budget du mois.
- **Sauvegardes** : PostgreSQL avec pgBackRest, une sauvegarde complète par jour et l'archivage continu des journaux, chiffrés et copiés sur R2. Perte maximale visée : 15 minutes de données ; remise en service en 4 heures. Restauration testée chaque mois sur la préproduction. Médias copiés chaque semaine chez un second fournisseur.
- **Procédures** écrites dans `docs/runbooks/` : panne, restauration, violation de données, rotation des secrets, demande d'effacement.
- **Routine** : revue mensuelle des coûts et des quotas, mises à jour de sécurité chaque semaine, exercice d'incident une fois par an.

## Hébergement et coûts

Un seul VPS suffit pour la bêta ; on sépare la base de données à 1 000 familles, puis on double l'application à 10 000. Le serveur est dans l'Union européenne : avec une app qui fonctionne hors-ligne, la distance depuis le Cameroun se sent peu, et le RGPD est respecté d'office. Si l'avis juridique impose un hébergement au Cameroun ou en Afrique, tout est en conteneurs Docker et se déplace sans réécriture.

| Palier | Machines | Base de données | Médias | Coût mensuel total estimé |
| --- | --- | --- | --- | --- |
| Bêta (20 familles) | 1 VPS Contabo Cloud VPS 4 (4 vCPU, 8 Go) pour l'API, les workers et la base | Sur le même VPS | R2, dans l'offre gratuite | ≈ 40 $ |
| 1 000 familles | 2 VPS : application (API et workers), base de données | Machine dédiée, sauvegardes continues | R2 | ≈ 355 $ |
| 10 000 familles | 3 à 4 VPS : deux pour l'application derrière Caddy, une base principale et une réplique en lecture | Réplique pour les exports et les statistiques | R2 | ≈ 3 300 $ |

Le détail par poste est dans l'onglet Cahier des charges (Budget de fonctionnement). Au palier de 10 000 familles, la voix et les SMS pèsent plus que les serveurs : c'est là que se jouent les quotas, le passage à WhatsApp et, le cas échéant, une transcription auto-hébergée.

## Organisation du code

Un seul dépôt, des paquets partagés entre l'app et le serveur : le moteur de parenté, les schémas et la synchronisation n'existent qu'en un exemplaire.

```text
lignee/
  apps/
    mobile/        app Expo (Expo Router)
    api/           API Hono
    worker/        voix, exports, rappels, vignettes, purges
    web/           site, pages d'invitation, paiement web (V3), version web (V4)
    admin/         console interne
  packages/
    kinship/       moteur de parenté : graphe, chemins, vocabulaire FR et EN
    layout/        disposition de l'arbre (foyers, implexe, repli)
    domain/        types, schémas Zod, dates floues, règles de cohérence et de visibilité
    sync/          protocole de synchronisation, côté téléphone et côté serveur
    voice/         schéma d'extraction, glossaire, résolveur
    ui/            composants de la charte et tokens.ts
    i18n/          textes français et anglais
    db/            schéma Prisma et migrations
  test/
    scenarios/     un fichier par cas limite (CL-POL-03.yaml…)
    voice-golden/  jeu de 300 phrases, avec l'accord des locuteurs
  docs/
    adr/           notes de décision
    runbooks/      procédures d'exploitation
    conformite/    registre des traitements, analyses d'impact
```

**Conventions** : TypeScript strict partout ; ESLint et Prettier ; messages de commit conventionnels ; une pull request ne fait qu'une chose et reprend la définition de « terminé » en case à cocher ; les deux développeurs sont propriétaires de `packages/kinship` et `packages/voice` (fichier CODEOWNERS) ; aucun texte d'interface en dur, tout passe par `packages/i18n`.
