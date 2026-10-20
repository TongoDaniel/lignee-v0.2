// L'arbre à l'écran (T-017) : dessin limité à l'écran et sa marge, boutons de zoom (ACC-06),
// parcours en liste, réduction des animations. Skia, Reanimated et Gesture Handler sont simulés
// (jest.setup.ts) : le rendu réel et les gestes se vérifient sur le téléphone (issue #34).
import { generateTree } from '@lignee/domain/tree-generator';
import { sceneSpecIssues } from '@lignee/layout';
import { devReaderSnapshot } from '@lignee/sync/dev-seed';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { withTiming } from 'react-native-reanimated';

import { AppProviders } from '../AppProviders';
import { sceneSpecFor } from '../tree/sceneSpec';
import { modelFromSnapshot } from '../tree/treeModel';
import { TreeView } from '../tree/TreeView';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

function model(size = 300) {
  const generated = generateTree({ seed: 7, size });
  const reader = generated.accounts[0];
  if (reader === undefined) throw new Error('no account');
  const built = modelFromSnapshot(devReaderSnapshot(generated, reader.accountId));
  if (built === undefined) throw new Error('empty model');
  return built;
}

function renderTree(options: { reduceMotion?: boolean; seniorMode?: boolean } = {}) {
  const built = model();
  render(
    <AppProviders
      theme={{
        reduceMotion: options.reduceMotion ?? true,
        seniorMode: options.seniorMode ?? false,
      }}
    >
      <TreeView model={built} />
    </AppProviders>,
  );
  return built;
}

function layOut(width = 360, height = 800) {
  act(() => {
    fireEvent(screen.getByTestId('tree-area'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    });
  });
}

function isDisabled(testID: string): boolean {
  const props = screen.getByTestId(testID).props as { accessibilityState?: { disabled?: boolean } };
  return props.accessibilityState?.disabled === true;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(withTiming).mockClear();
});

describe('TreeView — dessin', () => {
  it('ne peint que ce qui est à l’écran et sa marge (ARB-02)', () => {
    const built = renderTree();
    expect(screen.queryByTestId('skia-Canvas')).toBeNull();
    layOut();
    expect(screen.getByTestId('skia-Canvas')).toBeTruthy();
    const circles = screen.getAllByTestId('skia-Circle').length;
    expect(circles).toBeGreaterThan(0);
    // 300 personnes générées : un écran de téléphone et sa marge n'en peignent qu'une petite part.
    expect(circles).toBeLessThan(built.graph.people.length / 3);
  });

  it('chaque bouton porte un verbe et un libellé complet pour le lecteur d’écran', () => {
    renderTree();
    expect(screen.getByLabelText('Agrandir l’arbre')).toBeTruthy();
    expect(screen.getByLabelText('Réduire l’arbre')).toBeTruthy();
    expect(screen.getByLabelText('Voir tout l’arbre')).toBeTruthy();
    expect(screen.getByLabelText('Parcourir en liste')).toBeTruthy();
  });
});

describe('TreeView — zoom sans pincer (ACC-06)', () => {
  it('« + » puis « − » parcourent tous les crans jusqu’aux butées', () => {
    renderTree();
    layOut();
    const stops = sceneSpecFor({ seniorScale: 1, systemFontScale: 1, touchTarget: 48 }).zoom.stops;
    expect(isDisabled('tree-zoom-in')).toBe(false);
    for (let press = 0; press < stops.length + 1 && !isDisabled('tree-zoom-in'); press += 1) {
      act(() => {
        fireEvent.press(screen.getByTestId('tree-zoom-in'));
      });
    }
    expect(isDisabled('tree-zoom-in')).toBe(true);
    expect(isDisabled('tree-zoom-out')).toBe(false);
    for (let press = 0; press < stops.length + 1 && !isDisabled('tree-zoom-out'); press += 1) {
      act(() => {
        fireEvent.press(screen.getByTestId('tree-zoom-out'));
      });
    }
    expect(isDisabled('tree-zoom-out')).toBe(true);
  });

  it('les boutons animent le zoom, sauf si le téléphone demande de réduire les animations', () => {
    renderTree({ reduceMotion: false });
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-zoom-in'));
    });
    expect(withTiming).toHaveBeenCalled();
  });

  it('avec « Réduire les animations », le cadre change sans animation', () => {
    renderTree({ reduceMotion: true });
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-zoom-in'));
      fireEvent.press(screen.getByTestId('tree-fit'));
    });
    expect(withTiming).not.toHaveBeenCalled();
  });
});

describe('TreeView — parcours en liste (ACC-06)', () => {
  it('la liste donne les parents, les conjoints et les enfants ; un nom mène à cette personne', () => {
    const built = renderTree();
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    expect(screen.getByTestId('tree-list')).toBeTruthy();
    expect(screen.queryByTestId('skia-Canvas')).toBeNull();
    const buttons = screen.queryAllByTestId(/^outline-go-/);
    expect(buttons.length).toBeGreaterThan(0);
    const first = buttons.find(
      (button) =>
        (built.cards.get(String(button.props.testID).replace('outline-go-', ''))?.fullName ??
          '') !== '',
    );
    if (first === undefined) throw new Error('no named person in the list');
    const targetId = String(first.props.testID).replace('outline-go-', '');
    expect(built.cards.has(targetId)).toBe(true);
    act(() => {
      fireEvent.press(first);
    });
    // La personne choisie est maintenant celle du bouton : son nom entier est le titre.
    const name = built.cards.get(targetId)?.fullName ?? '';
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    // Retour au dessin par un bouton.
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-drawing'));
    });
    expect(screen.getByTestId('tree-zoom-in')).toBeTruthy();
  });

  it('avec un lecteur d’écran actif, la liste est proposée d’office', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    renderTree();
    expect(await screen.findByTestId('tree-list')).toBeTruthy();
    expect(screen.queryByTestId('skia-Canvas')).toBeNull();
    expect(screen.getByTestId('tree-show-drawing')).toBeTruthy();
  });
});

describe('mesures du dessin dans l’app', () => {
  it.each([
    [1, 1, 48],
    [1.3, 1, 56],
    [1, 2, 48],
    [1.3, 2, 56],
    [1.3, 3, 56],
  ])(
    'mode Aînés ×%s, texte du téléphone ×%s : le contrat de la disposition tient',
    (senior, system, touch) => {
      const spec = sceneSpecFor({
        seniorScale: senior,
        systemFontScale: system,
        touchTarget: touch,
      });
      expect(sceneSpecIssues(spec)).toEqual([]);
      expect(spec.touchTarget).toBe(touch);
    },
  );

  it('le texte du téléphone n’agrandit le dessin que jusqu’à 200 %', () => {
    const at2 = sceneSpecFor({ seniorScale: 1, systemFontScale: 2, touchTarget: 48 });
    const at3 = sceneSpecFor({ seniorScale: 1, systemFontScale: 3, touchTarget: 48 });
    expect(at3.unitX).toBe(at2.unitX);
  });
});
