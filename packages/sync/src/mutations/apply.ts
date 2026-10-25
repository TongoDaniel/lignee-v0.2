// Application d'un lot de mutations à un arbre, en mémoire (TRD, « Hors-ligne et
// synchronisation », points 2 et 3 ; ADR 0027). Logique pure, sans base ni horloge : le téléphone
// l'applique à sa copie (`local-changes.ts`), le serveur pourra l'appliquer à l'arbre complet
// (T-060) en branchant l'ensemble visible du rédacteur (`canWriterSee`).
//
// Un lot s'applique d'un seul bloc : toutes ses mutations ou aucune. Avant d'accepter, on
// vérifie sur l'état final : schéma de chaque objet, existence et visibilité de chaque objet
// cité (dont `distinctFrom`, ADR 0017), auteur des données qui n'appartiennent qu'à lui, nom
// d'une personne connue, réponses « simultanées ou successives », et les refus de cohérence
// (troisième parent de naissance, cycle : ADR 0011). Les alertes qu'on peut passer outre ne
// bloquent rien : l'écran les montre avant d'écrire (T-031, T-033).
//
// Confidentialité : les constats ne portent qu'un code et un chemin (rang de la mutation,
// champ), jamais une valeur saisie ni un identifiant. Un objet que le rédacteur ne voit pas
// reçoit exactement la même réponse qu'un objet qui n'existe pas.
import {
  checkNewFiliation,
  createdObject,
  updatedObject,
  type CoherenceCode,
  type Id,
  type Mutation,
  type MutationBatch,
  type MutationEntity,
  type VisibilityRule,
} from '@lignee/domain';

import {
  SNAPSHOT_COLLECTIONS,
  type LocalTreeSnapshot,
  type SnapshotCollection,
} from '../local-db/snapshot';

/** Les objets d'un arbre (instantané sans son lecteur). */
export type TreeObjects = Omit<LocalTreeSnapshot, 'readerAccountId'>;
type TreeObject = TreeObjects[SnapshotCollection][number];

/** Les objets d'un instantané, sans son lecteur. */
export function treeObjectsOf(snapshot: LocalTreeSnapshot): TreeObjects {
  const objects = { tree: snapshot.tree } as Record<string, unknown>;
  for (const collection of SNAPSHOT_COLLECTIONS) objects[collection] = snapshot[collection];
  return objects as TreeObjects;
}

/** Entités rangées dans une table de l'arbre ; les règles de visibilité ne le sont pas. */
export type StoredEntity = Exclude<MutationEntity, 'visibility_rule'>;

export const ENTITY_COLLECTIONS: Readonly<Record<StoredEntity, SnapshotCollection>> = {
  person: 'people',
  name: 'names',
  union: 'unions',
  simultaneity_answer: 'simultaneityAnswers',
  filiation: 'filiations',
  parent_candidate: 'parentCandidates',
  fact: 'facts',
  title_role: 'titleRoles',
  multiple_birth: 'multipleBirths',
  place: 'places',
  to_place: 'toPlace',
};

/** Codes stables des constats (traduits par packages/i18n quand l'écran les explique). */
export const MUTATION_ISSUE_CODES = [
  'unknown_tree',
  'foreign_author',
  'duplicate_mutation',
  'duplicate_id',
  'unknown_object',
  'invalid_object',
  'dangling_reference',
  'unsupported_reference',
  'author_mismatch',
  'person_without_name',
  'invalid_simultaneity_answer',
  'duplicate_visibility_rule',
  'base_version_mismatch',
  'coherence_refusal',
  'privacy_barrier',
] as const;
export type MutationIssueCode = (typeof MUTATION_ISSUE_CODES)[number];

/**
 * Un constat : un code et un chemin (`mutations[2].fields.parentId`). Pour un refus de
 * cohérence, le code du constat de @lignee/domain. Aucune valeur, aucun identifiant : un constat
 * peut être journalisé.
 */
export interface MutationIssue {
  readonly code: MutationIssueCode;
  readonly path: string;
  readonly coherenceCode?: CoherenceCode;
}

/** Un objet tel que le voit (ou non) le rédacteur. */
export interface WriterObject {
  readonly entity: StoredEntity;
  readonly id: Id;
}

export interface MutationContext {
  /** Compte qui a saisi le lot : l'auteur des noms, faits, titres et règles qu'il crée. */
  readonly authorAccountId: Id;
  /**
   * Point d'extension de la visibilité du rédacteur (ADR 0017 : « à l'écriture, chaque
   * identifiant est validé contre l'ensemble visible du rédacteur, avec la même réponse pour un
   * identifiant inexistant et pour un identifiant masqué »). Sur le téléphone, la copie locale ne
   * contient que ce que le rédacteur voit : sans cette fonction, tout objet présent est visible.
   * Le serveur (T-060) y branche la projection du rédacteur (T-056) : un objet cité, modifié ou
   * supprimé qu'il ne voit pas est traité comme absent. Vaut pour `distinctFrom` comme pour
   * toute autre référence.
   */
  readonly canWriterSee?: (object: WriterObject) => boolean;
  /**
   * Exiger que chaque `baseVersion` soit la version connue au moment de la mutation (téléphone :
   * un lot préparé sur une copie plus ancienne est refusé, il doit être reconstruit). Le serveur,
   * lui, reçoit des versions anciennes et résout le conflit (T-060).
   */
  readonly requireCurrentBaseVersion?: boolean;
}

/** Écriture nette d'un objet, une fois le lot appliqué. */
export type ObjectChange =
  | {
      readonly kind: 'insert' | 'update';
      readonly collection: SnapshotCollection;
      readonly object: TreeObject;
    }
  | { readonly kind: 'delete'; readonly collection: SnapshotCollection; readonly id: Id };

export type MutationApplication =
  | {
      readonly ok: true;
      /** L'arbre après le lot ; les objets gardent leur ordre, les nouveaux à la fin. */
      readonly tree: TreeObjects;
      /** Écritures à faire, dans l'ordre des objets de `tree`. */
      readonly changes: readonly ObjectChange[];
      /** Version de départ de chaque mutation, telle qu'on la connaît ici (ADR 0027). */
      readonly baseVersions: readonly (number | null)[];
      /** Règles de visibilité créées par le lot (elles ne sont pas rangées dans l'arbre). */
      readonly visibilityRules: readonly VisibilityRule[];
    }
  | { readonly ok: false; readonly issues: readonly MutationIssue[] };

/** Un objet cité par un autre : le champ qui le cite, son entité et son identifiant. */
interface Reference {
  readonly field: string;
  readonly entity: StoredEntity | 'source';
  readonly id: Id;
}

/** Objets cités par un objet de l'arbre (les mêmes que la seconde barrière de snapshot.ts). */
function referencesOf(collection: SnapshotCollection, object: TreeObject): Reference[] {
  const refs: Reference[] = [];
  const add = (field: string, entity: Reference['entity'], id: Id | undefined) => {
    if (id !== undefined) refs.push({ field, entity, id });
  };
  switch (collection) {
    case 'people': {
      const person = object as TreeObjects['people'][number];
      person.distinctFrom?.forEach((id, j) => {
        add(`distinctFrom[${String(j)}]`, 'person', id);
      });
      break;
    }
    case 'names': {
      add('personId', 'person', (object as TreeObjects['names'][number]).personId);
      break;
    }
    case 'unions': {
      const union = object as TreeObjects['unions'][number];
      union.spouses.forEach((spouse, j) => {
        add(`spouses[${String(j)}].personId`, 'person', spouse.personId);
      });
      add('placeId', 'place', union.placeId);
      break;
    }
    case 'simultaneityAnswers': {
      (object as TreeObjects['simultaneityAnswers'][number]).unionIds.forEach((id, j) => {
        add(`unionIds[${String(j)}]`, 'union', id);
      });
      break;
    }
    case 'filiations': {
      const filiation = object as TreeObjects['filiations'][number];
      add('parentId', 'person', filiation.parentId);
      add('childId', 'person', filiation.childId);
      add('originUnionId', 'union', filiation.originUnionId);
      add('sourceId', 'source', filiation.sourceId);
      break;
    }
    case 'parentCandidates': {
      const candidate = object as TreeObjects['parentCandidates'][number];
      add('childId', 'person', candidate.childId);
      add('candidateId', 'person', candidate.candidateId);
      break;
    }
    case 'facts': {
      const fact = object as TreeObjects['facts'][number];
      if (fact.subject.kind === 'person') add('subject.personId', 'person', fact.subject.personId);
      else add('subject.unionId', 'union', fact.subject.unionId);
      add('filiationId', 'filiation', fact.filiationId);
      add('placeId', 'place', fact.placeId);
      add('sourceId', 'source', fact.sourceId);
      break;
    }
    case 'titleRoles': {
      const title = object as TreeObjects['titleRoles'][number];
      add('personId', 'person', title.personId);
      add('placeId', 'place', title.placeId);
      break;
    }
    case 'multipleBirths': {
      (object as TreeObjects['multipleBirths'][number]).members.forEach((member, j) => {
        add(`members[${String(j)}].personId`, 'person', member.personId);
      });
      break;
    }
    case 'places':
      break;
    case 'toPlace': {
      const entry = object as TreeObjects['toPlace'][number];
      add('personId', 'person', entry.personId);
      add('referencePersonId', 'person', entry.referencePersonId);
      break;
    }
  }
  return refs;
}

function ruleReferences(rule: VisibilityRule): Reference[] {
  const refs: Reference[] = [{ field: 'target.id', entity: rule.target.type, id: rule.target.id }];
  if (rule.level === 'branch') {
    refs.push({ field: 'branchRootPersonId', entity: 'person', id: rule.branchRootPersonId });
  }
  return refs;
}

const at = (index: number) => `mutations[${String(index)}]`;

/**
 * Chemin d'un constat, au même format partout (`mutations[2].fields.spouses[0]`) : constats d'un
 * lot refusé comme erreurs de schéma (`InvalidMutationBatchError`).
 */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => {
    if (typeof key === 'number') return `${text}[${String(key)}]`;
    return text === '' ? String(key) : `${text}.${String(key)}`;
  }, '');
}

function zodPath(index: number, path: readonly PropertyKey[]): string {
  return formatIssuePath(['mutations', index, 'fields', ...path]);
}

/**
 * Remet un constat au rang qu'avait la mutation dans le lot d'origine (`origins[rang réduit]`),
 * quand des changements sans effet ont été retirés avant l'application.
 */
export function remapIssue(issue: MutationIssue, origins: readonly number[]): MutationIssue {
  const path = issue.path.replace(/^mutations\[(\d+)\]/, (whole, rank: string) => {
    const origin = origins[Number(rank)];
    return origin === undefined ? whole : at(origin);
  });
  return { ...issue, path };
}

/** Tri stable des clés, pour comparer deux valeurs JSON. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : inner,
  );
}

/** Version connue d'un objet : seule la fiche d'une personne est versionnée (TRD, `personnes`). */
function versionOf(entity: StoredEntity, object: TreeObject | undefined): number | null {
  if (entity !== 'person' || object === undefined) return null;
  return (object as TreeObjects['people'][number]).version;
}

/**
 * Retire d'un lot ce qui ne change rien : dans une modification, les champs égaux à la valeur
 * courante (la file ne garde que ce que l'auteur a modifié, pas le reste de la fiche, qui peut
 * venir d'autres membres) ; puis les modifications devenues vides. `origins[i]` est le rang,
 * dans le lot reçu, de la i-ème mutation gardée (pour remettre les constats à leur rang).
 */
export function dropUnchangedFields(
  tree: TreeObjects,
  batch: MutationBatch,
): { batch: MutationBatch; origins: number[] } {
  const working = new Map<Id, TreeObject>();
  const deleted = new Set<Id>();
  const lookup = (entity: StoredEntity, id: Id): TreeObject | undefined => {
    if (deleted.has(id)) return undefined;
    if (working.has(id)) return working.get(id);
    return (tree[ENTITY_COLLECTIONS[entity]] as readonly TreeObject[]).find(
      (object) => object.id === id,
    );
  };
  const mutations: Mutation[] = [];
  const origins: number[] = [];
  const keep = (mutation: Mutation, rank: number) => {
    mutations.push(mutation);
    origins.push(rank);
  };
  for (const [rank, mutation] of batch.mutations.entries()) {
    if (mutation.entity === 'visibility_rule') {
      keep(mutation, rank);
      continue;
    }
    const entity = mutation.entity;
    if (mutation.operation === 'delete') {
      working.delete(mutation.entityId);
      deleted.add(mutation.entityId);
      keep(mutation, rank);
      continue;
    }
    if (mutation.operation === 'create') {
      const created = createdObject(entity, mutation.entityId, batch.treeId, mutation.fields ?? {});
      if (created.success) {
        deleted.delete(mutation.entityId);
        working.set(mutation.entityId, created.data);
      }
      keep(mutation, rank);
      continue;
    }
    const current = lookup(entity, mutation.entityId) as Record<string, unknown> | undefined;
    if (current === undefined) {
      keep(mutation, rank);
      continue;
    }
    const fields = Object.fromEntries(
      Object.entries(mutation.fields ?? {}).filter(([key, value]) =>
        value === null ? key in current : canonical(current[key]) !== canonical(value),
      ),
    );
    if (Object.keys(fields).length === 0) continue;
    const updated = updatedObject(entity, current as never, fields);
    if (updated.success) working.set(mutation.entityId, updated.data);
    keep({ ...mutation, fields }, rank);
  }
  return { batch: { ...batch, mutations }, origins };
}

/**
 * Applique un lot à un arbre, en mémoire. Renvoie l'arbre final et les écritures à faire, ou
 * tous les constats qui le font refuser. L'arbre reçu n'est jamais modifié.
 */
export function applyMutationBatch(
  tree: TreeObjects,
  batch: MutationBatch,
  context: MutationContext,
): MutationApplication {
  const issues: MutationIssue[] = [];
  if (batch.treeId !== tree.tree.id) {
    return { ok: false, issues: [{ code: 'unknown_tree', path: 'treeId' }] };
  }
  const canSee = context.canWriterSee ?? (() => true);

  const maps = Object.fromEntries(
    SNAPSHOT_COLLECTIONS.map((collection) => [
      collection,
      new Map<Id, TreeObject>(
        (tree[collection] as readonly TreeObject[]).map((object) => [object.id, object]),
      ),
    ]),
  ) as Record<SnapshotCollection, Map<Id, TreeObject>>;
  const initial = new Map<Id, SnapshotCollection>();
  for (const collection of SNAPSHOT_COLLECTIONS) {
    for (const object of tree[collection]) initial.set(object.id, collection);
  }
  const takenIds = new Set<Id>([tree.tree.id, ...initial.keys()]);

  /** Dernière mutation qui a créé ou modifié chaque objet encore présent. */
  const lastTouch = new Map<Id, { collection: SnapshotCollection; index: number }>();
  /**
   * Pour chaque objet, la dernière mutation qui a écrit chacun de ses champs (premier niveau) :
   * un constat sur un champ désigne la mutation qui l'a écrit, pas une modification ultérieure
   * du même objet qui ne l'a pas touché.
   */
  const fieldTouch = new Map<Id, Map<string, number>>();
  const culprit = (id: Id, field: string, fallback: number) =>
    fieldTouch.get(id)?.get(field.split(/[.[]/)[0] ?? field) ?? fallback;
  /** Mutation qui a supprimé chaque objet. */
  const deletions = new Map<Id, number>();
  const createdIds = new Set<Id>();
  /** Personnes dont la fiche ou un nom a changé, et la dernière mutation en cause. */
  const nameWatch = new Map<Id, number>();
  const rules: { rule: VisibilityRule; index: number }[] = [];
  const baseVersions: (number | null)[] = [];

  // Un objet créé plus tôt dans le lot est du rédacteur : visible sans consulter `canWriterSee`
  // (la projection du serveur ne le connaît pas encore).
  const seen = (entity: StoredEntity, id: Id) => createdIds.has(id) || canSee({ entity, id });
  const visible = (entity: StoredEntity, id: Id) =>
    maps[ENTITY_COLLECTIONS[entity]].has(id) && seen(entity, id);

  batch.mutations.forEach((mutation, index) => {
    const fields = mutation.fields ?? {};
    if (mutation.entity === 'visibility_rule') {
      baseVersions.push(null);
      if (mutation.operation === 'create') {
        const created = createdObject('visibility_rule', mutation.entityId, batch.treeId, fields);
        if (created.success) rules.push({ rule: created.data, index });
        else {
          for (const issue of created.error.issues) {
            issues.push({ code: 'invalid_object', path: zodPath(index, issue.path) });
          }
        }
      }
      // Suppression d'une règle : les règles ne sont pas sur le téléphone ; le serveur vérifie.
      return;
    }
    const entity = mutation.entity;
    const collection = ENTITY_COLLECTIONS[entity];
    const map = maps[collection];
    const id = mutation.entityId;

    if (mutation.operation === 'create') {
      baseVersions.push(null);
      if (takenIds.has(id)) {
        issues.push({ code: 'duplicate_id', path: `${at(index)}.entityId` });
        return;
      }
      takenIds.add(id);
      const created = createdObject(entity, id, batch.treeId, fields);
      if (!created.success) {
        for (const issue of created.error.issues) {
          issues.push({ code: 'invalid_object', path: zodPath(index, issue.path) });
        }
        return;
      }
      map.set(id, created.data);
      createdIds.add(id);
      lastTouch.set(id, { collection, index });
      fieldTouch.set(id, new Map(Object.keys(created.data).map((key) => [key, index])));
    } else {
      const current = map.get(id);
      if (current === undefined || !seen(entity, id)) {
        baseVersions.push(null);
        issues.push({ code: 'unknown_object', path: `${at(index)}.entityId` });
        return;
      }
      baseVersions.push(versionOf(entity, current));
      if (mutation.operation === 'update') {
        const updated = updatedObject(entity, current as never, fields);
        if (!updated.success) {
          for (const issue of updated.error.issues) {
            issues.push({ code: 'invalid_object', path: zodPath(index, issue.path) });
          }
          return;
        }
        map.set(id, updated.data);
        lastTouch.set(id, { collection, index });
        const written = fieldTouch.get(id) ?? new Map<string, number>();
        for (const key of Object.keys(fields)) written.set(key, index);
        fieldTouch.set(id, written);
      } else {
        map.delete(id);
        lastTouch.delete(id);
        fieldTouch.delete(id);
        deletions.set(id, index);
      }
    }
    if (entity === 'person') nameWatch.set(id, index);
    if (entity === 'name') {
      const before =
        initial.get(id) === 'names' ? tree.names.find((name) => name.id === id) : undefined;
      const after = map.get(id) as TreeObjects['names'][number] | undefined;
      for (const personId of [before?.personId, after?.personId]) {
        if (personId !== undefined) nameWatch.set(personId, index);
      }
    }
  });

  if (context.requireCurrentBaseVersion === true) {
    batch.mutations.forEach((mutation, index) => {
      if (issues.some((issue) => issue.path.startsWith(`${at(index)}.entityId`))) return;
      if (mutation.baseVersion !== baseVersions[index]) {
        issues.push({ code: 'base_version_mismatch', path: `${at(index)}.baseVersion` });
      }
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  // --- Contrôles sur l'état final ------------------------------------------------------------
  const author = context.authorAccountId;

  for (const [id, { collection, index }] of lastTouch) {
    const object = maps[collection].get(id);
    if (object === undefined) continue;
    for (const ref of referencesOf(collection, object)) {
      const path = `${at(culprit(id, ref.field, index))}.fields.${ref.field}`;
      if (ref.entity === 'source') {
        // Les sources arrivent avec les médias : aucune n'est encore synchronisée (ADR 0023).
        issues.push({ code: 'unsupported_reference', path });
      } else if (!visible(ref.entity, ref.id)) {
        issues.push({ code: 'dangling_reference', path });
      }
    }
    // Données qui n'appartiennent qu'à leur auteur : on ne crée rien au nom d'un autre, et une
    // cause de décès ou un ancien prénom n'est jamais celui d'un autre (UNI-15, UNI-22).
    const owned = object as { authorAccountId?: Id; type?: string };
    const sensitive =
      (collection === 'facts' && owned.type === 'death_cause') ||
      (collection === 'names' && owned.type === 'former');
    if (
      owned.authorAccountId !== undefined &&
      owned.authorAccountId !== author &&
      (createdIds.has(id) || sensitive)
    ) {
      // Création au nom d'un autre : la mutation qui a écrit l'auteur ; donnée devenue sensible
      // (type changé en cause de décès ou en ancien prénom) : celle qui a écrit le type.
      const field = createdIds.has(id) ? 'authorAccountId' : 'type';
      issues.push({
        code: 'author_mismatch',
        path: `${at(culprit(id, field, index))}.fields.authorAccountId`,
      });
    }
  }

  // Règles de visibilité créées : de l'auteur, sur un objet qu'il voit, une par objet.
  const ruleTargets = new Set<string>();
  for (const { rule, index } of rules) {
    if (rule.authorAccountId !== author) {
      issues.push({ code: 'author_mismatch', path: `${at(index)}.fields.authorAccountId` });
    }
    for (const ref of ruleReferences(rule)) {
      if (!visible(ref.entity as StoredEntity, ref.id)) {
        issues.push({ code: 'dangling_reference', path: `${at(index)}.fields.${ref.field}` });
      }
    }
    const key = `${rule.target.type}:${rule.target.id}`;
    if (ruleTargets.has(key)) {
      issues.push({ code: 'duplicate_visibility_rule', path: `${at(index)}.fields.target` });
    }
    ruleTargets.add(key);
  }

  // Un objet supprimé ne doit plus être cité : le lot supprime aussi ce qui en dépend.
  if (deletions.size > 0) {
    const reported = new Set<number>();
    for (const collection of SNAPSHOT_COLLECTIONS) {
      for (const object of maps[collection].values()) {
        for (const ref of referencesOf(collection, object)) {
          const index = deletions.get(ref.id);
          if (index !== undefined && !reported.has(index)) {
            reported.add(index);
            issues.push({ code: 'dangling_reference', path: `${at(index)}.entityId` });
          }
        }
      }
    }
  }

  // Une personne connue garde un nom autre qu'un ancien prénom (UNI-01, UNI-22). Seule exception :
  // une fiche déjà connue dont la copie locale ne montrait aucun nom (noms masqués) n'est pas
  // refusée pour autant. Une place à compléter qui devient connue doit recevoir un nom.
  if (nameWatch.size > 0) {
    const hasName = (names: Iterable<TreeObjects['names'][number]>, personId: Id) => {
      for (const name of names) {
        if (name.personId === personId && name.type !== 'former') return true;
      }
      return false;
    };
    const finalNames = [...maps.names.values()] as TreeObjects['names'];
    for (const [personId, index] of nameWatch) {
      const person = maps.people.get(personId) as TreeObjects['people'][number] | undefined;
      if (person === undefined || person.nature !== 'known') continue;
      if (hasName(finalNames, personId)) continue;
      const wasKnown = tree.people.some(
        (entry) => entry.id === personId && entry.nature === 'known',
      );
      if (!wasKnown || hasName(tree.names, personId)) {
        issues.push({ code: 'person_without_name', path: at(index) });
      }
    }
  }

  // Réponses « simultanées ou successives » : deux unions qui ont un conjoint en commun, une
  // seule réponse par paire (ADR 0012).
  const answers = [...maps.simultaneityAnswers.values()] as TreeObjects['simultaneityAnswers'];
  for (const answer of answers) {
    const touched = lastTouch.get(answer.id);
    const unionTouch = answer.unionIds
      .map((id) => lastTouch.get(id)?.index)
      .find((index) => index !== undefined);
    const index = touched?.index ?? unionTouch;
    if (index === undefined) continue;
    const [first, second] = answer.unionIds.map(
      (id) => maps.unions.get(id) as TreeObjects['unions'][number] | undefined,
    );
    if (first === undefined || second === undefined) continue; // déjà signalé (référence)
    const shared = first.spouses.some((spouse) =>
      second.spouses.some((other) => other.personId === spouse.personId),
    );
    const twin = answers.some(
      (other) =>
        other.id !== answer.id &&
        other.unionIds[0] === answer.unionIds[0] &&
        other.unionIds[1] === answer.unionIds[1],
    );
    if (!shared || twin) issues.push({ code: 'invalid_simultaneity_answer', path: at(index) });
  }

  // Refus de cohérence (ADR 0011) : troisième parent de naissance, cycle. Chaque filiation créée
  // ou modifiée est contrôlée contre tout l'état final.
  const coherenceTree = {
    people: [...maps.people.values()] as TreeObjects['people'],
    unions: [...maps.unions.values()] as TreeObjects['unions'],
    filiations: [...maps.filiations.values()] as TreeObjects['filiations'],
    facts: [...maps.facts.values()] as TreeObjects['facts'],
  };
  for (const [id, { collection, index }] of lastTouch) {
    if (collection !== 'filiations') continue;
    const filiation = maps.filiations.get(id) as TreeObjects['filiations'][number] | undefined;
    if (filiation === undefined) continue;
    for (const found of checkNewFiliation(coherenceTree, filiation)) {
      if (found.severity === 'refusal') {
        issues.push({ code: 'coherence_refusal', path: at(index), coherenceCode: found.code });
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  // --- Arbre final et écritures nettes ---------------------------------------------------------
  const finalTree = { tree: tree.tree } as Record<string, unknown>;
  const changes: ObjectChange[] = [];
  for (const collection of SNAPSHOT_COLLECTIONS) {
    const objects = [...maps[collection].values()];
    finalTree[collection] = objects;
    for (const object of objects) {
      if (!lastTouch.has(object.id)) continue;
      changes.push({
        kind: initial.get(object.id) === collection ? 'update' : 'insert',
        collection,
        object,
      });
    }
  }
  for (const id of deletions.keys()) {
    const collection = initial.get(id);
    if (collection !== undefined) changes.push({ kind: 'delete', collection, id });
  }
  return {
    ok: true,
    tree: finalTree as TreeObjects,
    changes,
    baseVersions,
    visibilityRules: rules.map(({ rule }) => rule),
  };
}
