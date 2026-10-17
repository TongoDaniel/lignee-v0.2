// Feuille (components/Feuille) : un panneau qui monte du bas pour une tâche courte, sans quitter
// l'écran. Coins hauts `rayon-feuille`, poignée de 48 × 5, `ombre-feuille`, voile `voile` derrière.
// Elle monte en 360 ms, courbe de sortie, et suit le doigt quand on la tire par la poignée ;
// relâchée, elle se pose avec la courbe de sortie, ou se ferme si on l'a assez tirée. Elle se ferme
// aussi en touchant le voile, avec le bouton retour d'Android et avec le geste « échappement » du
// lecteur d'écran (la feuille est modale : le voile n'est pas proposé au lecteur d'écran).
// Quand le téléphone demande de réduire les animations, elle apparaît et disparaît en fondu de
// 150 ms, sans glisser.
// Le contenu défile : à 200 % de texte, rien n'est coupé.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
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

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) => {
        drag.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > sheetHeight.current * metrics.sheet.dismissRatio) {
          onCloseRef.current();
          return;
        }
        Animated.timing(drag, {
          toValue: 0,
          duration: motion.duration.transition,
          easing: curve('sortie'),
          useNativeDriver: true,
        }).start();
      },
    }),
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
