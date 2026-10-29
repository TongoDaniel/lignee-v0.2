import { describe, expect, it } from 'vitest';

import { factSchema, titleRoleSchema, type Fact } from './fact';
import { fuzzyDateSchema } from './fuzzy-date';
import {
  buildProfile,
  canViewFormerName,
  chooseDisplayName,
  type Profile,
  type ProfileSource,
} from './profile';
import { nameSchema, type Name } from './person';
import { fuzzyDateInputFromScenario } from './test-support/scenario';
import { buildScenarioTree, scenarioTreeSchema } from './test-support/scenario-tree';

const TODAY = { year: 2026, month: 10, day: 25 };

/** Date exacte, à l’année : triable, contrairement au texte d’origine des scénarios. */
function year(value: string) {
  return fuzzyDateSchema.parse(fuzzyDateInputFromScenario({ qualificatif: 'exacte', date: value }));
}

function treeOf(section: unknown) {
  const built = buildScenarioTree(scenarioTreeSchema.parse(section));
  const stranger = built.context.nextId();
  const author = built.context.authorAccountId;
  const profile = (
    key: string,
    options: { viewer?: 'author' | 'stranger'; source?: Partial<ProfileSource> } = {},
  ): Profile | undefined =>
    buildProfile({ ...built.data, ...options.source }, built.id(key), {
      viewer: { accountId: options.viewer === 'stranger' ? stranger : author },
      today: TODAY,
    });
  return { built, stranger, author, profile };
}

function name(overrides: Partial<Name> & Pick<Name, 'type'>): Name {
  return nameSchema.parse({
    id: '01900000-0000-7000-8000-000000000001',
    treeId: '01900000-0000-7000-8000-000000000002',
    personId: '01900000-0000-7000-8000-000000000003',
    authorAccountId: '01900000-0000-7000-8000-000000000004',
    givenNames: 'Prénom',
    ...overrides,
  });
}

describe('canViewFormerName (UNI-22)', () => {
  const former = name({ type: 'former' });

  it('ouvre l’ancien prénom à son auteur', () => {
    expect(canViewFormerName(former, { accountId: former.authorAccountId })).toBe(true);
  });

  it('le ferme à tout autre compte, même propriétaire de l’arbre', () => {
    const owner = '01900000-0000-7000-8000-0000000000aa';
    expect(canViewFormerName(former, { accountId: owner })).toBe(false);
  });

  it('l’ouvre à la personne concernée quand sa fiche est reliée à son compte', () => {
    const other = '01900000-0000-7000-8000-0000000000aa';
    expect(canViewFormerName(former, { accountId: other, ownPersonId: former.personId })).toBe(
      true,
    );
    expect(
      canViewFormerName(former, {
        accountId: other,
        ownPersonId: '01900000-0000-7000-8000-0000000000bb',
      }),
    ).toBe(false);
  });

  it('ne concerne que l’ancien prénom', () => {
    const birth = name({ type: 'birth' });
    expect(canViewFormerName(birth, { accountId: birth.authorAccountId })).toBe(false);
  });
});

describe('chooseDisplayName', () => {
  it('ne choisit jamais un ancien prénom, même seul ou en premier', () => {
    expect(chooseDisplayName([name({ type: 'former', givenNames: 'Marc' })])).toBeUndefined();
    const chosen = chooseDisplayName([
      name({ type: 'former', givenNames: 'Marc' }),
      name({ id: '01900000-0000-7000-8000-000000000005', type: 'nickname', givenNames: 'Mimi' }),
    ]);
    expect(chosen?.givenNames).toBe('Mimi');
  });

  it('préfère le nom en cours au nom terminé, puis l’usage à la naissance', () => {
    const ended = name({ type: 'usage', givenNames: 'Ancien', end: year('1978') });
    const birth = name({
      id: '01900000-0000-7000-8000-000000000005',
      type: 'birth',
      givenNames: 'Naissance',
    });
    const usage = name({
      id: '01900000-0000-7000-8000-000000000006',
      type: 'usage',
      givenNames: 'Usage',
    });
    expect(chooseDisplayName([ended, birth])?.givenNames).toBe('Naissance');
    expect(chooseDisplayName([birth, usage])?.givenNames).toBe('Usage');
    expect(chooseDisplayName([ended])?.givenNames).toBe('Ancien');
  });

  it('prend le nom le plus récemment terminé quand tous le sont', () => {
    const first = name({ type: 'usage', givenNames: 'Un', end: year('1978') });
    const second = name({
      id: '01900000-0000-7000-8000-000000000005',
      type: 'usage',
      givenNames: 'Deux',
      end: year('1991'),
    });
    expect(chooseDisplayName([first, second])?.givenNames).toBe('Deux');
  });
});

describe('buildProfile', () => {
  it('ne connaît pas une personne absente de la copie locale', () => {
    const { built, profile } = treeOf({ personnes: ['ada/F'] });
    const missing = buildProfile({ ...built.data, people: [] }, built.id('ada'), {
      viewer: { accountId: built.context.authorAccountId },
      today: TODAY,
    });
    expect(missing).toBeUndefined();
    expect(profile('ada')?.name).toBe('Ada');
  });

  it('CL-FAM-18 : le nom en cours est le nom affiché, les noms passés restent listés', () => {
    const { profile } = treeOf({
      personnes: ['marthe/F'],
      noms: [
        { personne: 'marthe', type: 'naissance', prenoms: 'Marthe', nom: 'Tchoupa', fin: '1978' },
        {
          personne: 'marthe',
          type: 'usage',
          prenoms: 'Marthe',
          nom: 'Essaka',
          debut: '1978',
          fin: '1991',
        },
        { personne: 'marthe', type: 'usage', prenoms: 'Aminatou', nom: 'Essaka', debut: '1991' },
      ],
    });
    const result = profile('marthe');
    expect(result?.name).toBe('Aminatou Essaka');
    expect(result?.otherNames.map((entry) => entry.text)).toEqual([
      'Marthe Tchoupa',
      'Marthe Essaka',
    ]);
    // Le nom de naissance donne la teinte de l’avatar, pas le nom du moment.
    expect(result?.tintName).toBe('Tchoupa');
    expect(result?.firstName).toBe('Aminatou');
  });

  it('l’ancien prénom ne sort ni du nom, ni de l’initiale, ni de la teinte, ni des autres noms', () => {
    const { profile } = treeOf({
      personnes: ['mia/F'],
      noms: [
        { personne: 'mia', type: 'usage', prenoms: 'Mia', nom: 'Lemaire' },
        { personne: 'mia', type: 'ancien', prenoms: 'Marc', nom: 'Lemaire' },
      ],
    });
    const stranger = profile('mia', { viewer: 'stranger' });
    expect(JSON.stringify(stranger)).not.toContain('Marc');
    expect(stranger?.formerNames).toEqual([]);
    const author = profile('mia');
    expect(author?.formerNames.map((entry) => entry.text)).toEqual(['Marc Lemaire']);
    expect(author?.sections).toContain('names');
    expect(author?.name).toBe('Mia Lemaire');
    expect(author?.firstName).toBe('Mia');
    expect(author?.otherNames).toEqual([]);
    expect(author?.tintName).toBe(stranger?.tintName);
  });

  it('un ancien prénom placé dans les noms d’une autre personne n’apparaît pas non plus', () => {
    const { profile } = treeOf({
      personnes: ['mia/F', 'jade/F'],
      noms: [
        { personne: 'mia', type: 'usage', prenoms: 'Mia' },
        { personne: 'mia', type: 'ancien', prenoms: 'Marc' },
        { personne: 'jade', type: 'usage', prenoms: 'Jade' },
      ],
      naissances_multiples: [{ enfants: ['mia', 'jade'] }],
    });
    // Jade voit Mia comme sa jumelle : sous son nom actuel seulement, quel que soit le lecteur.
    const jade = profile('jade');
    expect(jade?.multipleBirth?.others.map((other) => other.name)).toEqual(['Mia']);
    expect(JSON.stringify(jade)).not.toContain('Marc');
  });

  it('une place à compléter n’a pas de nom : l’écran dit « Inconnu »', () => {
    const { profile } = treeOf({ personnes: ['mere/F'], a_completer: ['mere'] });
    const result = profile('mere');
    expect(result?.placeholder).toBe(true);
    expect(result?.name).toBeUndefined();
    expect(result?.birthNameMissing).toBe(false);
  });

  describe('naissance multiple (UNI-14)', () => {
    const section = {
      personnes: ['ines/F', 'ivan/M', 'ilona/F', 'iris/F'],
      naissances_multiples: [{ enfants: ['ines', 'ivan', 'ilona', 'iris'], ordre: [1, 2, 3, 4] }],
    };

    it('dit « quadruplés » et nomme les autres enfants dans l’ordre de naissance', () => {
      const { profile } = treeOf(section);
      const birth = profile('ilona')?.multipleBirth;
      expect(birth?.kind).toBe('quadruplets');
      expect(birth?.order).toBe(3);
      expect(birth?.others.map((other) => other.name)).toEqual(['Ines', 'Ivan', 'Iris']);
    });

    it('n’affiche rien de plus qu’un enfant masqué : il disparaît du décompte et des rangs', () => {
      const { built, profile } = treeOf({
        personnes: ['ines/F', 'ivan/M', 'ilona/F'],
        naissances_multiples: [{ enfants: ['ines', 'ivan', 'ilona'], ordre: [1, 2, 3] }],
      });
      const hidden = built.id('ivan');
      const source = {
        people: built.data.people.filter((person) => person.id !== hidden),
        names: built.data.names.filter((entry) => entry.personId !== hidden),
      };
      const birth = profile('ilona', { source })?.multipleBirth;
      expect(birth?.kind).toBe('twins');
      expect(birth?.count).toBe(2);
      // Pas de rang 3 : la lacune trahirait l’enfant masqué.
      expect(birth?.order).toBe(2);
      expect(JSON.stringify(birth)).not.toContain('Ivan');
    });

    it('ne dit plus « Jumeaux » quand le seul autre enfant est masqué', () => {
      const { built, profile } = treeOf({
        personnes: ['awa/F', 'adama/M'],
        naissances_multiples: [{ enfants: ['awa', 'adama'] }],
      });
      const hidden = built.id('adama');
      const source = {
        people: built.data.people.filter((person) => person.id !== hidden),
      };
      expect(profile('awa', { source })?.multipleBirth).toBeUndefined();
    });
  });

  describe('titres et rôles (UNI-17)', () => {
    it('les range par date de début, ceux qui n’ont pas de date en dernier', () => {
      const { built, profile } = treeOf({ personnes: ['tamfu/M'] });
      const title = (label: string, start?: string) =>
        titleRoleSchema.parse({
          id: built.context.nextId(),
          treeId: built.context.treeId,
          personId: built.id('tamfu'),
          label,
          authorAccountId: built.context.authorAccountId,
          ...(start === undefined ? {} : { start: year(start) }),
        });
      const titleRoles = [title('Fon', '2004'), title('Notable'), title('Successeur', '1999')];
      expect(
        profile('tamfu', { source: { titleRoles } })?.titles.map((entry) => entry.label),
      ).toEqual(['Successeur', 'Fon', 'Notable']);
    });
  });

  describe('faits', () => {
    const base = {
      personnes: ['odette/F', 'lucien/M'],
      faits: [
        {
          personne: 'odette',
          type: 'naissance',
          date: { qualificatif: 'exacte', date: '1931-03-01' },
        },
        { personne: 'odette', type: 'deces', date: { qualificatif: 'exacte', date: '2019-06-02' } },
      ],
    };

    function withExtra(built: ReturnType<typeof treeOf>['built'], extra: Fact[]) {
      return { facts: [...built.data.facts, ...extra] };
    }

    function fact(
      built: ReturnType<typeof treeOf>['built'],
      key: string,
      type: Fact['type'],
      extra: Partial<Fact> = {},
    ): Fact {
      return factSchema.parse({
        id: built.context.nextId(),
        treeId: built.context.treeId,
        subject: { kind: 'person', personId: built.id(key) },
        type,
        authorAccountId: built.context.authorAccountId,
        ...extra,
      });
    }

    it('une personne décédée garde sa naissance et son décès dans le bloc « vie »', () => {
      const { profile } = treeOf(base);
      const result = profile('odette');
      expect(result?.deceased).toBe(true);
      expect(result?.birth?.date).toBeDefined();
      expect(result?.death?.date).toBeDefined();
      expect(result?.birthIsPrivate).toBe(false);
      expect(result?.sections).toEqual(['identity', 'life']);
    });

    it('la date de naissance d’une personne présumée vivante est marquée privée', () => {
      const { profile } = treeOf({
        personnes: ['nora/F'],
        faits: [
          {
            personne: 'nora',
            type: 'naissance',
            date: { qualificatif: 'exacte', date: '1990-01-01' },
          },
        ],
      });
      expect(profile('nora')?.birthIsPrivate).toBe(true);
    });

    it('la cause de décès ne sort jamais, même pour son auteur', () => {
      const { built, profile } = treeOf(base);
      const cause = fact(built, 'odette', 'death_cause', { value: 'cause-secrète-générée' });
      const result = profile('odette', { source: withExtra(built, [cause]) });
      expect(JSON.stringify(result)).not.toContain('cause-secrète-générée');
      expect(result?.deceased).toBe(true);
    });

    it('une cause de décès seule ne fait pas « décédée »', () => {
      const { built, profile } = treeOf({ personnes: ['lucien/M'] });
      const cause = fact(built, 'lucien', 'death_cause', { value: 'cause-secrète-générée' });
      const result = profile('lucien', { source: withExtra(built, [cause]) });
      expect(result?.deceased).toBe(false);
      expect(result?.death).toBeUndefined();
      expect(result?.sections).toEqual(['identity']);
    });

    it('range résidences et professions par date, avec le nom du lieu', () => {
      const { built, profile } = treeOf({ personnes: ['lucien/M'] });
      const place = {
        id: built.context.nextId(),
        treeId: built.context.treeId,
        name: 'Lieu généré',
        formerNames: [],
      };
      const late = fact(built, 'lucien', 'residence', {
        date: year('2010'),
        placeId: place.id,
      });
      const early = fact(built, 'lucien', 'residence', { date: year('1990') });
      const job = fact(built, 'lucien', 'occupation', { value: 'Pêcheur' });
      const result = profile('lucien', {
        source: { facts: [late, early, job], places: [place] },
      });
      expect(result?.residences.map((entry) => entry.place)).toEqual([undefined, 'Lieu généré']);
      expect(result?.occupations.map((entry) => entry.value)).toEqual(['Pêcheur']);
      expect(result?.sections).toEqual(['identity', 'residences', 'occupations']);
    });

    it('ne lit pas les faits des autres personnes', () => {
      const { built, profile } = treeOf({ personnes: ['lucien/M', 'odette/F'] });
      const other = fact(built, 'odette', 'occupation', { value: 'Tisserande' });
      expect(profile('lucien', { source: { facts: [other] } })?.occupations).toEqual([]);
    });
  });
});
