// Carte (components/Carte) : le bloc de contenu de l'app, `fondCarte`, `rayon-carte`, `ombre-carte`,
// marge intérieure `espace-5`. Elle se pose sur `fond` ; jamais une carte dans une carte, jamais de
// bordure colorée sur un côté ni de dégradé. Elle s'allonge avec le texte (aucune hauteur fixe).
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { radius, space } from '../tokens';
import { useTheme, type UiTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';
import { usePressScale } from './motion';

/** Teinte douce de la vignette, selon le type de contenu. */
export type CardThumbnailTone = 'celebrate' | 'memory' | 'documents' | 'kinship';

export interface CardProps {
  /** Titre de la carte (`titre-carte`), déjà traduit. */
  readonly title?: string;
  /** Texte secondaire (`secondaire`, en `texte-secondaire`). */
  readonly text?: string;
  /** Vignette de 52 à gauche : une icône sur la teinte douce du type de contenu. */
  readonly thumbnail?: { readonly icon: IconName; readonly tone: CardThumbnailTone };
  /** Toute la carte s'ouvre : elle devient un bouton. */
  readonly onPress?: () => void;
  /** Libellé pour le lecteur d'écran si la carte se touche ; par défaut titre et texte. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly children?: ReactNode;
  readonly testID?: string;
}

function thumbnailColors(tone: CardThumbnailTone, { colors }: UiTheme) {
  switch (tone) {
    case 'celebrate':
      return { background: colors.feteDouce, icon: colors.feteTexte };
    case 'memory':
      return { background: colors.memoireDouce, icon: colors.memoireTexte };
    case 'documents':
      return { background: colors.documentsDouce, icon: colors.documents };
    case 'kinship':
      return { background: colors.parenteDouce, icon: colors.parente };
  }
}

export function Card({
  title,
  text,
  thumbnail,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  testID,
}: CardProps) {
  const theme = useTheme();
  const { colors, typography, shadows } = theme;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  const thumb = thumbnail === undefined ? undefined : thumbnailColors(thumbnail.tone, theme);

  const body = (
    <Animated.View
      style={[
        {
          backgroundColor: colors.fondCarte,
          borderRadius: radius.carte,
          boxShadow: shadows.carte.boxShadow,
          padding: space[5],
          gap: space[4],
        },
        onPress !== undefined && { transform: [{ scale }] },
        focusStyle,
      ]}
    >
      {(title !== undefined || text !== undefined || thumbnail !== undefined) && (
        <View style={[styles.row, { gap: space[4] }]}>
          {thumbnail !== undefined && thumb !== undefined && (
            <View
              style={[
                styles.thumbnail,
                {
                  width: metrics.card.thumbnailSize,
                  height: metrics.card.thumbnailSize,
                  borderRadius: metrics.card.thumbnailRadius,
                  backgroundColor: thumb.background,
                },
              ]}
            >
              <Icon name={thumbnail.icon} color={thumb.icon} />
            </View>
          )}
          <View style={[styles.texts, { gap: metrics.card.textGap }]}>
            {title !== undefined && (
              <Text style={[typography.titreCarte, { color: colors.texte }]}>{title}</Text>
            )}
            {text !== undefined && (
              <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>{text}</Text>
            )}
          </View>
        </View>
      )}
      {children}
    </Animated.View>
  );

  if (onPress === undefined) {
    return <View testID={testID}>{body}</View>;
  }

  const defaultLabel = [title, text].filter((part) => part !== undefined).join(', ');
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? defaultLabel}
      accessibilityHint={accessibilityHint}
      style={{ minHeight: theme.touchTarget }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
});
