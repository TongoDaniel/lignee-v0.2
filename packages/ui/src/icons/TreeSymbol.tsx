// Symbole Lignée compact, pour l'onglet Arbre (BarreOnglets : « L'onglet Arbre utilise le symbole
// Lignée compact »). Tracé recopié de docs/charte/assets/Logos/lignee-symbole-compact-*.svg ; les
// épaisseurs font partie du dessin du symbole, pas de la grille des icônes. Recoloré par le thème,
// contrairement à `Logo`, dont les encres sont fixées par le fond (02-logo.md).
import Svg, { Circle, G, Path } from 'react-native-svg';

const SYMBOL_STROKE = { branches: 10.12, ring: 8.25 } as const;
const BRANCHES =
  'M0 92C0 52.4 -24 55.7 -32 26M0 92C0 52.4 24 55.7 32 26M-32 26C-32 -8.19 -51.71 -5.34 -58.27 -30.99M-32 26C-32 -26.32 -26.54 -21.96 -24.72 -61.19M32 26C32 -26.32 26.54 -21.96 24.72 -61.19M32 26C32 -8.19 51.71 -5.34 58.27 -30.99';
const RING = 'M-40.78 91.31A100 100 0 1 1 40.78 91.31';
const NO_FILL = 'none';

export interface TreeSymbolProps {
  /** Côté en dp (`size.iconeL` dans la barre d'onglets). */
  readonly size: number;
  readonly color: string;
}

export function TreeSymbol({ size, color }: TreeSymbolProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="-104.12 -104.12 208.25 211.12"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G fill={NO_FILL} stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <Path d={BRANCHES} strokeWidth={SYMBOL_STROKE.branches} />
        <Path d={RING} strokeWidth={SYMBOL_STROKE.ring} />
      </G>
      <G fill={color}>
        <Circle cx={0} cy={92} r={15} />
        <Circle cx={-32} cy={26} r={12} />
        <Circle cx={32} cy={26} r={12} />
        <Circle cx={-58.27} cy={-30.99} r={10.5} />
        <Circle cx={-24.72} cy={-61.19} r={10.5} />
        <Circle cx={24.72} cy={-61.19} r={10.5} />
        <Circle cx={58.27} cy={-30.99} r={10.5} />
      </G>
    </Svg>
  );
}
