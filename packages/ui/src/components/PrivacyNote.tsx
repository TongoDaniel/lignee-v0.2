// Mention de confidentialité (components/MentionPrivee) : dit qui peut voir une information, à
// côté de cette information. Elle accompagne toute donnée sensible : santé, coordonnées, date de
// naissance d'une personne vivante. Le texte est toujours explicite (« Visible par vous seul »,
// jamais « Privé ») : il arrive en props, déjà traduit, avec le nom de l'arbre ou des personnes
// quand le cercle en a besoin. Rien ne bouge ni ne rebondit ici.
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { metrics } from './metrics';

/** Qui voit : `you` vous seul, `family` un arbre familial (icône `famille`), le reste en cadenas. */
export type PrivacyCircle = 'you' | 'family' | 'managers' | 'people';

export interface PrivacyNoteProps {
  /** Phrase explicite, déjà traduite (« Visible par vous seul », « Visible par la famille Martin »). */
  readonly label: string;
  /** Le cercle choisit l'icône : `famille` pour un cercle familial, `prive` sinon. */
  readonly circle?: PrivacyCircle;
  /** Donnée de santé : texte en `sante-texte`. */
  readonly health?: boolean;
  readonly testID?: string;
}

export function PrivacyNote({ label, circle = 'you', health = false, testID }: PrivacyNoteProps) {
  const { colors, typography } = useTheme();
  const icon: IconName = circle === 'family' ? 'famille' : 'prive';
  const ink = health ? colors.santeTexte : colors.texteSecondaire;
  return (
    <View testID={testID} style={[styles.row, { gap: metrics.privacyNote.gap }]}>
      <Icon name={icon} size={metrics.privacyNote.iconSize} color={ink} />
      <Text style={[typography.etiquette, styles.text, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    flexShrink: 1,
  },
});
