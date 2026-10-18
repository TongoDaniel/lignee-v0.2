// Barre d'onglets principale (charte, components/BarreOnglets) : posée sur `fondCarte` avec un
// filet en haut, au-dessus de l'indicateur d'accueil du téléphone ; icônes de 28 (`iconeL`),
// libellés `legende`, actif en `action` et graisse 600, inactif en `texteSecondaire`.
// Elle rejoindra @lignee/ui sous le nom BarreOnglets avec les composants de navigation (T-015).
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslator } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { motion, size, space, type FontName } from '@lignee/ui';
import { mainTabs } from './tabs';

/** Au-delà, le libellé ne tiendrait plus sur une ligne (09-accessibilite.md, « Mise en œuvre »). */
const TAB_LABEL_MAX_FONT_SCALE = 2;

/** Graisse 600 de l'onglet actif : une police à part sur Android (11-react-native.md, « Polices »). */
const ACTIVE_LABEL_FONT: FontName = 'InstrumentSans-SemiBold';

export function MainTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useTranslator();
  const { colors, typography } = theme;

  return (
    <View
      testID="main-tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.fondCarte,
          borderTopColor: colors.filet,
          paddingBottom: insets.bottom,
          paddingHorizontal: space.margeEcran,
          gap: space[2],
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = mainTabs.find((candidate) => candidate.route === route.name);
        if (tab === undefined) return null;
        const focused = state.index === index;
        const label = t(tab.label);
        const color = focused ? colors.action : colors.texteSecondaire;

        const onPress = (): void => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityHint={t(tab.hint)}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={({ pressed }) => [
              styles.item,
              {
                minHeight: theme.touchTarget,
                paddingVertical: space[2],
                gap: space[1],
                transform: [{ scale: pressed ? motion.echelleAppui : 1 }],
              },
            ]}
          >
            <tab.Icon size={size.iconeL} color={color} />
            <Text
              maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
              style={[
                typography.legende,
                focused && { fontFamily: ACTIVE_LABEL_FONT },
                { color, textAlign: 'center' },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
