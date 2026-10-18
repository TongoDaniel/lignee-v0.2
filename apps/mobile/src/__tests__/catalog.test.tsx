// Page de revue des composants (développement seulement) : accessible depuis l'onglet Arbre,
// rendue avec les composants de @lignee/ui, ses réglages d'affichage changent le thème de la page.
import { themes } from '@lignee/ui';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

function flat(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never);
}

async function openCatalog(): Promise<void> {
  renderRouter('./src/app', { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('open-catalog'));
  await screen.findByTestId('screen-catalog');
}

describe('Page des composants', () => {
  it('s’ouvre depuis l’onglet Arbre en développement, avec un retour nommé', async () => {
    await openCatalog();
    expect(screen.getByRole('header', { name: 'Composants de la charte' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Revenir en arrière' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ajouter votre mère' })).toBeOnTheScreen();
  });

  it('passe la page en Nuit et en mode Aînés depuis ses réglages', async () => {
    await openCatalog();
    const background = () => flat(screen.getByTestId('catalog-page').props.style).backgroundColor;
    expect(background()).toBe(themes.jour.fond);
    fireEvent.press(screen.getByRole('switch', { name: 'Thème Nuit' }));
    expect(background()).toBe(themes.nuit.fond);
    fireEvent.press(screen.getByRole('switch', { name: 'Mode Aînés' }));
    // En mode Aînés, le micro est proposé d'office dans le champ.
    expect(screen.getByRole('button', { name: 'Dicter le prénom' })).toBeOnTheScreen();
  });

  it('affiche la confirmation au toucher', async () => {
    await openCatalog();
    fireEvent.press(screen.getByRole('button', { name: 'Afficher la confirmation' }));
    expect(await screen.findByText('Lucienne a rejoint l’arbre.')).toBeOnTheScreen();
  });
});
