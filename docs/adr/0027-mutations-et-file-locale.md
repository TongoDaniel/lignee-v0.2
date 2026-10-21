# 0027 — Mutations, lots et file de changements du téléphone

Date : 19 octobre 2026, révisée le 21 octobre 2026 après relecture · Statut : acceptée (décision technique, T-030) · Relecture : gardien-confidentialite, relecteur-code

## Contexte

Le TRD (« Hors-ligne et synchronisation », points 2 et 3) demande : « chaque modification devient une mutation (identifiant, entité, opération, champs modifiés, version de départ, date). Un plan vocal devient un lot de mutations appliqué d'un seul bloc », et un envoi « dans l'ordre, par lots de 100 au plus », répétable grâce à l'identifiant de mutation. HOL-01 veut que la saisie marche en mode avion. Le cahier ne fixe ni la forme des champs, ni le sens de « version de départ » pour les objets que le modèle ne versionne pas (seules les `personnes` ont une colonne `version`), ni la place des règles de visibilité dans la file, ni la conduite à tenir quand un instantané est rechargé alors que des saisies attendent. L'ADR 0017 impose que `distinctFrom` ne cite que des personnes visibles du rédacteur ; l'ADR 0023, que la base locale ne contienne que ce que le lecteur voit et qu'aucune valeur saisie ne soit dans une colonne.

## Décision

1. **Format partagé** (`packages/domain/src/mutation.ts`, utilisé aussi par l'API) : une mutation porte `id` (UUIDv7, clé d'idempotence), `entity`, `entityId`, `operation` (`create`, `update`, `delete`), `fields`, `baseVersion`, `createdAt` (ISO 8601 en UTC). Entités : celles des tables de l'arbre (`person`, `name`, `union`, `simultaneity_answer`, `filiation`, `parent_candidate`, `fact`, `title_role`, `multiple_birth`, `place`, `to_place`) et `visibility_rule`. L'arbre lui-même (nom, réglages) passe par l'API des arbres ; noms d'usage et sources viendront avec leurs tickets.
2. **Champs** : création = l'objet entier sans `id` ni `treeId` ; modification = les seuls champs changés, `null` retire un champ facultatif ; suppression = aucun champ. `id`, `treeId` et `version` ne sont jamais dans les champs ; `authorAccountId` est fixé à la création. Le lot normalise les champs par les schémas du modèle (espaces, valeurs par défaut) : le serveur obtient le même objet que le téléphone.
3. **Version de départ** : la version de la fiche connue du téléphone pour une personne (`0` pour une fiche créée plus tôt dans le même lot) ; `null` pour une création et pour les objets non versionnés. Le téléphone n'incrémente jamais `version` : elle reste celle du serveur. Un lot déjà formé dont une version ne correspond plus à la copie est refusé (`base_version_mismatch`) ; il se reconstruit. Le serveur, lui, reçoit des versions anciennes et applique les règles du tableau du TRD (T-060).
4. **Lot** : 1 à 500 mutations d'un même arbre, appliquées toutes ou aucune. Une saisie à la main est un lot (une fiche et son nom) ; un plan vocal validé est un lot. Un lot ne se coupe jamais. **Écart au TRD** (point 3, « par lots de 100 au plus ») : un envoi regroupe des lots entiers jusqu'à 100 mutations, mais un lot de plus de 100 mutations part seul et entier, dans un envoi qui dépasse donc 100. Pourquoi : le TRD exige aussi qu'un plan vocal soit « appliqué d'un seul bloc », ce qu'un lot coupé en deux envois ne garantit plus (le premier appliqué, le second refusé). La limite de 500 borne la taille d'un tel envoi.
5. **Application locale** (`packages/sync/src/mutations/apply.ts`, pure, réutilisable par le serveur ; `local-changes.ts`, adaptateur de la base) : dans une seule transaction, l'arbre est lu, le lot appliqué en mémoire, puis contrôlé sur l'état final avant toute écriture :
   - schéma de chaque objet créé ou modifié ;
   - identifiant neuf à la création, objet présent et visible pour une modification ou une suppression (`unknown_object`) ;
   - chaque objet cité existe et est visible du rédacteur (`dangling_reference`), `distinctFrom` compris ; aucune source tant qu'elles ne sont pas synchronisées ;
   - une suppression ne laisse rien qui cite l'objet supprimé : le lot supprime aussi les objets qui en dépendent (pas de cascade implicite) ;
   - rien n'est créé au nom d'un autre compte ; une cause de décès ou un ancien prénom est toujours du rédacteur (`author_mismatch`) ;
   - une personne connue garde un nom autre qu'un ancien prénom. Seule exception : une fiche déjà connue dont la copie ne montrait aucun nom (noms masqués). Une place à compléter qui devient connue doit recevoir un nom ;
   - réponses « simultanées ou successives » : deux unions avec un conjoint commun, une par paire ;
   - refus de cohérence de l'ADR 0011 (troisième parent de naissance, cycle), par `checkNewFiliation` pour chaque filiation créée ou modifiée. Les alertes qu'on peut passer outre ne bloquent pas : l'écran les montre avant (T-031, T-033) ;
   - puis la seconde barrière de l'instantané (`snapshotPrivacyIssues`, ADR 0023) sur la copie finale.

   Un seul constat refuse le lot entier ; arbre et file restent inchangés, y compris quand une écriture échoue en cours de route : la transaction est annulée, et un identifiant de mutation déjà dans la file donne `duplicate_mutation`. Les constats ne portent qu'un code et un chemin, au même format que les erreurs de schéma (`mutations[2].fields.parentId`), jamais une valeur ni un identifiant. Le rang est celui du changement reçu, même quand des changements sans effet ont été retirés avant l'application. Un lot sur une copie saine n'atteint jamais la seconde barrière (les contrôles du lot couvrent ce qu'elle vérifie) : elle n'arrête qu'une copie abîmée hors du paquet, et ses chemins désignent alors l'instantané (`facts[3]`).
6. **Visibilité du rédacteur, point d'extension** : `MutationContext.canWriterSee`. Sur le téléphone, la copie ne contient que ce que le rédacteur voit : tout objet présent est visible. Le serveur y branche la projection du rédacteur (T-056) ; un objet masqué reçoit exactement la réponse d'un objet inexistant (ADR 0017). Un objet créé plus tôt dans le même lot est visible sans consulter `canWriterSee` (la projection ne le connaît pas encore) : on peut le citer, le modifier ou le supprimer dans la suite du lot. Des tests le vérifient.
7. **Règles de visibilité** : créées ou supprimées, jamais modifiées champ par champ (changer = supprimer puis créer, dans le même lot). Elles restent dans la file, jamais dans les tables de l'arbre ni dans l'instantané (ADR 0023) ; elles visent un objet visible du rédacteur, sont de lui, et une seule par objet dans un lot. Leurs valeurs par défaut et leur calcul restent T-052.
8. **File** (`mutation_queue`, migration 2) : une ligne par mutation, ordre par `seq` (alias du rowid), lot, arbre, auteur, objet visé, état (`pending`, `sent`, `refused`, fixé par une contrainte CHECK), code de refus, mutation entière dans `body`. `sent` = réponse du serveur reçue (appliquée ou convertie en proposition). Si T-060 ou T-067 ont besoin d'un état « convertie en proposition » (« en attente » sur le téléphone, selon le TRD), il faudra une migration qui recrée la table pour changer la contrainte CHECK.
   - Seule une mutation en attente change d'état. Noter la même réponse dans deux appels ne change rien ; deux réponses pour la même mutation dans un seul appel sont refusées.
   - Les modifications ne gardent que les champs réellement changés (`dropUnchangedFields`) : la file ne contient que ce que l'auteur a modifié, jamais le reste de la fiche, qui peut venir d'autres membres.
   - La lecture, la liste des lots et le compteur demandent toujours l'arbre **et** le compte : on ne lit, ne compte et n'envoie que les saisies du compte connecté.
9. **File et instantané** : pas de clé étrangère vers `trees`. Recharger un instantané (`replaceTreeSnapshot`) garde la file de son lecteur ; effacer un arbre (`eraseLocalTree`, arbre retiré, CL-SEC-08) la vide explicitement. Seul le lecteur de la copie (`trees.reader_account_id`) écrit dans l'arbre et dans la file (`foreign_author`).

   **Changement de compte** : quand un instantané arrive pour un autre lecteur, la file des autres comptes pour cet arbre est vidée dans la même transaction. Je l'ai préféré au refus du chargement, pour trois raisons :
   - un refus bloquerait le nouveau compte sur un téléphone partagé ou repris ;
   - il ne rendrait pas pour autant les saisies de l'ancien compte envoyables : son jeton n'est plus là, et T-067 n'envoie que les saisies du compte connecté ;
   - garder ces saisies laisserait sur le téléphone des données d'un compte qu'un autre utilise.

   Le chemin normal reste la déconnexion, qui détruit toute la base (`destroyLocalDatabase`, T-055) : cette purge n'est qu'une seconde barrière. La perte des saisies non envoyées de l'ancien compte est assumée ; l'avertissement avant la déconnexion revient à T-055.
10. **Idempotence locale** : rejouer un lot déjà dans la file ne change rien (`already_recorded`) ; une mutation déjà présente sous un autre lot est refusée. Le contrôle d'auteur passe avant cette recherche, elle-même limitée aux saisies de l'auteur : un autre compte n'apprend rien de la file.

## Conséquences

Obligations reprises dans `docs/plan/v1-decoupage.md` (lignes « Obligations reçues des relectures » des fiches citées).

- **T-031 à T-033, T-079** : appeler `recordLocalChanges`, qui pose identifiants, date et versions ; traduire les codes de `MUTATION_ISSUE_CODES` par `packages/i18n`. Une suppression liste ses dépendants (noms, faits, liens, unions) dans le même lot.
- **T-060** (réutilise `applyMutationBatch` avec `canWriterSee` branché sur la projection du rédacteur, sans `requireCurrentBaseVersion`) :
  - accepter un lot de plus de 100 mutations envoyé seul (point 4) ;
  - neutraliser les oracles, par une réponse générique ou une conversion en proposition, avec des tests de non-fuite sur arbres générés :
    - `duplicate_id` : les identifiants pris sont ceux de tout l'arbre du serveur ;
    - `person_without_name` : lit tous les noms ;
    - réponse de simultanéité : lit toutes les réponses et les unions complètes ;
    - suppression refusée parce qu'un objet masqué la cite ;
    - `checkNewFiliation` sur l'arbre complet : `third_birth_parent` révèle une paternité secrète (ADR 0011, point 11) ;
    - fusion d'une modification contre l'objet complet : la faire contre la projection du rédacteur, en conservant les éléments qu'il ne voit pas (par exemple les identifiants masqués d'un `distinctFrom`) ;
  - `canWriterSee` vrai pour les objets créés dans le lot (déjà fait dans `applyMutationBatch`) ;
  - suppression d'une règle de visibilité : même réponse pour un non-auteur et pour une règle inexistante ;
  - un objet et sa règle « moi seul » s'appliquent d'un seul bloc : l'objet n'est jamais visible un instant sans sa règle ;
  - ne jamais journaliser une ZodError brute : un client peut y glisser une clé de champ inconnue (`normalizeMutationFields`) ;
  - état « convertie en proposition » face à la contrainte CHECK de `status` (point 8).
- **T-063** : après un instantané ou un tirage, ne rejouer que les mutations dont l'auteur est le lecteur, par `recordLocalChanges` ou par une fonction de rejeu dédiée qui garde la seconde barrière (pas par `applyLocalMutationBatch`).
- **T-067** :
  - ne lire, n'envoyer et ne compter que les saisies du compte connecté (les fonctions de la file l'exigent) ;
  - noter les réponses par `recordQueueOutcomes` ;
  - purger les entrées `sent` après le tirage qui les reflète ;
  - annuler localement une mutation refusée (par le tirage) ;
  - ne pas couper un lot (point 4).
- **T-055** : à la déconnexion, `destroyLocalDatabase` emporte les changements non envoyés. Il faut prévenir l'utilisateur avant ; la forme de l'avertissement est à décider par Daniel.
- **T-052** : les règles « personnes choisies » restent dans la file chiffrée de leur seul auteur. C'est acceptable avec la file limitée à son auteur (points 8 à 10) et la purge de T-067.
- **Lecture** : chaque saisie relit l'arbre entier, validation Zod comprise. À mesurer sur l'Android de référence (T-028, T-105) ; si c'est trop lent, garder la copie validée en mémoire entre deux saisies.
- **Sauvegardes** : la file vit dans la base chiffrée, dossier `SQLite`, déjà exclu des sauvegardes et des transferts Android (`apps/mobile/plugins/withLocalDataBackupRules.ts`). Sur iOS, la file part avec la base dans la sauvegarde iCloud, chiffrée et illisible sans la clé, qui reste sur l'appareil. C'est le risque accepté par l'ADR 0023 (point 7), qui couvre aussi la file.

## Écarté

- **Lot refusé mutation par mutation** (appliquer ce qui passe) : un plan vocal à moitié appliqué laisse des personnes sans liens ; le TRD veut « un seul bloc ».
- **Lot coupé en envois de 100** : contraire au « seul bloc » dès qu'un envoi passe et l'autre non (point 4).
- **Suppression en cascade implicite** : une fiche supprimée emporterait des faits saisis par d'autres membres sans que l'écran les montre ; sur le serveur, la cascade révélerait ou effacerait des objets masqués.
- **Champs de la fiche entière dans chaque modification** : la file et le journal du serveur porteraient au nom de l'auteur des valeurs saisies par d'autres, et la fusion champ par champ du TRD deviendrait impossible.
- **Version incrémentée sur le téléphone** : deux modifications hors-ligne d'une même fiche partiraient de versions que le serveur n'a jamais connues.
- **Refuser l'instantané d'un nouveau lecteur tant que la file d'un autre compte n'est pas vide** : bloque le nouveau compte sans rendre ces saisies envoyables (point 9).
- **Règles de visibilité dans une table locale** : l'instantané d'un lecteur ne porte jamais de règle (ADR 0023) ; une table à part pour les seules règles de l'auteur attendra l'écran de visibilité (T-072) s'il en a besoin.
