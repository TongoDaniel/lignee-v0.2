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
  logo: {
    /** Sous 48 px de haut, le symbole compact, au trait plus épais (02-logo.md). */
    compactBelow: 48,
  },
  /** Rayon d'un disque (avatar, coche) : la pilule de la charte. */
  round: radius.pilule,
} as const;
