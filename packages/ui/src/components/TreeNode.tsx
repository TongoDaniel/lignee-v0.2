// Nœud de l'arbre (components/NoeudArbre, 06-arbre.md) : avatar, prénom, et une ligne de lien ou
// d'années. États : normal, sur le chemin de parenté (anneau `chemin`), atténué (hors du chemin ou
// du calque, `opacite-attenue`), anniversaire (anneau `fete` qui respire, pastille) et place à
// compléter (cercle pointillé et `ajouter`). Une personne décédée montre ses années, rien d'autre.
// Ce composant ne dessine ni les traits ni la mise en page de l'arbre (T-017) et ne calcule aucun
// lien : l'écran lui donne le lien déjà formulé et le libellé complet du nœud.
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../icons/Icon';
import { opacity as opacities, stroke } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFocusRing } from './a11y';
import { Avatar, AVATAR_SIZES, type AvatarPerson, type AvatarSize } from './Avatar';
import { metrics } from './metrics';
import { curve, usePressScale } from './motion';

/** Nom de l'action d'accessibilité qui remplace l'appui long (TalkBack, VoiceOver). */
const LONG_PRESS_ACTION = 'longpress';

export type TreeNodeState = 'normal' | 'path' | 'faded' | 'birthday' | 'unknown';

interface TreeNodeBaseProps {
  /** La personne ; absente pour « Vous » et pour une place à compléter. */
  readonly person?: AvatarPerson;
  /** Prénom affiché sous l'avatar (« Claire », « Vous »). Pour une place à compléter : la place (« Mère »). */
  readonly name: string;
  /** « Vous » : avatar doré à silhouette. */
  readonly you?: boolean;
  /** Lien avec vous (« Maman »), déjà formulé par l'écran. */
  readonly relation?: string;
  /** Années de vie (« 1931 – 2019 ») d'une personne décédée : à la place du lien. */
  readonly years?: string;
  /**
   * Proposition en attente (06-arbre.md) : petit point `parente` en haut à droite de l'avatar.
   * Un lien probable (« Peut-être son frère ») se dit dans `relation`, pas ici.
   */
  readonly pendingProposal?: boolean;
  readonly state?: TreeNodeState;
  /** Calque santé actif : tous les avatars passent en neutre. */
  readonly neutral?: boolean;
  /** Pastille cœur : un antécédent est noté. Elle n'existe qu'avec le calque santé. */
  readonly health?: boolean;
  /** Taille de l'avatar : `m` au zoom standard, `s` en vue d'ensemble, `l` en détail. */
  readonly avatarSize?: AvatarSize;
  /** Libellé complet pour le lecteur d'écran (« Claire Martin, votre mère, née en 1968 »). */
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  /** Ouvre la fiche (ou l'ajout, pour une place à compléter). */
  readonly onPress?: () => void;
  readonly testID?: string;
}

export type TreeNodeProps = TreeNodeBaseProps & LongPressProps;

/** Appui long (affiche le chemin de parenté) : toujours avec le nom de son action pour le lecteur d'écran. */
type LongPressProps =
  | { readonly onLongPress?: undefined; readonly longPressLabel?: undefined }
  | {
      readonly onLongPress: () => void;
      /** Nom de l'action d'accessibilité (« Voir le lien de parenté »), déjà traduit. */
      readonly longPressLabel: string;
    };

/** Anneau d'anniversaire : il respire, ou reste fixe quand les animations sont réduites. */
function useBreathing(active: boolean, reduceMotion: boolean): Animated.Value {
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || reduceMotion) {
      value.setValue(1);
      return undefined;
    }
    const half = {
      duration: metrics.treeNode.breathHalfCycle,
      easing: curve('entreeSortie'),
      useNativeDriver: true,
    };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { ...half, toValue: metrics.treeNode.breathLowOpacity }),
        Animated.timing(value, { ...half, toValue: 1 }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [active, reduceMotion, value]);
  return value;
}

export function TreeNode({
  person,
  name,
  you = false,
  relation,
  years,
  pendingProposal = false,
  state = 'normal',
  neutral = false,
  health = false,
  avatarSize = 'm',
  accessibilityLabel,
  accessibilityHint,
  onPress,
  onLongPress,
  longPressLabel,
  testID,
}: TreeNodeProps) {
  const theme = useTheme();
  const { colors, typography, reduceMotion, touchTarget } = theme;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { onFocus, onBlur, focusStyle } = useFocusRing(colors);
  const breath = useBreathing(state === 'birthday', reduceMotion);
  const diameter = AVATAR_SIZES[avatarSize];
  const { ringWidth, ringGap } = metrics.treeNode;
  const ringSpace = ringWidth + ringGap;
  const unknown = state === 'unknown';
  const ringColor =
    state === 'path' ? colors.chemin : state === 'birthday' ? colors.fete : undefined;
  // Place à compléter : la ligne secondaire dit l'invitation (« À compléter »).
  const secondary = unknown ? relation : (years ?? relation);
  const interactive = onPress !== undefined || onLongPress !== undefined;

  const nameStyle = {
    ...typography.secondaire,
    fontFamily: typography.etiquette.fontFamily,
    color: colors.texte,
  };

  const body = (
    <Animated.View
      style={[
        styles.node,
        {
          width: Math.max(metrics.treeNode.width, touchTarget),
          minHeight: touchTarget,
          gap: metrics.treeNode.gap,
        },
        state === 'faded' && { opacity: opacities.attenue },
        interactive && { transform: [{ scale }] },
        focusStyle,
      ]}
    >
      <View
        style={{
          width: diameter + ringSpace * 2,
          height: diameter + ringSpace * 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {ringColor !== undefined && (
          <Animated.View
            testID={testID === undefined ? undefined : `${testID}-ring`}
            style={[
              styles.ring,
              {
                width: diameter + ringSpace * 2,
                height: diameter + ringSpace * 2,
                borderRadius: metrics.round,
                borderWidth: ringWidth,
                borderColor: ringColor,
                backgroundColor: colors.fond,
              },
              state === 'birthday' && { opacity: breath },
            ]}
          />
        )}
        {unknown ? (
          <View
            testID={testID === undefined ? undefined : `${testID}-unknown`}
            style={[
              styles.unknown,
              {
                width: diameter,
                height: diameter,
                borderRadius: metrics.round,
                borderWidth: metrics.treeNode.unknownBorderWidth,
                borderColor: colors.bordureChamp,
              },
            ]}
          >
            <Icon name="ajouter" color={colors.texteSecondaire} />
          </View>
        ) : (
          <Avatar
            {...(person === undefined ? {} : { person })}
            you={you}
            size={avatarSize}
            neutral={neutral || health}
          />
        )}
        {(health || state === 'birthday') && !unknown && (
          <View
            testID={testID === undefined ? undefined : `${testID}-badge`}
            style={[
              styles.badge,
              {
                width: metrics.treeNode.badgeSize,
                height: metrics.treeNode.badgeSize,
                borderRadius: metrics.round,
                top: ringSpace + metrics.treeNode.badgeOffsetTop,
                right: ringSpace + metrics.treeNode.badgeOffsetRight,
                backgroundColor: colors.fondCarte,
                boxShadow: theme.shadows.carte.boxShadow,
              },
            ]}
          >
            <Icon
              name={health ? 'santePlein' : 'anniversaire'}
              size={metrics.treeNode.badgeIconSize}
              color={health ? colors.sante : colors.fete}
            />
          </View>
        )}
        {pendingProposal && !unknown && (
          <View
            testID={testID === undefined ? undefined : `${testID}-pending`}
            style={[
              styles.pending,
              {
                width: metrics.treeNode.pendingDotSize,
                height: metrics.treeNode.pendingDotSize,
                borderRadius: metrics.round,
                top: ringSpace,
                right: ringSpace,
                backgroundColor: colors.parente,
                borderWidth: stroke.focus,
                borderColor: colors.fond,
              },
            ]}
          />
        )}
      </View>
      <Text style={[nameStyle, styles.text]}>{name}</Text>
      {secondary !== undefined && (
        <Text
          style={[
            typography.legende,
            styles.text,
            styles.secondary,
            { color: colors.texteSecondaire },
          ]}
        >
          {secondary}
        </Text>
      )}
    </Animated.View>
  );

  if (!interactive) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={styles.wrapper}
      >
        {body}
      </View>
    );
  }

  const withLongPressAction = onLongPress !== undefined;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      {...(withLongPressAction
        ? {
            accessibilityActions: [{ name: LONG_PRESS_ACTION, label: longPressLabel }],
            onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
              if (event.nativeEvent.actionName === LONG_PRESS_ACTION) onLongPress();
            },
          }
        : {})}
      style={styles.wrapper}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  node: {
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
  },
  unknown: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: {
    position: 'absolute',
  },
  text: {
    textAlign: 'center',
  },
  secondary: {
    // Resserre le prénom et la ligne secondaire (bundle.css : margin-top -4px).
    marginTop: -metrics.treeNode.secondaryOverlap,
  },
});
