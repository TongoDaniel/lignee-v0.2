// Fiche d'une personne (T-024 du plan V1) : rendu de la fiche calculée par le domaine, route par
// identifiant, états d'attente, d'absence et d'échec, langues, mode Aînés, mention privée.
import type { FuzzyDateDisplay, Profile } from '@lignee/domain';
import { createTranslator } from '@lignee/i18n';
import type { LocalDatabase } from '@lignee/sync';
import { themes } from '@lignee/ui';
import { render } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { AppProviders } from '../AppProviders';
import { LocalDatabaseProvider } from '../db/LocalDatabaseProvider';
import { profileRoute } from '../navigation/profileRoute';
import { PersonProfileScreen } from '../screens/PersonProfileScreen';
import { ProfileView } from '../screens/ProfileView';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

const mockReadProfile = jest.fn();
jest.mock('@lignee/sync', () => ({
  ...jest.requireActual<object>('@lignee/sync'),
  readProfile: (...args: unknown[]): unknown => mockReadProfile(...args),
}));

const NNBSP = ' ';
const PERSON_ID = '01900000-0000-7000-8000-000000000001';
const OTHER_ID = '01900000-0000-7000-8000-000000000002';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    personId: PERSON_ID,
    placeholder: false,
    name: 'Awa Generée',
    firstName: 'Awa',
    tintName: 'Generée',
    titles: [],
    otherNames: [],
    formerNames: [],
    birthNameMissing: false,
    gender: 'unspecified',
    birthIsPrivate: false,
    deceased: false,
    residences: [],
    occupations: [],
    sections: [],
    ...overrides,
  };
}

function text(value: string): FuzzyDateDisplay {
  return { kind: 'text', text: value, approximate: true };
}

function flat(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never);
}

function renderView(
  value: Profile,
  options: { language?: 'fr' | 'en'; seniorMode?: boolean; scheme?: 'jour' | 'nuit' } = {},
) {
  return render(
    <AppProviders
      i18n={{ translator: createTranslator({ language: options.language ?? 'fr' }) }}
      theme={{
        seniorMode: options.seniorMode ?? false,
        scheme: options.scheme ?? 'jour',
        reduceMotion: true,
      }}
    >
      <ProfileView profile={value} treeName="Arbre généré" onBack={jest.fn()} />
    </AppProviders>,
  );
}

describe('fiche : jumeaux et naissances multiples (UNI-14)', () => {
  const twins = profile({
    multipleBirth: {
      kind: 'twins',
      count: 2,
      others: [{ personId: OTHER_ID, name: 'Adama' }],
    },
  });

  it('affiche « Jumeaux » et avec qui, en français', () => {
    renderView(twins);
    expect(screen.getByText('Jumeaux')).toBeOnTheScreen();
    expect(screen.getByText('Avec Adama')).toBeOnTheScreen();
  });

  it('affiche « Twins » en anglais', () => {
    renderView(twins, { language: 'en' });
    expect(screen.getByText('Twins')).toBeOnTheScreen();
    expect(screen.getByText('With Adama')).toBeOnTheScreen();
  });

  it('n’affiche rien quand la fiche n’a pas de naissance multiple', () => {
    renderView(profile());
    expect(screen.queryByTestId('profile-multiple-birth')).toBeNull();
  });
});

describe('fiche : titres sous le nom (UNI-17, CL-FAM-19)', () => {
  it('range les titres sous le nom, avec leur période, dans l’ordre reçu', () => {
    renderView(
      profile({
        titles: [
          { id: PERSON_ID, label: 'Successeur désigné', start: text('1999'), end: text('2004') },
          { id: OTHER_ID, label: 'Fon', start: text('2004') },
        ],
      }),
    );
    expect(screen.getByText('Successeur désigné, de 1999 à 2004')).toBeOnTheScreen();
    expect(screen.getByText('Fon, depuis 2004')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Awa Generée' })).toBeOnTheScreen();
    const titles = screen.getAllByTestId('profile-title');
    expect(titles).toHaveLength(2);
  });
});

describe('fiche : ancien prénom (UNI-22, CL-FAM-15)', () => {
  const former = { id: OTHER_ID, type: 'former' as const, text: 'Ancien Prénom' };

  it('montre l’ancien prénom à qui y a droit, avec « Visible par vous seul »', () => {
    renderView(profile({ formerNames: [former], sections: ['names'] }));
    expect(screen.getByText('Ancien prénom')).toBeOnTheScreen();
    expect(screen.getByText('Ancien Prénom')).toBeOnTheScreen();
    expect(screen.getByText('Visible par vous seul')).toBeOnTheScreen();
  });

  it('ne montre ni l’ancien prénom ni sa mention quand la fiche n’en porte pas', () => {
    renderView(profile({ sections: [] }));
    expect(screen.queryByText('Ancien prénom')).toBeNull();
    expect(screen.queryByTestId('profile-former-privacy')).toBeNull();
  });
});

describe('fiche : surnom, nom de naissance à compléter, genre (CL-FAM-17, UNI-22)', () => {
  it('dit « à compléter » sans action quand le nom de naissance manque', () => {
    renderView(profile({ name: 'Tonton Bobo', birthNameMissing: true, sections: ['names'] }));
    expect(screen.getByRole('header', { name: 'Tonton Bobo' })).toBeOnTheScreen();
    expect(screen.getByText('Nom de naissance')).toBeOnTheScreen();
    expect(screen.getByText('À compléter')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /compléter/i })).toBeNull();
  });

  it('montre le genre actuel', () => {
    renderView(profile({ gender: 'other', sections: ['identity'] }), { language: 'en' });
    expect(screen.getByText('Gender')).toBeOnTheScreen();
    expect(screen.getByText('Other')).toBeOnTheScreen();
  });

  it('une place à compléter s’appelle « Inconnu » et dit pourquoi', () => {
    renderView(profile({ placeholder: true, name: undefined, firstName: undefined }));
    expect(screen.getByRole('header', { name: 'Inconnu' })).toBeOnTheScreen();
    expect(screen.getByText(/identité n’est pas encore connue/)).toBeOnTheScreen();
  });
});

describe('fiche : naissance, décès et confidentialité', () => {
  const birth = {
    date: {
      kind: 'point',
      qualifier: 'exact',
      date: { precision: 'day', year: 1990, month: 3, day: 1 },
      calendar: 'gregorian',
      approximate: false,
    },
    place: 'Lieu généré',
  } as const;

  it('la date de naissance d’une personne vivante porte sa mention privée', () => {
    renderView(profile({ birth, birthIsPrivate: true, sections: ['life'] }));
    expect(screen.getByText('1er mars 1990')).toBeOnTheScreen();
    expect(screen.getByText(`Lieu${NNBSP}: Lieu généré`)).toBeOnTheScreen();
    expect(
      screen.getByText(`Visible par l’arbre «${NNBSP}Arbre généré${NNBSP}»`),
    ).toBeOnTheScreen();
  });

  it('pas de mention pour une personne décédée', () => {
    renderView(
      profile({ birth, deceased: true, death: {}, birthIsPrivate: false, sections: ['life'] }),
    );
    expect(screen.queryByTestId('profile-birth-privacy')).toBeNull();
    expect(screen.getByText('Décès')).toBeOnTheScreen();
    expect(screen.getByText('Date inconnue')).toBeOnTheScreen();
  });

  it('un lieu de vie sans lieu dit « Lieu inconnu », jamais « Date inconnue »', () => {
    renderView(
      profile({
        residences: [{ id: OTHER_ID, date: text('1990') }],
        sections: ['residences'],
      }),
    );
    expect(screen.getByText('Lieu inconnu')).toBeOnTheScreen();
    expect(screen.queryByText('Date inconnue')).toBeNull();
  });

  it('ne liste pas une profession sans texte', () => {
    renderView(
      profile({ occupations: [{ id: OTHER_ID, date: text('1990') }], sections: ['occupations'] }),
    );
    expect(screen.queryByText('1990')).toBeNull();
  });
});

describe('fiche : accessibilité et thèmes', () => {
  it('le retour est un bouton nommé, de 48 px, et de 56 px en mode Aînés', () => {
    const { unmount } = renderView(profile());
    const target = () =>
      flat(screen.getByRole('button', { name: 'Revenir en arrière' }).props.style);
    expect(target().minHeight).toBe(48);
    unmount();
    renderView(profile(), { seniorMode: true });
    expect(target().minHeight).toBe(56);
  });

  it('suit le thème Nuit et laisse défiler la page (texte à 200 %)', () => {
    renderView(profile({ sections: [] }), { scheme: 'nuit' });
    const page = screen.getByTestId('screen-profile');
    expect(flat(page.props.style).backgroundColor).toBe(themes.nuit.fond);
    // Aucune hauteur fixe sur le nom : il grandit avec le texte du téléphone.
    expect(flat(screen.getByTestId('profile-name').props.style)).not.toHaveProperty('height');
  });

  it('mode Aînés : le nom grossit de 1,3', () => {
    const base = renderView(profile());
    const normal = flat(screen.getByTestId('profile-name').props.style).fontSize as number;
    base.unmount();
    renderView(profile(), { seniorMode: true });
    const senior = flat(screen.getByTestId('profile-name').props.style).fontSize as number;
    expect(senior).toBeCloseTo(normal * 1.3, 5);
  });
});

describe('route de la fiche', () => {
  beforeEach(() => {
    mockReadProfile.mockReset();
  });

  it('construit l’adresse par identifiant', () => {
    expect(profileRoute(PERSON_ID)).toBe(`/person/${PERSON_ID}`);
    expect(profileRoute(PERSON_ID, OTHER_ID)).toBe(`/person/${PERSON_ID}?treeId=${OTHER_ID}`);
  });

  it('ouvre la fiche par la route, en attendant la base locale', async () => {
    renderRouter('./src/app', { initialUrl: profileRoute(PERSON_ID) });
    expect(await screen.findByTestId('screen-profile-loading')).toBeOnTheScreen();
    expect(screen.getByText('Ouverture de la fiche…')).toBeOnTheScreen();
    expect(mockReadProfile).not.toHaveBeenCalled();
  });

  function renderScreen(open: () => Promise<{ db: LocalDatabase; close: () => void }>) {
    return render(
      <LocalDatabaseProvider open={open as never} seedDevelopmentTree={false}>
        <AppProviders i18n={{ translator: createTranslator({ language: 'fr' }) }}>
          <PersonProfileScreen personId={PERSON_ID} treeId={OTHER_ID} />
        </AppProviders>
      </LocalDatabaseProvider>,
    );
  }
  const fakeDatabase = () => Promise.resolve({ db: {} as LocalDatabase, close: jest.fn() });

  it('lit la copie locale avec l’identifiant et l’arbre de la route, puis affiche la fiche', async () => {
    mockReadProfile.mockReturnValue({ profile: profile(), treeName: 'Arbre généré' });
    renderScreen(fakeDatabase);
    expect(await screen.findByTestId('screen-profile')).toBeOnTheScreen();
    expect(mockReadProfile).toHaveBeenCalledWith(
      expect.anything(),
      PERSON_ID,
      expect.objectContaining({
        treeId: OTHER_ID,
        today: expect.objectContaining({ year: expect.any(Number) as unknown }) as unknown,
      }),
    );
  });

  it('dit que la fiche n’est pas disponible quand elle n’est pas sur le téléphone', async () => {
    mockReadProfile.mockReturnValue(undefined);
    renderScreen(fakeDatabase);
    expect(await screen.findByTestId('screen-profile-missing')).toBeOnTheScreen();
    expect(
      screen.getByText('Cette fiche n’est pas disponible sur ce téléphone.'),
    ).toBeOnTheScreen();
  });

  it('dit que la fiche ne s’ouvre pas quand la lecture échoue, sans détail', async () => {
    mockReadProfile.mockImplementation(() => {
      throw new Error('détail à ne pas afficher');
    });
    renderScreen(fakeDatabase);
    await waitFor(() => {
      expect(screen.getByTestId('screen-profile-failed')).toBeOnTheScreen();
    });
    expect(screen.queryByText(/détail/)).toBeNull();
  });

  it('dit que la fiche ne s’ouvre pas quand la base ne s’ouvre pas', async () => {
    renderScreen(() => Promise.reject(new Error('base')));
    expect(await screen.findByTestId('screen-profile-failed')).toBeOnTheScreen();
  });
});
