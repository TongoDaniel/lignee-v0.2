// Géométrie du dessin (T-017) : points et rectangles en pixels. Aucune dépendance : ces
// fonctions tournent aussi bien dans Node (tests) que sur le téléphone.

/** Un point, en pixels du « monde » (avant zoom et déplacement) ou de l'écran selon le contexte. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Un rectangle aligné sur les axes. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Plus petit rectangle qui contient tous les points (un seul point : rectangle de surface nulle). */
export function rectOfPoints(points: readonly Point[]): Rect {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    if (point.x < left) left = point.x;
    if (point.x > right) right = point.x;
    if (point.y < top) top = point.y;
    if (point.y > bottom) bottom = point.y;
  }
  return { left, top, right, bottom };
}

/** Rectangle centré en (`x`, `y`), de demi-largeur `halfWidth` et de demi-hauteur `halfHeight`. */
export function rectAround(x: number, y: number, halfWidth: number, halfHeight: number): Rect {
  return { left: x - halfWidth, top: y - halfHeight, right: x + halfWidth, bottom: y + halfHeight };
}

/** Deux rectangles se touchent ou se recouvrent (bords compris). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

/** `inner` est entièrement dans `outer` (bords compris). */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

/** Rectangle agrandi de `margin` de chaque côté. */
export function inflateRect(rect: Rect, margin: number): Rect {
  return {
    left: rect.left - margin,
    top: rect.top - margin,
    right: rect.right + margin,
    bottom: rect.bottom + margin,
  };
}

/** Plus petit rectangle qui contient les deux. */
export function unionRect(a: Rect, b: Rect): Rect {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

export function rectWidth(rect: Rect): number {
  return rect.right - rect.left;
}

export function rectHeight(rect: Rect): number {
  return rect.bottom - rect.top;
}
