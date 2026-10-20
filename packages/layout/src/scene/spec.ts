// Mesures du dessin (T-017) : de la grille de la disposition (une fiche par unité en largeur, une
// rangée par unité en hauteur) aux pixels. Les nombres viennent des tokens de la charte, donnés
// par l'écran (`SceneSpecInput`) : ce paquet ne connaît aucune valeur de la charte.
//
// Contrat de la disposition (ADR 0016, règle 9) : une fiche fait au plus une unité de large et
// moins d'une demi-rangée de haut, avec de quoi tirer un trait entre une fiche et la suivante.
// `buildSceneSpec` choisit donc la hauteur d'une rangée à partir de la fiche la plus haute.

/** Tailles d'avatar de la charte, en pixels (`avatar-s`, `-m`, `-l`, `-xl`). */
export interface AvatarSizes {
  readonly small: number;
  readonly medium: number;
  readonly large: number;
  readonly extraLarge: number;
}

export interface SceneSpecInput {
  readonly avatarSizes: AvatarSizes;
  /** Plus petit point coloré lisible en vue d'ensemble (une icône de la charte, 20). */
  readonly smallestDot: number;
  /** Anneau du chemin ou de la fête : sa largeur plus l'écart avec l'avatar (06-arbre.md). */
  readonly ringSpace: number;
  /**
   * Facteur de texte : mode Aînés multiplié par le réglage du téléphone (au plus 2). Il agrandit
   * le texte et la largeur des fiches, pas les avatars (la charte les fixe).
   */
  readonly textScale: number;
  /** Largeur d'une fiche à l'échelle 1 (96). */
  readonly nodeWidth: number;
  /** Espace entre deux fiches voisines d'une rangée. */
  readonly nodeGap: number;
  /** Écart entre l'avatar, le prénom et la ligne secondaire. */
  readonly textGap: number;
  /** Lignes du prénom au plus ; au-delà, « … » (le nom entier reste dans la liste). */
  readonly nameLines: number;
  /** Interlignes à l'échelle 1. */
  readonly nameLineHeight: number;
  readonly secondaryLineHeight: number;
  readonly markLineHeight: number;
  /** Rapproche la ligne secondaire du prénom. */
  readonly secondaryOverlap: number;
  /** Dégagement libre entre deux fiches voisines en hauteur, pour tirer un trait. */
  readonly connectorGap: number;
  /** Côté minimal d'une zone touchable à l'écran : 48, ou 56 en mode Aînés. */
  readonly touchTarget: number;
  /** Pastille du nombre d'enfants d'un foyer replié : hauteur et largeur minimale. */
  readonly counterHeight: number;
  readonly counterMinWidth: number;
}

/** Niveaux de zoom : où l'on passe d'un niveau de détail à l'autre, et les butées. */
export interface ZoomSpec {
  readonly min: number;
  readonly max: number;
  /** En dessous : vue d'ensemble (points). */
  readonly overviewBelow: number;
  /** À partir de là : détail (nom complet et années). */
  readonly detailFrom: number;
  /** Crans des boutons « + » et « − », du plus petit au plus grand. */
  readonly stops: readonly number[];
}

export interface SceneSpec {
  readonly input: SceneSpecInput;
  /** Largeur d'une unité de grille, en pixels. */
  readonly unitX: number;
  /** Hauteur d'une rangée, en pixels. */
  readonly unitY: number;
  /** Rayon de l'avatar au zoom standard. */
  readonly radius: number;
  /** Largeur d'une fiche, texte compris. */
  readonly nodeWidth: number;
  /** Du centre de l'avatar au haut de la fiche (anneau compris). */
  readonly cardTop: number;
  /** Du centre de l'avatar au bas de la fiche (mention comprise). */
  readonly cardBottom: number;
  /** Hauteur de la fiche la plus haute. */
  readonly cardHeight: number;
  /** Du centre de l'avatar au haut du prénom. */
  readonly nameTop: number;
  readonly nameLineHeight: number;
  readonly secondaryLineHeight: number;
  readonly markLineHeight: number;
  /** Du centre de l'avatar au haut de la mention « Voir aussi », sous deux lignes de prénom. */
  readonly markTop: number;
  readonly counterHeight: number;
  readonly counterMinWidth: number;
  readonly connectorGap: number;
  readonly touchTarget: number;
  readonly zoom: ZoomSpec;
}

function zoomSpec(input: SceneSpecInput): ZoomSpec {
  const { small, medium, large, extraLarge } = input.avatarSizes;
  const min = input.smallestDot / medium;
  const max = extraLarge / medium;
  const overviewBelow = small / medium;
  const detailFrom = large / medium;
  const stops = [...new Set([min, overviewBelow, 1, detailFrom, max])].sort((a, b) => a - b);
  return { min, max, overviewBelow, detailFrom, stops };
}

export function buildSceneSpec(input: SceneSpecInput): SceneSpec {
  const scale = Math.max(1, input.textScale);
  const radius = input.avatarSizes.medium / 2;
  const nameLineHeight = input.nameLineHeight * scale;
  const secondaryLineHeight = input.secondaryLineHeight * scale;
  const markLineHeight = input.markLineHeight * scale;
  const nodeWidth = input.nodeWidth * scale;
  const cardTop = radius + input.ringSpace;
  const nameTop = cardTop + input.textGap;
  const secondaryTop = nameTop + input.nameLines * nameLineHeight - input.secondaryOverlap;
  const markTop = secondaryTop + secondaryLineHeight;
  const cardBottom = markTop + markLineHeight;
  const cardHeight = cardTop + cardBottom;
  return {
    input,
    unitX: nodeWidth + input.nodeGap,
    unitY: 2 * (cardHeight + input.connectorGap),
    radius,
    nodeWidth,
    cardTop,
    cardBottom,
    cardHeight,
    nameTop,
    nameLineHeight,
    secondaryLineHeight,
    markLineHeight,
    markTop,
    counterHeight: input.counterHeight,
    counterMinWidth: input.counterMinWidth,
    connectorGap: input.connectorGap,
    touchTarget: input.touchTarget,
    zoom: zoomSpec(input),
  };
}

/**
 * Ce qui ne respecte pas le contrat de la disposition (vide si tout va bien) : une fiche tient
 * dans une unité de large, et dans une demi-rangée moins le dégagement des traits ; ce
 * dégagement loge la pastille d'un foyer replié (elle se pose sous les parents, jamais sur une
 * fiche).
 */
export function sceneSpecIssues(spec: SceneSpec): string[] {
  const issues: string[] = [];
  if (spec.nodeWidth >= spec.unitX) issues.push('A card is wider than one grid unit');
  if (spec.cardHeight + spec.connectorGap > spec.unitY / 2) {
    issues.push('A card plus the connector gap is taller than half a row');
  }
  if (spec.counterHeight > spec.connectorGap) {
    issues.push('The connector gap cannot hold the folded-family counter');
  }
  if (spec.zoom.min >= spec.zoom.max) issues.push('Empty zoom range');
  if (spec.zoom.overviewBelow >= spec.zoom.detailFrom) issues.push('Overlapping zoom levels');
  return issues;
}
