// Interrupteur (components/Interrupteur) : active ou désactive une option, avec effet immédiat.
// Piste de 54 × 32, pastille blanche de 25. Éteint : piste `filet-fort` et contour `bordure-champ`.
// Allumé : piste `action`, ou `sante` pour le calque santé (avec l'icône `sante` : jamais la
// couleur seule). La pastille glisse en 240 ms, courbe entrée-sortie ; sans rebond. Quand le
// téléphone demande de réduire les animations, elle change de place sans glisser.
// Toute la ligne est touchable et annoncée comme un interrupteur, avec son état.
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../icons/Icon';
import { motion, opacity, space, stroke } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { metrics } from './metrics';
import { curve } from './motion';

export interface SwitchProps {
  /** Décrit l'option, pas l'état : « Option Cousins », pas « Activer… ». Déjà traduit. */
  readonly label: string;
  /** Une ligne d'explication, lue aussi par le lecteur d'écran. */
  readonly description?: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  /** Interrupteur du calque santé : piste corail quand il est actif, icône `sante`. */
  readonly health?: boolean;
  readonly disabled?: boolean;
  readonly testID?: string;
}

const THUMB_INSET = (metrics.switch.trackHeight - metrics.switch.thumbSize) / 2;
const THUMB_TRAVEL = metrics.switch.trackWidth - metrics.switch.thumbSize - 2 * THUMB_INSET;

export function Switch({
  label,
  description,
  value,
  onValueChange,
  health = false,
  disabled = false,
  testID,
}: SwitchProps) {
  const theme = useTheme();
  const { colors, typography, touchTarget, reduceMotion } = theme;
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(value ? 1 : 0);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: value ? 1 : 0,
      duration: motion.duration.changementEtat,
      easing: curve('entreeSortie'),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [value, reduceMotion, position]);

  const onColor = health ? colors.sante : colors.action;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        onValueChange(!value);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.row,
        {
          minHeight: touchTarget,
          gap: space[3],
          paddingVertical: space[2],
          opacity: disabled ? opacity.desactive : 1,
        },
        focusStyle,
      ]}
    >
      {health && <Icon name="sante" color={colors.sante} />}
      <View style={[styles.texts, { gap: metrics.card.textGap }]}>
        <Text style={[typography.titreCarte, { color: colors.texte }]}>{label}</Text>
        {description !== undefined && (
          <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>
            {description}
          </Text>
        )}
      </View>
      <View
        testID={testID === undefined ? undefined : `${testID}-track`}
        style={[
          styles.track,
          {
            width: metrics.switch.trackWidth,
            height: metrics.switch.trackHeight,
            borderRadius: metrics.round,
            backgroundColor: value ? onColor : colors.filetFort,
            borderWidth: value ? 0 : stroke.champ,
            borderColor: colors.bordureChamp,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              top: THUMB_INSET - (value ? 0 : stroke.champ),
              left: THUMB_INSET - (value ? 0 : stroke.champ),
              width: metrics.switch.thumbSize,
              height: metrics.switch.thumbSize,
              borderRadius: metrics.round,
              backgroundColor: metrics.switch.thumbColor,
              boxShadow: metrics.switch.thumbShadow,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, THUMB_TRAVEL],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  texts: {
    flex: 1,
  },
  track: {
    flexShrink: 0,
  },
  thumb: {
    position: 'absolute',
  },
});
