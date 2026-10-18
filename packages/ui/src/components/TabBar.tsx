// Barre d'onglets (components/BarreOnglets) : la navigation principale, en bas de l'écran. Icônes
// de 28 (`icone-l`) et libellés `legende` ; actif en `action` et graisse 600, inactif en
// `texte-secondaire`. Posée sur `fond-carte`, avec un `filet` en haut, au-dessus de l'indicateur
// d'accueil du téléphone (`bottomInset`). Le composant ne connaît pas la navigation : l'app lui
// donne les onglets de la version (ordre de la charte : Arbre, Famille, Santé, Mémoire) et réagit
// à `onSelect`. Le libellé grossit avec le texte du téléphone jusqu'à 200 %, pas au-delà : à cette
// taille quatre libellés tiennent encore sur une ligne (09-accessibilite.md).
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { TreeSymbol } from '../icons/TreeSymbol';
import { size, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';
import { usePressScale } from './motion';

/** Une icône du jeu Lignée, ou le symbole compact de l'onglet Arbre. */
export type TabBarIcon = IconName | 'treeSymbol';

export interface TabBarItem {
  /** Identifiant stable de l'onglet, passé à `onSelect`. */
  readonly key: string;
  /** Libellé déjà traduit, affiché et lu. */
  readonly label: string;
  /** Ce que fait l'onglet, lu après le libellé (« Affiche votre arbre. »). */
  readonly hint?: string;
  readonly icon: TabBarIcon;
  readonly testID?: string;
}

export interface TabBarProps {
  readonly items: readonly TabBarItem[];
  /** Clé de l'onglet courant. */
  readonly activeKey: string;
  readonly onSelect: (key: string) => void;
  /** Zone de l'indicateur d'accueil du téléphone, en dp (`useSafeAreaInsets().bottom`). */
  readonly bottomInset?: number;
  readonly testID?: string;
}

function TabBarButton({
  item,
  focused,
  onPress,
}: {
  readonly item: TabBarItem;
  readonly focused: boolean;
  readonly onPress: () => void;
}) {
  const { colors, typography, touchTarget } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  const color = focused ? colors.action : colors.texteSecondaire;
  return (
    <Pressable
      testID={item.testID}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityHint={item.hint}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      style={[styles.item, { minHeight: touchTarget, paddingVertical: space[2] }, focusStyle]}
    >
      <Animated.View style={[styles.content, { gap: space[1], transform: [{ scale }] }]}>
        {item.icon === 'treeSymbol' ? (
          <TreeSymbol size={size.iconeL} color={color} />
        ) : (
          <Icon name={item.icon} size={size.iconeL} color={color} />
        )}
        <Text
          maxFontSizeMultiplier={metrics.tabBar.labelMaxFontScale}
          style={[
            typography.legende,
            focused && { fontFamily: typography.bouton.fontFamily },
            { color, textAlign: 'center' },
          ]}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ items, activeKey, onSelect, bottomInset = 0, testID }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.fondCarte,
          borderTopColor: colors.filet,
          paddingBottom: bottomInset,
          paddingHorizontal: space.margeEcran,
          gap: space[2],
        },
      ]}
    >
      {items.map((item) => (
        <TabBarButton
          key={item.key}
          item={item}
          focused={item.key === activeKey}
          onPress={() => {
            if (item.key !== activeKey) onSelect(item.key);
          }}
        />
      ))}
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
  content: {
    alignItems: 'center',
  },
});
