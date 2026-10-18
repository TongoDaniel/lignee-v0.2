// Étape 5 de la disposition (TRD) : le repli. Par défaut, les foyers qui ne mènent pas à la
// personne centrale sont repliés, avec le nombre de leurs enfants ; au-delà de 3 générations, les
// branches se replient aussi (ARB-03, CL-POL-12). Les choix du lecteur l'emportent sur cet état
// par défaut. Le parcours depuis la personne centrale dit ensuite qui est dessiné. Règles
// retenues (ligne de la personne centrale, profondeur, conjoints toujours montrés) : ADR 0016.
import type { Id } from '@lignee/domain';

import type { FamilyKind, FoldChoices } from './layout-types';
import type { SiblingSorter } from './sibling-order';
import type { TreeStructure } from './types';

/** Au-delà de ce nombre de générations, au-dessus comme en dessous, les branches se replient. */
export const UNFOLDED_GENERATIONS = 3;

/** Clé de la colonne « parent non précisé » d'un parent. */
export function unspecifiedKey(parentId: Id): string {
  return `unspecified:${parentId}`;
}

/** Une famille de la structure : un foyer ou une colonne « non précisé ». */
export interface Family {
  readonly key: string;
  readonly kind: FamilyKind;
  /** Au centre de l'unité, puis le conjoint ; le parent connu seul pour une colonne. */
  readonly parentIds: readonly Id[];
  /** Enfants dans l'ordre des frères et sœurs. */
  readonly children: readonly Id[];
  readonly leadsToCenter: boolean;
  /** Union en cours ou terminée ; absent sans union. */
  readonly ended: boolean;
}

/** Familles de la structure, indexées pour le repli, l'ordre et le placement. */
export interface FamilyIndex {
  readonly families: ReadonlyMap<string, Family>;
  /** Familles dont la personne est un parent : foyers portés, puis portés ailleurs, puis colonne. */
  readonly asParent: ReadonlyMap<Id, readonly string[]>;
  /** Famille où la personne est rangée comme enfant. */
  readonly asChild: ReadonlyMap<Id, string>;
  /** État par défaut de chaque famille : repliée ou non. */
  readonly foldedByDefault: ReadonlyMap<string, boolean>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

export function indexFamilies(structure: TreeStructure, sortSiblings: SiblingSorter): FamilyIndex {
  const families = new Map<string, Family>();
  const asParent = new Map<Id, string[]>();
  const asChild = new Map<Id, string>();
  const partnerOf = new Map<Id, string[]>();
  for (const unit of structure.units) {
    for (const foyer of unit.foyers) {
      families.set(foyer.key, {
        key: foyer.key,
        kind: 'foyer',
        parentIds: [foyer.hubId, foyer.partnerId],
        children: sortSiblings(foyer.children),
        leadsToCenter: foyer.leadsToCenter,
        ended: foyer.status === 'ended',
      });
      push(asParent, unit.hubId, foyer.key);
      push(partnerOf, foyer.partnerId, foyer.key);
    }
  }
  for (const [personId, keys] of partnerOf) for (const key of keys) push(asParent, personId, key);
  for (const unit of structure.units) {
    const column = unit.unspecified;
    if (column === undefined) continue;
    const key = unspecifiedKey(column.parentId);
    families.set(key, {
      key,
      kind: 'unspecified',
      parentIds: [column.parentId],
      children: sortSiblings(column.children.map((child) => child.childId)),
      leadsToCenter: column.leadsToCenter,
      ended: false,
    });
    push(asParent, column.parentId, key);
  }
  for (const [childId, placement] of structure.placementOf) {
    asChild.set(
      childId,
      placement.kind === 'foyer' ? placement.foyerKey : unspecifiedKey(placement.parentId),
    );
  }

  // Ligne descendante : la personne centrale et ses descendants par les familles où ils sont
  // rangés.
  const descendants = new Set<Id>([structure.centerId]);
  const stack: Id[] = [structure.centerId];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const key of asParent.get(id) ?? []) {
      for (const child of families.get(key)?.children ?? []) {
        if (!descendants.has(child)) {
          descendants.add(child);
          stack.push(child);
        }
      }
    }
  }

  const row = (id: Id) => structure.rowOf.get(id) ?? 0;
  const foldedByDefault = new Map<string, boolean>();
  for (const family of families.values()) {
    const rows = family.parentIds.map(row);
    const ancestorLine = family.leadsToCenter && Math.min(...rows) >= -UNFOLDED_GENERATIONS;
    const descendantLine =
      family.parentIds.some((id) => descendants.has(id)) &&
      Math.max(...rows) + 1 <= UNFOLDED_GENERATIONS;
    foldedByDefault.set(family.key, !(ancestorLine || descendantLine));
  }
  return { families, asParent, asChild, foldedByDefault };
}

/** Ce que le parcours depuis la personne centrale rend visible. */
export interface Visibility {
  /** Personnes dessinées, dans l'ordre de découverte. */
  readonly people: readonly Id[];
  readonly order: ReadonlyMap<Id, number>;
  /** Familles touchées (un membre dessiné), dans l'ordre de découverte. */
  readonly families: readonly string[];
  readonly familyOrder: ReadonlyMap<string, number>;
  readonly isFolded: (key: string) => boolean;
}

/**
 * Parcours depuis la personne centrale. D'une personne dessinée :
 * - chaque famille dont elle est un parent est dessinée avec l'autre parent ; ses enfants le sont
 *   si elle est dépliée ;
 * - sa famille d'origine, si elle est dépliée, est dessinée avec ses parents et ses frères et
 *   sœurs ; repliée, ses parents restent cachés (branche repliée).
 */
export function traverse(
  structure: TreeStructure,
  index: FamilyIndex,
  folds: FoldChoices,
): Visibility {
  const isFolded = (key: string) => folds.get(key) ?? index.foldedByDefault.get(key) ?? true;
  const order = new Map<Id, number>();
  const people: Id[] = [];
  const familyOrder = new Map<string, number>();
  const families: Id[] = [];
  const show = (id: Id) => {
    if (order.has(id) || !structure.rowOf.has(id)) return;
    order.set(id, people.length);
    people.push(id);
  };
  const touch = (key: string) => {
    if (familyOrder.has(key)) return;
    familyOrder.set(key, families.length);
    families.push(key);
  };
  show(structure.centerId);
  for (let next = 0; next < people.length; next += 1) {
    const id = people[next] as Id;
    for (const key of index.asParent.get(id) ?? []) {
      const family = index.families.get(key);
      if (family === undefined) continue;
      touch(key);
      for (const parent of family.parentIds) show(parent);
      if (!isFolded(key)) for (const child of family.children) show(child);
    }
    const origin = index.asChild.get(id);
    const family = origin === undefined ? undefined : index.families.get(origin);
    if (origin !== undefined && family !== undefined) {
      touch(origin);
      if (!isFolded(origin)) {
        for (const parent of family.parentIds) show(parent);
        for (const child of family.children) show(child);
      }
    }
  }
  return { people, order, families, familyOrder, isFolded };
}
