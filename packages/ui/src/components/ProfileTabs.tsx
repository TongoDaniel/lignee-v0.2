// Onglets de fiche (components/OngletsFiche) : les rubriques de la fiche d'une personne (Souvenirs,
// Documents, Santé). Libellés en 16 ; l'actif passe en graisse 600, `texte`, avec un trait de 4 px
// en `action` sous le mot ; les autres sont en `texte-secondaire`. Le trait glisse en 240 ms
// (courbe d'entrée et de sortie) ; avec « Réduire les animations », il apparaît en fondu de 150 ms.
// Le composant ne décide pas des rubriques affichées : l'écran donne celles de la version et des
// droits (la rubrique Santé n'affiche son contenu qu'à qui l'a renseignée, ou après accord).
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { motion } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';
import { timing } from './motion';

export interface ProfileTab {
  /** Identifiant stable (`memories`, `documents`, `health`), passé à `onChange`. */
  readonly key: string;
  /** Libellé déjà traduit. */
  readonly label: string;
  readonly accessibilityHint?: string;
}

export interface ProfileTabsProps {
  readonly tabs: readonly ProfileTab[];
  /** Clé de l'onglet affiché. */
  readonly active: string;
  readonly onChange: (key: string) => void;
  readonly testID?: string;
}

function TabItem({
  tab,
  selected,
  onPress,
  testID,
}: {
  readonly tab: ProfileTab;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const { colors, typography, textScale, touchTarget } = useTheme();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityHint={tab.accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={[
        styles.item,
        {
          minHeight: touchTarget,
          paddingTop: metrics.profileTabs.paddingTop,
          paddingBottom: metrics.profileTabs.paddingBottom,
        },
        focusStyle,
      ]}
    >
      <Text
        style={{
          fontFamily: selected ? typography.bouton.fontFamily : typography.etiquette.fontFamily,
          fontSize: metrics.profileTabs.fontSize * textScale,
          lineHeight: metrics.profileTabs.lineHeight * textScale,
          color: selected ? colors.texte : colors.texteSecondaire,
          textAlign: 'center',
        }}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function ProfileTabs({ tabs, active, onChange, testID }: ProfileTabsProps) {
  const { colors, reduceMotion } = useTheme();
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === active),
  );
  const slotWidth = tabs.length === 0 ? 0 : width / tabs.length;
  const indicatorWidth = Math.min(metrics.profileTabs.indicatorWidth, slotWidth);
  const target = activeIndex * slotWidth + (slotWidth - indicatorWidth) / 2;
  const x = useRef(new Animated.Value(target)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (width === 0) return;
    if (!placed.current) {
      // Première mesure : le trait se pose sans glisser.
      placed.current = true;
      x.setValue(target);
      return;
    }
    const slide = timing(motion.duration.transition, 'entreeSortie', reduceMotion);
    if (slide.move) {
      Animated.timing(x, {
        toValue: target,
        duration: slide.duration,
        easing: slide.easing,
        useNativeDriver: true,
      }).start();
    } else {
      x.setValue(target);
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: slide.duration,
        easing: slide.easing,
        useNativeDriver: true,
      }).start();
    }
  }, [target, width, reduceMotion, x, fade]);

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      style={[
        styles.row,
        {
          backgroundColor: colors.fondCarte,
          borderBottomWidth: metrics.profileTabs.ruleWidth,
          borderBottomColor: colors.filet,
        },
      ]}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          selected={tab.key === active}
          onPress={() => {
            if (tab.key !== active) onChange(tab.key);
          }}
          {...(testID === undefined ? {} : { testID: `${testID}-${tab.key}` })}
        />
      ))}
      {width > 0 && (
        <Animated.View
          testID={testID === undefined ? undefined : `${testID}-indicator`}
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: indicatorWidth,
              height: metrics.profileTabs.indicatorHeight,
              borderRadius: metrics.profileTabs.indicatorRadius,
              backgroundColor: colors.action,
              bottom: -metrics.profileTabs.ruleWidth,
              opacity: fade,
              transform: [{ translateX: x }],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
  },
});
