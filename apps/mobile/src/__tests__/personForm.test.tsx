// Saisir, modifier et supprimer une personne (T-031 du plan V1) : le formulaire fait un brouillon,
// le domaine en fait des changements, @lignee/sync les enregistre. La base native n'existe pas
// sous Jest : les fonctions de lecture et d'enregistrement de @lignee/sync sont simulées ; le
// brouillon, les dates, les refus et le texte sont ceux du vrai code. La logique des paquets est
// jouée par leurs propres tests (domain, sync, cas limites CL-…).
import {
  createUuidV7Generator,
  emptyDateDraft,
  emptyNameDraft,
  emptyPersonDraft,
  type PersonDraft,
  type Profile,
} from '@lignee/domain';
import { createTranslator } from '@lignee/i18n';
import { MutationBatchRefusedError, type LocalDatabase } from '@lignee/sync';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { AppProviders } from '../AppProviders';
import { LocalDatabaseProvider } from '../db/LocalDatabaseProvider';
import { PersonFormScreen } from '../personForm/PersonFormScreen';
import { ProfileView } from '../screens/ProfileView';

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'fr-FR' }],
}));

const mockSync = {
  readEntryContext: jest.fn(),
  readPersonDraft: jest.fn(),
  readDeletionPlan: jest.fn(),
  previewCoherence: jest.fn(),
  recordLocalChanges: jest.fn(),
};
jest.mock('@lignee/sync', () => ({
  ...jest.requireActual<object>('@lignee/sync'),
  readEntryContext: (...args: unknown[]): unknown => mockSync.readEntryContext(...args),
  readPersonDraft: (...args: unknown[]): unknown => mockSync.readPersonDraft(...args),
  readDeletionPlan: (...args: unknown[]): unknown => mockSync.readDeletionPlan(...args),
  previewCoherence: (...args: unknown[]): unknown => mockSync.previewCoherence(...args),
  recordLocalChanges: (...args: unknown[]): unknown => mockSync.recordLocalChanges(...args),
}));

const newId = createUuidV7Generator();
const TREE = newId();
const READER = newId();
const FATHER = newId();
const NNBSP = ' ';

const context = (overrides: object = {}) => ({
  treeId: TREE,
  accountId: READER,
  nameOrder: 'given_first',
  treeName: 'Arbre généré',
  places: [],
  ...overrides,
});

interface Recorded {
  readonly changes: readonly {
    readonly entity: string;
    readonly operation: string;
    readonly entityId: string;
    readonly fields?: Record<string, unknown>;
  }[];
  readonly treeId: string;
  readonly authorAccountId: string;
}
const recorded = (call = 0): Recorded => {
  const calls = mockSync.recordLocalChanges.mock.calls as unknown[][];
  return calls[call]?.[1] as Recorded;
};

beforeEach(() => {
  for (const mock of Object.values(mockSync)) mock.mockReset();
  mockSync.readEntryContext.mockReturnValue(context());
  mockSync.previewCoherence.mockReturnValue([]);
  mockSync.recordLocalChanges.mockReturnValue({ status: 'recorded' });
});

const fakeDb = {} as LocalDatabase;
const open = () => Promise.resolve({ db: fakeDb, outcome: 'opened' as const, close: jest.fn() });

interface Options {
  language?: 'fr' | 'en';
  seniorMode?: boolean;
  personId?: string;
  onDone?: () => void;
  onDeleted?: () => void;
}

async function renderForm(options: Options = {}) {
  const onDone = options.onDone ?? jest.fn();
  const onDeleted = options.onDeleted ?? jest.fn();
  const view = render(
    <AppProviders
      i18n={{ translator: createTranslator({ language: options.language ?? 'fr' }) }}
      theme={{ seniorMode: options.seniorMode ?? false, scheme: 'jour', reduceMotion: true }}
    >
      <LocalDatabaseProvider open={open} seedDevelopmentTree={false}>
        <PersonFormScreen
          personId={options.personId}
          newId={newId}
          now={() => Date.UTC(2026, 9, 29)}
          today={() => ({ year: 2026, month: 10, day: 29 })}
          onDone={onDone}
          onDeleted={onDeleted}
          onBack={jest.fn()}
        />
      </LocalDatabaseProvider>
    </AppProviders>,
  );
  await screen.findByTestId('screen-person-form');
  return { ...view, onDone, onDeleted };
}

const type = (testID: string, value: string) => {
  fireEvent.changeText(screen.getByTestId(`${testID}-input`), value);
};
const press = (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
};

describe('ajouter une personne (UNI-01)', () => {
  it('un nom suffit : la personne est enregistrée en un lot, hors ligne, au nom du lecteur', async () => {
    const { onDone } = await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-save');
    expect(mockSync.recordLocalChanges).toHaveBeenCalledTimes(1);
    const { changes, treeId, authorAccountId } = recorded();
    expect(treeId).toBe(TREE);
    expect(authorAccountId).toBe(READER);
    expect(changes.map((change) => `${change.entity}:${change.operation}`)).toEqual([
      'person:create',
      'name:create',
    ]);
    expect(changes[1]?.fields).toMatchObject({ type: 'birth', givenNames: 'Awa' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('sans nom, rien n’est enregistré et le champ du nom dit quoi faire', async () => {
    await renderForm();
    press('person-form-save');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    expect(
      screen.getByText('Indiquez au moins un nom, ou choisissez « Je ne connais pas son nom ».'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('person-form-error')).toBeOnTheScreen();
  });

  it('« Inconnu » : une place à compléter est enregistrée sans nom', async () => {
    await renderForm();
    press('person-form-unknown');
    expect(screen.queryByTestId('name-1')).toBeNull();
    press('person-form-save');
    const { changes } = recorded();
    expect(changes).toHaveLength(1);
    expect(changes[0]?.fields).toMatchObject({ nature: 'placeholder' });
  });

  it('un seul bouton principal, qui dit ce qu’il fait', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: 'Ajouter la personne à l’arbre' })).toBeOnTheScreen();
    expect(screen.getAllByText('Ajouter la personne')).toHaveLength(1);
  });

  it('une seule forme, sans nom de famille (CL-DON-02, CL-FAM-17)', async () => {
    await renderForm();
    press('name-1-type-nickname');
    press('name-1-single');
    type('name-1-display', 'Tonton Bobo');
    press('person-form-save');
    const name = recorded().changes.find((change) => change.entity === 'name');
    expect(name?.fields).toMatchObject({ type: 'nickname', displayForm: 'Tonton Bobo' });
    expect(name?.fields).not.toHaveProperty('surname');
  });

  it('l’ordre des champs suit celui de l’arbre, et un nom d’un trait se sépare (CL-DON-01)', async () => {
    mockSync.readEntryContext.mockReturnValue(context({ nameOrder: 'surname_first' }));
    await renderForm();
    const labels = screen
      .getAllByLabelText(/^(Prénoms|Nom de famille)$/u)
      .map((node) => node.props.accessibilityLabel as string);
    expect(labels).toEqual(['Nom de famille', 'Prénoms']);
    type('name-1-given', 'Abenzo Lucien');
    press('name-1-split');
    press('person-form-save');
    const name = recorded().changes.find((change) => change.entity === 'name');
    expect(name?.fields).toMatchObject({ givenNames: 'Lucien', surname: 'Abenzo' });
  });

  it('le lieu est du texte libre ; aucune position du téléphone n’est demandée (CAR-01)', async () => {
    await renderForm();
    type('name-1-given', 'Awa');
    type('person-form-birth-place', 'Bafoussam');
    press('person-form-save');
    const { changes } = recorded();
    expect(changes.find((change) => change.entity === 'place')?.fields).toEqual({
      name: 'Bafoussam',
    });
    expect(screen.getByLabelText('Lieu de naissance').props.accessibilityHint).toContain(
      'La position du téléphone n’est jamais utilisée',
    );
  });
});

describe('dates floues (CL-DON-05, CL-DON-06)', () => {
  it('« Vers » et une année donnent une date approximative', async () => {
    await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-birth-date-mode-about');
    type('person-form-birth-date-from-year', '1940');
    press('person-form-save');
    const birth = recorded().changes.find(
      (change) => change.entity === 'fact' && change.fields?.type === 'birth',
    );
    expect(birth?.fields?.date).toMatchObject({
      qualifier: 'about',
      precision: 'year',
      date: { year: 1940 },
    });
  });

  it('« Entre » avec des bornes inversées : le refus tombe sur la seconde date', async () => {
    await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-birth-date-mode-between');
    type('person-form-birth-date-from-year', '1940');
    type('person-form-birth-date-to-year', '1935');
    press('person-form-save');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    const second = screen.getByTestId('person-form-birth-date-to');
    expect(
      within(second).getByText('La première date doit être avant la seconde.'),
    ).toBeOnTheScreen();
  });

  it('des années entières : « années 1940 », sans mois ni jour', async () => {
    await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-birth-date-mode-exact');
    press('person-form-birth-date-decade');
    expect(screen.queryByTestId('person-form-birth-date-from-month')).toBeNull();
    type('person-form-birth-date-from-year', '1940');
    press('person-form-save');
    const birth = recorded().changes.find(
      (change) => change.entity === 'fact' && change.fields?.type === 'birth',
    );
    expect(birth?.fields?.date).toMatchObject({ qualifier: 'exact', precision: 'decade' });
  });
});

describe('décès et cause de décès (UNI-15)', () => {
  it('la cause n’apparaît qu’avec un décès, avec « Visible par vous seul », au nom du lecteur', async () => {
    await renderForm();
    expect(screen.queryByTestId('person-form-death-cause')).toBeNull();
    press('person-form-vital-deceased');
    expect(screen.getByTestId('person-form-death-cause-private')).toBeOnTheScreen();
    expect(screen.getByText('Visible par vous seul')).toBeOnTheScreen();
    type('name-1-given', 'Awa');
    type('person-form-death-cause', 'Cause saisie pour le test');
    press('person-form-save');
    const cause = recorded().changes.find((change) => change.fields?.type === 'death_cause');
    expect(cause?.fields).toMatchObject({
      value: 'Cause saisie pour le test',
      authorAccountId: READER,
    });
  });

  it('repasser à « en vie » ne laisse pas la cause partir avec la fiche', async () => {
    await renderForm();
    press('person-form-vital-deceased');
    type('name-1-given', 'Awa');
    type('person-form-death-cause', 'Cause saisie pour le test');
    press('person-form-vital-living');
    press('person-form-save');
    expect(JSON.stringify(recorded().changes)).not.toContain('Cause saisie pour le test');
  });
});

describe('ancien prénom (UNI-22)', () => {
  it('propose de ranger un prénom de naissance différent du prénom actuel, sans le faire d’office', async () => {
    await renderForm();
    press('person-form-gender-female');
    type('name-1-given', 'Jean');
    press('person-form-add-name');
    type('name-2-given', 'Jeanne');
    expect(screen.getByTestId('person-form-suggest-former')).toBeOnTheScreen();
    press('person-form-suggest-former-accept');
    expect(screen.queryByTestId('person-form-suggest-former')).toBeNull();
    press('person-form-save');
    const names = recorded().changes.filter((change) => change.entity === 'name');
    expect(names.map((name) => [name.fields?.type, name.fields?.givenNames])).toEqual([
      ['former', 'Jean'],
      ['usage', 'Jeanne'],
    ]);
    expect(names[0]?.fields?.authorAccountId).toBe(READER);
  });

  it('« Non, le laisser tel quel » garde le prénom de naissance et ne repose pas la question', async () => {
    await renderForm();
    press('person-form-gender-female');
    type('name-1-given', 'Jean');
    press('person-form-add-name');
    type('name-2-given', 'Jeanne');
    press('person-form-suggest-former-keep');
    expect(screen.queryByTestId('person-form-suggest-former')).toBeNull();
    type('name-2-given', 'Jeannette');
    expect(screen.queryByTestId('person-form-suggest-former')).toBeNull();
  });

  it('ne pose pas la question sans signal (genre non renseigné)', async () => {
    await renderForm();
    type('name-1-given', 'Jean');
    press('person-form-add-name');
    type('name-2-given', 'Jeanne');
    expect(screen.queryByTestId('person-form-suggest-former')).toBeNull();
  });

  it('un nom « ancien prénom » porte la mention « Visible par vous seul »', async () => {
    await renderForm();
    press('name-1-type-former');
    expect(screen.getByTestId('name-1-private')).toBeOnTheScreen();
  });
});

describe('refus de l’enregistrement (ADR 0027)', () => {
  it('un nom manquant refusé par la base s’affiche sur le champ du nom', async () => {
    mockSync.recordLocalChanges.mockImplementation(() => {
      throw new MutationBatchRefusedError([{ code: 'person_without_name', path: 'mutations[1]' }]);
    });
    await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-save');
    const card = screen.getByTestId('name-1');
    expect(
      within(card).getByText(
        'Une personne connue garde au moins un nom, autre qu’un ancien prénom.',
      ),
    ).toBeOnTheScreen();
  });

  it('un champ refusé par le modèle s’affiche sur le bon champ', async () => {
    mockSync.recordLocalChanges.mockImplementation((_db: unknown, input: Recorded) => {
      const index = input.changes.findIndex(
        (change) => change.fields?.type === 'birth' && change.entity === 'fact',
      );
      throw new MutationBatchRefusedError([
        { code: 'invalid_object', path: `mutations[${String(index)}].fields.date` },
      ]);
    });
    await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-birth-date-mode-exact');
    type('person-form-birth-date-from-year', '1940');
    press('person-form-save');
    const birth = screen.getByTestId('person-form-birth-date');
    expect(
      within(birth).getByText('Cette information n’est pas valide. Vérifiez ce champ.'),
    ).toBeOnTheScreen();
  });

  it('une erreur inconnue ne montre rien de ce qui a été saisi', async () => {
    mockSync.recordLocalChanges.mockImplementation(() => {
      throw new Error('disk full: Bafoussam Awa');
    });
    await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-save');
    expect(
      screen.getByText('L’enregistrement a échoué. Rien n’a été modifié. Réessayez.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/disk full/u)).toBeNull();
  });
});

describe('alertes de cohérence (UNI-18)', () => {
  it('montre l’alerte avant d’écrire, puis enregistre si la personne passe outre', async () => {
    mockSync.previewCoherence.mockReturnValue([
      { code: 'death_before_birth', severity: 'warning', objects: [] },
    ]);
    const { onDone } = await renderForm();
    type('name-1-given', 'Awa');
    press('person-form-save');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    expect(screen.getByText('La date du décès est avant la date de naissance.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enregistrer malgré tout' })).toBeOnTheScreen();
    press('person-form-save');
    expect(mockSync.recordLocalChanges).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

const existing = (): PersonDraft => ({
  ...emptyPersonDraft(),
  gender: 'male',
  names: [
    {
      ...emptyNameDraft('birth'),
      id: newId(),
      givenNames: 'Abessolo',
      surname: 'Ndomo',
    },
  ],
  birth: { date: emptyDateDraft(), place: '' },
});

describe('modifier une fiche', () => {
  it('ouvre la fiche telle qu’elle est ; sans changement, rien n’est enregistré', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    const { onDone } = await renderForm({ personId: FATHER });
    expect(screen.getByDisplayValue('Abessolo')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Modifier la fiche' })).toBeOnTheScreen();
    press('person-form-save');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('n’envoie que ce qui a changé', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    await renderForm({ personId: FATHER });
    type('name-1-surname', 'Ndomo-Essaka');
    press('person-form-save');
    expect(recorded().changes).toEqual([
      expect.objectContaining({
        entity: 'name',
        operation: 'update',
        fields: { surname: 'Ndomo-Essaka' },
      }),
    ]);
  });

  it('une fiche absente de la copie locale : le même message qu’une fiche inexistante', async () => {
    mockSync.readPersonDraft.mockReturnValue(undefined);
    render(
      <AppProviders i18n={{ translator: createTranslator({ language: 'fr' }) }}>
        <LocalDatabaseProvider open={open} seedDevelopmentTree={false}>
          <PersonFormScreen personId={FATHER} />
        </LocalDatabaseProvider>
      </AppProviders>,
    );
    expect(await screen.findByTestId('screen-person-form-missing')).toBeOnTheScreen();
  });
});

describe('supprimer une personne (ADR 0027)', () => {
  const plan = {
    personId: FATHER,
    changes: [
      { entity: 'name', entityId: newId(), operation: 'delete', target: 'form' },
      { entity: 'union', entityId: newId(), operation: 'delete', target: 'form' },
      { entity: 'person', entityId: FATHER, operation: 'delete', target: 'form' },
    ],
    summary: { names: 1, facts: 0, titles: 0, links: 0, unions: 1 },
  };

  it('demande confirmation, liste ce qui part avec la fiche, puis supprime en un seul lot', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    mockSync.readDeletionPlan.mockReturnValue({ context: context(), plan });
    const { onDeleted } = await renderForm({ personId: FATHER });
    press('person-form-delete');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    expect(await screen.findByText('Supprimer cette fiche ?')).toBeOnTheScreen();
    expect(screen.getByText('Cette action est irréversible.')).toBeOnTheScreen();
    expect(screen.getByText(`Seront aussi supprimés${NNBSP}: 1 nom et 1 union.`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Oui, supprimer cette fiche' })).toBeOnTheScreen();
    press('person-form-delete-confirm');
    expect(mockSync.recordLocalChanges).toHaveBeenCalledTimes(1);
    expect(recorded().changes).toEqual(plan.changes);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('« Non, garder la fiche » ne supprime rien', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    mockSync.readDeletionPlan.mockReturnValue({ context: context(), plan });
    const { onDeleted } = await renderForm({ personId: FATHER });
    press('person-form-delete');
    await screen.findByText('Cette action est irréversible.');
    press('person-form-delete-keep');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('une suppression refusée l’explique, sans rien perdre', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    mockSync.readDeletionPlan.mockReturnValue({ context: context(), plan });
    mockSync.recordLocalChanges.mockImplementation(() => {
      throw new MutationBatchRefusedError([
        { code: 'dangling_reference', path: 'mutations[2].entityId' },
      ]);
    });
    const { onDeleted } = await renderForm({ personId: FATHER });
    press('person-form-delete');
    await screen.findByText('Cette action est irréversible.');
    press('person-form-delete-confirm');
    expect(
      await screen.findByText(
        'Cette fiche est encore citée ailleurs (un lien, une union). Rouvrez-la, puis réessayez.',
      ),
    ).toBeOnTheScreen();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('une nouvelle personne n’a pas de bouton « Supprimer »', async () => {
    await renderForm();
    expect(screen.queryByTestId('person-form-delete')).toBeNull();
  });
});

describe('accessibilité et langues', () => {
  const heights = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style as never) as Record<string, number>;

  it.each([
    [false, 48],
    [true, 56],
  ])('mode Aînés : %s — cibles d’au moins %s', async (seniorMode, target) => {
    await renderForm({ seniorMode });
    const save = screen.getByTestId('person-form-save');
    expect(save).toBeOnTheScreen();
    // Le bouton principal et une puce de choix tiennent la cible de la charte.
    const pill = save.findAll((node) => typeof node.props.style !== 'undefined');
    const minHeights = pill
      .map(
        (node) =>
          (StyleSheet.flatten(node.props.style as never) as { minHeight?: number }).minHeight,
      )
      .filter((value): value is number => typeof value === 'number');
    expect(Math.max(...minHeights)).toBeGreaterThanOrEqual(target);
    expect(heights('person-form-gender-male').minWidth).toBeGreaterThanOrEqual(target);
  });

  it('aucun texte n’est tronqué : pas de limite de lignes, les champs et les puces passent à la ligne', async () => {
    await renderForm();
    press('person-form-vital-deceased');
    press('person-form-birth-date-mode-between');
    const limited = screen
      .UNSAFE_getAllByType(Text)
      .filter((node) => node.props.numberOfLines !== undefined);
    expect(limited).toEqual([]);
  });

  it('chaque puce de choix dit ce qu’elle choisit, et qu’elle soit sélectionnée ou non', async () => {
    await renderForm();
    const chip = screen.getByRole('radio', { name: 'Date de naissance, Vers' });
    expect(chip.props.accessibilityState).toEqual({ checked: false });
    fireEvent.press(chip);
    expect(
      screen.getByRole('radio', { name: 'Date de naissance, Vers' }).props.accessibilityState,
    ).toEqual({
      checked: true,
    });
  });

  it('en anglais, tout le formulaire suit', async () => {
    await renderForm({ language: 'en' });
    expect(screen.getByText('Add a person')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add the person to the tree' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Given names')).toBeOnTheScreen();
    press('person-form-save');
    expect(
      screen.getByText('Enter at least one name, or choose “I do not know their name”.'),
    ).toBeOnTheScreen();
  });

  it('un arbre absent du téléphone : une phrase claire au lieu d’un formulaire inutilisable', async () => {
    mockSync.readEntryContext.mockReturnValue(undefined);
    render(
      <AppProviders i18n={{ translator: createTranslator({ language: 'fr' }) }}>
        <LocalDatabaseProvider open={open} seedDevelopmentTree={false}>
          <PersonFormScreen />
        </LocalDatabaseProvider>
      </AppProviders>,
    );
    expect(await screen.findByTestId('screen-person-form-no-tree')).toBeOnTheScreen();
    await waitFor(() => {
      expect(mockSync.readEntryContext).toHaveBeenCalled();
    });
  });
});

describe('points d’entrée', () => {
  const profile: Profile = {
    personId: FATHER,
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
  };

  it('la fiche propose « Modifier la fiche », nommée par la personne', () => {
    const onEdit = jest.fn();
    render(
      <AppProviders i18n={{ translator: createTranslator({ language: 'fr' }) }}>
        <ProfileView profile={profile} treeName="Arbre généré" onBack={jest.fn()} onEdit={onEdit} />
      </AppProviders>,
    );
    const button = screen.getByRole('button', { name: 'Modifier la fiche — Awa Generée' });
    fireEvent.press(button);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('sans action de modification, la fiche reste en lecture seule', () => {
    render(
      <AppProviders i18n={{ translator: createTranslator({ language: 'fr' }) }}>
        <ProfileView profile={profile} treeName="Arbre généré" onBack={jest.fn()} />
      </AppProviders>,
    );
    expect(screen.queryByTestId('profile-edit')).toBeNull();
  });
});

describe('relectures de T-031', () => {
  it('R2 — « Inconnu » après un nom tapé : ce nom n’est pas enregistré', async () => {
    await renderForm();
    type('name-1-given', 'Jean');
    press('person-form-unknown');
    press('person-form-save');
    const { changes } = recorded();
    expect(changes.map((change) => change.entity)).toEqual(['person']);
    expect(JSON.stringify(changes)).not.toContain('Jean');
  });

  it('R3 — un refus sans champ affiché (version changée) s’affiche en haut du formulaire', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    mockSync.recordLocalChanges.mockImplementation(() => {
      throw new MutationBatchRefusedError([
        { code: 'base_version_mismatch', path: 'mutations[0].baseVersion' },
      ]);
    });
    await renderForm({ personId: FATHER });
    type('name-1-surname', 'Ndomo-Essaka');
    press('person-form-save');
    expect(
      within(screen.getByTestId('person-form-error')).getByText(
        'Cette fiche a changé depuis son ouverture. Rouvrez-la, puis réessayez.',
      ),
    ).toBeOnTheScreen();
  });

  it('R3 — un auteur refusé sur un nom modifié s’affiche aussi en haut', async () => {
    mockSync.readPersonDraft.mockReturnValue({ context: context(), draft: existing() });
    mockSync.recordLocalChanges.mockImplementation(() => {
      throw new MutationBatchRefusedError([
        { code: 'author_mismatch', path: 'mutations[0].fields.authorAccountId' },
      ]);
    });
    await renderForm({ personId: FATHER });
    type('name-1-surname', 'Ndomo-Essaka');
    press('person-form-save');
    expect(
      within(screen.getByTestId('person-form-error')).getByText(
        'Cette information ne peut être saisie qu’en votre nom.',
      ),
    ).toBeOnTheScreen();
  });

  it('retirer le seul nom laisse une ligne vide pour porter l’erreur du nom manquant', async () => {
    await renderForm();
    press('name-1-remove');
    expect(screen.getByTestId('name-1')).toBeOnTheScreen();
    press('person-form-save');
    expect(mockSync.recordLocalChanges).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId('name-1')).getByText(/Indiquez au moins un nom/u),
    ).toBeOnTheScreen();
  });

  it('G1 — un ancien prénom enregistré ne propose aucun autre type', async () => {
    const draft = existing();
    mockSync.readPersonDraft.mockReturnValue({
      context: context(),
      draft: {
        ...draft,
        names: [...draft.names, { ...emptyNameDraft('former'), id: newId(), givenNames: 'Jo' }],
      },
    });
    await renderForm({ personId: FATHER });
    expect(screen.getByTestId('name-2-type-former')).toBeOnTheScreen();
    expect(screen.queryByTestId('name-2-type-birth')).toBeNull();
    expect(screen.queryByTestId('name-2-type-usage')).toBeNull();
    // Un nom neuf, lui, garde tous ses types.
    expect(screen.getByTestId('name-1-type-usage')).toBeOnTheScreen();
  });

  it('G2 — un nom de naissance déjà enregistré : le texte ne promet pas « vous seul le verrez » d’avance', async () => {
    const draft = existing();
    mockSync.readPersonDraft.mockReturnValue({
      context: context(),
      draft: {
        ...draft,
        gender: 'female',
        names: [
          ...draft.names,
          { ...emptyNameDraft('usage'), id: newId(), givenNames: 'Abessola' },
        ],
      },
    });
    await renderForm({ personId: FATHER });
    const card = screen.getByTestId('person-form-suggest-former');
    expect(within(card).getByText(/déjà été vu par votre famille/u)).toBeOnTheScreen();
    expect(within(card).queryByText(/vous seul le verrez\./u)).toBeNull();
  });

  it('G3 — un surnom différent ne déclenche aucune question', async () => {
    await renderForm();
    press('person-form-gender-female');
    type('name-1-given', 'Jean');
    press('person-form-add-name');
    press('name-2-type-nickname');
    type('name-2-given', 'Jeannot');
    expect(screen.queryByTestId('person-form-suggest-former')).toBeNull();
  });

  it('une même indication n’est pas lue deux fois : le groupe de choix n’en porte pas', async () => {
    await renderForm();
    const groups = screen.UNSAFE_root.findAll(
      (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'radiogroup',
    );
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) expect(group.props.accessibilityHint).toBeUndefined();
  });
});
