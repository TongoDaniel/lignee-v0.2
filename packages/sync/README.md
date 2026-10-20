# sync

Protocole de synchronisation, côté téléphone et côté serveur. Agent : sync-hors-ligne ; toute modification passe par la relecture de gardien-confidentialite.

## Base locale chiffrée (T-016, ADR 0023)

| Fichier | Contenu |
| --- | --- |
| `src/local-db/schema.ts` | Schéma Drizzle : une table par objet du modèle, colonnes d'identifiants et objet entier dans `body` (JSON validé par `@lignee/domain`) |
| `src/local-db/migrations/` | SQL et instantanés écrits par drizzle-kit (ne pas modifier à la main) |
| `src/local-db/generated/migrations.ts` | Le même SQL en module TypeScript, embarqué par Metro |
| `src/local-db/migrate.ts` | Migrateur : version dans `PRAGMA user_version`, une transaction par migration |
| `src/local-db/key.ts`, `open.ts` | Clé aléatoire de 256 bits en clé brute SQLCipher, trousseau, ouverture, rotation, effacement |
| `src/local-db/snapshot.ts` | Instantané d'un arbre pour un lecteur : validation, seconde barrière de confidentialité, écriture, relecture, effacement d'un arbre |
| `src/mutations/apply.ts` | Application pure d'un lot de mutations à un arbre (T-030, ADR 0027) : contrôles sur l'état final, refus du lot entier, point d'extension `canWriterSee` (visibilité du rédacteur, ADR 0017) |
| `src/mutations/local-changes.ts` | Saisie locale : `recordLocalChanges` (changements de l'écran ou du plan vocal) et `applyLocalMutationBatch` (lot déjà formé, idempotent), arbre et file écrits dans la même transaction |
| `src/mutations/queue.ts` | File de changements (`mutation_queue`) : ordre de saisie, lots, « N changements en attente », états en attente, envoyée, refusée |
| `src/dev-seed/` | `@lignee/sync/dev-seed` : arbre généré de 500 personnes, projeté prudemment, chargé en développement seulement |
| `src/test-support/` | Base chiffrée sur le poste (better-sqlite3-multiple-ciphers au format SQLCipher 4), trousseau en mémoire |
| `src/tooling/` | Production du module des migrations |

Le code de `src/` hors tests, outils de test et outillage est embarqué dans l'app : `tsconfig.src.json` le vérifie sans types de Node. Le branchement sur expo-sqlite, expo-secure-store et expo-crypto est dans `apps/mobile/src/db/`.

### Changer le schéma

```sh
# 1. modifier src/local-db/schema.ts
corepack pnpm --filter @lignee/sync exec drizzle-kit generate --name <nom_court>   # SQL nommé
corepack pnpm --filter @lignee/sync exec node src/tooling/bundle-migrations.cli.ts # module embarqué
corepack pnpm --filter @lignee/sync test                                 # schéma, SQL et module d'accord
```

`db:generate` fait les deux étapes, mais sans nom de migration (un argument après `--` irait au second script). Une migration publiée ne se modifie plus : on en ajoute une. Toute colonne autre qu'un identifiant est refusée par `schema.test.ts` (aucune valeur saisie hors du corps JSON, donc jamais dans un index).

### Confidentialité

- Le téléphone ne reçoit que ce que son utilisateur voit (TRD, « Confidentialité appliquée ») : le filtrage est fait par le serveur (T-052, T-056). `replaceTreeSnapshot` refuse, sans rien écrire, un instantané qui porte la trace d'un filtrage incomplet : règle de visibilité, référence vers un objet absent (dont `distinctFrom`, ADR 0017), source, cause de décès ou ancien prénom d'un autre auteur. Erreurs et constats ne contiennent que des chemins.
- La file de changements ne garde que ce que l'auteur a saisi : une modification ne porte que les champs réellement changés, une suppression aucun champ. Elle vit dans la base chiffrée (dossier `SQLite`, exclu des sauvegardes Android) ; recharger un instantané la garde, effacer l'arbre la vide. Les constats d'un lot refusé ne portent qu'un code et un chemin.
- Aucune valeur saisie n'est journalisée ; l'issue de l'ouverture (`OpenOutcome`) et les nombres d'objets peuvent l'être.

## Tests

```sh
corepack pnpm --filter @lignee/sync test
```

Clé (format, refus d'une injection), migrations (ordre, transaction, base trop récente, table recréée sans effacement en cascade, clé étrangère rompue refusée), schéma (drizzle-kit d'accord, colonnes et index), ouverture (création, réouverture, clé absente ou fausse, rotation et ses interruptions, effacement), instantané (aller-retour sur des arbres générés, remplacement, effacement d'un arbre, seconde barrière), projection de développement (propriété : aucun objet sous règle restreinte), chargement de 500 personnes, mutations (lot appliqué puis relu = état attendu, lot invalide = base et file inchangées, propriétés sur des arbres générés ; « distincte de » vers une personne absente ou masquée, même réponse ; refus de cohérence ; idempotence ; file après redémarrage ; migration 2 sur une base remplie), et CL-SEC-14 (partie base locale : `src/scenarios/CL-SEC-14.test.ts`).

## À vérifier sur téléphone

Ce que les tests sur le poste ne prouvent pas, pour le ticket « À vérifier sur téléphone » (build de développement, Android de référence et iPhone) :

1. Le fichier `lignee.db` copié depuis l'appareil (`adb exec-out run-as com.lignee.app cat files/SQLite/lignee.db`, chemin à confirmer) ne commence pas par « SQLite format 3 » et ne contient aucun nom de l'arbre généré ; idem pour `lignee.db-wal`.
2. expo-sqlite avec SQLCipher accepte la clé brute (`PRAGMA key = "x'…'"`) : l'app rouvre la base après un arrêt complet.
3. La journalisation de développement affiche `[lignee-dev-seed-generated-tree] N personnes chargées` au premier lancement seulement.
4. Après désinstallation puis réinstallation (iOS garde le trousseau, pas le fichier ; Android efface les deux), l'app démarre sans erreur.
5. Sauvegarde Android désactivée : `adb shell bmgr backupnow com.lignee.app` ne sauvegarde rien.
6. Temps d'ouverture de la base et du chargement de 500 personnes sur l'Android de référence.
7. FTS5 disponible avec SQLCipher (`SELECT sqlite_compileoption_used('ENABLE_FTS5')`), pour la recherche locale.
8. La clé reste lisible quand l'app tourne en arrière-plan écran verrouillé (après le premier déverrouillage), en vue de expo-background-task.
9. Arrêt brutal (app tuée, batterie retirée) pendant `PRAGMA rekey` : à l'ouverture suivante, la base s'ouvre avec l'une des deux clés du trousseau, sans remise à zéro.
10. Keystore Android qui renvoie `null` de façon passagère (redémarrage, mise à jour du système) : aujourd'hui, une clé absente avec un fichier présent provoque une remise à zéro silencieuse (`reset_key_missing`) ; observer si cela arrive, et sinon le noter.
11. iOS avant le premier déverrouillage depuis le démarrage (tâche d'arrière-plan) : `getItemAsync` doit lever une erreur et non renvoyer `null` ; un `null` provoquerait une remise à zéro de la base.
12. Les messages d'erreur d'expo-sqlite pour une mauvaise clé sont bien reconnus (`isNotADatabaseError` : code `SQLITE_NOTADB` ou « file is not a database ») sur Android et sur iOS ; sinon l'ouverture échoue au lieu de se remettre à zéro.
13. Effacement (`destroyLocalDatabase`, remise à zéro) : `lignee.db-wal` et `lignee.db-shm` disparaissent aussi du dossier `SQLite`.
14. Transfert d'appareil Android 12+ (assistant de migration) : la base et la clé ne passent pas sur le nouveau téléphone.
