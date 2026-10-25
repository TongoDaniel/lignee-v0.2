// Fenêtre sur le dessin (T-017) : échelle et déplacement, de l'écran au monde et retour, zoom
// autour d'un point (pincement ou bouton), ajustement et butées. Fonctions pures : les gestes les
// appellent, les tests les rejouent sans écran.
import { rectHeight, rectWidth, type Point, type Rect } from './geometry';
import { clampScale } from './levels';
import type { ZoomSpec } from './spec';

/** Écran = monde × `scale` + (`x`, `y`). */
export interface Viewport {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export function toWorld(viewport: Viewport, screen: Point): Point {
  return {
    x: (screen.x - viewport.x) / viewport.scale,
    y: (screen.y - viewport.y) / viewport.scale,
  };
}

export function toScreen(viewport: Viewport, world: Point): Point {
  return { x: world.x * viewport.scale + viewport.x, y: world.y * viewport.scale + viewport.y };
}

/**
 * Partie du monde à l'écran, agrandie de `margin` fois la taille de l'écran de chaque côté : ce
 * qui est dans cette zone est dessiné, le reste ne l'est pas (TRD, « Seuls les nœuds dans
 * l'écran et sa marge sont dessinés »).
 */
export function visibleRect(viewport: Viewport, size: ScreenSize, margin = 0): Rect {
  const marginX = size.width * margin;
  const marginY = size.height * margin;
  return {
    left: (-marginX - viewport.x) / viewport.scale,
    top: (-marginY - viewport.y) / viewport.scale,
    right: (size.width + marginX - viewport.x) / viewport.scale,
    bottom: (size.height + marginY - viewport.y) / viewport.scale,
  };
}

/** Fenêtre de l'échelle donnée qui met le point `world` au point `screen` de l'écran. */
export function placeAt(scale: number, world: Point, screen: Point): Viewport {
  return { scale, x: screen.x - world.x * scale, y: screen.y - world.y * scale };
}

/** Change d'échelle en gardant fixe le point `focus` de l'écran (pincement, boutons « + » et « − »). */
export function zoomAbout(
  viewport: Viewport,
  nextScale: number,
  focus: Point,
  zoom: ZoomSpec,
): Viewport {
  const scale = clampScale(nextScale, zoom);
  return placeAt(scale, toWorld(viewport, focus), focus);
}

/** Fenêtre qui montre tout `content`, avec `padding` pixels d'écran autour, dans les butées. */
export function fitViewport(
  content: Rect,
  size: ScreenSize,
  padding: number,
  zoom: ZoomSpec,
): Viewport {
  const width = Math.max(rectWidth(content), 1);
  const height = Math.max(rectHeight(content), 1);
  const scale = clampScale(
    Math.min((size.width - 2 * padding) / width, (size.height - 2 * padding) / height),
    zoom,
  );
  const center = { x: (content.left + content.right) / 2, y: (content.top + content.bottom) / 2 };
  return placeAt(scale, center, { x: size.width / 2, y: size.height / 2 });
}

/**
 * Le dessin n'est jamais perdu : le centre de l'écran reste dans `content` agrandi d'une demi-
 * fenêtre (en pixels du monde), ce qui laisse défiler jusqu'au bord sans jamais afficher du vide.
 */
export function clampViewport(viewport: Viewport, size: ScreenSize, content: Rect): Viewport {
  const halfWidth = size.width / 2 / viewport.scale;
  const halfHeight = size.height / 2 / viewport.scale;
  const center = toWorld(viewport, { x: size.width / 2, y: size.height / 2 });
  const x = Math.min(content.right + halfWidth, Math.max(content.left - halfWidth, center.x));
  const y = Math.min(content.bottom + halfHeight, Math.max(content.top - halfHeight, center.y));
  if (x === center.x && y === center.y) return viewport;
  return placeAt(viewport.scale, { x, y }, { x: size.width / 2, y: size.height / 2 });
}

/**
 * Le dessin déjà préparé (`prepared`, zone avec marge) couvre-t-il encore tout l'écran (`visible`) ?
 * Sinon il faut recalculer ce qui est dessiné. Le geste lit cette règle à chaque image, sans
 * recalcul tant qu'elle est vraie.
 */
export function needsRedraw(prepared: Rect, visible: Rect): boolean {
  return (
    visible.left < prepared.left ||
    visible.top < prepared.top ||
    visible.right > prepared.right ||
    visible.bottom > prepared.bottom
  );
}
