// Onglet Arbre (T-025) : toucher une personne choisie, ou « Ouvrir la fiche », ouvre sa fiche dans
// l'arbre affiché, par la route de T-024. La base locale et le routeur sont simulés ; le dessin
// et les gestes se vérifient sur le téléphone (issue #34).
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { AppProviders } from '../AppProviders';
import { notifyLocalChange } from '../db/localChanges';
import { profileRoute } from '../navigation/profileRoute';
import { pierreModel } from '../testing/pierre';
import type { TreeModel } from '../tree/treeModel';
import { TreeScreen, useTreeViewKey } from '../tree/TreeScreen';

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

// Le modèle lu dans la copie locale : celui de Pierre, remplacé par les tests de saisie (T-031).
const mockRead = jest.fn();
jest.mock('../tree/treeModel', () => ({
  ...jest.requireActual<typeof import('../tree/treeModel')>('../tree/treeModel'),
  readFirstTreeModel: (...args: unknown[]): unknown => mockRead(...args),
}));

beforeEach(() => {
  mockRead.mockImplementation(() => pierreModel().model);
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

/** Le modèle sans une personne, ni rien qui la cite (comme après une suppression). */
function withoutPerson(model: TreeModel, removed: string, centerId = model.centerId): TreeModel {
  const gone = new Set<string>([removed]);
  const graph = { ...model.graph } as Record<string, unknown>;
  for (let changed = true; changed;) {
    changed = false;
    for (const [key, value] of Object.entries(graph)) {
      if (!Array.isArray(value)) continue;
      const kept = value.filter((object: { id?: string }) => {
        const text = JSON.stringify(object);
        const cites = [...gone].some((id) => text.includes(id));
        if (cites && object.id !== undefined && !gone.has(object.id)) {
          gone.add(object.id);
          changed = true;
        }
        return !cites;
      });
      graph[key] = kept;
    }
  }
  return {
    ...model,
    graph: graph as unknown as TreeModel['graph'],
    cards: new Map([...model.cards].filter(([id]) => !gone.has(id))),
    centerId,
  };
}

describe('onglet Arbre — ajouter une personne (T-031)', () => {
  it('« Ajouter une personne » est dans la barre de l’arbre, parmi des actions secondaires', async () => {
    render(
      <AppProviders theme={{ reduceMotion: true }}>
        <TreeScreen />
      </AppProviders>,
    );
    await act(() => Promise.resolve());
    const { model } = pierreModel();
    const button = screen.getByTestId('tree-add-person');
    expect(screen.getByRole('button', { name: 'Ajouter une personne' })).toBeOnTheScreen();
    // Ni bouton posé sur le dessin, ni deuxième action principale : le bouton est dans la barre.
    const ancestors = (node: { parent: unknown }, depth: number): unknown[] => {
      const found: unknown[] = [];
      for (
        let current = node.parent as { parent: unknown } | null;
        current && found.length < depth;
      ) {
        found.push(current);
        current = current.parent as { parent: unknown } | null;
      }
      return found;
    };
    const goYou = ancestors(screen.getByTestId('tree-go-you'), 6);
    const shared = ancestors(button, 6).some((node) => goYou.includes(node));
    expect(shared).toBe(true);
    act(() => {
      fireEvent.press(button);
    });
    expect(router.push).toHaveBeenCalledWith(
      `/person/new?treeId=${encodeURIComponent(model.treeId)}`,
    );
  });

  it('une saisie enregistrée relit la copie locale : la nouvelle personne est dans la liste', async () => {
    render(
      <AppProviders theme={{ reduceMotion: true }}>
        <TreeScreen />
      </AppProviders>,
    );
    await act(() => Promise.resolve());
    const calls = mockRead.mock.calls.length;
    act(() => {
      notifyLocalChange();
    });
    expect(mockRead.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe('onglet Arbre — supprimer la personne au centre (T-031, R4)', () => {
  it('l’arbre ne plante pas et repart de la nouvelle personne « Vous »', async () => {
    const { model, scenario } = pierreModel();
    const jacques = scenario.id('jacques');
    render(
      <AppProviders theme={{ reduceMotion: true }}>
        <TreeScreen />
      </AppProviders>,
    );
    await act(() => Promise.resolve());
    // Le centre, la personne choisie et le fil d'Ariane sont ceux de Pierre ; Pierre est supprimé.
    mockRead.mockImplementation(() => withoutPerson(model, scenario.id('pierre'), jacques));
    expect(() => {
      act(() => {
        notifyLocalChange();
      });
    }).not.toThrow();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    expect(screen.queryByTestId(`outline-go-${scenario.id('pierre')}`)).toBeNull();
    expect(screen.getByTestId('tree-show-drawing')).toBeOnTheScreen();
    expect(jacques).toBeDefined();
  });

  it('la clé de la vue change quand une personne disparaît, pas quand une personne s’ajoute', () => {
    const { model, scenario } = pierreModel();
    const smaller = withoutPerson(model, scenario.id('vic'));
    const { result, rerender } = renderHook(
      ({ value }: { value: TreeModel }) => useTreeViewKey(value),
      { initialProps: { value: smaller } },
    );
    const first = result.current;
    rerender({ value: model });
    expect(result.current).toBe(first);
    rerender({ value: smaller });
    expect(result.current).not.toBe(first);
  });
});
