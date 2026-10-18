// Barre d'onglets principale : le toucher d'un onglet émet toujours `tabPress` (retour en haut,
// retour à la racine de la pile), et la navigation n'a lieu que si l'onglet n'est pas déjà ouvert.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppProviders } from '../AppProviders';
import { MainTabBar } from '../navigation/MainTabBar';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

function renderBar(index: number, defaultPrevented = false) {
  const emit = jest.fn(() => ({ defaultPrevented }));
  const navigate = jest.fn();
  const props = {
    state: {
      index,
      routes: [
        { key: 'index-1', name: 'index' },
        { key: 'family-1', name: 'family' },
      ],
    },
    navigation: { emit, navigate },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
  render(
    <AppProviders theme={{ reduceMotion: false }}>
      <MainTabBar {...props} />
    </AppProviders>,
  );
  return { emit, navigate };
}

describe('MainTabBar', () => {
  it('émet tabPress sur l’onglet déjà ouvert, sans naviguer', () => {
    const { emit, navigate } = renderBar(0);
    fireEvent.press(screen.getByTestId('tab-index'));
    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'index-1',
      canPreventDefault: true,
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('émet tabPress puis navigue vers un autre onglet', () => {
    const { emit, navigate } = renderBar(0);
    fireEvent.press(screen.getByTestId('tab-family'));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('family', undefined);
  });

  it('ne navigue pas si tabPress est empêché', () => {
    const { navigate } = renderBar(0, true);
    fireEvent.press(screen.getByTestId('tab-family'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
