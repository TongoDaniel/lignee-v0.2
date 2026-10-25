// Le dessin de l'arbre : un canevas Skia, déplacé et zoomé par les gestes (TRD, « Dessin » ; ARB-02).
// Le déplacement et le zoom ne passent que par des valeurs partagées de Reanimated : le fil
// JavaScript ne redessine que lorsque l'écran sort de la zone préparée (écran plus une marge) ou
// change de niveau de détail, jamais à chaque image. Seuls les éléments de cette zone sont
// peints (culling par l'index spatial de `packages/layout`).
//
// Chaque geste a son équivalent en bouton (ACC-06) : le parent envoie une `command` (zoom des
// boutons « + » et « − », ajustement) que ce composant applique, sans animation quand le
// téléphone demande de réduire les animations (07-mouvement.md).
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import type { Id } from '@lignee/domain';
import {
  clampViewport,
  cullScene,
  hitTest,
  visibleRect,
  zoomLevelFor,
  type CulledScene,
  type Rect,
  type SceneHit,
  type SceneIndex,
  type ScreenSize,
  type TreeScene,
  type Viewport,
  type ZoomLevel,
} from '@lignee/layout';
import { fontFiles } from '@lignee/ui/fontFiles';
import { componentMetrics, motion, typography, useTheme } from '@lignee/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTranslator } from '../i18n/I18nProvider';
import { SkiaTree } from './SkiaTree';
import type { PersonCard } from './personCards';

/** Une fenêtre de plus de chaque côté est préparée : le doigt ne voit jamais le bord du dessin. */
export const CULL_MARGIN = 1;

/** Ordre envoyé par les boutons ; `id` change à chaque ordre pour qu'un même cadre soit rejoué. */
export interface ViewportCommand {
  readonly id: number;
  readonly viewport: Viewport;
}

export interface TreeCanvasProps {
  readonly scene: TreeScene;
  readonly index: SceneIndex;
  readonly size: ScreenSize;
  readonly cards: ReadonlyMap<Id, PersonCard>;
  readonly missingOf: ReadonlyMap<string, 'mother' | 'father' | 'parent'>;
  readonly selectedId: Id | undefined;
  readonly initialViewport: Viewport;
  readonly command: ViewportCommand | undefined;
  /** Cadre au repos : après un geste ou un ordre. */
  readonly onSettle: (viewport: Viewport) => void;
  readonly onActivate: (hit: SceneHit) => void;
  readonly testID?: string;
}

function emptyCull(area: Rect): CulledScene {
  return { area, people: [], missing: [], counters: [], marks: [], edges: [] };
}

export function TreeCanvas({
  scene,
  index,
  size,
  cards,
  missingOf,
  selectedId,
  initialViewport,
  command,
  onSettle,
  onActivate,
  testID,
}: TreeCanvasProps) {
  const theme = useTheme();
  const { t } = useTranslator();
  const { spec } = scene;
  const zoom = spec.zoom;
  const scaleText = spec.nodeWidth / spec.input.nodeWidth;

  // Polices de la charte dans Skia ; tant qu'elles chargent, rien n'est peint.
  const nameFont = useFont(
    fontFiles['InstrumentSans-Medium'],
    typography.secondaire.fontSize * scaleText,
  );
  const secondaryFont = useFont(
    fontFiles['InstrumentSans-Medium'],
    typography.legende.fontSize * scaleText,
  );
  const initialFont = useFont(
    fontFiles['InstrumentSans-SemiBold'],
    spec.radius * componentMetrics.avatar.initialRatio,
  );

  const scale = useSharedValue(initialViewport.scale);
  const translateX = useSharedValue(initialViewport.x);
  const translateY = useSharedValue(initialViewport.y);
  const prepared = useSharedValue<Rect>(visibleRect(initialViewport, size, CULL_MARGIN));
  const levelIndex = useSharedValue(0);
  const pending = useSharedValue(false);

  const [state, setState] = useState<{ culled: CulledScene; level: ZoomLevel }>(() => ({
    culled: emptyCull(prepared.value),
    level: zoomLevelFor(initialViewport.scale, zoom),
  }));

  const refresh = useCallback(
    (viewport: Viewport) => {
      const area = visibleRect(viewport, size, CULL_MARGIN);
      const level = zoomLevelFor(viewport.scale, zoom);
      prepared.value = area;
      levelIndex.value = level === 'overview' ? 0 : level === 'standard' ? 1 : 2;
      pending.value = false;
      setState({ culled: cullScene(index, area), level });
    },
    [index, size, zoom, prepared, levelIndex, pending],
  );

  // Premier dessin et nouvelle scène (repli, déplié) : on repart du cadre courant.
  useEffect(() => {
    refresh({ scale: scale.value, x: translateX.value, y: translateY.value });
  }, [refresh, scale, translateX, translateY]);

  // Déplace le cadre : animé, ou immédiat si le téléphone demande de réduire les animations.
  const moveTo = useCallback(
    (viewport: Viewport) => {
      if (theme.reduceMotion) {
        scale.value = viewport.scale;
        translateX.value = viewport.x;
        translateY.value = viewport.y;
        return;
      }
      const timing = {
        duration: motion.duration.transition,
        easing: Easing.bezier(...motion.easing.entreeSortie),
      };
      scale.value = withTiming(viewport.scale, timing);
      translateX.value = withTiming(viewport.x, timing);
      translateY.value = withTiming(viewport.y, timing);
    },
    [theme.reduceMotion, scale, translateX, translateY],
  );

  // Au repos (geste fini ou ordre appliqué), le dessin ne reste jamais hors de vue : le cadre est
  // ramené dans les bornes du dessin.
  const bounds = scene.bounds;
  const settle = useCallback(
    (viewport: Viewport) => {
      const bounded = clampViewport(viewport, size, bounds);
      if (bounded !== viewport) moveTo(bounded);
      refresh(bounded);
      onSettle(bounded);
    },
    [size, bounds, moveTo, refresh, onSettle],
  );

  const lastCommand = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (command === undefined || command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    moveTo(command.viewport);
    settle(command.viewport);
  }, [command, moveTo, settle]);

  // À chaque image : l'écran sort-il de la zone préparée, ou change-t-il de niveau ?
  const { overviewBelow, detailFrom, min, max } = zoom;
  const width = size.width;
  const height = size.height;
  useAnimatedReaction(
    () => ({ s: scale.value, x: translateX.value, y: translateY.value }),
    (current) => {
      if (pending.value) return;
      const area = prepared.value;
      const outside =
        -current.x / current.s < area.left ||
        -current.y / current.s < area.top ||
        (width - current.x) / current.s > area.right ||
        (height - current.y) / current.s > area.bottom;
      const level = current.s < overviewBelow ? 0 : current.s >= detailFrom ? 2 : 1;
      if (outside || level !== levelIndex.value) {
        pending.value = true;
        scheduleOnRN(refresh, { scale: current.s, x: current.x, y: current.y });
      }
    },
  );

  const activate = useCallback(
    (worldX: number, worldY: number, currentScale: number) => {
      const hit = hitTest(
        index,
        { x: worldX, y: worldY },
        { scale: currentScale, level: zoomLevelFor(currentScale, zoom) },
      );
      if (hit !== undefined) onActivate(hit);
    },
    [index, zoom, onActivate],
  );

  // Valeurs de départ des gestes : partagées, car un worklet ne garde pas ce qu'il modifie dans un objet capturé.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const pinchWorldX = useSharedValue(0);
  const pinchWorldY = useSharedValue(0);

  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(componentMetrics.treeNode.drawing.panMinDistance)
      .maxPointers(1)
      .onStart(() => {
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((event) => {
        translateX.value = startX.value + event.translationX;
        translateY.value = startY.value + event.translationY;
      })
      .onEnd(() => {
        scheduleOnRN(settle, {
          scale: scale.value,
          x: translateX.value,
          y: translateY.value,
        });
      });
    const pinch = Gesture.Pinch()
      .onStart((event) => {
        pinchScale.value = scale.value;
        pinchWorldX.value = (event.focalX - translateX.value) / scale.value;
        pinchWorldY.value = (event.focalY - translateY.value) / scale.value;
      })
      .onUpdate((event) => {
        const next = Math.min(max, Math.max(min, pinchScale.value * event.scale));
        scale.value = next;
        translateX.value = event.focalX - pinchWorldX.value * next;
        translateY.value = event.focalY - pinchWorldY.value * next;
      })
      .onEnd(() => {
        scheduleOnRN(settle, {
          scale: scale.value,
          x: translateX.value,
          y: translateY.value,
        });
      });
    const tap = Gesture.Tap().onEnd((event, success) => {
      if (!success) return;
      scheduleOnRN(
        activate,
        (event.x - translateX.value) / scale.value,
        (event.y - translateY.value) / scale.value,
        scale.value,
      );
    });
    return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));
  }, [
    scale,
    translateX,
    translateY,
    startX,
    startY,
    pinchScale,
    pinchWorldX,
    pinchWorldY,
    settle,
    activate,
    min,
    max,
  ]);

  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  return (
    <GestureDetector gesture={gestures}>
      <Animated.View testID={testID} style={{ width: size.width, height: size.height }}>
        <View style={{ flex: 1 }}>
          <Canvas style={{ flex: 1 }}>
            {nameFont && secondaryFont && initialFont ? (
              <Group transform={transform}>
                <SkiaTree
                  culled={state.culled}
                  cards={cards}
                  centerId={scene.centerId}
                  selectedId={selectedId}
                  missingOf={missingOf}
                  spec={spec}
                  theme={theme}
                  fonts={{ name: nameFont, secondary: secondaryFont, initial: initialFont }}
                  level={state.level}
                  t={t}
                />
              </Group>
            ) : null}
          </Canvas>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
