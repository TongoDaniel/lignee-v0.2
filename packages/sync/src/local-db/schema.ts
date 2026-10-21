// Schéma Drizzle de la base du téléphone (TRD, « Hors-ligne et synchronisation », Sur le
// téléphone ; « Modèle de données » : « la base SQLite reprend les mêmes tables, limitées à ce
// que l'utilisateur peut voir »). ADR 0023.
//
// Une table par objet du modèle. Chaque ligne garde l'objet entier, validé par son schéma Zod de
// @lignee/domain, dans `body` (JSON) ; les seules autres colonnes sont l'identifiant, l'arbre et
// les identifiants des objets reliés, pour les index et les requêtes. Aucune valeur saisie (nom,
// cause de décès, notes, lieu) n'est donc dans une colonne indexée : `schema.test.ts`
// le vérifie sur la base migrée.
//
// Ce fichier n'importe que drizzle-orm : drizzle-kit le lit pour écrire les migrations
// (`corepack pnpm --filter @lignee/sync db:generate`).
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Arbres présents sur le téléphone, chacun projeté pour un lecteur (le compte connecté). */
export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  /** Compte pour lequel la copie a été filtrée : un autre compte ne la lit jamais. */
  readerAccountId: text('reader_account_id').notNull(),
  /** Moment du chargement, en millisecondes depuis 1970 (aucune donnée de l'arbre). */
  loadedAt: integer('loaded_at').notNull(),
  body: text('body', { mode: 'json' }).notNull(),
});

/** Clé étrangère commune : effacer un arbre efface tout ce qu'il contient (arbre retiré). */
function treeId() {
  return text('tree_id')
    .notNull()
    .references(() => trees.id, { onDelete: 'cascade' });
}

export const people = sqliteTable(
  'people',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [index('people_tree_idx').on(table.treeId)],
);

export const names = sqliteTable(
  'names',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    personId: text('person_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('names_tree_idx').on(table.treeId),
    index('names_person_idx').on(table.personId),
  ],
);

export const unions = sqliteTable(
  'unions',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    spouseAId: text('spouse_a_id').notNull(),
    spouseBId: text('spouse_b_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('unions_tree_idx').on(table.treeId),
    index('unions_spouse_a_idx').on(table.spouseAId),
    index('unions_spouse_b_idx').on(table.spouseBId),
  ],
);

export const simultaneityAnswers = sqliteTable(
  'simultaneity_answers',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    unionAId: text('union_a_id').notNull(),
    unionBId: text('union_b_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [index('simultaneity_answers_tree_idx').on(table.treeId)],
);

export const filiations = sqliteTable(
  'filiations',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    parentId: text('parent_id').notNull(),
    childId: text('child_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('filiations_tree_idx').on(table.treeId),
    index('filiations_parent_idx').on(table.parentId),
    index('filiations_child_idx').on(table.childId),
  ],
);

export const parentCandidates = sqliteTable(
  'parent_candidates',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    childId: text('child_id').notNull(),
    candidateId: text('candidate_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('parent_candidates_tree_idx').on(table.treeId),
    index('parent_candidates_child_idx').on(table.childId),
  ],
);

/**
 * Faits. La valeur (profession, cause de décès…) n'est que dans `body` : jamais dans une colonne,
 * donc jamais dans un index ni dans une future table de recherche plein texte construite sur les
 * colonnes (ADR 0023).
 */
export const facts = sqliteTable(
  'facts',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    personId: text('person_id'),
    unionId: text('union_id'),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('facts_tree_idx').on(table.treeId),
    index('facts_person_idx').on(table.personId),
    index('facts_union_idx').on(table.unionId),
  ],
);

export const titleRoles = sqliteTable(
  'title_roles',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    personId: text('person_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('title_roles_tree_idx').on(table.treeId),
    index('title_roles_person_idx').on(table.personId),
  ],
);

export const multipleBirths = sqliteTable(
  'multiple_births',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [index('multiple_births_tree_idx').on(table.treeId)],
);

export const places = sqliteTable(
  'places',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [index('places_tree_idx').on(table.treeId)],
);

export const toPlace = sqliteTable(
  'to_place',
  {
    id: text('id').primaryKey(),
    treeId: treeId(),
    personId: text('person_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [index('to_place_tree_idx').on(table.treeId)],
);

/** États d'une mutation dans la file (ADR 0027). */
export const QUEUE_STATUSES = ['pending', 'sent', 'refused'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/**
 * File de changements (TRD, « Hors-ligne et synchronisation », point 2 ; T-030, ADR 0027) : une
 * ligne par mutation, dans l'ordre de saisie (`seq`, croissant), groupées par lot. Le corps est
 * la mutation entière (ce que l'auteur a saisi, rien d'autre) ; les colonnes ne portent que des
 * identifiants, l'ordre, l'état et le code d'un refus (jamais une valeur saisie).
 *
 * Pas de clé étrangère vers `trees` : recharger l'instantané d'un arbre (`replaceTreeSnapshot`
 * efface puis réécrit la ligne de l'arbre) ne doit jamais effacer des saisies pas encore
 * envoyées. L'effacement d'un arbre retiré (`eraseLocalTree`) vide aussi sa file, explicitement.
 */
export const mutationQueue = sqliteTable(
  'mutation_queue',
  {
    /** Ordre de saisie : alias du rowid, toujours plus grand que les lignes présentes. */
    seq: integer('seq').primaryKey(),
    /** Identifiant de la mutation (UUIDv7), unique : une mutation n'entre qu'une fois. */
    id: text('id').notNull().unique(),
    batchId: text('batch_id').notNull(),
    treeId: text('tree_id').notNull(),
    /** Compte qui a saisi la mutation : seul ce compte l'envoie (T-067). */
    authorAccountId: text('author_account_id').notNull(),
    /** Objet visé, pour dire qu'une fiche a des changements en attente. */
    entityId: text('entity_id').notNull(),
    status: text('status', { enum: QUEUE_STATUSES }).notNull(),
    /** Code stable du refus du serveur (T-060), sans texte ni valeur. */
    refusalCode: text('refusal_code'),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('mutation_queue_tree_idx').on(table.treeId),
    index('mutation_queue_batch_idx').on(table.batchId),
    index('mutation_queue_entity_idx').on(table.entityId),
    check('mutation_queue_status_check', sql`${table.status} IN ('pending', 'sent', 'refused')`),
    check(
      'mutation_queue_refusal_check',
      sql`(${table.status} = 'refused') = (${table.refusalCode} IS NOT NULL)`,
    ),
  ],
);

/** Toutes les tables, pour `drizzle(…, { schema: localSchema })`. */
export const localSchema = {
  trees,
  people,
  names,
  unions,
  simultaneityAnswers,
  filiations,
  parentCandidates,
  facts,
  titleRoles,
  multipleBirths,
  places,
  toPlace,
  mutationQueue,
};
export type LocalSchema = typeof localSchema;
