// Notification (components/Notification) : la bannière d'une notification de l'app, telle qu'elle
// apparaît sur le téléphone ou en haut de l'app. Icône d'app (symbole or sur `vert-700`), surtitre
// en capitales espacées, titre en 17 graisse 700 (la personne d'abord, l'action ensuite), texte
// `secondaire` qui invite à ouvrir. Jamais de donnée de santé ni de date de naissance complète :
// c'est à l'écran, ou au serveur, de ne pas les mettre dans `title` et `text`. Une notification
// par événement ; les ajouts en série se regroupent (« 12 personnes ») avant d'arriver ici.
// Lue d'un bloc : surtitre, titre, texte, moment.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '../logo/Logo';
import { palette, radius } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';

export interface NotificationProps {
  /** Nom de l'app en surtitre (« Lignée »), déjà traduit ; affiché en capitales. */
  readonly appName: string;
  /** La personne d'abord, l'action ensuite (« Odette a ajouté une photo »). */
  readonly title: string;
  /** Une phrase qui invite à ouvrir. */
  readonly text?: string;
  /** Moment (« maintenant », « 14 h 05 »), déjà formaté. */
  readonly time?: string;
  /** Rend la bannière touchable : elle ouvre l'événement. */
  readonly onPress?: () => void;
  /** Libellé complet pour le lecteur d'écran ; par défaut surtitre, titre, texte et moment. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

export function Notification({
  appName,
  title,
  text,
  time,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: NotificationProps) {
  const { colors, typography, shadows, touchTarget } = useTheme();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  const spoken =
    accessibilityLabel ??
    [appName, title, text, time].filter((part) => part !== undefined).join('. ');
  const m = metrics.notification;

  const banner = (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.fondCarte,
          borderRadius: radius.carte,
          boxShadow: shadows.flottante.boxShadow,
          padding: m.padding,
          gap: m.gap,
          minHeight: touchTarget,
        },
        onPress !== undefined && focusStyle,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.appIcon,
          {
            width: m.iconBoxSize,
            height: m.iconBoxSize,
            borderRadius: m.iconBoxRadius,
            backgroundColor: palette.vert700,
          },
        ]}
      >
        <Logo variant="symbol" height={m.iconSize} label={appName} background="nuit" />
      </View>
      <View style={styles.body}>
        <View style={[styles.top, { gap: m.padding }]}>
          <Text style={[typography.surtitre, styles.kicker, { color: colors.texteSecondaire }]}>
            {appName}
          </Text>
          {time !== undefined && (
            <Text style={[typography.legende, { color: colors.texteSecondaire }]}>{time}</Text>
          )}
        </View>
        <Text
          style={[
            typography.titreCarte,
            {
              fontFamily: typography.titreEcran.fontFamily,
              color: colors.texte,
              marginTop: m.titleGap,
            },
          ]}
        >
          {title}
        </Text>
        {text !== undefined && (
          <Text
            style={[typography.secondaire, { color: colors.texteSecondaire, marginTop: m.textGap }]}
          >
            {text}
          </Text>
        )}
      </View>
    </View>
  );

  if (onPress === undefined) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={spoken}
        accessibilityHint={accessibilityHint}
      >
        {banner}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
    >
      {banner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  appIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kicker: {
    textTransform: 'uppercase',
    flexShrink: 1,
  },
});
