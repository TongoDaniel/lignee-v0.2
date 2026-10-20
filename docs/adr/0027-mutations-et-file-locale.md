# 0027 — Mutations, lots et file de changements du téléphone

Date : 19 octobre 2026 · Statut : acceptée (décision technique, T-030) · Relecture : gardien-confidentialite, relecteur-code

## Contexte

Le TRD (« Hors-ligne et synchronisation », points 2 et 3) demande : « chaque modification devient une mutation (identifiant, entité, opération, champs modifiés, version de départ, date). Un plan vocal devient un lot de mutations appliqué d'un seul bloc », et un envoi « dans l'ordre, par lots de 100 au plus », répétable grâce à l'identifiant de mutation. HOL-01 veut que la saisie marche en mode avion. Le cahier ne fixe ni la forme des champs, ni le sens de « version de départ » pour les objets que le modèle ne versionne pas (seules les `personnes` ont une colonne `version`), ni la place des règles de visibilité dans la file, ni la conduite à tenir quand un instantané est rechargé alors que des saisies attendent. L'ADR 0017 impose que `distinctFrom` ne cite que des personnes visibles du rédacteur ; l'ADR 0023, que la base locale ne contienne que ce que le lecteur voit et qu'aucune valeur saisie ne soit dans une colonne.

## Décision

1. **Format partagé** (`packages/domain/src/mutation.ts`, utilisé aussi par l'API) : une mutation porte `id` (UUIDv7, clé d'idempotence), `entity`, `entityId`, `operation` (`create`, `update`, `delete`), `fields`, `baseVersion`, `createdAt` (ISO 8601 en UTC). Entités : celles des tables de l'arbre (`person`, `name`, `union`, `simultaneity_answer`, `filiation`, `parent_candidate`, `fact`, `title_role`, `multiple_birth`, `place`, `to_place`) et `visibility_rule`. L'arbre lui-même (nom, réglages) passe par l'API des arbres ; noms d'usage et sources viendront avec leurs tickets.
2. **Champs** : création = l'objet entier sans `id` ni `treeId` ; modification = les seuls champs changés, `null` retire un champ facultatif ; suppression = aucun champ. `id`, `treeId` et `version` ne sont jamais dans les champs ; `authorAccountId` est fixé à la création. Le lot normalise les champs par les schémas du modèle (espaces, valeurs par défaut) : le serveur obtient le même objet que le téléphone.
3. **Version de départ** : la version de la fiche connue du téléphone pour une personne (`0` pour une fiche créée plus tôt dans le même lot) ; `null` pour une création et pour les objets non versionnés. Le téléphone n'incrémente jamais `version` : elle reste celle du serveur. Un lot déjà formé dont une version ne correspond plus à la copie est refusé (`base_version_mismatch`) ; il se reconstruit. Le serveur, lui, reçoit des versions anciennes et applique les règles du tableau du TRD (T-060).
4. **Lot** : 1 à 500 mutations d'un même arbre, appliquées toutes ou aucune. Une saisie à la main est un lot (une fiche et son nom) ; un plan vocal validé est un lot. Un lot ne se coupe jamais : quand T-060 et T-067 regroupent les envois par 100, un lot plus grand part seul, entier.
5. **Application locale** (`packages/sync/src/mutations/apply.ts`, pure, réutilisable par le serveur ; `local-changes.ts`, adaptateur de la base) : dans une seule transaction, l'arbre est lu, le lot appliqué en mémoire, puis contrôlé sur l'état final avant toute écriture :
   - schéma de chaque objet créé ou modifié ;
   - identifiant neuf à la création, objet présent et visible pour une modification ou une suppression (`unknown_object`) ;
   - chaque objet cité existe et est visible du rédacteur (`dangling_reference`), `distinctFrom` compris ; aucune source tant qu'elles ne sont pas synchronisées ;
   - une suppression ne laisse rien qui cite l'objet supprimé : le lot supprime aussi les objets qui en dépendent (pas de cascade implicite) ;
   - rien n'est créé au nom d'un autre compte ; une cause de décès ou un ancien prénom est toujours du rédacteur (`author_mismatch`) ;
   - une personne connue garde un nom autre qu'un ancien prénom, sauf si sa copie n'en montrait déjà aucun (noms masqués) ;
   - réponses « simultanées ou successives » : deux unions avec un conjoint commun, une par paire ;
   - refus de cohérence de l'ADR 0011 (troisième parent de naissance, cycle), par `checkNewFiliation` pour chaque filiation créée ou modifiée. Les alertes qu'on peut passer outre ne bloquent pas : l'écran les montre avant (T-031, T-033) ;
   - puis la seconde barrière de l'instantané (`snapshotPrivacyIssues`, ADR 0023) sur la copie finale.
   Un seul constat refuse le lot entier ; arbre et file restent inchangés. Les constats ne portent qu'un code et un chemin (`mutations[2].fields.parentId`), jamais une valeur ni un identifiant.
6. **Visibilité du rédacteur, point d'extension** : `MutationContext.canWriterSee`. Sur le téléphone, la copie ne contient que ce que le rédacteur voit : tout objet présent est visible. Le serveur y branche la projection du rédacteur (T-056) ; un objet masqué reçoit exactement la réponse d'un objet inexistant (ADR 0017). Un test le vérifie.
7. **Règles de visibilité** : créées ou supprimées, jamais modifiées champ par champ (changer = supprimer puis créer, dans le même lot). Elles restent dans la file, jamais dans les tables de l'arbre ni dans l'instantané (ADR 0023) ; elles visent un objet visible du rédacteur, sont de lui, et une seule par objet dans un lot. Leurs valeurs par défaut et leur calcul restent T-052.
8. **File** (`mutation_queue`, migration 2) : une ligne par mutation, ordre par `seq` (alias du rowid), lot, arbre, auteur, objet visé, état (`pending`, `sent`, `refused`), code de refus, mutation entière dans `body`. `sent` = réponse du serveur reçue (appliquée ou convertie en proposition ; le détail viendra avec T-060 et T-067). Seule une mutation en attente change d'état ; noter deux fois la même réponse ne change rien. Les modifications ne gardent que les champs réellement changés (`dropUnchangedFields`) : la file ne contient que ce que l'auteur a modifié, jamais le reste de la fiche, qui peut venir d'autres membres.
9. **File et instantané** : pas de clé étrangère vers `trees`. Recharger un instantané (`replaceTreeSnapshot`) garde la file ; effacer un arbre (`eraseLocalTree`, arbre retiré, CL-SEC-08) la vide explicitement. Seul le lecteur de la copie (`trees.reader_account_id`) écrit dans l'arbre et dans la file (`foreign_author`).
10. **Idempotence locale** : rejouer un lot déjà dans la file ne change rien (`already_recorded`) ; une mutation déjà présente sous un autre lot est refusée.

## Conséquences

- T-031 à T-033 et T-079 appellent `recordLocalChanges` (identifiants, date et versions posés par le paquet) ; ils traduisent les codes de `MUTATION_ISSUE_CODES` par `packages/i18n`. Supprimer une fiche demande de lister ses noms, faits, liens et unions dans le même lot.
- T-060 réutilise `applyMutationBatch` avec `canWriterSee` branché sur la projection du rédacteur, et sans `requireCurrentBaseVersion`. **Oracle** : sur le serveur, le refus d'une suppression parce qu'un objet masqué la cite, comme les refus de cohérence (ADR 0011, point 11), révélerait un objet masqué : T-060 doit traiter les dépendants invisibles du rédacteur autrement (suppression convertie en proposition, ou refus générique), avec des tests de non-fuite.
- T-063 et T-067 : après un instantané ou un tirage, rejouer les mutations en attente sur la nouvelle copie ; n'envoyer que les lots de l'auteur connecté (`authorAccountId` du filtre) ; noter les réponses par `recordQueueOutcomes` ; annuler localement une mutation refusée (par le tirage). Les lots ne se coupent pas (point 4).
- Lecture : chaque saisie relit l'arbre entier (validation Zod comprise). À mesurer sur l'Android de référence (T-028, T-105) ; si c'est trop lent, garder la copie validée en mémoire entre deux saisies.
- La file vit dans la base chiffrée, dossier `SQLite`, déjà exclu des sauvegardes et des transferts Android (`apps/mobile/plugins/withLocalDataBackupRules.ts`) ; aucune exclusion nouvelle.

## Écarté

- **Lot refusé mutation par mutation** (appliquer ce qui passe) : un plan vocal à moitié appliqué laisse des personnes sans liens ; le TRD veut « un seul bloc ».
- **Suppression en cascade implicite** : une fiche supprimée emporterait des faits saisis par d'autres membres sans que l'écran les montre ; sur le serveur, la cascade révélerait ou effacerait des objets masqués.
- **Champs de la fiche entière dans chaque modification** : la file et le journal du serveur porteraient au nom de l'auteur des valeurs saisies par d'autres, et la fusion champ par champ du TRD deviendrait impossible.
- **Version incrémentée sur le téléphone** : deux modifications hors-ligne d'une même fiche partiraient de versions que le serveur n'a jamais connues.
- **Règles de visibilité dans une table locale** : l'instantané d'un lecteur ne porte jamais de règle (ADR 0023) ; une table à part pour les seules règles de l'auteur attendra l'écran de visibilité (T-072) s'il en a besoin.
