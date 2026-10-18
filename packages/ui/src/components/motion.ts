// Mouvement des composants (07-mouvement.md) : durées et courbes de `motion`, et leur version
// réduite quand le téléphone demande de réduire les animations (tout déplacement devient un fondu
// de 150 ms, sans rebond). Aucun composant de base ne rebondit : `rebondLeger` est réservé à une
// personne qui apparaît dans l'arbre.
import { useEffect, useRef } from 'react';
import { Animated, Easing, type EasingFunction } from 'react-native';

import { motion } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

export type CurveName = 'sortie' | 'entreeSortie';

export function curve(name: CurveName): EasingFunction {
  const [x1, y1, x2, y2] = motion.easing[name];
  return Easing.bezier(x1, y1, x2, y2);
}

/** Paramètres d'une animation, déjà adaptés au réglage « Réduire les animations ». */
export interface Timing {
  readonly duration: number;
  readonly easing: EasingFunction;
  /** Faux quand le déplacement doit être remplacé par un fondu. */
  readonly move: boolean;
}

export function timing(duration: number, curveName: CurveName, reduceMotion: boolean): Timing {
  if (reduceMotion) {
    return { duration: motion.duration.fonduReduit, easing: curve('sortie'), move: false };
  }
  return { duration, easing: curve(curveName), move: true };
}

/**
 * Retour au toucher : le contrôle se réduit à 97 % en 120 ms, courbe de sortie. Rien quand le
 * téléphone demande de réduire les animations.
 */
export function usePressScale(): {
  readonly scale: Animated.Value;
  readonly onPressIn: () => void;
  readonly onPressOut: () => void;
} {
  const { reduceMotion } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => () => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: value,
      duration: motion.duration.toucher,
      easing: curve('sortie'),
      useNativeDriver: true,
    }).start();
  };
  useEffect(() => {
    if (reduceMotion) scale.setValue(1);
  }, [reduceMotion, scale]);
  return { scale, onPressIn: to(motion.echelleAppui), onPressOut: to(1) };
}
