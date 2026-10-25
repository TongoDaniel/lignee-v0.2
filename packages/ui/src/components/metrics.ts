// Mesures propres à un composant, écrites dans sa fiche (docs/charte/components/<Composant>/
// README.md) ou dans la feuille de style de référence des aperçus (components/bundle.css), quand
// tokens.json ne les nomme pas. Elles ne se recopient pas dans un écran : un écran utilise le
// composant. Si la charte leur donne un jour un token, remplacez la valeur par le token.
import { palette, radius, size, space } from '../tokens';

export const metrics = {
  button: {
    /** Contour des variantes `secondaire` et `danger` (bundle.css : inset 0 0 0 2px). */
    outlineWidth: 2,
  },
  chip: {
    /** Hauteur de la pilule (bundle.css : 32px) ; elle grandit avec le texte. */
    minHeight: 32,
    paddingHorizontal: space[3],
    /** Écart entre l'icône et le libellé (bundle.css : 6px). */
    gap: 6,
    /** Icône de 16 px avant le libellé (README de Puce). */
    iconSize: 16,
    /** Contour de la variante `neutre` (bundle.css : inset 0 0 0 1px). */
    outlineWidth: 1,
  },
  card: {
    /** Vignette de 52 px à gauche (README de Carte). */
    thumbnailSize: 52,
    /** Coins de la vignette (bundle.css : 14px). */
    thumbnailRadius: 14,
    /** Écart entre le titre et le texte (bundle.css : 4px). */
    textGap: space[1],
  },
  field: {
    /** Contour au focus et en erreur (README de Champ : 2,5 px). */
    focusBorderWidth: 2.5,
    /** Marge intérieure de la boîte (bundle.css : 18px). */
    paddingHorizontal: 18,
    /** Retrait du libellé et du message sous la boîte (bundle.css : 4px). */
    labelInset: space[1],
    /** Écart entre l'icône `alerte` et le message d'erreur (bundle.css : 6px). */
    messageGap: 6,
  },
  switch: {
    /** Piste de 54 × 32 px (README d'Interrupteur). */
    trackWidth: 54,
    trackHeight: 32,
    /** Pastille de 25 px. */
    thumbSize: 25,
    /** Pastille blanche dans les deux thèmes. */
    thumbColor: palette.blanc,
    /** Ombre de la pastille (bundle.css : 0 1px 3px rgba(10,23,19,.3)). */
    thumbShadow: `0 1px 3px ${palette.nuit900}4D`,
  },
  header: {
    /** Écart entre le titre et le sous-titre (bundle.css : 2px). */
    subtitleGap: 2,
  },
  settingsRow: {
    /** Hauteur minimale d'une ligne (README de LigneReglage : 60 px). */
    minHeight: 60,
    /** Marge gauche avant l'icône (bundle.css : 20px). */
    paddingLeft: space[5],
    paddingRight: space[4],
    gap: space[4],
    /** Marge haute et basse du groupe de lignes (bundle.css : 4px). */
    groupPaddingVertical: space[1],
  },
  toast: {
    /** Hauteur de la pilule (bundle.css : 46px) ; elle grandit avec le texte. */
    minHeight: 46,
    paddingLeft: space[3],
    /** Marge droite (bundle.css : 22px). */
    paddingRight: 22,
    /** Coche dorée : disque de 24 px, icône de 15 px. */
    checkSize: size.iconeM,
    checkIconSize: 15,
    /** La coche est or sur la pilule sombre, dans les deux thèmes (bundle.css). */
    checkBackground: palette.or500,
    checkColor: palette.nuit900,
    /** Distance parcourue à l'apparition (glisse depuis le bas). */
    enterOffset: space[4],
  },
  sheet: {
    /** Poignée de 48 × 5 px (README de Feuille). */
    handleWidth: 48,
    handleHeight: 5,
    handleRadius: 3,
    /** Marges intérieures (bundle.css : 12px 22px 24px). */
    paddingTop: space[3],
    paddingHorizontal: 22,
    paddingBottom: space[6],
    /** Une feuille ne couvre jamais tout l'écran : au-delà, ouvrez un écran. */
    maxHeightRatio: 0.9,
    /** Tirée de plus d'un quart de sa hauteur vers le bas, elle se ferme. */
    dismissRatio: 0.25,
  },
  avatar: {
    /** Initiale à 86 % du rayon (README d'Avatar). */
    initialRatio: 0.86,
    /** Contour de l'avatar neutre, en `filet-fort` (bundle.css : inset 0 0 0 1.5px). */
    neutralOutlineWidth: 1.5,
    /** Silhouette de « Vous », en proportions du diamètre (bundle.css, .lg-avatar--vous). */
    silhouette: {
      headSize: 0.34,
      headLeft: 0.33,
      headTop: 0.17,
      bodySize: 0.62,
      bodyLeft: 0.19,
      bodyTop: 0.61,
      /** Blanc à 92 % sur le dégradé doré. */
      opacity: 0.92,
    },
  },
  treeNode: {
    /** Largeur d'un nœud au zoom par défaut (bundle.css : 96px). */
    width: 96,
    /** Écart entre l'avatar, le prénom et la ligne secondaire (bundle.css : 6px). */
    gap: 6,
    /** Anneau de 3 px, séparé de l'avatar par 3 px de `fond` (README de NoeudArbre). */
    ringWidth: 3,
    ringGap: 3,
    /** Pastille (cœur, anniversaire) : disque de 22 px, icône de 14 px (bundle.css). */
    badgeSize: 22,
    badgeIconSize: 14,
    /** Rapproche la ligne secondaire du prénom (bundle.css : margin-top -4px). */
    secondaryOverlap: 4,
    /** Débord de la pastille au-dessus et à droite de l'avatar (bundle.css : top -2px). */
    badgeOffsetTop: -2,
    badgeOffsetRight: -3,
    /** Point « proposition en attente » en haut à droite (06-arbre.md). */
    pendingDotSize: 12,
    /** Contour du cercle pointillé d'une place à compléter : le trait des icônes. */
    unknownBorderWidth: 2,
    /** L'anneau d'anniversaire respire en 2 s : 1 s pour chaque sens (06-arbre.md). */
    breathHalfCycle: 1000,
    breathLowOpacity: 0.45,
    /**
     * Dessin de l'arbre (T-017, Skia), qui ne passe pas par le composant. Pointillés d'un lien
     * supposé : 6 et 7 (06-arbre.md). Doigt déplacé de 8 pixels avant que le déplacement ne démarre.
     * Le signe « + » d'une place à compléter fait le tiers du rayon de chaque côté. Lignes de base
     * du texte, en fraction de la hauteur de ligne ou de la taille de la police : centré sur un
     * point, bas d'un prénom, haut d'une ligne secondaire, mention.
     */
    drawing: {
      supposedDash: [6, 7],
      panMinDistance: 8,
      plusRadiusRatio: 1 / 3,
      baseline: { centered: 0.35, name: 0.25, secondary: 0.8, mark: 0.3 },
    },
  },
  privacyNote: {
    /** Icône de 16 px à gauche du texte (README de MentionPrivee). */
    iconSize: 16,
    gap: 6,
  },
  profileTabs: {
    /** Libellés en 16 (README d'OngletsFiche), graisse 500 puis 600 pour l'actif. */
    fontSize: 16,
    lineHeight: 20,
    /** Trait sous l'onglet actif : 4 px de haut, 72 de large au plus (bundle.css). */
    indicatorHeight: 4,
    indicatorWidth: 72,
    indicatorRadius: 2,
    /** Filet sous la rangée (bundle.css : 1px). */
    ruleWidth: 1,
    paddingTop: 14,
    paddingBottom: 14,
  },
  tabBar: {
    /** Au-delà, le libellé ne tiendrait plus sur une ligne (09-accessibilite.md, « Mise en œuvre »). */
    labelMaxFontScale: 2,
  },
  notification: {
    /** Icône d'app : carré de 40 px, coins de 10, symbole or sur `vert-700` (bundle.css). */
    iconBoxSize: 40,
    iconBoxRadius: 10,
    iconSize: size.iconeM,
    gap: 14,
    padding: space[4],
    textGap: 2,
    titleGap: space[1],
  },
  logo: {
    /** Sous 48 px de haut, le symbole compact, au trait plus épais (02-logo.md). */
    compactBelow: 48,
  },
  /** Rayon d'un disque (avatar, coche) : la pilule de la charte. */
  round: radius.pilule,
} as const;
