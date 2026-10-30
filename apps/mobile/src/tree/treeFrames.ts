// Cadres cibles de l'arbre (T-018) : où mettre la fenêtre pour montrer « Vous », ou la personne sur
// laquelle on recentre. Fonctions pures : l'écran les appelle, les tests les rejouent sans Skia.
import type { Id } from '@lignee/domain';
import { placeAt, type ScreenSize, type TreeScene, type Viewport } from '@lignee/layout';

/**
 * Cadre qui met la personne en bas au centre de l'écran, à l'échelle standard : c'est la place de
 * « Vous » au lancement (06-arbre.md). `margin` est l'espace laissé sous la fiche (un jeton
 * d'espacement). Si la personne n'est pas dans la scène, le cadre montre l'origine du dessin
 * plutôt que de ne rien faire.
 */
export function bottomCenterFrame(
  scene: TreeScene,
  personId: Id,
  size: ScreenSize,
  margin: number,
): Viewport {
  const person = scene.personById.get(personId);
  return placeAt(
    1,
    { x: person?.x ?? 0, y: person?.y ?? 0 },
    { x: size.width / 2, y: size.height - margin - scene.spec.cardBottom },
  );
}

/**
 * Cadre de la vue « descendance » (ARB-14) : l'ancêtre en haut au centre, à l'échelle standard ;
 * ses descendants s'étendent vers le bas. `margin` est l'espace laissé au-dessus de sa fiche (un
 * jeton d'espacement).
 */
export function topCenterFrame(
  scene: TreeScene,
  personId: Id,
  size: ScreenSize,
  margin: number,
): Viewport {
  const person = scene.personById.get(personId);
  return placeAt(
    1,
    { x: person?.x ?? 0, y: person?.y ?? 0 },
    { x: size.width / 2, y: margin + scene.spec.radius },
  );
}
