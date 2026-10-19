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
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
};
export type LocalSchema = typeof localSchema;
