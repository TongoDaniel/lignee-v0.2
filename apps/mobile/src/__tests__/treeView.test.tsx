// L'arbre à l'écran (T-017) : dessin limité à l'écran et sa marge, boutons de zoom (ACC-06),
// parcours en liste, réduction des animations. Skia, Reanimated et Gesture Handler sont simulés
// (jest.setup.ts) : le rendu réel et les gestes se vérifient sur le téléphone (issue #34).
import { generateTree } from '@lignee/domain/tree-generator';
import {
  buildOutline,
  buildScene,
  clampViewport,
  indexScene,
  layoutTree,
  sceneSpecIssues,
} from '@lignee/layout';
import { devReaderSnapshot } from '@lignee/sync/dev-seed';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { cancelAnimation, withTiming } from 'react-native-reanimated';

import { AppProviders } from '../AppProviders';
import { sceneSpecFor } from '../tree/sceneSpec';
import { modelFromSnapshot } from '../tree/treeModel';
import { TreeCanvas } from '../tree/TreeCanvas';
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

async function renderTree(options: { reduceMotion?: boolean; seniorMode?: boolean } = {}) {
  const built = model();
  // Le lecteur d'écran répond après le premier rendu : on laisse la réponse arriver dans `act`.
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
  await act(() => Promise.resolve());
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

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(withTiming).mockClear();
});

describe('TreeView — dessin', () => {
  it('ne peint que ce qui est à l’écran et sa marge (ARB-02)', async () => {
    const built = await renderTree();
    expect(screen.queryByTestId('skia-Canvas')).toBeNull();
    layOut();
    expect(screen.getByTestId('skia-Canvas')).toBeTruthy();
    const circles = screen.getAllByTestId('skia-Circle').length;
    expect(circles).toBeGreaterThan(0);
    // 300 personnes générées : un écran de téléphone et sa marge n'en peignent qu'une petite part.
    expect(circles).toBeLessThan(built.graph.people.length / 3);
  });

  it('chaque bouton porte un verbe et un libellé complet pour le lecteur d’écran', async () => {
    await renderTree();
    expect(screen.getByLabelText('Agrandir l’arbre')).toBeTruthy();
    expect(screen.getByLabelText('Réduire l’arbre')).toBeTruthy();
    expect(screen.getByLabelText('Voir tout l’arbre')).toBeTruthy();
    expect(screen.getByLabelText('Parcourir en liste')).toBeTruthy();
  });
});

describe('TreeView — zoom sans pincer (ACC-06)', () => {
  it('« + » puis « − » parcourent tous les crans jusqu’aux butées', async () => {
    await renderTree();
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

  it('les boutons animent le zoom, sauf si le téléphone demande de réduire les animations', async () => {
    await renderTree({ reduceMotion: false });
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-zoom-in'));
    });
    expect(withTiming).toHaveBeenCalled();
  });

  it('avec « Réduire les animations », le cadre change sans animation', async () => {
    await renderTree({ reduceMotion: true });
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-zoom-in'));
      fireEvent.press(screen.getByTestId('tree-fit'));
    });
    expect(withTiming).not.toHaveBeenCalled();
  });
});

describe('TreeView — parcours en liste (ACC-06)', () => {
  it('la liste donne les parents, les conjoints et les enfants ; un nom mène à cette personne', async () => {
    const built = await renderTree();
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

  it('revenir au dessin depuis une personne non dessinée recentre sur sa voisine dessinée', async () => {
    // Un enfant d'un foyer replié n'est pas sur le dessin : on y va par les boutons de la liste,
    // de proche en proche depuis « Vous ».
    const built = model();
    const outline = buildOutline(layoutTree(built.graph, built.centerId));
    const neighbours = (id: string) => {
      const entry = outline.get(id);
      return [
        ...(entry?.parents.flatMap((parents) => parents.parentIds) ?? []),
        ...(entry?.unions.flatMap((union) => [
          ...(union.partnerId === undefined ? [] : [union.partnerId]),
          ...union.childIds,
        ]) ?? []),
      ];
    };
    const previous = new Map<string, string>();
    const queue = [built.centerId];
    let hiddenId: string | undefined;
    for (let id = queue.shift(); id !== undefined && hiddenId === undefined; id = queue.shift()) {
      for (const next of neighbours(id)) {
        if (next === built.centerId || previous.has(next)) continue;
        previous.set(next, id);
        if (outline.get(next)?.drawn === false && (built.cards.get(next)?.fullName ?? '') !== '') {
          hiddenId = next;
          break;
        }
        queue.push(next);
      }
    }
    if (hiddenId === undefined) throw new Error('no hidden person in the generated tree');
    const path: string[] = [];
    for (let id: string | undefined = hiddenId; id !== undefined && id !== built.centerId;) {
      path.unshift(id);
      id = previous.get(id);
    }
    render(
      <AppProviders theme={{ reduceMotion: true }}>
        <TreeView model={built} />
      </AppProviders>,
    );
    await act(() => Promise.resolve());
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    for (const id of path) {
      act(() => {
        fireEvent.press(screen.getByTestId(`outline-go-${id}`));
      });
    }
    expect(screen.getByText('pas encore sur le dessin')).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-drawing'));
    });
    // Le dessin revient, même si la personne choisie n'y est pas.
    expect(screen.getByTestId('tree-zoom-in')).toBeTruthy();
    expect(screen.queryByTestId('tree-list')).toBeNull();
  });

  it('avec un lecteur d’écran actif, la liste est proposée d’office', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await renderTree();
    expect(screen.getByTestId('tree-list')).toBeTruthy();
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

describe('TreeCanvas — cadre au repos', () => {
  it('le dessin ne reste jamais hors de vue : un cadre lointain est ramené dans les bornes', async () => {
    const built = model(80);
    const spec = sceneSpecFor({ seniorScale: 1, systemFontScale: 1, touchTarget: 48 });
    const layout = layoutTree(built.graph, built.centerId);
    const scene = buildScene(layout, spec);
    const size = { width: 360, height: 800 };
    const onSettle = jest.fn();
    const far = { scale: 1, x: 1_000_000, y: -1_000_000 };
    render(
      <AppProviders theme={{ reduceMotion: true }}>
        <TreeCanvas
          scene={scene}
          index={indexScene(scene)}
          size={size}
          cards={built.cards}
          missingOf={new Map()}
          youId={built.centerId}
          selectedId={undefined}
          initialViewport={{ scale: 1, x: 0, y: 0 }}
          command={{ id: 1, viewport: far }}
          onSettle={onSettle}
          onActivate={jest.fn()}
        />
      </AppProviders>,
    );
    await act(() => Promise.resolve());
    const calls = onSettle.mock.calls as [typeof far][];
    const settled = calls[calls.length - 1]?.[0] as typeof far;
    expect(settled).not.toEqual(far);
    expect(clampViewport(settled, size, scene.bounds)).toEqual(settled);
  });
});

describe('TreeView — « Vous »', () => {
  it('l’avatar doré a son dégradé et la mention « Vous » sous lui', async () => {
    await renderTree();
    layOut();
    expect(screen.getAllByTestId('skia-LinearGradient').length).toBeGreaterThan(0);
    const labels = screen
      .getAllByTestId('skia-Text')
      .map((node) => (node.props as { accessibilityLabel?: string }).accessibilityLabel);
    expect(labels).toContain('"Vous"');
  });
});

/** Premier bouton « Aller à … » de la liste dont la personne a un nom : sa personne et son nom. */
function firstNamedInList(built: ReturnType<typeof model>) {
  const button = screen
    .queryAllByTestId(/^outline-go-/)
    .find(
      (candidate) =>
        (built.cards.get(String(candidate.props.testID).replace('outline-go-', ''))?.fullName ??
          '') !== '',
    );
  if (button === undefined) throw new Error('no named person in the list');
  const id = String(button.props.testID).replace('outline-go-', '');
  return { button, id, name: built.cards.get(id)?.fullName ?? '' };
}

describe('TreeView — retour à « Vous » et recentrage (ARB-09)', () => {
  it('« Revenir à Vous » est un bouton nommé pour le lecteur d’écran, au dessin comme en liste', async () => {
    await renderTree();
    layOut();
    expect(screen.getByLabelText('Revenir à Vous, au centre de l’arbre')).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    expect(screen.getByTestId('tree-go-you')).toBeTruthy();
    expect(screen.getByLabelText('Revenir à Vous, au centre de l’arbre')).toBeTruthy();
  });

  it('recentrer sur une personne choisie ouvre le fil d’Ariane ; « Vous » le referme en une touche', async () => {
    const built = await renderTree();
    layOut();
    expect(screen.queryByTestId('tree-recenter')).toBeNull();
    expect(screen.queryByTestId('tree-trail')).toBeNull();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    const { button, name } = firstNamedInList(built);
    act(() => {
      fireEvent.press(button);
    });
    // Le bouton dit sur qui l'arbre sera centré.
    expect(screen.getByLabelText(`Recentrer l’arbre sur ${name}`)).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-recenter'));
    });
    expect(screen.getByTestId('tree-trail')).toBeTruthy();
    expect(screen.getByTestId('tree-trail-current')).toHaveTextContent(name);
    expect(screen.queryByTestId('tree-recenter')).toBeNull();
    // Une seule touche ramène à « Vous » : le fil disparaît.
    act(() => {
      fireEvent.press(screen.getByTestId('tree-go-you'));
    });
    expect(screen.queryByTestId('tree-trail')).toBeNull();
  });

  it('une étape du fil ramène à cette personne', async () => {
    const built = await renderTree();
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    const first = firstNamedInList(built);
    act(() => {
      fireEvent.press(first.button);
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-recenter'));
    });
    // Du centre actuel, une autre personne nommée de la liste, puis on revient à la première étape.
    const next = screen
      .queryAllByTestId(/^outline-go-/)
      .map((candidate) => String(candidate.props.testID).replace('outline-go-', ''))
      .find(
        (id) =>
          id !== first.id && id !== built.centerId && (built.cards.get(id)?.fullName ?? '') !== '',
      );
    if (next === undefined) throw new Error('no second person to recenter on');
    act(() => {
      fireEvent.press(screen.getByTestId(`outline-go-${next}`));
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-recenter'));
    });
    expect(screen.getByTestId(`tree-trail-${first.id}`)).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByTestId(`tree-trail-${first.id}`));
    });
    expect(screen.getByTestId('tree-trail-current')).toHaveTextContent(first.name);
  });
});

describe('TreeView — l’arbre pousse (ARB-13)', () => {
  it('à l’ouverture, l’arbre pousse sur la durée du plan quand les animations sont permises', async () => {
    await renderTree({ reduceMotion: false });
    layOut();
    const calls = jest.mocked(withTiming).mock.calls;
    const growth = calls.find(([, options]) => options?.duration !== undefined);
    expect(growth).toBeDefined();
    // Durée totale = au moins le temps d'un trait (jeton « arbre »), jamais une valeur en dur.
    expect(growth?.[1]?.duration).toBeGreaterThanOrEqual(600);
    expect(growth?.[0]).toBe(growth?.[1]?.duration);
  });

  it('réglage « Réduire les animations » : ni pousse, ni recentrage, ni retour animés', async () => {
    const built = await renderTree({ reduceMotion: true });
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    const { button } = firstNamedInList(built);
    act(() => {
      fireEvent.press(button);
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-recenter'));
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-drawing'));
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-go-you'));
      fireEvent.press(screen.getByTestId('tree-zoom-in'));
      fireEvent.press(screen.getByTestId('tree-go-you'));
    });
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('un recentrage fait pousser l’arbre sans animer le trajet du cadre', async () => {
    const built = await renderTree({ reduceMotion: false });
    layOut();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-list'));
    });
    const { button } = firstNamedInList(built);
    act(() => {
      fireEvent.press(button);
    });
    act(() => {
      fireEvent.press(screen.getByTestId('tree-show-drawing'));
    });
    jest.mocked(withTiming).mockClear();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-recenter'));
    });
    const calls = jest.mocked(withTiming).mock.calls;
    // Une seule animation : la pousse. Les trois du cadre (échelle, x, y) n'ont pas lieu.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]?.duration).toBeGreaterThanOrEqual(600);
  });

  it('le retour à « Vous » depuis un cadre déplacé anime le cadre, tel que le prévoit la charte', async () => {
    await renderTree({ reduceMotion: false });
    layOut();
    // Le cadre est d'abord déplacé (zoom), puis le retour le ramène.
    act(() => {
      fireEvent.press(screen.getByTestId('tree-zoom-in'));
    });
    jest.mocked(withTiming).mockClear();
    act(() => {
      fireEvent.press(screen.getByTestId('tree-go-you'));
    });
    expect(withTiming).toHaveBeenCalledTimes(3);
  });

  function inTree(reduceMotion: boolean, built: ReturnType<typeof model>) {
    return (
      <AppProviders theme={{ reduceMotion, seniorMode: false }}>
        <TreeView model={built} />
      </AppProviders>
    );
  }

  it('le réglage qui passe de « réduire » à « permettre » ne rejoue pas une pousse ancienne', async () => {
    const built = model();
    const view = render(inTree(true, built));
    await act(() => Promise.resolve());
    layOut();
    view.rerender(inTree(false, built));
    await act(() => Promise.resolve());
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('le réglage qui passe à « réduire » en pleine pousse l’arrête', async () => {
    const built = model();
    const view = render(inTree(false, built));
    await act(() => Promise.resolve());
    layOut();
    expect(withTiming).toHaveBeenCalled();
    jest.mocked(cancelAnimation).mockClear();
    view.rerender(inTree(true, built));
    await act(() => Promise.resolve());
    expect(cancelAnimation).toHaveBeenCalled();
  });
});
