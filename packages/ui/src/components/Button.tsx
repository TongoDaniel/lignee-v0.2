// Bouton (components/Bouton) : une pilule de 56 qui lance une action. Une seule variante
// `primary` par écran ; `celebrate` est rare ; `danger` est toujours suivi d'une confirmation.
// Pas d'ombre, pas de dégradé, pas de capitales. La hauteur est un minimum : quand le texte du
// téléphone est agrandi, le bouton grandit avec son libellé au lieu de le couper.
import { Animated, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { opacity, size, space } from '../tokens';
import { useTheme, type UiTheme } from '../theme/ThemeProvider';
import { hitSlopFor, useFocusRing } from './a11y';
import { metrics } from './metrics';
import { usePressScale } from './motion';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'celebrate' | 'danger';

export interface ButtonProps {
  /** Verbe à l'infinitif, en casse de phrase (« Ajouter », « Oui, ajouter »), déjà traduit. */
  readonly label: string;
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly variant?: ButtonVariant;
  /** Icône du jeu Lignée, avant le libellé. */
  readonly icon?: IconName;
  /** 44 de haut, pour un bouton dans une carte ou un en-tête ; la zone touchable reste de 48 (56). */
  readonly compact?: boolean;
  /** Toute la largeur disponible. */
  readonly fullWidth?: boolean;
  readonly disabled?: boolean;
  /**
   * Libellé complet pour le lecteur d'écran quand le libellé visible ne suffit pas
   * (« Ajouter votre mère » pour un bouton « Ajouter »). Par défaut, le libellé visible.
   */
  readonly accessibilityLabel?: string;
  /** Ce qui se passera, si ce n'est pas évident (« Ouvre la fiche de Claire »). */
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

interface VariantColors {
  readonly background: string;
  readonly text: string;
  readonly outline?: string;
}

function variantColors(variant: ButtonVariant, { colors }: UiTheme): VariantColors {
  switch (variant) {
    case 'primary':
      return { background: colors.action, text: colors.surAction };
    case 'secondary':
      return { background: 'transparent', text: colors.texte, outline: colors.bordureChamp };
    case 'quiet':
      return { background: 'transparent', text: colors.action };
    case 'celebrate':
      return { background: colors.feteForte, text: colors.surFete };
    case 'danger':
      return { background: 'transparent', text: colors.erreur, outline: colors.erreur };
  }
}

function paddingFor(variant: ButtonVariant, compact: boolean): number {
  if (variant === 'quiet') return space[3];
  return compact ? space[5] : space[6];
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  compact = false,
  fullWidth = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const { typography, touchTarget } = theme;
  const palette = variantColors(variant, theme);
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { onFocus, onBlur, focusStyle } = useFocusRing(theme.colors);
  // Hauteur visible : 56 (ou 44 en compact), jamais moins que la zone touchable hors compact.
  const visualHeight = compact
    ? size.hauteurBoutonCompact
    : Math.max(size.hauteurBouton, touchTarget);
  // Le libellé compact est en 15 (bundle.css), avec la graisse du bouton.
  const labelStyle = compact
    ? {
        ...typography.bouton,
        fontSize: typography.secondaire.fontSize,
        lineHeight: typography.secondaire.lineHeight,
      }
    : typography.bouton;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      hitSlop={hitSlopFor(visualHeight, touchTarget)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.pressable, fullWidth && styles.fullWidth]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            minHeight: visualHeight,
            minWidth: touchTarget,
            paddingHorizontal: paddingFor(variant, compact),
            paddingVertical: space[2],
            gap: space[2],
            borderRadius: metrics.round,
            backgroundColor: palette.background,
            opacity: disabled ? opacity.desactive : 1,
            transform: [{ scale }],
          },
          palette.outline !== undefined && {
            borderWidth: metrics.button.outlineWidth,
            borderColor: palette.outline,
          },
          focusStyle,
        ]}
      >
        {icon !== undefined && <Icon name={icon} color={palette.text} />}
        <Text style={[labelStyle, styles.label, { color: palette.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    flexShrink: 1,
  },
});
