// Aides d'accessibilité communes aux composants (09-accessibilite.md).
import { useState } from 'react';
import type { Insets, ViewStyle } from 'react-native';

import { stroke } from '../tokens';
import type { ThemeColors } from '../tokens';

/**
 * Agrandit la zone touchable d'un élément visuellement plus petit (bouton compact de 44, puce de
 * 32) jusqu'à la zone de la charte : 48, ou 56 en mode Aînés. `hitSlop` ne change pas la mise en
 * page ; la zone reste centrée sur l'élément.
 */
export function hitSlopFor(visualHeight: number, touchTarget: number): Insets | undefined {
  const missing = touchTarget - visualHeight;
  if (missing <= 0) return undefined;
  const half = missing / 2;
  return { top: half, bottom: half, left: 0, right: 0 };
}

/**
 * Anneau de focus clavier : 2 px de `fond`, puis 2 px de `focus` (README de la charte, « États »).
 * Le contour décalé laisse voir le fond de l'écran entre l'élément et l'anneau.
 */
export function useFocusRing(colors: ThemeColors): {
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  readonly focusStyle: ViewStyle | undefined;
} {
  const [focused, setFocused] = useState(false);
  return {
    onFocus: () => {
      setFocused(true);
    },
    onBlur: () => {
      setFocused(false);
    },
    focusStyle: focused
      ? {
          outlineColor: colors.focus,
          outlineStyle: 'solid',
          outlineWidth: stroke.focus,
          outlineOffset: stroke.focus,
        }
      : undefined,
  };
}
