// Onglet Arbre (T-025) : toucher une personne choisie, ou « Ouvrir la fiche », ouvre sa fiche dans
// l'arbre affiché, par la route de T-024. La base locale et le routeur sont simulés ; le dessin
// et les gestes se vérifient sur le téléphone (issue #34).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { AppProviders } from '../AppProviders';
import { profileRoute } from '../navigation/profileRoute';
import { pierreModel } from '../testing/pierre';
import { TreeScreen } from '../tree/TreeScreen';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

jest.mock('expo-router', () => ({
  ...jest.requireActual<typeof import('expo-router')>('expo-router'),
  router: { push: jest.fn() },
}));

jest.mock('../db/LocalDatabaseProvider', () => ({
  ...jest.requireActual<typeof import('../db/LocalDatabaseProvider')>(
    '../db/LocalDatabaseProvider',
  ),
  useLocalDatabase: () => ({ status: 'ready', db: {} }),
}));

jest.mock('../tree/treeModel', () => ({
  ...jest.requireActual<typeof import('../tree/treeModel')>('../tree/treeModel'),
  readFirstTreeModel: () =>
    jest.requireActual<typeof import('../testing/pierre')>('../testing/pierre').pierreModel().model,
}));

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(router.push).mockClear();
});

describe('onglet Arbre — ouvrir une fiche', () => {
  it('« Ouvrir la fiche » mène à la route de la fiche, dans l’arbre affiché', async () => {
    render(
      <AppProviders theme={{ reduceMotion: true }}>
        <TreeScreen />
      </AppProviders>,
    );
    await act(() => Promise.resolve());
    const { model, scenario } = pierreModel();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    // Les identifiants du modèle simulé sont ceux d'une construction identique et déterministe.
    const odile = scenario.id('odile');
    act(() => {
      fireEvent.press(screen.getByTestId(`outline-go-${odile}`));
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-open-profile'));
    });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(profileRoute(odile, model.treeId));
  });
});
