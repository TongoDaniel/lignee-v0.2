// Filtres (ARB-11) et vue « descendance » (ARB-14) à l'écran, avec ouverture de la fiche (T-025).
// Le canevas Skia est remplacé par une vue qui garde les propriétés reçues : ce que l'écran lui
// donne à peindre (scène, personnes atténuées, pousse) se lit sans téléphone. Le rendu réel, les
// gestes et la fluidité se vérifient sur l'Android de référence (issue #34).
import type { Id } from '@lignee/domain';
import type { ScenePerson, SceneHit } from '@lignee/layout';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { AppProviders } from '../AppProviders';
import { pierreModel } from '../testing/pierre';
import type { TreeCanvasProps } from '../tree/TreeCanvas';
import { TreeView } from '../tree/TreeView';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

let mockCanvas: TreeCanvasProps | undefined;
jest.mock('../tree/TreeCanvas', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    TreeCanvas: (props: TreeCanvasProps) => {
      mockCanvas = props;
      return <View testID={props.testID} />;
    },
  };
});

function canvas(): TreeCanvasProps {
  if (mockCanvas === undefined) throw new Error('canvas not rendered');
  return mockCanvas;
}

async function renderTree(
  centerKey: string,
  options: { reduceMotion?: boolean; seniorMode?: boolean; onOpenPerson?: (id: Id) => void } = {},
) {
  mockCanvas = undefined;
  const built = pierreModel(centerKey);
  render(
    <AppProviders
      theme={{
        reduceMotion: options.reduceMotion ?? true,
        seniorMode: options.seniorMode ?? false,
      }}
    >
      <TreeView
        model={built.model}
        {...(options.onOpenPerson === undefined ? {} : { onOpenPerson: options.onOpenPerson })}
      />
    </AppProviders>,
  );
  await act(() => Promise.resolve());
  act(() => {
    fireEvent(screen.getByTestId('tree-area'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 800 } },
    });
  });
  return built;
}

function press(testID: string) {
  act(() => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Choisit un filtre : la feuille se referme en 360 ms, on attend la fin de son animation. */
async function chooseFilter(testID: string) {
  press(testID);
  await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
}

function keysOf(scenario: { keyOf: (id: Id) => string }, ids: Iterable<Id> | undefined): string[] {
  return [...(ids ?? [])].map((id) => scenario.keyOf(id)).sort();
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('filtres de l’arbre (ARB-11)', () => {
  it('le bouton « Filtrer » est nommé, et la feuille propose côté, vie, foyer et branche', async () => {
    await renderTree('luc');
    expect(screen.getByLabelText('Filtrer l’arbre')).toBeTruthy();
    press('tree-filters-open');
    expect(screen.getByTestId('filter-side-paternal')).toBeTruthy();
    expect(screen.getByTestId('filter-side-maternal')).toBeTruthy();
    expect(screen.getByTestId('filter-vital-living')).toBeTruthy();
    expect(screen.getByTestId('filter-vital-deceased')).toBeTruthy();
    expect(screen.getAllByTestId(/^filter-foyer-/)).toHaveLength(1);
    // Un verbe, un nom, et le nombre de personnes gardées, lu avec la ligne.
    expect(screen.getByLabelText('Côté paternel, 10 personnes')).toBeTruthy();
    expect(screen.getByLabelText('Foyer avec Zoe, 3 personnes')).toBeTruthy();
    expect(screen.getByText('Branche de Jean')).toBeTruthy();
  });

  it('choisir le côté paternel n’atténue que ceux qui n’en sont pas, et l’annonce', async () => {
    const { scenario } = await renderTree('luc');
    expect(canvas().matching).toBeUndefined();
    press('tree-filters-open');
    await chooseFilter('filter-side-paternal');
    // Luc : père Jean, mère Anne. Côté paternel : Jean, ses parents Pierre et Rose, ses grands-parents
    // Jacques et Léa, et leurs autres descendants (André, Marthe, Paul, Noé, Tom). Ni Anne, ni
    // sa famille, ni les conjoints (Odile, Clarisse, Serge).
    expect(keysOf(scenario, canvas().matching)).toEqual(
      ['andre', 'jacques', 'jean', 'lea', 'marthe', 'noe', 'paul', 'pierre', 'rose', 'tom'].sort(),
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Filtre Côté paternel appliqué, 10 personnes.',
    );
    // Le filtre actif se lit en texte : son nom, le nombre de personnes, et le moyen de le retirer.
    const banner = screen.getByTestId('tree-filter-active');
    expect(within(banner).getByText('Côté paternel')).toBeTruthy();
    expect(within(banner).getByText('10 personnes')).toBeTruthy();
    expect(within(banner).getByLabelText('Retirer le filtre Côté paternel')).toBeTruthy();
    // Les personnes atténuées restent sur le dessin : la scène n'est pas modifiée.
    expect(canvas().scene.personById.has(scenario.id('anne'))).toBe(true);
    expect(canvas().matching?.has(scenario.id('anne'))).toBe(false);
  });

  it('« Retirer le filtre » réaffiche tout le monde et l’annonce', async () => {
    await renderTree('luc');
    press('tree-filters-open');
    await chooseFilter('filter-vital-living');
    expect(canvas().matching).toBeDefined();
    press('tree-filter-clear');
    expect(canvas().matching).toBeUndefined();
    expect(screen.queryByTestId('tree-filter-active')).toBeNull();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Filtre retiré. Toute la famille est affichée.',
    );
  });

  it('le foyer ne garde que les deux conjoints et leurs enfants', async () => {
    const { scenario } = await renderTree('luc');
    press('tree-filters-open');
    await chooseFilter(String(screen.getAllByTestId(/^filter-foyer-/)[0]?.props.testID));
    expect(keysOf(scenario, canvas().matching)).toEqual(['luc', 'ugo', 'zoe']);
  });

  it('la branche garde la personne choisie, sa descendance et ses foyers', async () => {
    const { scenario } = await renderTree('luc');
    press('tree-filters-open');
    const jean = scenario.id('jean');
    await chooseFilter(`filter-branch-${jean}`);
    expect(keysOf(scenario, canvas().matching)).toEqual(
      ['anne', 'jean', 'lise', 'luc', 'ugo', 'vic', 'yvette', 'zoe'].sort(),
    );
  });

  it('recentrer retire le filtre : les côtés se comptent depuis la personne au centre', async () => {
    const { scenario } = await renderTree('luc');
    press('tree-filters-open');
    await chooseFilter('filter-side-maternal');
    expect(canvas().matching).toBeDefined();
    press('tree-show-list');
    press(`outline-go-${scenario.id('jean')}`);
    press('tree-recenter');
    expect(screen.queryByTestId('tree-filter-active')).toBeNull();
  });

  it('dans la liste, les personnes hors du filtre sont signalées, en texte et au lecteur d’écran', async () => {
    const { scenario } = await renderTree('luc');
    press('tree-filters-open');
    await chooseFilter('filter-side-paternal');
    press('tree-show-list');
    // Luc est au centre : ses parents sont listés. Jean est du côté paternel, Anne non.
    const jean = scenario.id('jean');
    const anne = scenario.id('anne');
    expect(screen.queryByTestId(`outline-outside-${jean}`)).toBeNull();
    expect(screen.getByTestId(`outline-outside-${anne}`)).toHaveTextContent('Hors du filtre');
    expect(screen.getByLabelText('Aller à Anne, hors du filtre')).toBeTruthy();
  });
});

describe('vue « descendance » (ARB-14)', () => {
  it('la descendance de Pierre montre ses trois foyers et leurs petits-enfants', async () => {
    const { scenario } = await renderTree('pierre');
    expect(screen.getByLabelText('Voir la descendance de Pierre')).toBeTruthy();
    press('tree-descendants');
    expect(screen.getByText('Descendance de Pierre')).toBeTruthy();
    // Le dessin est celui de la scène ordinaire, avec les 17 fiches de la descendance.
    expect(canvas().scene.people).toHaveLength(17);
    expect(keysOf(scenario, canvas().scene.personById.keys())).toEqual(
      [
        'pierre',
        'rose',
        'odile',
        'clarisse',
        'jean',
        'marthe',
        'paul',
        'anne',
        'serge',
        'luc',
        'lise',
        'noe',
        'tom',
        'zoe',
        'ugo',
        'yvette',
        'vic',
      ].sort(),
    );
    expect(canvas().scene.personById.has(scenario.id('jacques'))).toBe(false);
    // Le parcours en liste donne ses trois foyers.
    press('tree-show-list');
    expect(screen.getByText('Foyer avec Rose')).toBeTruthy();
    expect(screen.getByText('Foyer avec Odile')).toBeTruthy();
    expect(screen.getByText('Foyer avec Clarisse')).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Descendance de Pierre, 17 personnes.',
    );
  });

  it('un bouton ramène à l’arbre ; les filtres sont absents pendant la descendance', async () => {
    const { scenario } = await renderTree('pierre');
    press('tree-descendants');
    expect(screen.queryByTestId('tree-filters-open')).toBeNull();
    expect(screen.queryByTestId('tree-go-you')).toBeNull();
    expect(screen.getByLabelText('Revenir à l’arbre entier')).toBeTruthy();
    press('tree-descendants-back');
    expect(screen.getByText('Arbre')).toBeTruthy();
    expect(screen.getByTestId('tree-filters-open')).toBeTruthy();
    // L'arbre ordinaire revient : les parents de Pierre y sont de nouveau.
    expect(canvas().scene.personById.has(scenario.id('jacques'))).toBe(true);
  });

  it('seule une personne qui a des enfants offre la vue', async () => {
    await renderTree('vic');
    expect(screen.queryByTestId('tree-descendants')).toBeNull();
  });

  it('l’arbre pousse sous l’ancêtre quand les animations sont permises', async () => {
    await renderTree('pierre', { reduceMotion: false });
    press('tree-descendants');
    expect(canvas().growth).toBeDefined();
  });

  it('réglage « Réduire les animations » : la descendance s’affiche d’un coup', async () => {
    await renderTree('pierre', { reduceMotion: true });
    press('tree-descendants');
    expect(canvas().growth).toBeUndefined();
  });

  it('l’ancêtre est en haut du cadre de départ, et en bas pour l’arbre ordinaire', async () => {
    const { model } = await renderTree('pierre');
    const screenY = () => {
      const { scene, initialViewport } = canvas();
      const ancestor = scene.personById.get(model.centerId);
      if (ancestor === undefined) throw new Error('no ancestor');
      return ancestor.y * initialViewport.scale + initialViewport.y;
    };
    expect(screenY()).toBeGreaterThan(500);
    press('tree-descendants');
    expect(screenY()).toBeLessThan(200);
  });
});

describe('ouvrir la fiche depuis l’arbre (T-025)', () => {
  function person(id: Id): SceneHit {
    return { kind: 'person', person: { id } as ScenePerson };
  }

  it('la première touche choisit la personne, la seconde ouvre sa fiche', async () => {
    const onOpenPerson = jest.fn();
    const { scenario } = await renderTree('pierre', { onOpenPerson });
    const jean = scenario.id('jean');
    act(() => {
      canvas().onActivate(person(jean));
    });
    expect(onOpenPerson).not.toHaveBeenCalled();
    expect(canvas().selectedId).toBe(jean);
    // La personne choisie offre ses actions, nommées pour le lecteur d’écran.
    expect(screen.getByLabelText('Recentrer l’arbre sur Jean')).toBeTruthy();
    expect(screen.getByLabelText('Ouvrir la fiche de Jean')).toBeTruthy();
    act(() => {
      canvas().onActivate(person(jean));
    });
    expect(onOpenPerson).toHaveBeenCalledTimes(1);
    expect(onOpenPerson).toHaveBeenCalledWith(jean);
    // Le choix et « Recentrer » restent intacts.
    expect(canvas().selectedId).toBe(jean);
    expect(screen.getByTestId('tree-recenter')).toBeTruthy();
  });

  it('toucher une autre personne change le choix sans ouvrir de fiche', async () => {
    const onOpenPerson = jest.fn();
    const { scenario } = await renderTree('pierre', { onOpenPerson });
    act(() => {
      canvas().onActivate(person(scenario.id('jean')));
      canvas().onActivate(person(scenario.id('marthe')));
    });
    expect(onOpenPerson).not.toHaveBeenCalled();
    expect(canvas().selectedId).toBe(scenario.id('marthe'));
  });

  it('« Ouvrir la fiche » ouvre la fiche de la personne choisie, au dessin comme en liste', async () => {
    const onOpenPerson = jest.fn();
    const { scenario } = await renderTree('pierre', { onOpenPerson });
    press('tree-show-list');
    press(`outline-go-${scenario.id('odile')}`);
    press('tree-open-profile');
    expect(onOpenPerson).toHaveBeenCalledWith(scenario.id('odile'));
  });

  it('recentrer fonctionne toujours après avoir ouvert une fiche', async () => {
    const onOpenPerson = jest.fn();
    const { scenario } = await renderTree('pierre', { onOpenPerson });
    const jean = scenario.id('jean');
    act(() => {
      canvas().onActivate(person(jean));
      canvas().onActivate(person(jean));
    });
    press('tree-recenter');
    expect(screen.getByTestId('tree-trail-current')).toHaveTextContent('Jean');
  });

  it('mode Aînés : les actions et les filtres restent atteignables', async () => {
    await renderTree('pierre', { seniorMode: true });
    expect(screen.getByTestId('tree-filters-open')).toBeTruthy();
    expect(screen.getByTestId('tree-open-profile')).toBeTruthy();
    expect(screen.getByTestId('tree-descendants')).toBeTruthy();
    press('tree-filters-open');
    expect(screen.getByTestId('filter-vital-living')).toBeTruthy();
  });
});
