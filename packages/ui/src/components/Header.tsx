// En-tête (components/EnTete) : le haut de chaque écran. Titre (`titre-ecran`), sous-titre
// facultatif, une seule action à droite (un Bouton compact, ou la photo du profil), et l'icône
// `retour` à gauche pour les écrans de détail. Le titre passe à la ligne au lieu d'être coupé.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../icons/Icon';
import { space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';

/** Retour à l'écran précédent : l'action et son libellé (« Revenir en arrière »), déjà traduit. */
export interface HeaderBack {
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
}

export interface HeaderProps {
  /** Où l'on est, en un ou deux mots (« Mon arbre », « Famille »). Déjà traduit. */
  readonly title: string;
  readonly subtitle?: string;
  /** Affiche l'icône `retour` à gauche. */
  readonly back?: HeaderBack;
  /** Une seule action : un Bouton compact, ou la photo du profil. */
  readonly action?: ReactNode;
  readonly testID?: string;
}

export function Header({ title, subtitle, back, action, testID }: HeaderProps) {
  const { colors, typography, touchTarget } = useTheme();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        {
          gap: space[3],
          paddingTop: space[4],
          paddingHorizontal: space.margeEcran,
          paddingBottom: space[3],
        },
      ]}
    >
      {back !== undefined && (
        <Pressable
          testID={testID === undefined ? undefined : `${testID}-back`}
          onPress={back.onPress}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityRole="button"
          accessibilityLabel={back.accessibilityLabel}
          accessibilityHint={back.accessibilityHint}
          style={[
            styles.back,
            { minWidth: touchTarget, minHeight: touchTarget, borderRadius: metrics.round },
            focusStyle,
          ]}
        >
          <Icon name="retour" />
        </Pressable>
      )}
      <View style={[styles.texts, { gap: metrics.header.subtitleGap }]}>
        <Text accessibilityRole="header" style={[typography.titreEcran, { color: colors.texte }]}>
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text
            style={[
              typography.secondaire,
              { fontFamily: typography.etiquette.fontFamily, color: colors.texteSecondaire },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {action !== undefined && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  back: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  action: {
    flexShrink: 0,
  },
});
