// Icône « famille » de la charte (docs/charte/assets/Icones/famille.svg) : grille de 24, trait
// `stroke.icone`, recolorée par le thème. Rejoindra @lignee/ui avec les icônes (T-015).
import { stroke } from '@lignee/ui';
import Svg, { Path } from 'react-native-svg';

import { NO_FILL, type IconProps } from './TreeSymbolIcon';

const PATHS = [
  'M11.93 8.22A3.57 3.57 0 0 1 4.79 8.22A3.57 3.57 0 0 1 11.93 8.22',
  'M1.85 19.15A6.72 6.72 0 0 1 14.87 19.15',
  'M19.07 9.48A2.73 2.73 0 0 1 13.61 9.48A2.73 2.73 0 0 1 19.07 9.48',
  'M12.27 18.11A5.04 5.04 0 0 1 21.55 18.84',
] as const;

export function FamilyIcon({ size, color }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS.map((d) => (
        <Path
          key={d}
          d={d}
          fill={NO_FILL}
          stroke={color}
          strokeWidth={stroke.icone}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
