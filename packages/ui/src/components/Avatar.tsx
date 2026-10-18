// Avatar (components/Avatar) : la photo d'une personne, ou son initiale sur une teinte qui suit son
// nom de naissance (jamais son genre, jamais le corail). « Vous » a l'avatar doré à silhouette.
// Avec le calque santé, l'avatar passe en neutre. Photo recadrée en cercle, sans bordure ; si elle
// ne charge pas (hors ligne, fichier absent), l'initiale prend le relais. L'avatar est décoratif
// pour le lecteur d'écran, sauf si on lui donne un libellé : le nom est lu par le composant qui
// l'entoure (nœud de l'arbre, ligne de liste).
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Stop } from 'react-native-svg';

import { palette, size as sizes } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import {
  avatarTintColors,
  defaultAvatarTintRule,
  type AvatarTint,
  type AvatarTintInput,
} from './avatarTint';
import { metrics } from './metrics';

/** Tailles de la charte : `avatar-s` (40), `avatar-m` (58, défaut), `avatar-l` (88), `avatar-xl` (108). */
export type AvatarSize = 's' | 'm' | 'l' | 'xl';

export const AVATAR_SIZES: { readonly [S in AvatarSize]: number } = {
  s: sizes.avatarS,
  m: sizes.avatarM,
  l: sizes.avatarL,
  xl: sizes.avatarXl,
};

export interface AvatarPerson extends AvatarTintInput {
  readonly firstName: string;
  /** Photo déjà réduite (la limite de poids est celle de l'envoi) ; sans elle, l'initiale. */
  readonly photoUri?: string;
}

export interface AvatarProps {
  /** La personne affichée ; absente avec `you`. */
  readonly person?: AvatarPerson;
  /** L'avatar doré à silhouette de la personne qui utilise l'app. */
  readonly you?: boolean;
  readonly size?: AvatarSize;
  /** Force l'avatar neutre (calque santé actif). */
  readonly neutral?: boolean;
  /** Impose une teinte (autre règle de couleur) ; par défaut celle de la charte. */
  readonly tint?: AvatarTint;
  /** Lu par le lecteur d'écran si l'avatar est seul ; sans libellé, il est ignoré. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** Identifiant du dégradé doré de « Vous » dans son dessin SVG. */
const GRADIENT_ID = 'avatarYou';
const GRADIENT_FILL = ['url(#', GRADIENT_ID, ')'].join('');

function initialOf(firstName: string): string {
  const first = Array.from(firstName.trim())[0];
  return first === undefined ? '' : first.toLocaleUpperCase();
}

function YouAvatar({ diameter }: { readonly diameter: number }) {
  const { silhouette } = metrics.avatar;
  const radius = diameter / 2;
  const body = (diameter * silhouette.bodySize) / 2;
  return (
    <Svg width={diameter} height={diameter} viewBox={[0, 0, diameter, diameter].join(' ')}>
      <Defs>
        <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.or500} />
          <Stop offset="1" stopColor={palette.or700} />
        </LinearGradient>
      </Defs>
      <Circle cx={radius} cy={radius} r={radius} fill={GRADIENT_FILL} />
      <G fill={palette.blanc} fillOpacity={silhouette.opacity}>
        <Circle
          cx={diameter * (silhouette.headLeft + silhouette.headSize / 2)}
          cy={diameter * (silhouette.headTop + silhouette.headSize / 2)}
          r={(diameter * silhouette.headSize) / 2}
        />
        <Ellipse
          cx={diameter * (silhouette.bodyLeft + silhouette.bodySize / 2)}
          cy={diameter * (silhouette.bodyTop + silhouette.bodySize / 2)}
          rx={body}
          ry={body}
        />
      </G>
    </Svg>
  );
}

export function Avatar({
  person,
  you = false,
  size = 'm',
  neutral = false,
  tint,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const { colors, typography } = useTheme();
  const [photoFailed, setPhotoFailed] = useState(false);
  const diameter = AVATAR_SIZES[size];
  const a11y =
    accessibilityLabel === undefined
      ? {
          accessible: false,
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants' as const,
        }
      : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel };
  const frame = { width: diameter, height: diameter, borderRadius: metrics.round };

  if (you) {
    return (
      <View testID={testID} {...a11y} style={[styles.frame, frame]}>
        <YouAvatar diameter={diameter} />
      </View>
    );
  }

  const photoUri = person?.photoUri;
  const showPhoto = photoUri !== undefined && !photoFailed && !neutral;
  const tinted = avatarTintColors(
    tint ?? (person === undefined ? 'green' : defaultAvatarTintRule(person)),
    colors,
  );

  return (
    <View
      testID={testID}
      {...a11y}
      style={[
        styles.frame,
        frame,
        { backgroundColor: neutral ? colors.fondCarte : tinted.background },
        neutral && {
          borderWidth: metrics.avatar.neutralOutlineWidth,
          borderColor: colors.filetFort,
        },
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photoUri }}
          resizeMode="cover"
          // Une photo de visage ne s'inverse pas en mode sombre forcé.
          accessibilityIgnoresInvertColors
          onError={() => {
            setPhotoFailed(true);
          }}
          style={frame}
        />
      ) : (
        <Text
          // L'initiale vit dans un disque de taille fixe : elle ne grossit pas avec le texte du
          // téléphone (le nom complet, lui, est lu et affiché à côté, et grossit).
          allowFontScaling={false}
          style={{
            fontFamily: typography.bouton.fontFamily,
            fontSize: (diameter / 2) * metrics.avatar.initialRatio,
            lineHeight: diameter,
            color: neutral ? colors.texteSecondaire : tinted.text,
          }}
        >
          {person === undefined ? '' : initialOf(person.firstName)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
