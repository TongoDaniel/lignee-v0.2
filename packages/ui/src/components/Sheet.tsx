// Feuille (components/Feuille) : un panneau qui monte du bas pour une tâche courte, sans quitter
// l'écran. Coins hauts `rayon-feuille`, poignée de 48 × 5, `ombre-feuille`, voile `voile` derrière.
// Elle monte en 360 ms, courbe de sortie, et suit le doigt quand on la tire par la poignée ;
// relâchée, elle se pose avec la courbe de sortie, ou se ferme si on l'a assez tirée. Elle se ferme
// aussi en touchant le voile, avec le bouton retour d'Android et avec le geste « échappement » du
// lecteur d'écran. Sur iOS, la feuille est modale (accessibilityViewIsModal) : VoiceOver ne propose
// pas le voile, d'où le geste « échappement ». Sur Android, TalkBack atteint le voile, un bouton
// nommé par `closeLabel` (« Fermer »).
// Quand le téléphone demande de réduire les animations, elle apparaît et disparaît en fondu de
// 150 ms, sans glisser.
// Le contenu défile : à 200 % de texte, rien n'est coupé.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion, radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { metrics } from './metrics';
import { curve, timing } from './motion';

export interface SheetProps {
  /** Ouverte ou fermée. */
  readonly visible: boolean;
  /** La tâche, déjà traduite (« Inviter vos proches »). */
  readonly title: string;
  readonly subtitle?: string;
  /** Fermeture demandée : voile touché, feuille tirée vers le bas, bouton retour. */
  readonly onClose: () => void;
  /** Libellé du voile pour le lecteur d'écran (« Fermer »), déjà traduit. */
  readonly closeLabel: string;
  /** Indication du voile (« Ferme la feuille sans enregistrer »), si utile. */
  readonly closeHint?: string;
  /** Contenu : champs, choix, et une action principale (Bouton). */
  readonly children: ReactNode;
  readonly testID?: string;
}

/** Ce dont le geste de la poignée a besoin ; séparé du composant pour être testé seul. */
export interface SheetPanOptions {
  /** Déplacement du doigt vers le bas, en dp. */
  readonly drag: Animated.Value;
  readonly getHeight: () => number;
  readonly isVisible: () => boolean;
  readonly onClose: () => void;
}

/**
 * Geste de la poignée : la feuille suit le doigt vers le bas ; relâchée au-delà d'un quart de sa
 * hauteur, elle demande sa fermeture, sinon elle se repose. Si l'écran ne la ferme pas (il garde
 * `visible` à vrai après `onClose`), elle se repose aussi, au lieu de rester à mi-course.
 */
export function sheetPanHandlers({ drag, getHeight, isVisible, onClose }: SheetPanOptions) {
  const settle = (): void => {
    Animated.timing(drag, {
      toValue: 0,
      duration: motion.duration.transition,
      easing: curve('sortie'),
      useNativeDriver: true,
    }).start();
  };
  return {
    onMoveShouldSetPanResponder: (_event: unknown, gesture: PanResponderGestureState) =>
      gesture.dy > Math.abs(gesture.dx),
    onPanResponderMove: (_event: unknown, gesture: PanResponderGestureState) => {
      drag.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_event: unknown, gesture: PanResponderGestureState) => {
      if (gesture.dy <= getHeight() * metrics.sheet.dismissRatio) {
        settle();
        return;
      }
      onClose();
      // L'écran met à jour `visible` au rendu suivant : on regarde après.
      setTimeout(() => {
        if (isVisible()) settle();
      }, 0);
    },
  };
}

export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  closeLabel,
  closeHint,
  children,
  testID,
}: SheetProps) {
  const { colors, typography, shadows, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  // 0 : fermée (hors de l'écran ou transparente), 1 : posée.
  const progress = useRef(new Animated.Value(0)).current;
  // Déplacement du doigt vers le bas, en dp.
  const drag = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(windowHeight * metrics.sheet.maxHeightRatio);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (visible) setMounted(true);
    const t = timing(motion.duration.feuille, 'sortie', reduceMotion);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: t.duration,
      easing: t.easing,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        drag.setValue(0);
      }
    });
    return () => {
      animation.stop();
    };
  }, [visible, reduceMotion, progress, drag]);

  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const pan = useRef(
    PanResponder.create(
      sheetPanHandlers({
        drag,
        getHeight: () => sheetHeight.current,
        isVisible: () => visibleRef.current,
        onClose: () => {
          onCloseRef.current();
        },
      }),
    ),
  ).current;

  if (!mounted) return null;

  const offscreen = windowHeight;
  const translateY = reduceMotion
    ? drag
    : Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] }), drag);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            testID={testID === undefined ? undefined : `${testID}-scrim`}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            accessibilityHint={closeHint}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.voile }]}
          />
        </Animated.View>
        <Animated.View
          testID={testID === undefined ? undefined : `${testID}-panel`}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          onLayout={(event) => {
            sheetHeight.current = event.nativeEvent.layout.height;
          }}
          style={[
            {
              maxHeight: windowHeight * metrics.sheet.maxHeightRatio,
              backgroundColor: colors.fondCarte,
              borderTopLeftRadius: radius.feuille,
              borderTopRightRadius: radius.feuille,
              boxShadow: shadows.feuille.boxShadow,
              paddingTop: metrics.sheet.paddingTop,
              paddingBottom: metrics.sheet.paddingBottom + insets.bottom,
              opacity: reduceMotion ? progress : 1,
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            {...pan.panHandlers}
            style={[styles.handleZone, { minHeight: space[6] }]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={{
                width: metrics.sheet.handleWidth,
                height: metrics.sheet.handleHeight,
                borderRadius: metrics.sheet.handleRadius,
                backgroundColor: colors.filetFort,
              }}
            />
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: metrics.sheet.paddingHorizontal,
              gap: space[4],
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: space[1] }}>
              <Text
                accessibilityRole="header"
                style={[typography.titreSection, { color: colors.texte }]}
              >
                {title}
              </Text>
              {subtitle !== undefined && (
                <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>
                  {subtitle}
                </Text>
              )}
            </View>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  handleZone: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
