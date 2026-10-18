// Ligne de réglage (components/LigneReglage) : une ligne de liste qui ouvre un écran. Icône à la
// couleur de son domaine, libellé `titre-carte`, valeur facultative, chevron `suivant` en
// `texte-secondaire`. 60 de haut au moins. Les lignes d'un même groupe sont dans une seule carte
// (SettingsGroup), séparées par un filet qui commence après l'icône.
import { Children, isValidElement, cloneElement, type ReactElement, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { radius, size, space } from '../tokens';
import { useTheme, type UiTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';
import { usePressScale } from './motion';

/** Couleur de l'icône, selon le domaine du réglage (README de LigneReglage). */
export type SettingsIconTone =
  'text' | 'action' | 'celebrate' | 'healthText' | 'memory' | 'kinship' | 'documents';

export interface SettingsRowProps {
  readonly icon: IconName;
  readonly iconTone?: SettingsIconTone;
  /** Nom du réglage, déjà traduit. */
  readonly label: string;
  /** Valeur courte à droite (« Activé », « Français »). */
  readonly value?: string;
  readonly onPress: () => void;
  /** Ce qui s'ouvre, si ce n'est pas évident. */
  readonly accessibilityHint?: string;
  /** Filet au-dessus de la ligne ; posé par SettingsGroup sur toutes les lignes sauf la première. */
  readonly separator?: boolean;
  readonly testID?: string;
}

function iconColor(tone: SettingsIconTone, { colors }: UiTheme): string {
  switch (tone) {
    case 'text':
      return colors.texte;
    case 'action':
      return colors.action;
    case 'celebrate':
      return colors.fete;
    case 'healthText':
      return colors.santeTexte;
    case 'memory':
      return colors.memoire;
    case 'kinship':
      return colors.parente;
    case 'documents':
      return colors.documents;
  }
}

export function SettingsRow({
  icon,
  iconTone = 'text',
  label,
  value,
  onPress,
  accessibilityHint,
  separator = false,
  testID,
}: SettingsRowProps) {
  const theme = useTheme();
  const { colors, typography, touchTarget } = theme;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  // Le lecteur d'écran lit le réglage et sa valeur : « Langue, Français ».
  const fullLabel = value === undefined ? label : [label, value].join(', ');
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityHint={accessibilityHint}
      style={focusStyle}
    >
      <Animated.View
        style={[
          styles.row,
          {
            minHeight: Math.max(metrics.settingsRow.minHeight, touchTarget),
            paddingLeft: metrics.settingsRow.paddingLeft,
            paddingRight: metrics.settingsRow.paddingRight,
            gap: metrics.settingsRow.gap,
            transform: [{ scale }],
          },
        ]}
      >
        <Icon name={icon} color={iconColor(iconTone, theme)} />
        <View
          style={[
            styles.body,
            { gap: space[3], paddingVertical: space[3] },
            separator && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.filet },
          ]}
        >
          <Text style={[typography.titreCarte, styles.label, { color: colors.texte }]}>
            {label}
          </Text>
          {value !== undefined && (
            <Text style={[typography.secondaire, styles.value, { color: colors.texteSecondaire }]}>
              {value}
            </Text>
          )}
          <Icon name="suivant" size={size.iconeS} color={colors.texteSecondaire} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export interface SettingsGroupProps {
  /** Des SettingsRow : le groupe pose les filets entre elles. */
  readonly children: ReactNode;
  readonly testID?: string;
}

/** Un groupe de lignes de réglage, dans une seule carte. */
export function SettingsGroup({ children, testID }: SettingsGroupProps) {
  const { colors, shadows } = useTheme();
  let index = 0;
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.fondCarte,
        borderRadius: radius.carte,
        boxShadow: shadows.carte.boxShadow,
        paddingVertical: metrics.settingsRow.groupPaddingVertical,
      }}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const separator = index > 0;
        index += 1;
        return cloneElement(child as ReactElement<SettingsRowProps>, { separator });
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
