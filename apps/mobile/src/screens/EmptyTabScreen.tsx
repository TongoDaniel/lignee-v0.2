// Écran d'onglet encore vide (T-011) : titre d'écran et phrase d'attente, lisibles jusqu'à
// 200 % de texte (défilement, aucune hauteur fixe, aucune ligne coupée).
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { space } from '@lignee/ui';

export interface EmptyTabScreenProps {
  readonly title: string;
  readonly message: string;
  readonly testID: string;
}

export function EmptyTabScreen({ title, message, testID }: EmptyTabScreenProps) {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: colors.fond }}
      contentContainerStyle={{
        paddingTop: insets.top + space[6],
        paddingHorizontal: space.margeEcran,
        paddingBottom: space[6],
        gap: space[3],
      }}
    >
      <Text accessibilityRole="header" style={[typography.titreEcran, { color: colors.texte }]}>
        {title}
      </Text>
      <Text style={[typography.corps, { color: colors.texteSecondaire }]}>{message}</Text>
    </ScrollView>
  );
}
