// Toast (components/Toast) : une confirmation brève, en pilule sombre (`notification`), coche
// dorée. Apparition 300 ms (courbe de sortie), présence 2,5 s, disparition 300 ms. En mode Aînés,
// ou si `persistent`, il reste jusqu'à ce que la personne le ferme (09-accessibilite.md). Le
// message dit le résultat (« Lucienne a rejoint l'arbre »). Pas de toast pour une erreur.
// Annoncé au lecteur d'écran : rôle « status » et région vivante polie (Android), annonce
// explicite sur iOS. Quand le téléphone demande de
// réduire les animations, il apparaît et disparaît en fondu de 150 ms, sans glisser.
// Le composant dessine la pilule ; l'écran la place (en bas, au-dessus de la barre d'onglets).
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '../icons/Icon';
import { motion, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { metrics } from './metrics';
import { timing } from './motion';

export interface ToastProps {
  /** Ce qui vient de se passer, en une phrase courte, déjà traduite. */
  readonly message: string;
  /** Affiché ou non ; passez à faux pour le fermer. */
  readonly visible: boolean;
  /** Appelé quand le toast a fini de disparaître (fin de présence ou bouton Fermer). */
  readonly onHide: () => void;
  /** Libellé du bouton qui ferme un toast persistant (« Fermer »), déjà traduit. */
  readonly closeLabel: string;
  /** Indication du bouton Fermer, si utile. */
  readonly closeHint?: string;
  /** Reste affiché jusqu'à ce qu'on le ferme ; toujours vrai en mode Aînés. */
  readonly persistent?: boolean;
  readonly testID?: string;
}

export function Toast({
  message,
  visible,
  onHide,
  closeLabel,
  closeHint,
  persistent = false,
  testID,
}: ToastProps) {
  const { colors, typography, shadows, seniorMode, reduceMotion, touchTarget } = useTheme();
  const stays = persistent || seniorMode;
  const progress = useRef(new Animated.Value(0)).current;
  // Monté tant qu'il est visible ou en train de disparaître.
  const [shown, setShown] = useState(visible);
  // Fermé par la personne, ou à la fin de sa présence, avant que l'écran ne le retire.
  const [dismissed, setDismissed] = useState(false);
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);
  const wanted = visible && !dismissed;

  // Un nouveau toast (visible repasse à vrai, ou autre message) annule la fermeture précédente.
  useEffect(() => {
    if (visible) setDismissed(false);
  }, [visible, message]);

  useEffect(() => {
    if (!wanted) return;
    setShown(true);
    // Android annonce déjà le toast par sa région vivante (accessibilityLiveRegion) : l'annonce
    // explicite ne sert qu'à iOS, sinon TalkBack le lirait deux fois.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
    const enter = timing(motion.duration.toastApparition, 'sortie', reduceMotion);
    const appear = Animated.timing(progress, {
      toValue: 1,
      duration: enter.duration,
      easing: enter.easing,
      useNativeDriver: true,
    });
    appear.start();
    const timer = stays
      ? undefined
      : setTimeout(() => {
          setDismissed(true);
        }, enter.duration + motion.duration.toastPresence);
    return () => {
      appear.stop();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [wanted, stays, reduceMotion, message, progress]);

  useEffect(() => {
    if (wanted || !shown) return;
    // Disparition : courbe d'entrée-sortie (la charte n'a pas de jeton pour la courbe « entrée »).
    const leave = timing(motion.duration.toastDisparition, 'entreeSortie', reduceMotion);
    const disappear = Animated.timing(progress, {
      toValue: 0,
      duration: leave.duration,
      easing: leave.easing,
      useNativeDriver: true,
    });
    disappear.start(({ finished }) => {
      if (!finished) return;
      setShown(false);
      onHideRef.current();
    });
    return () => {
      disappear.stop();
    };
  }, [wanted, shown, reduceMotion, progress]);

  const enterMoves = !reduceMotion;

  if (!shown && !wanted) return null;

  const translateY = enterMoves
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [metrics.toast.enterOffset, 0] })
    : 0;

  return (
    <Animated.View
      testID={testID}
      role="status"
      accessibilityLiveRegion="polite"
      style={[
        styles.pill,
        {
          minHeight: metrics.toast.minHeight,
          paddingLeft: metrics.toast.paddingLeft,
          paddingRight: stays ? space[1] : metrics.toast.paddingRight,
          gap: space[3],
          borderRadius: metrics.round,
          backgroundColor: colors.notification,
          boxShadow: shadows.flottante.boxShadow,
          opacity: progress,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.check,
          {
            width: metrics.toast.checkSize,
            height: metrics.toast.checkSize,
            borderRadius: metrics.round,
            backgroundColor: metrics.toast.checkBackground,
          },
        ]}
      >
        <Icon name="valider" size={metrics.toast.checkIconSize} color={metrics.toast.checkColor} />
      </View>
      <Text
        style={[
          typography.bouton,
          {
            fontSize: typography.secondaire.fontSize,
            lineHeight: typography.secondaire.lineHeight,
            paddingVertical: space[2],
          },
          styles.message,
          { color: colors.surNotification },
        ]}
      >
        {message}
      </Text>
      {stays && (
        <Pressable
          testID={testID === undefined ? undefined : `${testID}-close`}
          onPress={() => {
            setDismissed(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          accessibilityHint={closeHint}
          style={[styles.close, { minWidth: touchTarget, minHeight: touchTarget }]}
        >
          <Icon name="fermer" color={colors.surNotification} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  check: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flexShrink: 1,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
