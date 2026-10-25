// Mesures de l'arbre dessiné (T-017), tirées des tokens de la charte : aucune taille en dur ici.
// Le paquet de disposition les reçoit (`SceneSpecInput`) et en déduit la grille en pixels.
import { buildSceneSpec, type SceneSpec, type SceneSpecInput } from '@lignee/layout';
import { componentMetrics, size, space, typography } from '@lignee/ui';

/** Au-delà de 200 %, le texte du téléphone n'agrandit plus le dessin (09-accessibilite.md). */
export const MAX_SYSTEM_FONT_SCALE = 2;

export interface SceneSpecOptions {
  /** Facteur du mode Aînés (1 ou 1,3) : `theme.textScale`. */
  readonly seniorScale: number;
  /** Réglage de taille de texte du téléphone (`PixelRatio.getFontScale()`). */
  readonly systemFontScale: number;
  /** Zone touchable minimale : `theme.touchTarget` (48 ou 56). */
  readonly touchTarget: number;
}

/** Facteur de texte du dessin : mode Aînés × réglage du téléphone, ce dernier plafonné à 200 %. */
export function drawingTextScale(options: SceneSpecOptions): number {
  const system = Math.min(MAX_SYSTEM_FONT_SCALE, Math.max(1, options.systemFontScale));
  return options.seniorScale * system;
}

export function sceneSpecInput(options: SceneSpecOptions): SceneSpecInput {
  const { treeNode, chip } = componentMetrics;
  return {
    avatarSizes: {
      small: size.avatarS,
      medium: size.avatarM,
      large: size.avatarL,
      extraLarge: size.avatarXl,
    },
    smallestDot: size.iconeS,
    ringSpace: treeNode.ringWidth + treeNode.ringGap,
    textScale: drawingTextScale(options),
    nodeWidth: treeNode.width,
    nodeGap: space[4],
    textGap: treeNode.gap,
    nameLines: 2,
    nameLineHeight: typography.secondaire.lineHeight,
    secondaryLineHeight: typography.legende.lineHeight,
    markLineHeight: typography.legende.lineHeight,
    secondaryOverlap: treeNode.secondaryOverlap,
    // Le dégagement entre deux fiches loge la pastille d'un foyer replié et ses marges.
    connectorGap: chip.minHeight + 2 * space[1],
    touchTarget: options.touchTarget,
    counterHeight: chip.minHeight,
    counterMinWidth: size.cibleTactile,
  };
}

export function sceneSpecFor(options: SceneSpecOptions): SceneSpec {
  return buildSceneSpec(sceneSpecInput(options));
}
