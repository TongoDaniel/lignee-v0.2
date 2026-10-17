// Disposition complète (TRD, « Disposition de l'arbre », étapes 1 à 5) : la structure de T-008,
// puis l'ordre, le placement et le repli (T-012). Fonctions pures : le graphe et les choix reçus
// ne sont pas modifiés. Le cache réutilise les étapes 1 et 2 quand seul un repli change, et part
// de l'ordre précédent pour que le dessin reste stable. Règles retenues : ADR 0016.
import type { Id } from '@lignee/domain';

import { arrange, type Arrangement } from './arrange';
import { buildBlocks } from './blocks';
import { indexFamilies, traverse, type FamilyIndex } from './folding';
import type {
  FoldChoices,
  GridPoint,
  LayoutOptions,
  PlacedBlock,
  PlacedFamily,
  PlacedPerson,
  TreeLayout,
} from './layout-types';
import { createSiblingSorter } from './sibling-order';
import { buildTreeStructure } from './structure';
import type { LayoutGraph, TreeStructure } from './types';

const NO_FOLDS: FoldChoices = new Map();

/** Ce qui ne dépend que du graphe et de la personne centrale (étapes 1 et 2, familles). */
export interface PreparedTree {
  readonly structure: TreeStructure;
  readonly families: FamilyIndex;
}

export function prepareTree(graph: LayoutGraph, centerId: Id): PreparedTree {
  const structure = buildTreeStructure(graph, centerId);
  return { structure, families: indexFamilies(structure, createSiblingSorter(graph)) };
}

/** Étapes 3 à 5 sur une structure déjà calculée. */
export function layoutPrepared(
  prepared: PreparedTree,
  options: LayoutOptions = {},
  previous?: TreeLayout,
): TreeLayout {
  const { structure, families: index } = prepared;
  const folds = options.folds ?? NO_FOLDS;
  const visibility = traverse(structure, index, folds);
  const built = buildBlocks(structure, index, visibility);
  const arrangement: Arrangement = arrange(
    structure,
    index,
    visibility,
    built,
    previous === undefined ? undefined : previousOrders.get(previous),
  );

  // Coordonnées, la personne centrale en x = 0.
  const centerBlock = built.blockOf.get(structure.centerId) ?? 0;
  const centerSlot = built.blocks[centerBlock]?.slots.get(structure.centerId);
  const origin = (arrangement.blockLeft.get(centerBlock) ?? 0) + (centerSlot?.x ?? 0);
  const at = (block: number, slot: { x: number; level: number }, row: number): GridPoint => ({
    x: (arrangement.blockLeft.get(block) ?? 0) + slot.x - origin,
    y: row + slot.level,
  });

  const people = new Map<Id, PlacedPerson>();
  const placedBlocks: PlacedBlock[] = [];
  for (const block of built.blocks) {
    const xs: number[] = [];
    for (const personId of block.personIds) {
      const slot = block.slots.get(personId);
      if (slot === undefined) continue;
      const point = at(block.index, slot, block.row);
      xs.push(point.x);
      const originKey = index.asChild.get(personId);
      people.set(personId, {
        personId,
        row: block.row,
        x: point.x,
        y: point.y,
        block: block.index,
        foldedParentsKey:
          originKey !== undefined && visibility.isFolded(originKey) ? originKey : undefined,
      });
    }
    for (const slot of block.headers.values()) xs.push(at(block.index, slot, block.row).x);
    placedBlocks.push({
      row: block.row,
      personIds: block.personIds,
      left: Math.min(...xs),
      right: Math.max(...xs),
      familyKey: arrangement.familyOfBlock.get(block.index),
    });
  }

  const families = new Map<string, PlacedFamily>();
  for (const key of visibility.families) {
    const family = index.families.get(key);
    if (family === undefined) continue;
    const folded = visibility.isFolded(key);
    const anchor = built.anchorOf.get(key);
    const block = anchor === undefined ? undefined : built.blocks[anchor.block];
    const point =
      anchor === undefined || block === undefined
        ? undefined
        : at(anchor.block, anchor.slot, block.row);
    families.set(key, {
      key,
      kind: family.kind,
      parentIds: family.parentIds,
      folded,
      foldedByDefault: index.foldedByDefault.get(key) ?? true,
      childCount: family.children.length,
      shownChildren: folded ? [] : family.children.filter((id) => people.has(id)),
      anchor: point,
      header: family.kind === 'unspecified' ? point : undefined,
    });
  }

  const rows = new Map<number, Id[]>();
  for (const person of people.values()) {
    const list = rows.get(person.row);
    if (list === undefined) rows.set(person.row, [person.personId]);
    else list.push(person.personId);
  }
  for (const list of rows.values()) {
    list.sort((a, b) => {
      const left = people.get(a) as PlacedPerson;
      const right = people.get(b) as PlacedPerson;
      return left.x - right.x || left.y - right.y;
    });
  }
  const xs = placedBlocks.flatMap((block) => [block.left, block.right]);
  const ys = [...people.values()].map((person) => person.y);
  const headerYs = [...families.values()].flatMap((family) =>
    family.header === undefined ? [] : [family.header.y],
  );
  const layout: TreeLayout = {
    centerId: structure.centerId,
    structure,
    people,
    rows,
    families,
    blocks: placedBlocks,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys, ...headerYs),
    },
    crossings: arrangement.crossings,
    folds,
  };
  previousOrders.set(layout, arrangement.orderOf);
  return layout;
}

/** Ordre des fratries de chaque disposition calculée, pour repartir de lui au calcul suivant. */
const previousOrders = new WeakMap<TreeLayout, ReadonlyMap<number, readonly string[]>>();

/**
 * Disposition de l'arbre vu depuis `centerId` : étapes 1 à 5. Le graphe est déjà limité à ce que
 * le lecteur peut voir (packages/domain) ; rien de masqué n'est compté ni dessiné.
 */
export function layoutTree(
  graph: LayoutGraph,
  centerId: Id,
  options: LayoutOptions = {},
): TreeLayout {
  return layoutPrepared(prepareTree(graph, centerId), options);
}

/** Choix du lecteur après avoir replié (`true`) ou déplié (`false`) une famille. */
export function setFolded(folds: FoldChoices, key: string, folded: boolean): FoldChoices {
  const next = new Map(folds);
  next.set(key, folded);
  return next;
}

/** Choix du lecteur après avoir touché une famille : repliée, elle se déplie, et inversement. */
export function toggleFamily(layout: TreeLayout, key: string): FoldChoices {
  const family = layout.families.get(key);
  const folded = family?.folded ?? layout.folds.get(key) ?? true;
  return setFolded(layout.folds, key, !folded);
}

/** Ce que le dernier appel du cache a recalculé. */
export type LayoutRecompute = 'none' | 'layout' | 'all';

export interface TreeLayoutCache {
  /**
   * Disposition pour ce graphe, cette personne centrale et ces choix. Même graphe (même objet)
   * et même personne : les étapes 1 et 2 ne sont pas refaites ; mêmes choix : le résultat
   * précédent est rendu tel quel.
   */
  layout(graph: LayoutGraph, centerId: Id, folds?: FoldChoices): TreeLayout;
  /** Ce que le dernier appel a recalculé. */
  readonly lastRecompute: LayoutRecompute;
}

function sameFolds(a: FoldChoices, b: FoldChoices): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) if (b.get(key) !== value) return false;
  return true;
}

export function createTreeLayoutCache(): TreeLayoutCache {
  let graphSeen: LayoutGraph | undefined;
  let centerSeen: Id | undefined;
  let prepared: PreparedTree | undefined;
  let last: TreeLayout | undefined;
  let lastRecompute: LayoutRecompute = 'all';
  return {
    get lastRecompute() {
      return lastRecompute;
    },
    layout(graph, centerId, folds = NO_FOLDS) {
      if (prepared === undefined || graph !== graphSeen || centerId !== centerSeen) {
        prepared = prepareTree(graph, centerId);
        // Même personne centrale sur un graphe modifié : l'ordre précédent sert de départ.
        const previous = centerId === centerSeen ? last : undefined;
        graphSeen = graph;
        centerSeen = centerId;
        last = layoutPrepared(prepared, { folds }, previous);
        lastRecompute = 'all';
        return last;
      }
      if (last !== undefined && sameFolds(last.folds, folds)) {
        lastRecompute = 'none';
        return last;
      }
      last = layoutPrepared(prepared, { folds }, last);
      lastRecompute = 'layout';
      return last;
    },
  };
}
