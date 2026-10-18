// Outils communs aux tests de rendu des composants : rendu sous un thème donné (Jour ou Nuit,
// mode Aînés, animations réduites), lecture des styles, contrôles d'accessibilité de la charte
// (contraste du texte, texte agrandi sans troncature).
import { render, type RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';

import { CONTRAST_TEXT, contrastRatio } from '../src/contrast';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { aines, size, themes, type SchemeName } from '../src/tokens';

/** Nœud rendu, tel que les requêtes de Testing Library le renvoient. */
export type TestNode = ReturnType<RenderResult['getByText']>;

export interface ThemeCase {
  readonly scheme: SchemeName;
  readonly seniorMode: boolean;
  readonly reduceMotion?: boolean;
}

/** Les quatre thèmes : Jour et Nuit, avec et sans mode Aînés. */
export const THEME_CASES: readonly ThemeCase[] = (['jour', 'nuit'] as const).flatMap((scheme) =>
  [false, true].map((seniorMode) => ({ scheme, seniorMode })),
);

export function caseName({ scheme, seniorMode }: ThemeCase): string {
  return `${scheme}${seniorMode ? ', mode Aînés' : ''}`;
}

/** Zone touchable attendue : 48, ou 56 en mode Aînés. */
export function touchTargetFor({ seniorMode }: ThemeCase): number {
  return seniorMode ? aines.cibleTactile : size.cibleTactile;
}

export function renderThemed(ui: ReactElement, theme: ThemeCase): RenderResult {
  return render(
    <ThemeProvider
      scheme={theme.scheme}
      seniorMode={theme.seniorMode}
      reduceMotion={theme.reduceMotion ?? false}
    >
      {ui}
    </ThemeProvider>,
  );
}

export function flat(style: unknown): Record<string, unknown> {
  // flatten renvoie undefined pour un style absent, malgré son type.
  const flattened = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;
  return flattened ?? {};
}

function isOpaqueHex(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

/** Fond réellement peint derrière un élément : le premier parent au fond opaque. */
export function backgroundBehind(node: TestNode, pageBackground: string): string {
  let current: TestNode | null = node;
  while (current !== null) {
    const bg = flat(current.props.style).backgroundColor;
    if (isOpaqueHex(bg)) return bg;
    current = current.parent;
  }
  return pageBackground;
}

/** Élément natif du nom donné (« Text », « RCTScrollView »). */
export function isHost(node: TestNode, name: string): boolean {
  return (node.type as unknown) === name;
}

/** Tous les textes affichés (éléments natifs Text). */
export function hostTexts(view: RenderResult): TestNode[] {
  return view.UNSAFE_root.findAll((node) => isHost(node, 'Text'));
}

/**
 * Chaque texte atteint 4,5:1 sur ce qui est derrière lui. Un composant sans fond propre se pose
 * sur `fond` (écran) ou `fondCarte` (carte, feuille) : le texte doit tenir sur les deux.
 */
export function expectReadableTexts(view: RenderResult, scheme: SchemeName): void {
  const colors = themes[scheme];
  const texts = hostTexts(view);
  expect(texts.length).toBeGreaterThan(0);
  const failures: string[] = [];
  for (const text of texts) {
    const color = flat(text.props.style).color;
    if (!isOpaqueHex(color)) {
      failures.push(`« ${String(text.props.children)} » : couleur ${String(color)}`);
      continue;
    }
    for (const page of [colors.fond, colors.fondCarte]) {
      const background = backgroundBehind(text, page);
      const ratio = contrastRatio(color, background);
      if (ratio < CONTRAST_TEXT) {
        failures.push(
          `« ${String(text.props.children)} » : ${ratio.toFixed(2)}:1 (${color} sur ${background})`,
        );
      }
    }
  }
  expect(failures).toEqual([]);
}

/**
 * Texte du téléphone à 200 % sans troncature : aucun texte n'est limité en lignes ni en
 * agrandissement, et aucun ancêtre n'a de hauteur fixe (seulement des hauteurs minimales).
 */
export function expectScalableTexts(view: RenderResult): void {
  for (const text of hostTexts(view)) {
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    expect(text.props.adjustsFontSizeToFit).not.toBe(true);
    let current: TestNode | null = text;
    while (current !== null) {
      const style = flat(current.props.style);
      const label = String(text.props.children);
      expect({ text: label, height: style.height }).toEqual({ text: label, height: undefined });
      expect(style.maxHeight).toBeUndefined();
      current = current.parent;
    }
  }
}

/** Hauteur touchable effective d'un élément : hauteur minimale, plus son hitSlop. */
export function touchHeight(node: TestNode): number {
  const own = flat(node.props.style).minHeight;
  const inner = node.findAll((n) => typeof flat(n.props.style).minHeight === 'number');
  const heights = [own, ...inner.map((n) => flat(n.props.style).minHeight)].filter(
    (h): h is number => typeof h === 'number',
  );
  const slop = node.props.hitSlop as { top?: number; bottom?: number } | undefined;
  return Math.max(0, ...heights) + (slop?.top ?? 0) + (slop?.bottom ?? 0);
}

/** Valeur numérique d'un style, animé ou non (Animated.Value en test). */
export function numeric(value: unknown): number {
  if (typeof value === 'number') return value;
  const animated = value as { __getValue?: () => unknown } | null;
  const inner = animated?.__getValue?.();
  return typeof inner === 'number' ? inner : Number.NaN;
}
