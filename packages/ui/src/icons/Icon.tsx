// Icône du jeu Lignée (components/Icones, 05-iconographie.md) : grille de 24, trait de 2,
// extrémités arrondies, recolorée par le thème (`texte` par défaut). Les tracés viennent des SVG de
// la charte (icons.generated.ts) ; ils sont dessinés en `color`, l'équivalent de currentColor.
import Svg, { Path } from 'react-native-svg';

import { size as sizes, stroke } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { iconShapes, type IconName } from './icons.generated';

export type { IconName } from './icons.generated';

/** Noms des 37 icônes de la charte. */
export const iconNames = Object.keys(iconShapes) as IconName[];

const NO_FILL = 'none';

export interface IconProps {
  readonly name: IconName;
  /** Côté en dp : `size.iconeM` (24) par défaut ; jamais plus que `size.iconeL` dans l'interface. */
  readonly size?: number;
  /** Couleur du trait ou du plein ; `texte` du thème par défaut. */
  readonly color?: string;
  /**
   * Nom lu par le lecteur d'écran, si l'icône porte seule une information : elle devient une
   * image. Sans nom, l'icône est décorative et le lecteur d'écran l'ignore (le texte voisin suffit).
   */
  readonly label?: string;
  readonly testID?: string;
}

export function Icon({ name, size = sizes.iconeM, color, label, testID }: IconProps) {
  const { colors } = useTheme();
  const ink = color ?? colors.texte;
  const labelled = label !== undefined;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...(testID === undefined ? {} : { testID })}
      {...(labelled
        ? {
            accessible: true,
            accessibilityRole: 'image' as const,
            accessibilityLabel: label,
          }
        : {
            accessible: false,
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          })}
    >
      {iconShapes[name].map((shape, index) =>
        shape.mode === 'stroke' ? (
          <Path
            key={index}
            d={shape.d}
            fill={NO_FILL}
            stroke={ink}
            strokeWidth={'strokeWidth' in shape ? shape.strokeWidth : stroke.icone}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Path
            key={index}
            d={shape.d}
            fill={ink}
            fillRule={'evenOdd' in shape ? 'evenodd' : 'nonzero'}
          />
        ),
      )}
    </Svg>
  );
}
