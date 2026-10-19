// Copie locale d'un arbre, telle que le serveur l'envoie à un lecteur (TRD, « Hors-ligne et
// synchronisation », point 5 : « un instantané compressé de la partie visible »), et son
// écriture dans la base du téléphone. Le tirage par curseur (T-063) écrira dans les mêmes tables.
//
// Confidentialité (TRD, « Confidentialité appliquée » ; ADR 0017 et 0023) : le téléphone ne
// reçoit que ce que son utilisateur peut voir. Le filtrage est fait sur le serveur, par le module
// de droits (T-049, T-052, T-056). Ce module n'en refait pas le calcul ; il refuse en seconde
// barrière tout instantané qui porte la trace d'un filtrage incomplet (`snapshotPrivacyIssues`).
import {
  factSchema,
  filiationSchema,
  idSchema,
  multipleBirthSchema,
  nameSchema,
  parentCandidateSchema,
  personSchema,
  placeSchema,
  simultaneityAnswerSchema,
  titleRoleSchema,
  toPlaceSchema,
  treeSchema,
  unionSchema,
  type Fact,
  type Id,
} from '@lignee/domain';
import { asc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import {
  facts,
  filiations,
  localSchema,
  multipleBirths,
  names,
  parentCandidates,
  people,
  places,
  simultaneityAnswers,
  titleRoles,
  toPlace,
  trees,
  unions,
  type LocalSchema,
} from './schema';

/** Base du téléphone vue par Drizzle : expo-sqlite sur le téléphone, better-sqlite3 en test. */
export type LocalDatabase = BaseSQLiteDatabase<'sync', unknown, LocalSchema>;

/**
 * Instantané d'un arbre pour un lecteur. Aucune règle de visibilité : le lecteur reçoit les
 * objets qu'il voit, jamais les règles qui en cachent d'autres (la liste des comptes choisis
 * n'appartient qu'à l'auteur de la règle : T-052, T-063). Une clé inconnue est refusée.
 */
export const localTreeSnapshotSchema = z.strictObject({
  /** Compte pour lequel l'arbre a été filtré. */
  readerAccountId: idSchema,
  tree: treeSchema,
  people: z.array(personSchema),
  names: z.array(nameSchema),
  unions: z.array(unionSchema),
  simultaneityAnswers: z.array(simultaneityAnswerSchema),
  filiations: z.array(filiationSchema),
  parentCandidates: z.array(parentCandidateSchema),
  facts: z.array(factSchema),
  titleRoles: z.array(titleRoleSchema),
  multipleBirths: z.array(multipleBirthSchema),
  places: z.array(placeSchema),
  toPlace: z.array(toPlaceSchema),
});
export type LocalTreeSnapshot = z.infer<typeof localTreeSnapshotSchema>;
export type LocalTreeSnapshotInput = z.input<typeof localTreeSnapshotSchema>;

/** Collections d'objets d'un instantané (tout sauf l'arbre et le lecteur). */
export const SNAPSHOT_COLLECTIONS = [
  'people',
  'names',
  'unions',
  'simultaneityAnswers',
  'filiations',
  'parentCandidates',
  'facts',
  'titleRoles',
  'multipleBirths',
  'places',
  'toPlace',
] as const;
export type SnapshotCollection = (typeof SNAPSHOT_COLLECTIONS)[number];

/**
 * Trace d'un filtrage incomplet. Ne contient que des chemins (collection, rang, champ) et un
 * code, jamais une valeur saisie ni un identifiant : un constat peut être journalisé.
 */
export interface SnapshotIssue {
  readonly code:
    | 'foreign_tree'
    | 'duplicate_id'
    | 'dangling_reference'
    | 'unsupported_reference'
    | 'death_cause_of_another_author'
    | 'former_name_of_another_author';
  readonly path: string;
}

/**
 * Seconde barrière avant l'écriture (la première est le serveur) :
 * - chaque objet est de cet arbre et chaque identifiant n'apparaît qu'une fois ;
 * - chaque référence (personne, union, filiation, lieu, mention « distincte de » de l'ADR 0017)
 *   désigne un objet de l'instantané : une référence vers un objet absent trahit un objet masqué
 *   (son identifiant, et le fait qu'il existe) ;
 * - aucune source n'est encore synchronisée : un `sourceId` est refusé ;
 * - cause de décès et ancien prénom : auteur seul par défaut (README de packages/domain). Sans
 *   règles sur le téléphone, tout autre auteur est refusé. À revoir avec T-052 si une règle
 *   explicite peut les ouvrir à d'autres lecteurs.
 */
export function snapshotPrivacyIssues(snapshot: LocalTreeSnapshot): SnapshotIssue[] {
  const issues: SnapshotIssue[] = [];
  const treeId = snapshot.tree.id;
  const seen = new Set<Id>([treeId]);
  for (const collection of SNAPSHOT_COLLECTIONS) {
    snapshot[collection].forEach((object, index) => {
      if (object.treeId !== treeId) {
        issues.push({ code: 'foreign_tree', path: `${collection}[${String(index)}].treeId` });
      }
      if (seen.has(object.id)) {
        issues.push({ code: 'duplicate_id', path: `${collection}[${String(index)}].id` });
      }
      seen.add(object.id);
    });
  }

  const personIds = new Set(snapshot.people.map((person) => person.id));
  const unionIds = new Set(snapshot.unions.map((union) => union.id));
  const filiationIds = new Set(snapshot.filiations.map((filiation) => filiation.id));
  const placeIds = new Set(snapshot.places.map((place) => place.id));
  const check = (ids: ReadonlySet<Id>, id: Id | undefined, path: string) => {
    if (id !== undefined && !ids.has(id)) issues.push({ code: 'dangling_reference', path });
  };
  const noSource = (id: Id | undefined, path: string) => {
    if (id !== undefined) issues.push({ code: 'unsupported_reference', path });
  };

  snapshot.people.forEach((person, i) => {
    person.distinctFrom?.forEach((id, j) => {
      check(personIds, id, `people[${String(i)}].distinctFrom[${String(j)}]`);
    });
  });
  snapshot.names.forEach((name, i) => {
    check(personIds, name.personId, `names[${String(i)}].personId`);
    if (name.type === 'former' && name.authorAccountId !== snapshot.readerAccountId) {
      issues.push({ code: 'former_name_of_another_author', path: `names[${String(i)}]` });
    }
  });
  snapshot.unions.forEach((union, i) => {
    union.spouses.forEach((spouse, j) => {
      check(personIds, spouse.personId, `unions[${String(i)}].spouses[${String(j)}]`);
    });
    check(placeIds, union.placeId, `unions[${String(i)}].placeId`);
  });
  snapshot.simultaneityAnswers.forEach((answer, i) => {
    answer.unionIds.forEach((id, j) => {
      check(unionIds, id, `simultaneityAnswers[${String(i)}].unionIds[${String(j)}]`);
    });
  });
  snapshot.filiations.forEach((filiation, i) => {
    check(personIds, filiation.parentId, `filiations[${String(i)}].parentId`);
    check(personIds, filiation.childId, `filiations[${String(i)}].childId`);
    check(unionIds, filiation.originUnionId, `filiations[${String(i)}].originUnionId`);
    noSource(filiation.sourceId, `filiations[${String(i)}].sourceId`);
  });
  snapshot.parentCandidates.forEach((candidate, i) => {
    check(personIds, candidate.childId, `parentCandidates[${String(i)}].childId`);
    check(personIds, candidate.candidateId, `parentCandidates[${String(i)}].candidateId`);
  });
  snapshot.facts.forEach((fact: Fact, i) => {
    const path = `facts[${String(i)}]`;
    if (fact.subject.kind === 'person') check(personIds, fact.subject.personId, `${path}.subject`);
    else check(unionIds, fact.subject.unionId, `${path}.subject`);
    check(filiationIds, fact.filiationId, `${path}.filiationId`);
    check(placeIds, fact.placeId, `${path}.placeId`);
    noSource(fact.sourceId, `${path}.sourceId`);
    if (fact.type === 'death_cause' && fact.authorAccountId !== snapshot.readerAccountId) {
      issues.push({ code: 'death_cause_of_another_author', path });
    }
  });
  snapshot.titleRoles.forEach((title, i) => {
    check(personIds, title.personId, `titleRoles[${String(i)}].personId`);
    check(placeIds, title.placeId, `titleRoles[${String(i)}].placeId`);
  });
  snapshot.multipleBirths.forEach((birth, i) => {
    birth.members.forEach((member, j) => {
      check(personIds, member.personId, `multipleBirths[${String(i)}].members[${String(j)}]`);
    });
  });
  snapshot.toPlace.forEach((entry, i) => {
    check(personIds, entry.personId, `toPlace[${String(i)}].personId`);
    check(personIds, entry.referencePersonId, `toPlace[${String(i)}].referencePersonId`);
  });
  return issues;
}

/** Instantané mal formé : seuls les chemins des erreurs sont gardés, jamais les valeurs. */
export class InvalidSnapshotError extends Error {
  constructor(readonly paths: readonly string[]) {
    super(`Invalid tree snapshot (${String(paths.length)} issue(s))`);
    this.name = 'InvalidSnapshotError';
  }
}

/** Instantané qui porte la trace d'un filtrage incomplet : rien n'est écrit. */
export class SnapshotPrivacyError extends Error {
  constructor(readonly issues: readonly SnapshotIssue[]) {
    super(`Tree snapshot refused (${String(issues.length)} privacy issue(s))`);
    this.name = 'SnapshotPrivacyError';
  }
}

/** Valide un instantané reçu (schémas de @lignee/domain), puis la seconde barrière. */
export function parseLocalTreeSnapshot(input: unknown): LocalTreeSnapshot {
  const result = localTreeSnapshotSchema.safeParse(input);
  if (!result.success) {
    throw new InvalidSnapshotError(result.error.issues.map((issue) => issue.path.join('.')));
  }
  const issues = snapshotPrivacyIssues(result.data);
  if (issues.length > 0) throw new SnapshotPrivacyError(issues);
  return result.data;
}

/** Nombre d'objets écrits par collection. */
export type SnapshotCounts = Record<SnapshotCollection, number>;

type Row = Record<string, unknown>;

/** Une table de l'arbre et la façon d'y ranger un objet : colonnes de relation, objet entier. */
interface CollectionTable<K extends SnapshotCollection> {
  readonly table: SQLiteTable & { treeId: unknown; id: unknown };
  readonly row: (object: LocalTreeSnapshot[K][number]) => Row;
}

const COLLECTION_TABLES: { readonly [K in SnapshotCollection]: CollectionTable<K> } = {
  people: { table: people, row: () => ({}) },
  names: { table: names, row: (name) => ({ personId: name.personId }) },
  unions: {
    table: unions,
    row: (union) => ({
      spouseAId: union.spouses[0].personId,
      spouseBId: union.spouses[1].personId,
    }),
  },
  simultaneityAnswers: {
    table: simultaneityAnswers,
    row: (answer) => ({ unionAId: answer.unionIds[0], unionBId: answer.unionIds[1] }),
  },
  filiations: {
    table: filiations,
    row: (filiation) => ({ parentId: filiation.parentId, childId: filiation.childId }),
  },
  parentCandidates: {
    table: parentCandidates,
    row: (candidate) => ({ childId: candidate.childId, candidateId: candidate.candidateId }),
  },
  facts: {
    table: facts,
    row: (fact) => ({
      personId: fact.subject.kind === 'person' ? fact.subject.personId : null,
      unionId: fact.subject.kind === 'union' ? fact.subject.unionId : null,
    }),
  },
  titleRoles: { table: titleRoles, row: (title) => ({ personId: title.personId }) },
  multipleBirths: { table: multipleBirths, row: () => ({}) },
  places: { table: places, row: () => ({}) },
  toPlace: { table: toPlace, row: (entry) => ({ personId: entry.personId }) },
};

/** Lignes par instruction INSERT : bien sous la limite de paramètres de SQLite. */
const INSERT_CHUNK = 100;

function insertAll<K extends SnapshotCollection>(
  tx: LocalDatabase,
  collection: K,
  objects: LocalTreeSnapshot[K],
): void {
  const { table, row } = COLLECTION_TABLES[collection] as unknown as CollectionTable<K>;
  const rows = (objects as LocalTreeSnapshot[K][number][]).map((object) => ({
    id: object.id,
    treeId: object.treeId,
    ...row(object),
    body: object,
  }));
  for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
    tx.insert(table)
      .values(rows.slice(start, start + INSERT_CHUNK))
      .run();
  }
}

/** Efface tout ce que la base garde d'un arbre (arbre retiré au lecteur, TRD). */
function deleteTree(tx: LocalDatabase, treeId: Id): void {
  // Les clés étrangères effaceraient en cascade ; on ne compte pas sur `PRAGMA foreign_keys`.
  for (const collection of SNAPSHOT_COLLECTIONS) {
    const { table } = COLLECTION_TABLES[collection];
    tx.delete(table)
      .where(eq(table.treeId as never, treeId))
      .run();
  }
  tx.delete(trees).where(eq(trees.id, treeId)).run();
}

export interface ReplaceTreeOptions {
  /** Moment du chargement (millisecondes depuis 1970). */
  readonly now: number;
}

/**
 * Remplace, en une transaction, la copie locale d'un arbre par cet instantané (premier
 * chargement, ou arbre rechargé en entier). Rien n'est écrit si l'instantané est refusé.
 */
export function replaceTreeSnapshot(
  db: LocalDatabase,
  input: unknown,
  options: ReplaceTreeOptions,
): SnapshotCounts {
  const snapshot = parseLocalTreeSnapshot(input);
  return db.transaction((tx) => {
    const local = tx as unknown as LocalDatabase;
    deleteTree(local, snapshot.tree.id);
    local
      .insert(trees)
      .values({
        id: snapshot.tree.id,
        readerAccountId: snapshot.readerAccountId,
        loadedAt: options.now,
        body: snapshot.tree,
      })
      .run();
    const counts = {} as SnapshotCounts;
    for (const collection of SNAPSHOT_COLLECTIONS) {
      insertAll(local, collection, snapshot[collection]);
      counts[collection] = snapshot[collection].length;
    }
    return counts;
  });
}

/** Efface un arbre de la base du téléphone (arbre retiré, exclusion : CL-SEC-08, T-063). */
export function eraseLocalTree(db: LocalDatabase, treeId: Id): void {
  db.transaction((tx) => {
    deleteTree(tx, treeId);
  });
}

/** Arbres présents sur le téléphone. */
export function listLocalTrees(db: LocalDatabase): { id: Id; readerAccountId: Id }[] {
  return db
    .select({ id: trees.id, readerAccountId: trees.readerAccountId })
    .from(trees)
    .orderBy(asc(trees.id))
    .all();
}

/**
 * Relit la copie locale d'un arbre, chaque objet repassé par son schéma (une base écrite par
 * une autre version de l'app ne donne jamais d'objet invalide). `undefined` si l'arbre n'est pas
 * sur le téléphone.
 */
export function readTreeSnapshot(db: LocalDatabase, treeId: Id): LocalTreeSnapshot | undefined {
  const tree = db.select().from(trees).where(eq(trees.id, treeId)).get();
  if (tree === undefined) return undefined;
  const collections = Object.fromEntries(
    SNAPSHOT_COLLECTIONS.map((collection) => {
      const { table } = COLLECTION_TABLES[collection];
      const rows = db
        .select({ body: sql<string>`body` })
        .from(table)
        .where(eq(table.treeId as never, treeId))
        .orderBy(sql`rowid`)
        .all();
      return [collection, rows.map((row) => JSON.parse(row.body) as unknown)];
    }),
  );
  return localTreeSnapshotSchema.parse({
    readerAccountId: tree.readerAccountId,
    tree: tree.body,
    ...collections,
  });
}

export { localSchema };
