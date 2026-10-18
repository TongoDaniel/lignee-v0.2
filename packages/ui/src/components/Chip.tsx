// Puce (components/Puce) : un ou deux mots qui disent un lien, un type de contenu ou un statut, sur
// un fond teinté. Le texte est le token `*-texte` (ou la teinte forte) sur la teinte douce : 4,5:1
// au moins. Une puce n'est pas un bouton ; si elle se touche, elle a un libellé d'accessibilité et
// une zone de 48 (56 en mode Aînés). La teinte santé, corail, porte toujours l'icône `sante`.
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { useTheme, type UiTheme } from '../theme/ThemeProvider';
import { hitSlopFor, useFocusRing } from './a11y';
import { metrics } from './metrics';
import { usePressScale } from './motion';

export type ChipTone =
  'green' | 'kinship' | 'celebrate' | 'health' | 'memory' | 'documents' | 'neutral';

export interface ChipProps {
  /** Un ou deux mots, sans point final (« Papa », « Sœur d’Odette »), déjà traduits. */
  readonly label: string;
  /** `green` lien direct, `kinship` lien de parenté ou proposition, `celebrate` lien mis en valeur. */
  readonly tone?: ChipTone;
  /** Icône de 16 avant le libellé ; `sante` d'office pour la teinte santé. */
  readonly icon?: IconName;
  /** Rend la puce touchable : elle devient un bouton. */
  readonly onPress?: () => void;
  /** Libellé complet pour le lecteur d'écran, si la puce se touche ; par défaut le libellé. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

function toneColors(tone: ChipTone, { colors }: UiTheme) {
  switch (tone) {
    case 'green':
      return { background: colors.personneVertFond, text: colors.personneVert };
    case 'kinship':
      return { background: colors.parenteDouce, text: colors.parente };
    case 'celebrate':
      return { background: colors.feteDouce, text: colors.feteTexte };
    case 'health':
      return { background: colors.santeDouce, text: colors.santeTexte };
    case 'memory':
      return { background: colors.memoireDouce, text: colors.memoireTexte };
    case 'documents':
      return { background: colors.documentsDouce, text: colors.documents };
    case 'neutral':
      return { background: colors.fond, text: colors.texteSecondaire, outline: colors.filetFort };
  }
}

export function Chip({
  label,
  tone = 'neutral',
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const tint: { background: string; text: string; outline?: string } = toneColors(tone, theme);
  const shownIcon = icon ?? (tone === 'health' ? 'sante' : undefined);
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { onFocus, onBlur, focusStyle } = useFocusRing(theme.colors);
  // Libellé de la puce : graisse 600, en 14 (bundle.css), avec la taille du mode Aînés.
  const labelStyle = {
    ...theme.typography.etiquette,
    fontFamily: theme.typography.bouton.fontFamily,
  };

  const pill = (
    <Animated.View
      style={[
        styles.pill,
        {
          minHeight: metrics.chip.minHeight,
          paddingHorizontal: metrics.chip.paddingHorizontal,
          gap: metrics.chip.gap,
          borderRadius: metrics.round,
          backgroundColor: tint.background,
        },
        tint.outline !== undefined && {
          borderWidth: metrics.chip.outlineWidth,
          borderColor: tint.outline,
        },
        onPress !== undefined && { transform: [{ scale }] },
        focusStyle,
      ]}
    >
      {shownIcon !== undefined && (
        <Icon name={shownIcon} size={metrics.chip.iconSize} color={tint.text} />
      )}
      <Text style={[labelStyle, styles.label, { color: tint.text }]}>{label}</Text>
    </Animated.View>
  );

  if (onPress === undefined) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        style={styles.wrapper}
      >
        {pill}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      hitSlop={hitSlopFor(metrics.chip.minHeight, theme.touchTarget)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={[styles.wrapper, { minWidth: theme.touchTarget }]}
    >
      {pill}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flexShrink: 1,
  },
});
