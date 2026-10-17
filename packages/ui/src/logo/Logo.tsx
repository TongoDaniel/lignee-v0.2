// Logo Lignée (components/Logo, 02-logo.md). Sur Nuit : symbole or, logotype crème. Sur fond clair :
// symbole vert, logotype encre. Sous 48 px, le symbole passe en version compacte, au trait plus
// épais. Les dessins viennent des SVG de la charte (logo.generated.ts).
import Svg, { Circle, Path } from 'react-native-svg';

import { metrics } from '../components/metrics';
import { palette } from '../tokens';
import type { SchemeName } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { logoDrawings, type LogoDrawing, type LogoPart } from './logo.generated';

/** Encres autorisées par fond : jamais le symbole or sur un fond clair (1,6:1). */
const INKS: { readonly [S in SchemeName]: { readonly [P in LogoPart]: string } } = {
  jour: { symbol: palette.vert700, wordmark: palette.encre900 },
  nuit: { symbol: palette.or500, wordmark: palette.creme50 },
};

const NO_FILL = 'none';
const ROUND = 'round' as const;

export type LogoKind = 'horizontal' | 'vertical' | 'symbol' | 'wordmark';

export interface LogoProps {
  readonly variant?: LogoKind;
  /** Hauteur en dp ; la largeur suit les proportions du dessin. */
  readonly height: number;
  /** Nom lu par le lecteur d'écran (« Lignée », traduit par l'écran). Le logo est une image. */
  readonly label: string;
  /** Fond sur lequel le logo est posé ; par défaut celui du thème (Jour ou Nuit). */
  readonly background?: SchemeName;
  readonly testID?: string;
}

function viewBoxSize(drawing: LogoDrawing): { width: number; height: number } {
  const [, , width = 1, height = 1] = drawing.viewBox.split(/\s+/).map(Number);
  return { width, height };
}

/** Le symbole compact sous 48 px (02-logo.md : « Sous 48 px, utilisez le symbole compact »). */
export function logoDrawingFor(variant: LogoKind, height: number): LogoDrawing {
  if (variant === 'symbol' && height < metrics.logo.compactBelow) return logoDrawings.symbolCompact;
  return logoDrawings[variant];
}

export function Logo({ variant = 'horizontal', height, label, background, testID }: LogoProps) {
  const theme = useTheme();
  const inks = INKS[background ?? theme.scheme];
  const drawing = logoDrawingFor(variant, height);
  const box = viewBoxSize(drawing);
  return (
    // Une image qui ne se touche pas : son nom suffit, il n'y a aucune action à indiquer.
    // eslint-disable-next-line react-native-a11y/has-accessibility-hint
    <Svg
      width={(height * box.width) / box.height}
      height={height}
      viewBox={drawing.viewBox}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      {...(testID === undefined ? {} : { testID })}
    >
      {drawing.shapes.map((shape, index) => {
        const ink = inks[shape.part];
        const paint =
          shape.mode === 'stroke'
            ? {
                fill: NO_FILL,
                stroke: ink,
                strokeWidth: shape.strokeWidth ?? 0,
                strokeLinecap: ROUND,
                strokeLinejoin: ROUND,
              }
            : { fill: ink };
        return shape.tag === 'circle' ? (
          <Circle key={index} cx={shape.cx ?? 0} cy={shape.cy ?? 0} r={shape.r ?? 0} {...paint} />
        ) : (
          <Path key={index} d={shape.d ?? ''} {...paint} />
        );
      })}
    </Svg>
  );
}
