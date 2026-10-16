// Thème de l'interface : couleurs et ombres du schéma (Jour ou Nuit), typographie et zone
// touchable selon le mode Aînés. Fonction pure, sans React : le fournisseur de thème (T-014) ne
// fait que choisir les entrées et transmettre le résultat.
import {
  aines,
  schemeNames,
  shadows,
  size,
  themes,
  typography,
  type SchemeName,
  type TextStyle,
  type ThemeColors,
  type ThemeShadows,
  type TypographyName,
} from './tokens';

export interface ThemeOptions {
  readonly scheme: SchemeName;
  /** Mode Aînés (Profil › Affichage). */
  readonly seniorMode: boolean;
}

export interface Theme extends ThemeOptions {
  readonly colors: ThemeColors;
  readonly shadows: ThemeShadows;
  /**
   * Styles de texte, déjà multipliés par le facteur du mode Aînés. Le réglage de taille du
   * téléphone s'ajoute par-dessus : ne bloquez jamais `allowFontScaling`.
   */
  readonly typography: { readonly [K in TypographyName]: TextStyle };
  /** Facteur appliqué aux tailles et interlignes : 1, ou 1,3 en mode Aînés. */
  readonly textScale: number;
  /** Côté minimal d'une zone touchable : 48, ou 56 en mode Aînés. */
  readonly touchTarget: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function scaleTextStyle(style: TextStyle, factor: number): TextStyle {
  if (factor === 1) return style;
  return {
    ...style,
    fontSize: round2(style.fontSize * factor),
    lineHeight: round2(style.lineHeight * factor),
    ...(style.letterSpacing === undefined
      ? {}
      : { letterSpacing: round2(style.letterSpacing * factor) }),
  };
}

function scaleTypography(factor: number): Theme['typography'] {
  const entries = Object.entries(typography) as [TypographyName, TextStyle][];
  return Object.freeze(
    Object.fromEntries(entries.map(([name, style]) => [name, scaleTextStyle(style, factor)])),
  ) as Theme['typography'];
}

function buildTheme(scheme: SchemeName, seniorMode: boolean): Theme {
  const textScale = seniorMode ? aines.facteurTexte : 1;
  return Object.freeze({
    scheme,
    seniorMode,
    colors: themes[scheme],
    shadows: shadows[scheme],
    typography: scaleTypography(textScale),
    textScale,
    touchTarget: seniorMode ? aines.cibleTactile : size.cibleTactile,
  });
}

// Les quatre thèmes sont calculés une fois : un même choix renvoie le même objet, ce qui évite
// de redessiner tous les écrans quand rien n'a changé.
const cache: ReadonlyMap<string, Theme> = new Map(
  schemeNames.flatMap((scheme) =>
    [false, true].map((senior) => [`${scheme}:${String(senior)}`, buildTheme(scheme, senior)]),
  ),
);

/** Thème pour un schéma (Jour ou Nuit) et le mode Aînés. */
export function getTheme({ scheme, seniorMode }: ThemeOptions): Theme {
  const theme = cache.get(`${scheme}:${String(seniorMode)}`);
  if (!theme) throw new Error(`Schéma de couleurs inconnu : ${scheme}`);
  return theme;
}

/**
 * Schéma de la charte pour la préférence du téléphone (`useColorScheme()` de React Native).
 * Sans préférence connue, l'interface est en Jour.
 */
export function schemeFromSystem(colorScheme: string | null | undefined): SchemeName {
  return colorScheme === 'dark' ? 'nuit' : 'jour';
}
