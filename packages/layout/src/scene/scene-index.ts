// Index spatial de la scène (T-017 ; TRD, « Dessin » : « un index spatial pour savoir quelle fiche
// est touchée. Seuls les nœuds dans l'écran et sa marge sont dessinés »). Une grille de cases de
// la largeur d'une unité : chercher dans un rectangle ne regarde que les cases qu'il touche, pas
// les 500 personnes. Fonctions pures.
import {
  inflateRect,
  rectAround,
  rectOfPoints,
  rectsIntersect,
  type Point,
  type Rect,
} from './geometry';
import {
  cardRect,
  counterRect,
  markRect,
  type SceneCounter,
  type SceneEdge,
  type SceneMark,
  type SceneMissing,
  type ScenePerson,
  type TreeScene,
} from './scene';
import type { ZoomLevel } from './levels';

type SceneItem =
  | { readonly kind: 'person'; readonly person: ScenePerson; readonly rect: Rect }
  | { readonly kind: 'missing'; readonly place: SceneMissing; readonly rect: Rect }
  | { readonly kind: 'counter'; readonly counter: SceneCounter; readonly rect: Rect }
  | { readonly kind: 'mark'; readonly mark: SceneMark; readonly rect: Rect }
  | { readonly kind: 'edge'; readonly edge: SceneEdge; readonly rect: Rect };

export interface SceneIndex {
  readonly scene: TreeScene;
  readonly cellSize: number;
  readonly cells: ReadonlyMap<string, readonly SceneItem[]>;
}

function cellKey(column: number, row: number): string {
  return `${String(column)}:${String(row)}`;
}

/** Construit l'index : une fois par scène, pas à chaque image. */
export function indexScene(scene: TreeScene): SceneIndex {
  const { spec } = scene;
  const cellSize = spec.unitX;
  const items: SceneItem[] = [
    ...scene.people.map((person): SceneItem => ({
      kind: 'person',
      person,
      rect: cardRect(spec, person.x, person.y),
    })),
    ...scene.missing.map((place): SceneItem => ({
      kind: 'missing',
      place,
      rect: cardRect(spec, place.x, place.y),
    })),
    ...scene.counters.map((counter): SceneItem => ({
      kind: 'counter',
      counter,
      rect: counterRect(spec, counter.x, counter.y),
    })),
    ...scene.marks.map((mark): SceneItem => ({
      kind: 'mark',
      mark,
      rect: markRect(spec, mark.x, mark.y),
    })),
    ...scene.edges.map((edge): SceneItem => ({
      kind: 'edge',
      edge,
      rect: inflateRect(rectOfPoints(edge.points), spec.radius / 4),
    })),
  ];
  const cells = new Map<string, SceneItem[]>();
  for (const item of items) {
    const { rect } = item;
    for (
      let column = Math.floor(rect.left / cellSize);
      column <= Math.floor(rect.right / cellSize);
      column += 1
    ) {
      for (
        let row = Math.floor(rect.top / cellSize);
        row <= Math.floor(rect.bottom / cellSize);
        row += 1
      ) {
        const key = cellKey(column, row);
        const cell = cells.get(key);
        if (cell === undefined) cells.set(key, [item]);
        else cell.push(item);
      }
    }
  }
  return { scene, cellSize, cells };
}

function itemsIn(index: SceneIndex, area: Rect): SceneItem[] {
  const { cellSize, cells } = index;
  const found = new Set<SceneItem>();
  for (
    let column = Math.floor(area.left / cellSize);
    column <= Math.floor(area.right / cellSize);
    column += 1
  ) {
    for (
      let row = Math.floor(area.top / cellSize);
      row <= Math.floor(area.bottom / cellSize);
      row += 1
    ) {
      for (const item of cells.get(cellKey(column, row)) ?? []) {
        if (rectsIntersect(item.rect, area)) found.add(item);
      }
    }
  }
  return [...found];
}

/** Ce qui est dessiné pour une zone du monde. */
export interface CulledScene {
  readonly area: Rect;
  readonly people: readonly ScenePerson[];
  readonly missing: readonly SceneMissing[];
  readonly counters: readonly SceneCounter[];
  readonly marks: readonly SceneMark[];
  readonly edges: readonly SceneEdge[];
}

/** Éléments de la scène qui touchent `area` (l'écran et sa marge) ; rien d'autre n'est dessiné. */
export function cullScene(index: SceneIndex, area: Rect): CulledScene {
  const people: ScenePerson[] = [];
  const missing: SceneMissing[] = [];
  const counters: SceneCounter[] = [];
  const marks: SceneMark[] = [];
  const edges: SceneEdge[] = [];
  for (const item of itemsIn(index, area)) {
    if (item.kind === 'person') people.push(item.person);
    else if (item.kind === 'missing') missing.push(item.place);
    else if (item.kind === 'counter') counters.push(item.counter);
    else if (item.kind === 'mark') marks.push(item.mark);
    else edges.push(item.edge);
  }
  return { area, people, missing, counters, marks, edges };
}

/** Nombre d'éléments dessinés (fiches, places, pastilles, mentions, traits). */
export function drawnCount(culled: CulledScene): number {
  return (
    culled.people.length +
    culled.missing.length +
    culled.counters.length +
    culled.marks.length +
    culled.edges.length
  );
}

/** Ce que touche un doigt. */
export type SceneHit =
  | { readonly kind: 'person'; readonly person: ScenePerson }
  | { readonly kind: 'missing'; readonly place: SceneMissing }
  | { readonly kind: 'counter'; readonly counter: SceneCounter }
  | { readonly kind: 'mark'; readonly mark: SceneMark };

export interface HitOptions {
  readonly scale: number;
  readonly level: ZoomLevel;
}

/**
 * La zone touchable d'un élément : sa taille dans le dessin, d'au moins `cible-tactile` (48, ou 56
 * en mode Aînés) à l'écran, même dézoomé (06-arbre.md). En vue d'ensemble, une fiche n'est plus
 * qu'un point.
 */
function touchRect(index: SceneIndex, item: SceneItem, options: HitOptions): Rect {
  const { spec } = index.scene;
  const minHalf = spec.touchTarget / 2 / options.scale;
  const base =
    options.level === 'overview' && (item.kind === 'person' || item.kind === 'missing')
      ? rectAround(
          item.kind === 'person' ? item.person.x : item.place.x,
          item.kind === 'person' ? item.person.y : item.place.y,
          spec.radius,
          spec.radius,
        )
      : item.rect;
  const halfWidth = (base.right - base.left) / 2;
  const halfHeight = (base.bottom - base.top) / 2;
  return rectAround(
    (base.left + base.right) / 2,
    (base.top + base.bottom) / 2,
    Math.max(halfWidth, minHalf),
    Math.max(halfHeight, minHalf),
  );
}

const PRIORITY = { counter: 0, mark: 1, person: 2, missing: 2, edge: 3 } as const;

/**
 * Élément touché au point `world` (pixels du monde). Une pastille ou une mention l'emporte sur la
 * fiche qui la porte ; entre deux fiches, la plus proche de son centre.
 */
export function hitTest(
  index: SceneIndex,
  world: Point,
  options: HitOptions,
): SceneHit | undefined {
  const reach = index.scene.spec.touchTarget / 2 / options.scale;
  const candidates = itemsIn(index, rectAround(world.x, world.y, reach, reach)).filter(
    (item) => item.kind !== 'edge',
  );
  let best: { item: SceneItem; priority: number; distance: number } | undefined;
  for (const item of candidates) {
    const area = touchRect(index, item, options);
    if (
      world.x < area.left ||
      world.x > area.right ||
      world.y < area.top ||
      world.y > area.bottom
    ) {
      continue;
    }
    const distance = Math.hypot(
      world.x - (area.left + area.right) / 2,
      world.y - (area.top + area.bottom) / 2,
    );
    const priority = PRIORITY[item.kind];
    if (
      best === undefined ||
      priority < best.priority ||
      (priority === best.priority && distance < best.distance)
    ) {
      best = { item, priority, distance };
    }
  }
  const item = best?.item;
  if (item === undefined) return undefined;
  switch (item.kind) {
    case 'person':
      return { kind: 'person', person: item.person };
    case 'missing':
      return { kind: 'missing', place: item.place };
    case 'counter':
      return { kind: 'counter', counter: item.counter };
    case 'mark':
      return { kind: 'mark', mark: item.mark };
    case 'edge':
      return undefined;
  }
}
