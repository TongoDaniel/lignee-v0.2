// Scène à dessiner (T-017) : la disposition (`TreeLayout`, en unités de grille) mise en pixels, avec
// les traits, les pastilles de foyers repliés et les mentions « Voir aussi ». Fonction pure, sans
// Skia : l'écran n'a plus qu'à peindre ce qu'elle décrit, et les tests la lisent directement.
//
// Règles (ADR 0016, 0024) :
// - les traits entre fiches d'un foyer viennent des familles (`families`), tout le reste de
//   `links` : aucun lien n'est recalculé depuis la structure ;
// - un lien `line` est un trait, un lien `seeAlso` n'est pas tracé : chaque bout porte la mention
//   « Voir aussi » qui mène à l'autre fiche ;
// - `crossings`, `rowSpan` et les clés internes ne sortent jamais de la scène : ni dessinés, ni
//   lisibles par un libellé.
import type { Id } from '@lignee/domain';

import type { GridPoint, PlacedFamily, PlacedLink, TreeLayout } from '../layout-types';
import { rectAround, rectOfPoints, unionRect, type Point, type Rect } from './geometry';
import type { SceneSpec } from './spec';

/** Une personne dessinée : centre de l'avatar, en pixels. */
export interface ScenePerson {
  readonly id: Id;
  readonly x: number;
  readonly y: number;
  /** Famille d'origine repliée : la mention « Parents » la déplie (ADR 0016, règle 4). */
  readonly foldedParentsKey: string | undefined;
}

/** Place du parent non précisé d'une colonne (« Mère non précisée »), à compléter plus tard. */
export interface SceneMissing {
  /** Clé de la colonne (`unspecified:<parentId>`), pour la déplier ; jamais affichée. */
  readonly familyKey: string;
  readonly parentId: Id;
  readonly x: number;
  readonly y: number;
}

/** Pastille « + n » d'un foyer replié : son centre. Elle le déplie. */
export interface SceneCounter {
  readonly familyKey: string;
  readonly x: number;
  readonly y: number;
  readonly count: number;
}

/**
 * Mention sous une fiche : « Voir aussi » (renvoi vers la ou les fiches `targets`), ou « Parents »
 * (déplie la famille `familyKey`). Un renvoi a priorité (ADR 0024) : une personne qui a les deux
 * garde la mention « Voir aussi » ; ses parents se déplient depuis la liste.
 */
export type SceneMark =
  | {
      readonly kind: 'seeAlso';
      readonly personId: Id;
      readonly targets: readonly Id[];
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: 'parents';
      readonly personId: Id;
      readonly familyKey: string;
      readonly x: number;
      readonly y: number;
    };

export type SceneEdgeKind =
  /** Entre deux conjoints. */
  | 'union'
  /** Du foyer au trait horizontal des enfants. */
  | 'trunk'
  /** Trait horizontal au-dessus des enfants. */
  | 'bus'
  /** Du trait horizontal à un enfant. */
  | 'leg'
  /** Lien hors des foyers (trait long, adoption à côté de la naissance, union entre générations). */
  | 'link';

/** Un trait à angles droits, en pixels. `supposed` : en pointillés (lien probable ou supposé). */
export interface SceneEdge {
  readonly kind: SceneEdgeKind;
  readonly points: readonly Point[];
  readonly supposed: boolean;
  /**
   * Famille (ou lien) dont le trait fait partie : clé interne, jamais affichée ni lue par un
   * libellé ; elle sert à relier un trait à sa famille dans les tests et à replier.
   */
  readonly familyKey: string;
  /** Pour `leg` : l'enfant au bout du trait. */
  readonly childId: Id | undefined;
}

export interface TreeScene {
  readonly spec: SceneSpec;
  readonly centerId: Id;
  readonly people: readonly ScenePerson[];
  readonly missing: readonly SceneMissing[];
  readonly counters: readonly SceneCounter[];
  readonly marks: readonly SceneMark[];
  readonly edges: readonly SceneEdge[];
  /** Les renvois « Voir aussi », une fois par lien (`fromId` puis `toId`). */
  readonly seeAlso: readonly { readonly fromId: Id; readonly toId: Id }[];
  readonly personById: ReadonlyMap<Id, ScenePerson>;
  /** Tout ce qui est dessiné, au plus large (fiches complètes). */
  readonly bounds: Rect;
}

export interface SceneOptions {
  /**
   * Enfants dont la filiation n'est pas certaine : le trait qui y mène est en pointillés
   * (06-arbre.md, « lien supposé »). Une adoption est un trait plein.
   */
  readonly supposedChildren?: ReadonlySet<Id>;
}

const EPSILON = 1e-6;
const NO_SUPPOSED: ReadonlySet<Id> = new Set();

/** Rectangle d'une fiche, au plus large (prénom sur deux lignes, ligne secondaire, mention). */
export function cardRect(spec: SceneSpec, x: number, y: number): Rect {
  return {
    left: x - spec.nodeWidth / 2,
    right: x + spec.nodeWidth / 2,
    top: y - spec.cardTop,
    bottom: y + spec.cardBottom,
  };
}

/** Rectangle de la pastille d'un foyer replié. */
export function counterRect(spec: SceneSpec, x: number, y: number): Rect {
  return rectAround(
    x,
    y,
    Math.max(spec.counterMinWidth, spec.counterHeight) / 2,
    spec.counterHeight / 2,
  );
}

/** Rectangle de la mention sous une fiche. */
export function markRect(spec: SceneSpec, x: number, y: number): Rect {
  return rectAround(x, y, spec.nodeWidth / 2, spec.markLineHeight / 2);
}

interface FamilyStart {
  /** D'où part le trait vers les enfants. */
  readonly start: Point;
  /**
   * Détour du départ quand une fiche empilée sous le parent barre la descente : le trait passe par
   * la gouttière voisine. Le dernier point est celui d'où descendent les enfants et où se pose la
   * pastille ; vide sans détour.
   */
  readonly via: readonly Point[];
  /** Bas des fiches des parents : rien ne se dessine plus haut. */
  readonly baseBottom: number;
}

function sameSpot(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/**
 * Point de départ des traits d'une famille. Le point d'attache est sur la fiche d'un parent
 * (chef de famille au centre de ses épouses : le trait part sous la fiche de l'épouse), ou entre
 * deux conjoints voisins (le trait part du trait d'union, entre les deux fiches).
 */
function familyStart(
  spec: SceneSpec,
  parents: readonly Point[],
  anchor: Point,
  obstacles: Obstacles,
): FamilyStart {
  const baseBottom = Math.max(anchor.y, ...parents.map((parent) => parent.y)) + spec.cardBottom;
  const underCard = (card: Point): FamilyStart => {
    const start = { x: card.x, y: card.y + spec.cardBottom };
    if (obstacles.columnFree(start.x, start.y, start.y + spec.unitY / 2)) {
      return { start, via: [], baseBottom };
    }
    const mid = start.y + spec.connectorGap / 2;
    // Première colonne libre de part et d'autre, de gouttière en gouttière.
    for (let step = 1; step <= 8; step += 1) {
      for (const side of [1, -1]) {
        const x = start.x + side * step * (spec.unitX / 2);
        if (obstacles.columnFree(x, mid, mid + spec.unitY / 2)) {
          return {
            start,
            via: [
              { x: start.x, y: mid },
              { x, y: mid },
            ],
            baseBottom,
          };
        }
      }
    }
    return { start, via: [], baseBottom };
  };
  if (parents.some((parent) => sameSpot(parent, anchor))) {
    return underCard(anchor);
  }
  if (obstacles.columnFree(anchor.x, anchor.y, baseBottom + spec.connectorGap)) {
    return { start: anchor, via: [], baseBottom };
  }
  // Le milieu des deux conjoints tombe sur la fiche d'une autre personne (conjoint précédent
  // d'une épouse du milieu, ADR 0016 règle 6, ADR 0025) : le trait part sous la fiche du conjoint
  // le plus bas, qui garde ses enfants sous lui.
  const lower = parents.reduce(
    (best, parent) => (parent.y > best.y ? parent : best),
    parents[0] ?? anchor,
  );
  return underCard(lower);
}

/** Rectangles de l'avatar et du texte d'une fiche, pour savoir si un trait peut passer. */
function cardBoxes(spec: SceneSpec, x: number, y: number): Rect[] {
  return [
    rectAround(x, y, spec.radius, spec.radius),
    {
      left: x - spec.nodeWidth / 2,
      right: x + spec.nodeWidth / 2,
      top: y + spec.radius,
      bottom: y + spec.cardBottom,
    },
  ];
}

/** Les fiches posées, rangées par demi-rangée : un trait vertical ne se compare qu'à celles qu'il longe. */
interface Obstacles {
  /** Aucune fiche sur le trait vertical `x`, de `top` à `bottom`. */
  columnFree(x: number, top: number, bottom: number): boolean;
}

function obstaclesOf(spec: SceneSpec, cards: readonly Point[]): Obstacles {
  const level = (y: number) => Math.floor((y / spec.unitY) * 2 + EPSILON);
  const buckets = new Map<number, Rect[]>();
  for (const card of cards) {
    for (const box of cardBoxes(spec, card.x, card.y)) {
      // Une fiche touche au plus deux niveaux : on la range sous chacun.
      for (let key = level(box.top); key <= level(box.bottom); key += 1) {
        const list = buckets.get(key);
        if (list === undefined) buckets.set(key, [box]);
        else list.push(box);
      }
    }
  }
  return {
    columnFree(x, top, bottom) {
      for (let key = level(top); key <= level(bottom); key += 1) {
        for (const box of buckets.get(key) ?? []) {
          if (
            x > box.left + EPSILON &&
            x < box.right - EPSILON &&
            top < box.bottom - EPSILON &&
            bottom > box.top + EPSILON
          ) {
            return false;
          }
        }
      }
      return true;
    },
  };
}

/** Trait d'un conjoint à l'autre : droit, par-dessus les fiches qui les séparent, ou en échelle. */
function unionPoints(spec: SceneSpec, a: Point, b: Point, blocked: boolean): Point[] {
  if (Math.abs(a.y - b.y) < EPSILON) {
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    if (!blocked) {
      return [
        { x: left.x + spec.radius, y: left.y },
        { x: right.x - spec.radius, y: right.y },
      ];
    }
    const rise = left.y - spec.radius - spec.connectorGap / 2;
    return [
      { x: left.x, y: left.y - spec.radius },
      { x: left.x, y: rise },
      { x: right.x, y: rise },
      { x: right.x, y: right.y - spec.radius },
    ];
  }
  // Conjoint sur la demi-rangée : le trait descend sous la fiche du haut, traverse au milieu du
  // dégagement, et arrive sur la fiche du bas.
  const [upper, lower] = a.y < b.y ? [a, b] : [b, a];
  const from = upper.y + spec.cardBottom;
  const to = lower.y - spec.cardTop;
  const rail = (from + to) / 2;
  return [
    { x: upper.x, y: from },
    { x: upper.x, y: rail },
    { x: lower.x, y: rail },
    { x: lower.x, y: to },
  ];
}

/** Conjoint sur la demi-rangée : son époux ou son épouse centrale est au-dessus de lui, sur la rangée. */
function isHalfLevel(spec: SceneSpec, y: number): boolean {
  const rows = y / spec.unitY;
  return Math.abs(rows - Math.round(rows)) > 0.25;
}

/**
 * Hauteur du trait horizontal qui précède une fiche : juste au-dessus de sa fiche, ou, pour le
 * conjoint de la demi-rangée, au-dessus de la rangée de son époux, dont la fiche est sur le
 * chemin (le trait contourne cette fiche par la gouttière voisine).
 */
function railAbove(spec: SceneSpec, target: Point): number {
  const top = target.y - spec.cardTop - (isHalfLevel(spec, target.y) ? spec.unitY / 2 : 0);
  return top - spec.connectorGap / 2;
}

/**
 * Trait d'un point de départ à une fiche plus bas : descend, traverse, descend. Pour un conjoint
 * de la demi-rangée, il descend dans la gouttière entre deux fiches puis entre dans l'avatar par
 * le côté, sans traverser la fiche de son époux.
 */
function dropPoints(
  spec: SceneSpec,
  start: Point,
  target: Point,
  rail = railAbove(spec, target),
  obstacles?: Obstacles,
): Point[] {
  const entry = entryPoints(spec, start, target, rail, obstacles);
  const first = entry[0];
  return first === undefined
    ? [start]
    : [start, { x: start.x, y: rail }, { x: first.x, y: rail }, ...entry.slice(1)];
}

/**
 * De la hauteur `rail` à la fiche `target` : droit vers le haut de la fiche, ou, pour un conjoint
 * de la demi-rangée, par la gouttière voisine et le côté de l'avatar. Le premier point est sur le
 * trait horizontal.
 */
function entryPoints(
  spec: SceneSpec,
  start: Point,
  target: Point,
  rail: number,
  obstacles?: Obstacles,
): Point[] {
  if (!isHalfLevel(spec, target.y)) {
    return [
      { x: target.x, y: rail },
      { x: target.x, y: target.y - spec.cardTop },
    ];
  }
  // Gouttière du côté du départ, ou de l'autre si une fiche (l'époux, centré entre ses épouses)
  // l'occupe.
  const preferred = start.x <= target.x ? -1 : 1;
  const free = (side: number) =>
    obstacles?.columnFree(target.x + side * (spec.unitX / 2), rail, target.y) ?? true;
  const side = free(preferred) || !free(-preferred) ? preferred : -preferred;
  const gutter = target.x + side * (spec.unitX / 2);
  return [
    { x: gutter, y: rail },
    { x: gutter, y: target.y },
    { x: target.x + side * spec.radius, y: target.y },
  ];
}

/** Trait d'une fiche à une autre, au-dessus ou au-dessous, qui part du bord de la première. */
function cardToCardPoints(spec: SceneSpec, from: Point, to: Point): Point[] {
  if (to.y >= from.y) {
    return dropPoints(spec, { x: from.x, y: from.y + spec.cardBottom }, to);
  }
  const bottom = to.y + spec.cardBottom;
  const rail = bottom + spec.connectorGap / 2;
  return [
    { x: from.x, y: from.y - spec.cardTop },
    { x: from.x, y: rail },
    { x: to.x, y: rail },
    { x: to.x, y: bottom },
  ];
}

/** Indice des fiches d'une même hauteur, pour savoir si un trait d'union passerait derrière l'une d'elles. */
function rowIndex(cards: readonly Point[]): Map<number, number[]> {
  const rows = new Map<number, number[]>();
  for (const card of cards) {
    const key = Math.round(card.y * 1000);
    const xs = rows.get(key);
    if (xs === undefined) rows.set(key, [card.x]);
    else xs.push(card.x);
  }
  return rows;
}

function isBlocked(rows: Map<number, number[]>, a: Point, b: Point): boolean {
  const xs = rows.get(Math.round(a.y * 1000)) ?? [];
  const low = Math.min(a.x, b.x);
  const high = Math.max(a.x, b.x);
  return xs.some((x) => x > low + EPSILON && x < high - EPSILON);
}

export function buildScene(
  layout: TreeLayout,
  spec: SceneSpec,
  options: SceneOptions = {},
): TreeScene {
  const supposed = options.supposedChildren ?? NO_SUPPOSED;
  const world = (point: GridPoint): Point => ({ x: point.x * spec.unitX, y: point.y * spec.unitY });

  const people: ScenePerson[] = [...layout.people.values()].map((person) => ({
    id: person.personId,
    ...world(person),
    foldedParentsKey: person.foldedParentsKey,
  }));
  const personById = new Map(people.map((person) => [person.id, person]));

  const missing: SceneMissing[] = [];
  for (const family of layout.families.values()) {
    const parentId = family.parentIds[0];
    if (family.kind !== 'unspecified' || family.header === undefined || parentId === undefined) {
      continue;
    }
    if (!personById.has(parentId)) continue;
    missing.push({ familyKey: family.key, parentId, ...world(family.header) });
  }
  const missingByKey = new Map(missing.map((place) => [place.familyKey, place]));

  const rows = rowIndex([...people, ...missing]);
  const obstacles = obstaclesOf(spec, [...people, ...missing]);
  const edges: SceneEdge[] = [];
  const counters: SceneCounter[] = [];
  const linkedChildren = new Set(
    layout.links
      .filter((link) => link.nature === 'elsewhere' || link.nature === 'long')
      .map((link) => `${link.key}|${link.toId}`),
  );

  /** Fiches (centres) des parents dessinés d'une famille, et leur point d'attache. */
  const parentsOf = (family: PlacedFamily): Point[] =>
    family.parentIds.flatMap((id) => {
      const person = personById.get(id);
      return person === undefined ? [] : [{ x: person.x, y: person.y }];
    });

  for (const family of layout.families.values()) {
    if (family.anchor === undefined) continue;
    const anchor = world(family.anchor);
    const place = missingByKey.get(family.key);

    // Trait d'union.
    if (family.kind === 'unspecified') {
      const parent = personById.get(family.parentIds[0] ?? '');
      if (parent !== undefined && place !== undefined) {
        edges.push({
          kind: 'union',
          points: unionPoints(spec, parent, place, isBlocked(rows, parent, place)),
          supposed: false,
          familyKey: family.key,
          childId: undefined,
        });
      }
    } else {
      const [first, second] = family.parentIds.map((id) => personById.get(id));
      const rowA = first === undefined ? undefined : layout.people.get(first.id)?.row;
      const rowB = second === undefined ? undefined : layout.people.get(second.id)?.row;
      if (first !== undefined && second !== undefined && rowA === rowB) {
        edges.push({
          kind: 'union',
          points: unionPoints(spec, first, second, isBlocked(rows, first, second)),
          supposed: false,
          familyKey: family.key,
          childId: undefined,
        });
      }
    }

    // Traits vers les enfants, ou pastille du foyer replié.
    const parents =
      family.kind === 'unspecified' && place !== undefined ? [place] : parentsOf(family);
    if (parents.length === 0) continue;
    const origin = familyStart(spec, parents, anchor, obstacles);
    const { baseBottom, via } = origin;
    // D'où les enfants descendent : le départ, ou la fin du détour par la gouttière.
    const start = via[via.length - 1] ?? origin.start;
    if (family.folded) {
      if (family.childCount > 0) {
        const y = baseBottom + spec.connectorGap / 2;
        counters.push({ familyKey: family.key, x: start.x, y, count: family.childCount });
        edges.push({
          kind: 'trunk',
          points:
            via.length === 0
              ? [origin.start, { x: start.x, y: y - spec.counterHeight / 2 }]
              : [origin.start, ...via],
          supposed: false,
          familyKey: family.key,
          childId: undefined,
        });
      }
      continue;
    }
    // Les enfants reliés par un lien (rangés ailleurs, ou sur une rangée non voisine) n'ont pas
    // de descente : leur trait, ou leur renvoi, vient de `layout.links`.
    const children = family.shownChildren.flatMap((id) => {
      const child = personById.get(id);
      return child === undefined || linkedChildren.has(`${family.key}|${id}`) ? [] : [child];
    });
    if (children.length === 0) continue;
    const rail = Math.min(...children.map((child) => railAbove(spec, child)));
    const entries = children.map((child) => entryPoints(spec, start, child, rail, obstacles));
    const xs = [start.x, ...entries.map((entry) => entry[0]?.x ?? start.x)];
    edges.push({
      kind: 'trunk',
      points: [origin.start, ...via, { x: start.x, y: rail }],
      supposed: false,
      familyKey: family.key,
      childId: undefined,
    });
    if (Math.min(...xs) < Math.max(...xs)) {
      edges.push({
        kind: 'bus',
        points: [
          { x: Math.min(...xs), y: rail },
          { x: Math.max(...xs), y: rail },
        ],
        supposed: false,
        familyKey: family.key,
        childId: undefined,
      });
    }
    children.forEach((child, index) => {
      edges.push({
        kind: 'leg',
        points: entries[index] ?? [],
        supposed: supposed.has(child.id),
        familyKey: family.key,
        childId: child.id,
      });
    });
  }

  // Liens hors des foyers (étape 6) : un trait, ou un renvoi « Voir aussi » à chaque bout.
  const seeAlso: { fromId: Id; toId: Id }[] = [];
  const targets = new Map<Id, Id[]>();
  const addTarget = (id: Id, target: Id) => {
    const list = targets.get(id);
    if (list === undefined) targets.set(id, [target]);
    else if (!list.includes(target)) list.push(target);
  };
  for (const link of layout.links) {
    if (!personById.has(link.fromId) || !personById.has(link.toId)) continue;
    if (link.drawing === 'seeAlso') {
      seeAlso.push({ fromId: link.fromId, toId: link.toId });
      addTarget(link.fromId, link.toId);
      addTarget(link.toId, link.fromId);
      continue;
    }
    edges.push({
      kind: 'link',
      points: linkPoints(spec, layout, link, personById, world, parentsOf, obstacles),
      supposed: supposed.has(link.toId),
      familyKey: link.key,
      childId: undefined,
    });
  }

  const marks: SceneMark[] = [];
  for (const person of people) {
    const y = person.y + spec.markTop + spec.markLineHeight / 2;
    const linked = targets.get(person.id);
    if (linked !== undefined) {
      marks.push({ kind: 'seeAlso', personId: person.id, targets: linked, x: person.x, y });
    } else if (person.foldedParentsKey !== undefined) {
      marks.push({
        kind: 'parents',
        personId: person.id,
        familyKey: person.foldedParentsKey,
        x: person.x,
        y,
      });
    }
  }

  const rects: Rect[] = [
    ...people.map((person) => cardRect(spec, person.x, person.y)),
    ...missing.map((place) => cardRect(spec, place.x, place.y)),
    ...counters.map((counter) => counterRect(spec, counter.x, counter.y)),
    ...edges.map((edge) => rectOfPoints(edge.points)),
  ];
  const first = rects[0] ?? rectAround(0, 0, 0, 0);
  const bounds = rects.reduce(unionRect, first);

  return {
    spec,
    centerId: layout.centerId,
    people,
    missing,
    counters,
    marks,
    edges,
    seeAlso,
    personById,
    bounds,
  };
}

function linkPoints(
  spec: SceneSpec,
  layout: TreeLayout,
  link: PlacedLink,
  personById: ReadonlyMap<Id, ScenePerson>,
  world: (point: GridPoint) => Point,
  parentsOf: (family: PlacedFamily) => Point[],
  obstacles: Obstacles,
): Point[] {
  const to = personById.get(link.toId);
  const from = personById.get(link.fromId);
  if (to === undefined || from === undefined) return [];
  if (link.nature === 'elsewhere' || link.nature === 'long') {
    const family = layout.families.get(link.key);
    const anchor = world(link.from);
    const parents = family === undefined ? [from] : parentsOf(family);
    const origin = familyStart(spec, parents.length === 0 ? [from] : parents, anchor, obstacles);
    const start = origin.via[origin.via.length - 1] ?? origin.start;
    const path = dropPoints(spec, start, to, railAbove(spec, to), obstacles);
    return origin.via.length === 0 ? path : [origin.start, ...origin.via, ...path.slice(1)];
  }
  return cardToCardPoints(spec, from, to);
}
