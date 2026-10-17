// Icônes, logo et fournisseur de thème : icônes recolorées (currentColor), décoratives sauf
// libellé, logo aux encres de son fond et compact sous 48, thème Jour et Nuit du téléphone, mode
// Aînés, réglage « Réduire les animations » suivi à chaud.
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text, useColorScheme } from 'react-native';
import { Circle, Path } from 'react-native-svg';

import { Icon, iconNames } from '../src/icons/Icon';
import { Logo, logoDrawingFor } from '../src/logo/Logo';
import { logoDrawings } from '../src/logo/logo.generated';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { aines, palette, size, stroke, themes, typography } from '../src/tokens';
import { renderThemed } from './helpers';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const jour = { scheme: 'jour', seniorMode: false } as const;
const nuit = { scheme: 'nuit', seniorMode: false } as const;

function paints(testID: string): Record<string, unknown>[] {
  return screen
    .getByTestId(testID, { includeHiddenElements: true })
    .findAll((n) => n.type === Path)
    .map((n) => {
      const props = n.props as Record<string, unknown>;
      return { fill: props['fill'], stroke: props['stroke'], strokeWidth: props['strokeWidth'] };
    });
}

describe('Icône', () => {
  it('compte les 37 icônes de la charte', () => {
    expect(iconNames).toHaveLength(37);
  });

  it('se dessine en `texte` du thème par défaut, trait de 2, en 24', () => {
    renderThemed(<Icon name="ajouter" testID="i" />, nuit);
    const svg = screen.getByTestId('i', { includeHiddenElements: true });
    expect(svg.props.width).toBe(size.iconeM);
    expect(paints('i')).toEqual([
      { fill: 'none', stroke: themes.nuit.texte, strokeWidth: stroke.icone },
    ]);
  });

  it('prend la couleur demandée (équivalent de currentColor), pleine pour `sante-plein`', () => {
    renderThemed(<Icon name="santePlein" color={themes.jour.sante} testID="i" />, jour);
    expect(paints('i').every((p) => p.fill === themes.jour.sante)).toBe(true);
  });

  it('est décorative sans libellé, une image nommée avec libellé', () => {
    renderThemed(<Icon name="prive" testID="i" />, jour);
    expect(screen.queryByTestId('i')).toBeNull();
    expect(screen.getByTestId('i', { includeHiddenElements: true })).toBeOnTheScreen();
    screen.unmount();
    renderThemed(<Icon name="prive" label="Visible par vous seul" />, jour);
    expect(screen.getByRole('image', { name: 'Visible par vous seul' })).toBeOnTheScreen();
  });
});

describe('Logo', () => {
  function inks(testID: string): Set<unknown> {
    const svg = screen.getByTestId(testID);
    return new Set(
      svg
        .findAll((n) => n.type === Path || n.type === Circle)
        .flatMap((n) => {
          const props = n.props as Record<string, unknown>;
          return [props['fill'], props['stroke']];
        })
        .filter((c) => c !== undefined && c !== 'none'),
    );
  }

  it('sur fond clair : symbole vert, logotype encre ; jamais d’or', () => {
    renderThemed(<Logo height={48} label="Lignée" testID="l" />, jour);
    expect(inks('l')).toEqual(new Set([palette.vert700, palette.encre900]));
    expect(screen.getByRole('image', { name: 'Lignée' })).toBeOnTheScreen();
  });

  it('sur Nuit : symbole or, logotype crème', () => {
    renderThemed(<Logo height={48} label="Lignée" testID="l" />, nuit);
    expect(inks('l')).toEqual(new Set([palette.or500, palette.creme50]));
  });

  it('le fond imposé l’emporte sur le thème', () => {
    renderThemed(
      <Logo variant="symbol" height={64} background="nuit" label="Lignée" testID="l" />,
      jour,
    );
    expect(inks('l')).toEqual(new Set([palette.or500]));
  });

  it('garde les proportions du dessin', () => {
    renderThemed(<Logo height={40} label="Lignée" testID="l" />, jour);
    const [, , w = 0, h = 1] = logoDrawings.horizontal.viewBox.split(' ').map(Number);
    expect(screen.getByTestId('l').props.width).toBeCloseTo((40 * w) / h);
  });

  it('sous 48, le symbole compact', () => {
    expect(logoDrawingFor('symbol', 32)).toBe(logoDrawings.symbolCompact);
    expect(logoDrawingFor('symbol', 48)).toBe(logoDrawings.symbol);
    expect(logoDrawingFor('horizontal', 32)).toBe(logoDrawings.horizontal);
  });
});

function Probe() {
  const theme = useTheme();
  return (
    <Text testID="probe">
      {[
        theme.scheme,
        String(theme.seniorMode),
        String(theme.touchTarget),
        String(theme.reduceMotion),
        String(theme.typography.corps.fontSize),
      ].join('|')}
    </Text>
  );
}

describe('Fournisseur de thème', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('suit le téléphone : Nuit quand il est en sombre', () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');
    render(
      <ThemeProvider reduceMotion={false}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `nuit|false|${String(size.cibleTactile)}|false|${String(typography.corps.fontSize)}`,
    );
  });

  it('mode Aînés : zones de 56, texte × 1,3', () => {
    render(
      <ThemeProvider scheme="jour" seniorMode reduceMotion={false}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `jour|true|${String(aines.cibleTactile)}|false|${String(typography.corps.fontSize * aines.facteurTexte)}`,
    );
  });

  it('suit à chaud le réglage « Réduire les animations » du téléphone', async () => {
    let listener: ((value: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler as unknown as (value: boolean) => void;
      return { remove: jest.fn() } as never;
    });
    render(
      <ThemeProvider scheme="jour">
        <Probe />
      </ThemeProvider>,
    );
    // Réduit tant que le système n'a pas répondu, puis la réponse du système.
    expect(screen.getByTestId('probe')).toHaveTextContent(/\|true\|17$/);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('probe')).toHaveTextContent(/\|false\|17$/);
    act(() => {
      listener?.(true);
    });
    expect(screen.getByTestId('probe')).toHaveTextContent(/\|true\|17$/);
  });
});
