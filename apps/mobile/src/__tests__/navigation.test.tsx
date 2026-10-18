// Tests de rendu de l'app entière (Expo Router, vrais fichiers de src/app) : barre d'onglets
// de la V1, écrans traduits et accessibles, langue de l'appareil suivie à chaud, thème Jour et
// Nuit, mode Aînés.
import { aines, getTheme, size, themes } from '@lignee/ui';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme, type ColorSchemeName } from 'react-native';

import TabsLayout from '../app/(tabs)/_layout';
import FamilyScreen from '../app/(tabs)/family';
import TreeScreen from '../app/(tabs)/index';
import { AppProviders } from '../AppProviders';

// Langues de l'appareil : `useLocales` d'expo-localization redessine quand le réglage du
// téléphone change. Le faux reproduit ce comportement avec un petit magasin.
jest.mock('expo-localization', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react');
  let locales: { languageTag: string }[] = [{ languageTag: 'fr-CM' }];
  const listeners = new Set<() => void>();
  return {
    useLocales: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => locales,
      ),
    __setDeviceLanguages: (tags: string[]) => {
      locales = tags.map((languageTag) => ({ languageTag }));
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
});
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const localization = jest.requireMock<{ __setDeviceLanguages: (tags: string[]) => void }>(
  'expo-localization',
);
const mockUseColorScheme = jest.mocked(useColorScheme);

function deviceLanguages(...tags: string[]): void {
  localization.__setDeviceLanguages(tags);
}

function deviceScheme(scheme: ColorSchemeName): void {
  mockUseColorScheme.mockReturnValue(scheme);
}

beforeEach(() => {
  deviceLanguages('fr-CM');
  deviceScheme('light');
});

const APP_DIR = './src/app';

async function renderApp(): Promise<ReturnType<typeof renderRouter>> {
  const view = renderRouter(APP_DIR, { initialUrl: '/' });
  await screen.findByTestId('screen-tree');
  return view;
}

function tabLabels(): unknown[] {
  return screen.getAllByRole('tab').map((tab): unknown => tab.props.accessibilityLabel);
}

function flat(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never);
}

describe('Barre d’onglets de la V1', () => {
  it('montre Arbre puis Famille, sans Santé (V3) ni Mémoire (V2)', async () => {
    await renderApp();
    expect(tabLabels()).toEqual(['Arbre', 'Famille']);
    expect(screen.queryByText(/Santé|Mémoire/)).toBeNull();
  });

  it('ouvre l’arbre par défaut et passe à Famille au toucher', async () => {
    const view = await renderApp();
    expect(view.getPathname()).toBe('/');
    expect(screen.getByTestId('tab-index')).toBeSelected();
    expect(screen.getByTestId('tab-family')).not.toBeSelected();

    fireEvent.press(screen.getByTestId('tab-family'));

    expect(await screen.findByTestId('screen-family')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/family');
    expect(screen.getByTestId('tab-family')).toBeSelected();
    expect(screen.getByTestId('tab-index')).not.toBeSelected();
  });

  it('donne à chaque onglet un rôle, un libellé, une indication et une zone de 48', async () => {
    await renderApp();
    expect(screen.getByTestId('main-tab-bar')).toBeOnTheScreen();
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.props.accessibilityLabel).toEqual(expect.any(String));
      expect(tab.props.accessibilityHint).toMatch(/^Affiche /);
      expect(flat(tab.props.style).minHeight).toBe(size.cibleTactile);
    }
  });

  it('colore l’onglet actif en `action` et graisse 600, l’inactif en `texteSecondaire`', async () => {
    await renderApp();
    const colors = themes.jour;
    const active = within(screen.getByTestId('tab-index')).getByText('Arbre');
    const inactive = within(screen.getByTestId('tab-family')).getByText('Famille');
    expect(flat(active.props.style)).toMatchObject({
      color: colors.action,
      fontFamily: 'InstrumentSans-SemiBold',
    });
    expect(flat(inactive.props.style)).toMatchObject({
      color: colors.texteSecondaire,
      fontFamily: 'InstrumentSans-Medium',
    });
    expect(flat(screen.getByTestId('main-tab-bar').props.style)).toMatchObject({
      backgroundColor: colors.fondCarte,
      borderTopColor: colors.filet,
    });
  });

  it('limite l’agrandissement du libellé d’onglet à 200 %, pas celui des écrans', async () => {
    await renderApp();
    const label = within(screen.getByTestId('tab-index')).getByText('Arbre');
    expect(label.props.maxFontSizeMultiplier).toBe(2);
    const title = screen.getByRole('header');
    expect(title.props.maxFontSizeMultiplier).toBeUndefined();
    expect(title.props.allowFontScaling).not.toBe(false);
    expect(title.props.numberOfLines).toBeUndefined();
  });
});

describe('Écrans traduits', () => {
  it('affiche le titre d’écran (en-tête) et le texte d’attente en français, en 17 au moins', async () => {
    await renderApp();
    expect(screen.getByRole('header')).toHaveTextContent('Arbre');
    const body = screen.getByText(/Votre arbre apparaîtra ici/);
    expect(flat(body.props.style).fontSize).toBeGreaterThanOrEqual(17);
  });

  it('suit la langue de l’appareil : anglais au démarrage', async () => {
    deviceLanguages('en-GB', 'fr-FR');
    await renderApp();
    expect(tabLabels()).toEqual(['Tree', 'Family']);
    expect(screen.getByText(/Your tree will appear here/)).toBeOnTheScreen();
  });

  it('change de langue à chaud quand la personne change celle du téléphone', async () => {
    await renderApp();
    expect(screen.getByText(/Votre arbre apparaîtra ici/)).toBeOnTheScreen();

    await act(async () => {
      deviceLanguages('en-US');
      await Promise.resolve();
    });

    expect(await screen.findByText(/Your tree will appear here/)).toBeOnTheScreen();
    expect(tabLabels()).toEqual(['Tree', 'Family']);
  });

  it('prend le français pour une langue non prise en charge', async () => {
    deviceLanguages('de-DE');
    await renderApp();
    expect(tabLabels()).toEqual(['Arbre', 'Famille']);
  });
});

describe('Thème et mode Aînés', () => {
  it('passe en Nuit quand le téléphone est en sombre', async () => {
    deviceScheme('dark');
    await renderApp();
    expect(flat(screen.getByTestId('main-tab-bar').props.style).backgroundColor).toBe(
      themes.nuit.fondCarte,
    );
    expect(flat(screen.getByTestId('screen-tree').props.style).backgroundColor).toBe(
      themes.nuit.fond,
    );
  });

  it('agrandit les zones à 56 et les textes × 1,3 en mode Aînés', async () => {
    const { Slot } = jest.requireActual<typeof import('expo-router')>('expo-router');
    function SeniorRoot({ children }: { children?: ReactNode }) {
      return <AppProviders theme={{ seniorMode: true }}>{children}</AppProviders>;
    }
    renderRouter(
      {
        _layout: () => (
          <SeniorRoot>
            <Slot />
          </SeniorRoot>
        ),
        '(tabs)/_layout': TabsLayout,
        '(tabs)/index': TreeScreen,
        '(tabs)/family': FamilyScreen,
      },
      { initialUrl: '/' },
    );
    await screen.findByTestId('screen-tree');
    for (const tab of screen.getAllByRole('tab')) {
      expect(flat(tab.props.style).minHeight).toBe(aines.cibleTactile);
    }
    const senior = getTheme({ scheme: 'jour', seniorMode: true });
    expect(flat(screen.getByRole('header').props.style).fontSize).toBe(
      senior.typography.titreEcran.fontSize,
    );
  });
});
