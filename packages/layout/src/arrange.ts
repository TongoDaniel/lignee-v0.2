// Étapes 3 et 4 de la disposition (TRD) : ordre, puis placement.
// - Ordre : sur chaque rangée, les groupes de conjoints enfants d'une même famille forment une
//   fratrie, dans l'ordre des frères et sœurs ; les fratries (et les groupes sans famille au-dessus)
//   sont réordonnées par la méthode des barycentres, rangée par rangée, en descendant puis en
//   remontant. Un groupe ou une fratrie n'est jamais coupé : on ne permute que des fratries
//   entières. L'ordre gardé est celui qui croise le moins de traits.
// - Placement : chaque fratrie vise le point d'attache de sa famille (descendants) ou chaque
//   famille vise le milieu de ses enfants (ascendants, en miroir) ; sur une rangée, la position la
//   plus proche de ces cibles qui garde l'ordre et l'écart entre fratries se calcule exactement
//   (régression isotone, algorithme « pool adjacent violators »). Rien ne se chevauche par
//   construction. Règles retenues : ADR 0016.
import type { Id } from '@lignee/domain';

import { BLOCK_GAP, CLUSTER_GAP, type Block, type Blocks, type Slot } from './blocks';
import type { FamilyIndex, Visibility } from './folding';
import type { TreeStructure } from './types';

/** Passes de barycentres (une descente et une remontée chacune) au plus. */
const ORDER_PASSES = 8;
/** Passes de placement avant la passe finale en sablier. */
const PLACEMENT_PASSES = 4;
/** Poids d'une fratrie sans cible : elle reste où elle est, sans gêner les autres. */
const IDLE_WEIGHT = 1e-3;

/** Une fratrie : les groupes enfants d'une même famille (ou un groupe seul), sur une rangée. */
interface Cluster {
  readonly id: number;
  /** Clé de stabilité entre deux calculs : la famille, ou le groupe. */
  readonly key: string;
  readonly row: number;
  readonly familyKey: string | undefined;
  readonly blocks: readonly number[];
  /** Décalage de chaque groupe dans la fratrie. */
  readonly offsets: readonly number[];
  readonly width: number;
  readonly discovery: number;
  readonly weight: number;
  /** Familles au-dessus dont un membre est un enfant dessiné : une entrée par enfant. */
  readonly upLinks: readonly { readonly familyKey: string; readonly childId: Id }[];
  /** Familles attachées dans la fratrie, et leurs enfants dessinés de la rangée suivante. */
  readonly downLinks: readonly { readonly familyKey: string; readonly childIds: readonly Id[] }[];
}

export interface Arrangement {
  readonly rows: readonly number[];
  /** Fratries de chaque rangée, de gauche à droite. */
  readonly orderOf: ReadonlyMap<number, readonly string[]>;
  readonly familyOfBlock: ReadonlyMap<number, string | undefined>;
  /** Bord gauche (centre de la première place) de chaque groupe. */
  readonly blockLeft: ReadonlyMap<number, number>;
  readonly crossings: { readonly initial: number; readonly final: number };
}

/** Nombre de paires (a, b) avec a avant b et b.second < a.second : tri fusion, O(n log n). */
function countInversions(values: number[]): number {
  if (values.length < 2) return 0;
  const buffer = new Array<number>(values.length);
  let count = 0;
  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += 2 * width) {
      const middle = Math.min(start + width, values.length);
      const end = Math.min(start + 2 * width, values.length);
      let i = start;
      let j = middle;
      let k = start;
      while (i < middle && j < end) {
        if ((values[j] as number) < (values[i] as number)) {
          count += middle - i;
          buffer[k++] = values[j++] as number;
        } else buffer[k++] = values[i++] as number;
      }
      while (i < middle) buffer[k++] = values[i++] as number;
      while (j < end) buffer[k++] = values[j++] as number;
      for (let m = start; m < end; m += 1) values[m] = buffer[m] as number;
    }
  }
  return count;
}

/**
 * Régression isotone pondérée : les `y` croissants les plus proches des cibles (moindres carrés).
 * Algorithme des voisins en défaut (PAVA), linéaire.
 */
function isotonic(targets: readonly number[], weights: readonly number[]): number[] {
  const means: number[] = [];
  const totals: number[] = [];
  const counts: number[] = [];
  targets.forEach((target, i) => {
    let mean = target;
    let weight = weights[i] as number;
    let count = 1;
    // Tant que le bloc précédent est plus haut, on fusionne : la moyenne pondérée des deux.
    while (means.length > 0 && (means[means.length - 1] as number) > mean) {
      const previousMean = means.pop() as number;
      const previousWeight = totals.pop() as number;
      count += counts.pop() as number;
      mean = (mean * weight + previousMean * previousWeight) / (weight + previousWeight);
      weight += previousWeight;
    }
    means.push(mean);
    totals.push(weight);
    counts.push(count);
  });
  return means.flatMap((mean, at) => new Array<number>(counts[at] as number).fill(mean));
}

export function arrange(
  structure: TreeStructure,
  index: FamilyIndex,
  visibility: Visibility,
  built: Blocks,
  previousOrder?: ReadonlyMap<number, readonly string[]>,
): Arrangement {
  const { blocks, blockOf, anchorOf } = built;
  const row = (id: Id) => structure.rowOf.get(id) ?? 0;
  const blockAt = (i: number) => blocks[i] as Block;

  const anchorRow = (familyKey: string): number | undefined => {
    const anchor = anchorOf.get(familyKey);
    return anchor === undefined ? undefined : blockAt(anchor.block).row;
  };
  const shown = (familyKey: string) => !visibility.isFolded(familyKey);

  // Famille de chaque groupe : celle, dépliée et attachée à la rangée du dessus, dont un membre
  // est un enfant ; la première découverte s'il y en a plusieurs.
  const familyOfBlock = new Map<number, string | undefined>();
  for (const block of blocks) {
    let best: string | undefined;
    for (const id of block.personIds) {
      const origin = index.asChild.get(id);
      if (origin === undefined || !shown(origin) || anchorRow(origin) !== block.row - 1) continue;
      const rank = visibility.familyOrder.get(origin) ?? Infinity;
      if (best === undefined || rank < (visibility.familyOrder.get(best) ?? Infinity)) {
        best = origin;
      }
    }
    familyOfBlock.set(block.index, best);
  }

  // Fratries.
  const siblingRank = (block: Block, familyKey: string) => {
    const children = index.families.get(familyKey)?.children ?? [];
    return Math.min(
      ...block.personIds.map((id) => {
        const at = children.indexOf(id);
        return at < 0 ? Infinity : at;
      }),
    );
  };
  const grouped = new Map<string, number[]>();
  for (const block of blocks) {
    const familyKey = familyOfBlock.get(block.index);
    const key =
      familyKey === undefined ? `block:${block.personIds[0] ?? ''}` : `family:${familyKey}`;
    const list = grouped.get(key);
    if (list === undefined) grouped.set(key, [block.index]);
    else list.push(block.index);
  }
  const clusters: Cluster[] = [];
  const clusterOfBlock = new Map<number, number>();
  const offsetOfBlock = new Map<number, number>();
  for (const [key, members] of grouped) {
    const first = blockAt(members[0] as number);
    const familyKey = familyOfBlock.get(first.index);
    if (familyKey !== undefined) {
      members.sort(
        (a, b) =>
          siblingRank(blockAt(a), familyKey) - siblingRank(blockAt(b), familyKey) ||
          blockAt(a).discovery - blockAt(b).discovery,
      );
    }
    const offsets: number[] = [];
    let cursor = 0;
    for (const member of members) {
      offsets.push(cursor);
      offsetOfBlock.set(member, cursor);
      cursor += blockAt(member).width + BLOCK_GAP;
    }
    const id = clusters.length;
    for (const member of members) clusterOfBlock.set(member, id);
    const people = members.flatMap((member) => blockAt(member).personIds);
    const upLinks = people.flatMap((childId) => {
      const origin = index.asChild.get(childId);
      return origin !== undefined && shown(origin) && anchorRow(origin) === first.row - 1
        ? [{ familyKey: origin, childId }]
        : [];
    });
    const downLinks: { familyKey: string; childIds: Id[] }[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      for (const id of blockAt(member).personIds) {
        for (const familyKey of index.asParent.get(id) ?? []) {
          if (seen.has(familyKey) || !shown(familyKey)) continue;
          if (anchorOf.get(familyKey)?.block !== member) continue;
          seen.add(familyKey);
          const childIds = (index.families.get(familyKey)?.children ?? []).filter(
            (child) => visibility.order.has(child) && row(child) === first.row + 1,
          );
          if (childIds.length > 0) downLinks.push({ familyKey, childIds });
        }
      }
    }
    clusters.push({
      id,
      key,
      row: first.row,
      familyKey,
      blocks: members,
      offsets,
      width: cursor - BLOCK_GAP,
      discovery: Math.min(...members.map((member) => blockAt(member).discovery)),
      weight: people.length,
      upLinks,
      downLinks,
    });
  }

  const rows = [...new Set(clusters.map((cluster) => cluster.row))].sort((a, b) => a - b);
  const order = new Map<number, number[]>();
  for (const cluster of clusters) {
    const list = order.get(cluster.row);
    if (list === undefined) order.set(cluster.row, [cluster.id]);
    else list.push(cluster.id);
  }
  // Ordre de départ : celui du calcul précédent quand il existe (le dessin reste stable quand on
  // déplie un foyer), sinon l'ordre de découverte depuis la personne centrale.
  for (const [rowNumber, list] of order) {
    const previous = previousOrder?.get(rowNumber);
    const rank = new Map(previous?.map((key, at) => [key, at]) ?? []);
    list.sort((a, b) => {
      const left = clusters[a] as Cluster;
      const right = clusters[b] as Cluster;
      return (
        (rank.get(left.key) ?? Infinity) - (rank.get(right.key) ?? Infinity) ||
        left.discovery - right.discovery
      );
    });
  }

  const left = new Float64Array(clusters.length);
  const leftOf = (id: number): number => left[id] ?? 0;
  const pack = (rowNumber: number) => {
    let cursor = 0;
    for (const id of order.get(rowNumber) ?? []) {
      left[id] = cursor;
      cursor += (clusters[id] as Cluster).width + CLUSTER_GAP;
    }
  };
  for (const rowNumber of rows) pack(rowNumber);

  const slotX = (blockIndex: number, slot: Slot) => {
    const cluster = clusterOfBlock.get(blockIndex) ?? 0;
    return leftOf(cluster) + (offsetOfBlock.get(blockIndex) ?? 0) + slot.x;
  };
  const personX = (id: Id) => {
    const blockIndex = blockOf.get(id);
    if (blockIndex === undefined) return 0;
    const slot = blockAt(blockIndex).slots.get(id);
    return slot === undefined ? 0 : slotX(blockIndex, slot);
  };
  const anchorX = (familyKey: string) => {
    const anchor = anchorOf.get(familyKey);
    return anchor === undefined ? 0 : slotX(anchor.block, anchor.slot);
  };
  const center = (id: number) => leftOf(id) + ((clusters[id] as Cluster).width - 1) / 2;

  const crossingsBelow = (rowNumber: number) => {
    const edges: [number, number][] = [];
    for (const id of order.get(rowNumber) ?? []) {
      for (const link of (clusters[id] as Cluster).downLinks) {
        const from = anchorX(link.familyKey);
        for (const child of link.childIds) edges.push([from, personX(child)]);
      }
    }
    edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return countInversions(edges.map((edge) => edge[1]));
  };
  const totalCrossings = () => rows.reduce((sum, rowNumber) => sum + crossingsBelow(rowNumber), 0);

  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const reorder = (rowNumber: number, direction: 'down' | 'up') => {
    const list = order.get(rowNumber);
    if (list === undefined || list.length < 2) return;
    const keys = new Map<number, number>();
    for (const id of list) {
      const cluster = clusters[id] as Cluster;
      const values =
        direction === 'down'
          ? cluster.upLinks.map((link) => anchorX(link.familyKey))
          : cluster.downLinks.flatMap((link) => link.childIds.map(personX));
      keys.set(id, values.length > 0 ? mean(values) : center(id));
    }
    const position = new Map(list.map((id, at) => [id, at]));
    list.sort(
      (a, b) =>
        (keys.get(a) ?? 0) - (keys.get(b) ?? 0) || (position.get(a) ?? 0) - (position.get(b) ?? 0),
    );
    pack(rowNumber);
  };

  const snapshot = () => new Map([...order].map(([rowNumber, list]) => [rowNumber, [...list]]));
  const initial = totalCrossings();
  let best = { crossings: initial, order: snapshot() };
  let stale = 0;
  for (let pass = 0; pass < ORDER_PASSES && best.crossings > 0 && stale < 2; pass += 1) {
    const before = best.crossings;
    for (const rowNumber of rows.slice(1)) reorder(rowNumber, 'down');
    let current = totalCrossings();
    if (current < best.crossings) best = { crossings: current, order: snapshot() };
    for (const rowNumber of rows.slice(0, -1).reverse()) reorder(rowNumber, 'up');
    current = totalCrossings();
    if (current < best.crossings) best = { crossings: current, order: snapshot() };
    stale = best.crossings < before ? 0 : stale + 1;
  }
  for (const [rowNumber, list] of best.order) order.set(rowNumber, list);
  for (const rowNumber of rows) pack(rowNumber);

  // Placement.
  const place = (rowNumber: number, direction: 'down' | 'up') => {
    const list = order.get(rowNumber) ?? [];
    if (list.length === 0) return;
    const targets: number[] = [];
    const weights: number[] = [];
    let offset = 0;
    for (const id of list) {
      const cluster = clusters[id] as Cluster;
      const local = (child: Id) => personX(child) - leftOf(id);
      let target: number | undefined;
      if (direction === 'down') {
        // La fratrie se centre sous le point d'attache de sa famille, sinon de ses autres
        // familles.
        const own = cluster.upLinks.filter((link) => link.familyKey === cluster.familyKey);
        const links = own.length > 0 ? own : cluster.upLinks;
        if (links.length > 0) {
          const familyKey = (links[0] as { familyKey: string }).familyKey;
          const sameFamily = links.filter((link) => link.familyKey === familyKey);
          const locals = sameFamily.map((link) => local(link.childId));
          target = anchorX(familyKey) - (Math.min(...locals) + Math.max(...locals)) / 2;
        }
      } else if (cluster.downLinks.length > 0) {
        // Chaque famille se centre au-dessus de ses enfants (miroir).
        let sum = 0;
        let weight = 0;
        for (const link of cluster.downLinks) {
          const xs = link.childIds.map(personX);
          const desired = (Math.min(...xs) + Math.max(...xs)) / 2;
          sum += (desired - (anchorX(link.familyKey) - leftOf(id))) * link.childIds.length;
          weight += link.childIds.length;
        }
        target = sum / weight;
      }
      targets.push((target ?? leftOf(id)) - offset);
      weights.push(target === undefined ? IDLE_WEIGHT : cluster.weight);
      offset += cluster.width + CLUSTER_GAP;
    }
    const fitted = isotonic(targets, weights);
    offset = 0;
    list.forEach((id, at) => {
      left[id] = (fitted[at] as number) + offset;
      offset += (clusters[id] as Cluster).width + CLUSTER_GAP;
    });
  };
  for (let pass = 0; pass < PLACEMENT_PASSES; pass += 1) {
    for (const rowNumber of rows.slice(0, -1).reverse()) place(rowNumber, 'up');
    for (const rowNumber of rows.slice(1)) place(rowNumber, 'down');
  }
  // Passe finale en sablier : les ascendants au-dessus de leurs enfants, les descendants sous
  // leurs parents, à partir de la rangée de la personne centrale.
  for (const rowNumber of rows.filter((value) => value < 0).reverse()) place(rowNumber, 'up');
  for (const rowNumber of rows.filter((value) => value > 0)) place(rowNumber, 'down');

  const blockLeft = new Map<number, number>();
  for (const block of blocks) {
    blockLeft.set(
      block.index,
      leftOf(clusterOfBlock.get(block.index) ?? 0) + (offsetOfBlock.get(block.index) ?? 0),
    );
  }
  const orderOf = new Map<number, string[]>();
  for (const [rowNumber, list] of order) {
    orderOf.set(
      rowNumber,
      list.map((id) => (clusters[id] as Cluster).key),
    );
  }
  return {
    rows,
    orderOf,
    familyOfBlock,
    blockLeft,
    crossings: { initial, final: totalCrossings() },
  };
}
