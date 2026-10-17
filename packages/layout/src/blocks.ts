// Groupes de conjoints (étapes 2 et 3) : sur une rangée, les personnes dessinées reliées par un
// foyer dessiné forment un groupe que l'ordre et le placement ne coupent jamais. Disposition
// interne, en places entières de gauche à droite (ADR 0016) :
// - unions simultanées (ARB-03) : la personne sur sa rangée, au-dessus du milieu de ses
//   conjoints, eux sur la demi-rangée dans l'ordre des rangs, chacun en tête de la colonne de ses
//   enfants ;
// - unions successives (ARB-04) : les conjoints de la plus ancienne à la plus récente union, les
//   unions terminées d'abord, puis la personne, l'union en cours au plus près d'elle ;
// - un seul conjoint : côte à côte ;
// - la colonne « parent non précisé » (ARB-05) prend une place sur la demi-rangée, à droite.
import type { Id } from '@lignee/domain';

import { unspecifiedKey, type FamilyIndex, type Visibility } from './folding';
import type { TreeStructure } from './types';

/** Écart entre deux groupes d'une même fratrie, et entre deux fratries, en plus d'une place. */
export const BLOCK_GAP = 0.5;
export const CLUSTER_GAP = 1;
/** Hauteur de la demi-rangée des conjoints d'unions simultanées. */
export const HALF_ROW = 0.5;

/** Une place dans un groupe : `x` relatif au groupe, `level` 0 ou la demi-rangée. */
export interface Slot {
  readonly x: number;
  readonly level: number;
}

export interface Block {
  readonly index: number;
  readonly row: number;
  /** Personnes, dans l'ordre de leurs places. */
  readonly personIds: readonly Id[];
  readonly slots: ReadonlyMap<Id, Slot>;
  /** Place de la mention de chaque colonne « non précisé » du groupe, par clé de famille. */
  readonly headers: ReadonlyMap<string, Slot>;
  /** Nombre de places : le groupe va de 0 à `width - 1`. */
  readonly width: number;
  /** Ordre de découverte de sa première personne. */
  readonly discovery: number;
}

export interface Blocks {
  readonly blocks: readonly Block[];
  readonly blockOf: ReadonlyMap<Id, number>;
  /** Place, dans son groupe, du point d'attache de chaque famille dessinée. */
  readonly anchorOf: ReadonlyMap<string, { readonly block: number; readonly slot: Slot }>;
}

export function buildBlocks(
  structure: TreeStructure,
  index: FamilyIndex,
  visibility: Visibility,
): Blocks {
  const visible = (id: Id) => visibility.order.has(id);
  const row = (id: Id) => structure.rowOf.get(id) ?? 0;

  // Foyers dessinés dont les deux parents sont sur la même rangée : ils lient un groupe.
  const spousesOf = new Map<Id, { spouse: Id; key: string; ended: boolean }[]>();
  const parentOf = new Map<Id, Id>(visibility.people.map((id) => [id, id]));
  const find = (id: Id): Id => {
    let root = id;
    while (parentOf.get(root) !== root) root = parentOf.get(root) ?? root;
    let current = id;
    while (current !== root) {
      const next = parentOf.get(current) ?? root;
      parentOf.set(current, root);
      current = next;
    }
    return root;
  };
  for (const id of visibility.people) {
    const links: { spouse: Id; key: string; ended: boolean }[] = [];
    for (const key of index.asParent.get(id) ?? []) {
      const family = index.families.get(key);
      if (family?.kind !== 'foyer') continue;
      const spouse = family.parentIds.find((parent) => parent !== id);
      if (spouse === undefined || !visible(spouse) || row(spouse) !== row(id)) continue;
      links.push({ spouse, key, ended: family.ended });
      const a = find(id);
      const b = find(spouse);
      if (a !== b) parentOf.set(a, b);
    }
    spousesOf.set(id, links);
  }

  const members = new Map<Id, Id[]>();
  for (const id of visibility.people) {
    const root = find(id);
    const list = members.get(root);
    if (list === undefined) members.set(root, [id]);
    else list.push(id);
  }

  const blocks: Block[] = [];
  const blockOf = new Map<Id, number>();
  const anchorOf = new Map<string, { block: number; slot: Slot }>();
  // Largeur réservée sous une famille dépliée : celle des groupes de ses enfants dessinés à la
  // rangée suivante, déjà disposés (les rangées sont traitées de bas en haut).
  const childrenWidth = (key: string): number => {
    const family = index.families.get(key);
    if (family === undefined || visibility.isFolded(key)) return 1;
    const below = new Set<number>();
    for (const child of family.children) {
      const at = blockOf.get(child);
      if (at !== undefined && blocks[at]?.row === row(family.parentIds[0] ?? child) + 1) {
        below.add(at);
      }
    }
    if (below.size === 0) return 1;
    let width = -BLOCK_GAP;
    for (const at of below) width += (blocks[at]?.width ?? 1) + BLOCK_GAP;
    // L'écart entre deux fratries est compris : les colonnes voisines tiennent côte à côte.
    return Math.max(1, width + CLUSTER_GAP);
  };
  const groups = [...members.values()].sort((a, b) => row(b[0] as Id) - row(a[0] as Id));
  for (const group of groups) {
    // Racine : le plus de conjoints dans le groupe, puis le premier découvert.
    let rootId = group[0] as Id;
    for (const id of group) {
      const degree = spousesOf.get(id)?.length ?? 0;
      if (degree > (spousesOf.get(rootId)?.length ?? 0)) rootId = id;
    }
    const slots = new Map<Id, Slot>();
    const headers = new Map<string, Slot>();
    /** Ce qui a reçu une place, dans l'ordre : pour décaler un conjoint dans sa réserve. */
    const emitted: { kind: 'person' | 'header'; key: string }[] = [];
    const visited = new Set<Id>([rootId]);
    let cursor = 0;
    const setSlot = (kind: 'person' | 'header', key: string, slot: Slot) => {
      if (kind === 'person') slots.set(key, slot);
      else headers.set(key, slot);
      emitted.push({ kind, key });
    };
    /** Donne au moins `width` places à ce qui a été placé depuis `start`, centré dedans. */
    const reserve = (start: number, from: number, width: number) => {
      const used = cursor - start;
      if (used >= width) return;
      const shift = (width - used) / 2;
      for (const entry of emitted.slice(from)) {
        const map = entry.kind === 'person' ? slots : headers;
        const slot = map.get(entry.key);
        if (slot !== undefined) map.set(entry.key, { x: slot.x + shift, level: slot.level });
      }
      cursor = start + width;
    };
    const header = (id: Id) => {
      const key = unspecifiedKey(id);
      if (!index.families.has(key)) return;
      const start = cursor;
      const from = emitted.length;
      setSlot('header', key, { x: cursor, level: HALF_ROW });
      cursor += 1;
      reserve(start, from, childrenWidth(key));
    };
    const visit = (id: Id, level: number) => {
      const links = (spousesOf.get(id) ?? []).filter((link) => !visited.has(link.spouse));
      for (const link of links) visited.add(link.spouse);
      const simultaneous =
        level === 0 && links.length > 0 && structure.unitOf.get(id)?.kind === 'simultaneous';
      if (simultaneous) {
        // Chaque conjoint en tête de la colonne de ses enfants : il réserve leur largeur.
        const from = emitted.length;
        for (const link of links) {
          const start = cursor;
          const at = emitted.length;
          visit(link.spouse, HALF_ROW);
          reserve(start, at, childrenWidth(link.key));
        }
        header(id);
        const xs = emitted
          .slice(from)
          .map((entry) =>
            entry.kind === 'person'
              ? (slots.get(entry.key)?.x ?? 0)
              : (headers.get(entry.key)?.x ?? 0),
          );
        setSlot('person', id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, level: 0 });
      } else if (links.length >= 2) {
        // Successives : unions terminées d'abord, l'union en cours au plus près de la personne.
        const ordered = [
          ...links.filter((link) => link.ended),
          ...links.filter((link) => !link.ended),
        ];
        for (const link of ordered) visit(link.spouse, level);
        setSlot('person', id, { x: cursor, level });
        cursor += 1;
        header(id);
      } else {
        setSlot('person', id, { x: cursor, level });
        cursor += 1;
        for (const link of links) visit(link.spouse, level);
        header(id);
      }
    };
    visit(rootId, 0);
    const blockIndex = blocks.length;
    const personIds = [...slots.keys()].sort(
      (a, b) =>
        (slots.get(a)?.x ?? 0) - (slots.get(b)?.x ?? 0) ||
        (slots.get(a)?.level ?? 0) - (slots.get(b)?.level ?? 0),
    );
    for (const id of personIds) blockOf.set(id, blockIndex);
    blocks.push({
      index: blockIndex,
      row: row(rootId),
      personIds,
      slots,
      headers,
      width: cursor,
      discovery: Math.min(...group.map((id) => visibility.order.get(id) ?? Infinity)),
    });

    // Points d'attache des familles dont un parent est dans ce groupe.
    for (const id of group) {
      for (const key of index.asParent.get(id) ?? []) {
        if (anchorOf.has(key)) continue;
        const family = index.families.get(key);
        if (family === undefined || !family.parentIds.every(visible)) continue;
        const headerSlot = headers.get(key);
        if (headerSlot !== undefined) {
          anchorOf.set(key, { block: blockIndex, slot: headerSlot });
          continue;
        }
        const [hub, partner] = family.parentIds;
        const hubSlot = hub === undefined ? undefined : slots.get(hub);
        const partnerSlot = partner === undefined ? undefined : slots.get(partner);
        if (hubSlot !== undefined && partnerSlot !== undefined) {
          anchorOf.set(key, { block: blockIndex, slot: foyerAnchor(hubSlot, partnerSlot) });
        } else if (hub === id && hubSlot !== undefined) {
          // Conjoint sur une autre rangée (union entre générations) : sous la personne au centre.
          anchorOf.set(key, { block: blockIndex, slot: hubSlot });
        } else if (hub !== undefined && !visible(hub) && partnerSlot !== undefined) {
          anchorOf.set(key, { block: blockIndex, slot: partnerSlot });
        }
      }
    }
  }
  return { blocks, blockOf, anchorOf };
}

/**
 * Point d'attache d'un foyer dont les deux parents sont dans le groupe : le conjoint sur la
 * demi-rangée (il est en tête de la colonne de ses enfants) ; côte à côte, le milieu du couple ;
 * sinon le conjoint, à l'extérieur des unions successives.
 */
function foyerAnchor(hub: Slot, partner: Slot): Slot {
  if (hub.level !== partner.level) return hub.level > partner.level ? hub : partner;
  if (Math.abs(hub.x - partner.x) <= 1) return { x: (hub.x + partner.x) / 2, level: hub.level };
  return partner;
}
