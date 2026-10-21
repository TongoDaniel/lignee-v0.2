// L'arbre à l'écran (T-017) : le dessin Skia, ses boutons (zoom, tout voir, liste) et la liste
// équivalente. Cet écran affiche : la disposition, les liens et le parcours viennent de
// `packages/layout`, les noms du graphe filtré. « Vous » est au centre, en bas, au lancement (06-arbre.md).
//
// Chaque geste a son bouton (ACC-06) : « + » et « − » pour le zoom, « Voir tout l'arbre » pour
// l'ensemble, et la liste pour parcourir l'arbre personne par personne sans pincer ni glisser. La
// liste est proposée d'office quand un lecteur d'écran est actif.
import type { Id } from '@lignee/domain';
import {
  buildOutline,
  buildScene,
  canZoom,
  createTreeLayoutCache,
  fitViewport,
  indexScene,
  nearestDrawn,
  placeAt,
  toggleFamily,
  zoomAbout,
  zoomStep,
  type FoldChoices,
  type SceneHit,
  type ScreenSize,
  type TreeLayout,
  type Viewport,
} from '@lignee/layout';
import { Button, space, useTheme } from '@lignee/ui';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslator } from '../i18n/I18nProvider';
import { sceneSpecFor } from './sceneSpec';
import { TreeCanvas, type ViewportCommand } from './TreeCanvas';
import { TreeOutlineList } from './TreeOutlineList';
import type { TreeModel } from './treeModel';
import { useScreenReader } from './useScreenReader';

export interface TreeViewProps {
  readonly model: TreeModel;
  /** Ouvre la fiche d'une personne (T-025) ; sans elle, le toucher sélectionne seulement. */
  readonly onOpenPerson?: (personId: Id) => void;
}

const NO_FOLDS: FoldChoices = new Map();

/** Parent manquant de chaque colonne « non précisé » : « mère », « père » ou « parent ». */
function missingKinds(layout: TreeLayout): ReadonlyMap<string, 'mother' | 'father' | 'parent'> {
  const kinds = new Map<string, 'mother' | 'father' | 'parent'>();
  for (const family of layout.families.values()) {
    if (family.kind !== 'unspecified') continue;
    const parentId = family.parentIds[0];
    const column = parentId === undefined ? undefined : layout.structure.unitOf.get(parentId);
    kinds.set(family.key, column?.unspecified?.missing ?? 'parent');
  }
  return kinds;
}

export function TreeView({ model, onOpenPerson }: TreeViewProps) {
  const theme = useTheme();
  const { colors, typography } = theme;
  const { t } = useTranslator();
  const insets = useSafeAreaInsets();
  const screenReader = useScreenReader();
  // Réglage de taille du texte du téléphone, suivi à chaud.
  const { fontScale } = useWindowDimensions();

  const [size, setSize] = useState<ScreenSize | undefined>(undefined);
  const [folds, setFolds] = useState<FoldChoices>(NO_FOLDS);
  const [selectedId, setSelectedId] = useState<Id | undefined>(undefined);
  const [listChoice, setListChoice] = useState<'list' | 'drawing' | undefined>(undefined);
  const [focusId, setFocusId] = useState<Id>(model.centerId);
  const [command, setCommand] = useState<ViewportCommand | undefined>(undefined);
  const [scaleNow, setScaleNow] = useState(1);
  const current = useRef<Viewport | undefined>(undefined);
  const commandId = useRef(0);

  const showList = listChoice === undefined ? screenReader : listChoice === 'list';

  const cache = useRef(createTreeLayoutCache()).current;
  const layout = useMemo(
    () => cache.layout(model.graph, model.centerId, folds),
    [cache, model, folds],
  );
  const spec = useMemo(
    () =>
      sceneSpecFor({
        seniorScale: theme.textScale,
        systemFontScale: fontScale,
        touchTarget: theme.touchTarget,
      }),
    [theme.textScale, theme.touchTarget, fontScale],
  );
  const scene = useMemo(
    () => buildScene(layout, spec, { supposedFiliations: model.supposedFiliations }),
    [layout, spec, model.supposedFiliations],
  );
  const index = useMemo(() => indexScene(scene), [scene]);
  const outline = useMemo(() => buildOutline(layout), [layout]);
  const missingOf = useMemo(() => missingKinds(layout), [layout]);

  const initialViewport = useMemo<Viewport | undefined>(() => {
    if (size === undefined) return undefined;
    const you = scene.personById.get(model.centerId);
    // « Vous » en bas au centre, toujours visible au lancement (06-arbre.md).
    return placeAt(
      1,
      { x: you?.x ?? 0, y: you?.y ?? 0 },
      { x: size.width / 2, y: size.height - space[6] - spec.cardBottom },
    );
    // Le cadre de départ ne dépend que de la taille : replier ne le fait pas sauter.
  }, [size?.width, size?.height, spec]);

  const send = useCallback((viewport: Viewport) => {
    commandId.current += 1;
    setCommand({ id: commandId.current, viewport });
  }, []);

  const centerOf = (screen: ScreenSize) => ({ x: screen.width / 2, y: screen.height / 2 });

  const zoomBy = (direction: 1 | -1) => {
    const now = current.current ?? initialViewport;
    if (now === undefined || size === undefined) return;
    send(zoomAbout(now, zoomStep(now.scale, direction, spec.zoom), centerOf(size), spec.zoom));
  };

  const fit = () => {
    if (size === undefined) return;
    send(fitViewport(scene.bounds, size, space[4], spec.zoom));
  };

  /**
   * Amène une personne au centre de l'écran. Si elle n'est pas sur le dessin (foyer ou branche
   * replié), le dessin se recentre sur la personne dessinée la plus proche : revenir de la liste
   * montre toujours le dessin (ACC-06).
   */
  const goTo = (personId: Id) => {
    const shown = scene.personById.has(personId) ? personId : nearestDrawn(outline, personId);
    const target = shown === undefined ? undefined : scene.personById.get(shown);
    setFocusId(personId);
    setSelectedId(shown);
    const now = current.current ?? initialViewport;
    if (target === undefined || now === undefined || size === undefined) return;
    send(placeAt(now.scale, { x: target.x, y: target.y }, centerOf(size)));
  };

  const toggle = (familyKey: string) => {
    setFolds(toggleFamily(layout, familyKey));
  };

  const onActivate = (hit: SceneHit) => {
    if (hit.kind === 'person') {
      setSelectedId(hit.person.id);
      setFocusId(hit.person.id);
      onOpenPerson?.(hit.person.id);
    } else if (hit.kind === 'counter') {
      toggle(hit.counter.familyKey);
    } else if (hit.kind === 'mark') {
      if (hit.mark.kind === 'parents') toggle(hit.mark.familyKey);
      else if (hit.mark.targets.length === 1 && hit.mark.targets[0] !== undefined) {
        goTo(hit.mark.targets[0]);
      } else {
        setFocusId(hit.mark.personId);
        setListChoice('list');
      }
    }
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous?.width === width && previous.height === height ? previous : { width, height },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.fond }} testID="screen-tree">
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingHorizontal: space.margeEcran,
          paddingBottom: space[2],
          gap: space[2],
        }}
      >
        <Text accessibilityRole="header" style={[typography.titreEcran, { color: colors.texte }]}>
          {t('common:treeScreen.title')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {showList ? (
            <Button
              testID="tree-show-drawing"
              label={t('common:treeScreen.showDrawing')}
              variant="secondary"
              compact
              onPress={() => {
                setListChoice('drawing');
                goTo(focusId);
              }}
            />
          ) : (
            <>
              <Button
                testID="tree-zoom-in"
                label={t('common:treeScreen.zoomIn')}
                icon="plus"
                variant="secondary"
                compact
                disabled={!canZoom(scaleNow, 1, spec.zoom)}
                onPress={() => {
                  zoomBy(1);
                }}
              />
              <Button
                testID="tree-zoom-out"
                label={t('common:treeScreen.zoomOut')}
                variant="secondary"
                compact
                disabled={!canZoom(scaleNow, -1, spec.zoom)}
                onPress={() => {
                  zoomBy(-1);
                }}
              />
              <Button
                testID="tree-fit"
                label={t('common:treeScreen.fit')}
                variant="secondary"
                compact
                onPress={fit}
              />
              <Button
                testID="tree-show-list"
                label={t('common:treeScreen.showList')}
                variant="secondary"
                compact
                onPress={() => {
                  setListChoice('list');
                }}
              />
            </>
          )}
        </View>
      </View>
      <View style={{ flex: 1 }} onLayout={onLayout} testID="tree-area">
        {showList ? (
          <TreeOutlineList
            testID="tree-list"
            outline={outline}
            cards={model.cards}
            focusId={focusId}
            centerId={model.centerId}
            onFocus={(id) => {
              setFocusId(id);
              setSelectedId(id);
            }}
            onToggleFamily={toggle}
          />
        ) : size === undefined || initialViewport === undefined ? null : (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('common:treeScreen.drawingLabel')}
            accessibilityHint={t('common:treeScreen.drawingHint')}
          >
            <TreeCanvas
              testID="tree-canvas"
              scene={scene}
              index={index}
              size={size}
              cards={model.cards}
              missingOf={missingOf}
              selectedId={selectedId}
              initialViewport={initialViewport}
              command={command}
              onSettle={(viewport) => {
                current.current = viewport;
                setScaleNow(viewport.scale);
              }}
              onActivate={onActivate}
            />
          </View>
        )}
      </View>
    </View>
  );
}
