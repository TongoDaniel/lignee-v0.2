// Contrôles de cohérence (UNI-09, UNI-18) : chaque règle, ses seuils, ses exceptions par type de
// lien, et la tolérance aux dates floues. Les cas limites sont joués à part
// (src/scenarios/coherence-scenarios.test.ts).
import { describe, expect, it } from 'vitest';

import {
  APPROXIMATE_DATE_MARGIN_YEARS,
  checkNewFiliation,
  checkPersonDates,
  checkStatedAge,
  checkUnion,
  coherenceIssueKey,
  coherenceIssueSchema,
  COHERENCE_SEVERITY,
  coherenceCodeSchema,
  findCoherenceIssues,
  hasRefusal,
  toleratedSpan,
} from './coherence';
import { filiationSchema, type FiliationType } from './filiation';
import { addMonthsToDay, compareCalendarDays, fuzzyDateSchema } from './fuzzy-date';
import { scenarioFiliationTypes, type ScenarioFuzzyDate } from './test-support/scenario';
import {
  buildScenarioTree,
  factFromScenario,
  scenarioTreeSchema,
  type ScenarioTree,
} from './test-support/scenario-tree';

const exact = (date: string): ScenarioFuzzyDate => ({ qualificatif: 'exacte', date });

/** Un parent et un enfant, le lien du type donné, et des dates de naissance et de décès. */
function family(options: {
  type?: keyof typeof scenarioFiliationTypes;
  parentGender?: 'M' | 'F' | 'A' | 'N';
  parentBirth?: ScenarioFuzzyDate;
  parentDeath?: ScenarioFuzzyDate;
  childBirth?: ScenarioFuzzyDate;
}): ScenarioTree {
  const facts = [
    options.parentBirth && { personne: 'p', type: 'naissance', date: options.parentBirth },
    options.parentDeath && { personne: 'p', type: 'deces', date: options.parentDeath },
    options.childBirth && { personne: 'e', type: 'naissance', date: options.childBirth },
  ].filter((fact) => fact !== undefined);
  return buildScenarioTree(
    scenarioTreeSchema.parse({
      personnes: [`p/${options.parentGender ?? 'F'}`, 'e/F'],
      filiations: [{ parents: ['p'], enfant: 'e', type: options.type ?? 'naissance' }],
      faits: facts,
    }),
  );
}

const codes = (tree: ScenarioTree, today?: { year: number; month: number; day: number }) =>
  findCoherenceIssues(tree.data, today === undefined ? {} : { today }).map((issue) => issue.code);

describe('codes et sévérités', () => {
  it('seuls le troisième parent de naissance, le cycle et l’union avec soi-même sont des refus', () => {
    const refusals = coherenceCodeSchema.options.filter(
      (code) => COHERENCE_SEVERITY[code] === 'refusal',
    );
    expect(refusals).toEqual(['third_birth_parent', 'filiation_cycle', 'union_with_self']);
  });

  it('un constat est validé par son schéma : la sévérité suit le code', () => {
    const [found] = findCoherenceIssues(
      family({ parentBirth: exact('1990'), childBirth: exact('1960') }).data,
    );
    expect(coherenceIssueSchema.parse(found)).toEqual(found);
    expect(coherenceIssueSchema.safeParse({ ...found, severity: 'refusal' }).success).toBe(false);
    expect(coherenceIssueSchema.safeParse({ ...found, message: 'texte' }).success).toBe(false);
  });

  it('la clé d’un constat dépend du code et des objets, pas de l’ordre d’appel', () => {
    const tree = family({ parentBirth: exact('1990'), childBirth: exact('1960') });
    const [first] = findCoherenceIssues(tree.data);
    const [again] = findCoherenceIssues(tree.data);
    if (first === undefined || again === undefined) throw new Error('missing issue');
    expect(coherenceIssueKey(first)).toBe(coherenceIssueKey(again));
    expect(coherenceIssueKey({ ...first, code: 'parent_too_young' })).not.toBe(
      coherenceIssueKey(first),
    );
  });
});

describe('dates floues : étendue tolérée (ADR 0011)', () => {
  const span = (input: unknown) => toleratedSpan(fuzzyDateSchema.parse(input));

  it('exacte, entre, avant, après : l’étendue nominale, sans marge', () => {
    expect(span({ qualifier: 'exact', precision: 'year', date: { year: 1950 } })).toEqual({
      earliest: { year: 1950, month: 1, day: 1 },
      latest: { year: 1950, month: 12, day: 31 },
    });
    expect(span({ qualifier: 'before', precision: 'year', date: { year: 1950 } })).toEqual({
      earliest: undefined,
      latest: { year: 1949, month: 12, day: 31 },
    });
  });

  it('« vers » : 5 ans de chaque côté, 10 ans à la décennie ; « calculée » : 2 ans', () => {
    expect(APPROXIMATE_DATE_MARGIN_YEARS).toEqual({ aboutDecade: 10, about: 5, calculated: 2 });
    expect(span({ qualifier: 'about', precision: 'year', date: { year: 1950 } })).toEqual({
      earliest: { year: 1945, month: 1, day: 1 },
      latest: { year: 1955, month: 12, day: 31 },
    });
    expect(span({ qualifier: 'about', precision: 'decade', date: { year: 1940 } })).toEqual({
      earliest: { year: 1930, month: 1, day: 1 },
      latest: { year: 1959, month: 12, day: 31 },
    });
    expect(span({ qualifier: 'calculated', precision: 'year', date: { year: 1930 } })).toEqual({
      earliest: { year: 1928, month: 1, day: 1 },
      latest: { year: 1932, month: 12, day: 31 },
    });
  });

  it('texte libre et calendrier hégirien : rien n’en est déduit', () => {
    expect(span({ qualifier: 'text', originalText: 'avant la guerre' })).toBeUndefined();
    expect(
      span({ qualifier: 'exact', precision: 'year', date: { year: 1370 }, calendar: 'hijri' }),
    ).toBeUndefined();
  });
});

describe('jours du calendrier', () => {
  it('ajoute des mois en gardant le jour, ramené au dernier jour du mois', () => {
    expect(addMonthsToDay({ year: 1971, month: 3, day: 14 }, 10)).toEqual({
      year: 1972,
      month: 1,
      day: 14,
    });
    expect(addMonthsToDay({ year: 2000, month: 2, day: 29 }, 12)).toEqual({
      year: 2001,
      month: 2,
      day: 28,
    });
    expect(addMonthsToDay({ year: 1950, month: 1, day: 31 }, -2)).toEqual({
      year: 1949,
      month: 11,
      day: 30,
    });
    expect(
      compareCalendarDays({ year: 1950, month: 1, day: 2 }, { year: 1950, month: 1, day: 1 }),
    ).toBeGreaterThan(0);
  });
});

describe('UNI-18 : âge du parent', () => {
  it('parent plus jeune que l’enfant, pour un lien de naissance, de donneur, de gestation ou d’adoption', () => {
    for (const type of ['naissance', 'donneur', 'gpa', 'adoptive'] as const) {
      expect(
        codes(family({ type, parentBirth: exact('1990'), childBirth: exact('1960') })),
      ).toEqual(['parent_younger_than_child']);
    }
  });

  it('« a élevé », confié, tuteur : pas d’alerte d’âge (un aîné peut élever ou être tuteur)', () => {
    for (const type of ['a_eleve', 'confie', 'tuteur'] as const) {
      expect(
        codes(family({ type, parentBirth: exact('1990'), childBirth: exact('1960') })),
      ).toEqual([]);
    }
  });

  it('moins de 12 ans à la naissance : seulement pour un lien biologique', () => {
    expect(codes(family({ parentBirth: exact('1950'), childBirth: exact('1960') }))).toEqual([
      'parent_too_young',
    ]);
    expect(
      codes(family({ type: 'adoptive', parentBirth: exact('1950'), childBirth: exact('1960') })),
    ).toEqual([]);
    expect(codes(family({ parentBirth: exact('1940'), childBirth: exact('1960') }))).toEqual([]);
  });

  it('sans date, ou une seule des deux : rien', () => {
    expect(codes(family({ childBirth: exact('1960') }))).toEqual([]);
    expect(codes(family({ parentBirth: exact('1990') }))).toEqual([]);
  });
});

describe('UNI-18 : naissance après la mort d’un parent', () => {
  const late = { parentDeath: exact('1960-01-01'), childBirth: exact('1961-06-01') };
  const afterDeath = { parentDeath: exact('1960-01-01'), childBirth: exact('1960-03-01') };

  it('le père : plus de 10 mois ; la mère : après sa mort', () => {
    expect(codes(family({ parentGender: 'M', ...late }))).toEqual(['born_long_after_father_death']);
    expect(codes(family({ parentGender: 'M', ...afterDeath }))).toEqual([]);
    expect(codes(family({ parentGender: 'F', ...afterDeath }))).toEqual([
      'born_after_mother_death',
    ]);
  });

  it('genre autre ou non renseigné : la règle la plus large, celle des 10 mois', () => {
    for (const parentGender of ['A', 'N'] as const) {
      expect(codes(family({ parentGender, ...afterDeath }))).toEqual([]);
      expect(codes(family({ parentGender, ...late }))).toEqual(['born_long_after_father_death']);
    }
  });

  it('gestation pour autrui : la personne qui porte l’enfant suit la règle de la mère', () => {
    expect(codes(family({ type: 'gpa', parentGender: 'A', ...afterDeath }))).toEqual([
      'born_after_mother_death',
    ]);
  });

  it('donneur, adoption, « a élevé » : aucune règle de décès', () => {
    for (const type of ['donneur', 'adoptive', 'a_eleve', 'confie', 'tuteur'] as const) {
      expect(codes(family({ type, parentGender: 'F', ...late }))).toEqual([]);
    }
  });

  it('une mère de naissance dont l’enfant a été porté par une autre : pas de règle de décès', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['m/F', 'g/F', 'e/N'],
        filiations: [
          { parents: ['m'], enfant: 'e' },
          { parents: ['g'], enfant: 'e', type: 'gpa' },
        ],
        faits: [
          { personne: 'm', type: 'deces', date: exact('1990') },
          { personne: 'e', type: 'naissance', date: exact('1995') },
        ],
      }),
    );
    expect(codes(tree)).toEqual([]);
  });
});

describe('ADR 0011 : contrôles de la personne', () => {
  it('décès avant la naissance', () => {
    const tree = family({ parentBirth: exact('1950'), parentDeath: exact('1940') });
    expect(codes(tree)).toEqual(['death_before_birth']);
  });

  it('âge au décès au-delà de 120 ans ; 120 ans tout juste ne déclenche rien', () => {
    expect(
      codes(family({ parentBirth: exact('1800-01-01'), parentDeath: exact('1921-01-01') })),
    ).toEqual(['implausible_age']);
    expect(
      codes(family({ parentBirth: exact('1800-01-01'), parentDeath: exact('1920-12-31') })),
    ).toEqual([]);
  });

  it('personne dite vivante et âgée de plus de 120 ans au jour donné ; sans jour, rien', () => {
    const tree = family({ parentBirth: exact('1880') });
    const today = { year: 2026, month: 10, day: 16 };
    expect(codes(tree, today)).toEqual([]);
    const living = {
      ...tree.data,
      people: tree.data.people.map((entry) => ({ ...entry, vitalStatus: 'living' as const })),
    };
    expect(findCoherenceIssues(living, { today }).map((found) => found.code)).toEqual([
      'implausible_age',
    ]);
    expect(findCoherenceIssues(living).map((found) => found.code)).toEqual([]);
  });

  it('âge dit : de 0 à 120 ans accepté, au-delà une alerte (complète birthDateFromAge)', () => {
    expect(checkStatedAge(80)).toEqual([]);
    expect(checkStatedAge(120)).toEqual([]);
    expect(checkStatedAge(150).map((found) => found.code)).toEqual(['implausible_age']);
    expect(checkStatedAge(-1).map((found) => found.severity)).toEqual(['warning']);
  });

  it('checkPersonDates : les alertes d’une personne et de ses liens, sans le reste de l’arbre', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['a/F', 'b/F', 'c/M', 'd/M'],
        filiations: [
          { parents: ['a'], enfant: 'b' },
          { parents: ['c'], enfant: 'd' },
        ],
        faits: [
          { personne: 'a', type: 'naissance', date: exact('1990') },
          { personne: 'b', type: 'naissance', date: exact('1960') },
          { personne: 'c', type: 'naissance', date: exact('1990') },
          { personne: 'd', type: 'naissance', date: exact('1960') },
        ],
      }),
    );
    expect(findCoherenceIssues(tree.data)).toHaveLength(2);
    const issues = checkPersonDates(tree.data, tree.id('b'));
    expect(issues.map((found) => found.code)).toEqual(['parent_younger_than_child']);
    expect(issues[0]?.objects.slice(0, 2)).toEqual([
      { type: 'person', id: tree.id('a') },
      { type: 'person', id: tree.id('b') },
    ]);
  });
});

describe('UNI-09 : au plus deux parents de naissance ; les autres types sans limite', () => {
  const tree = buildScenarioTree(
    scenarioTreeSchema.parse({
      personnes: ['a/M', 'b/F', 'c/F', 'd/M', 'e/F', 'f/M'],
      filiations: [{ parents: ['a', 'b'], enfant: 'e' }],
    }),
  );
  const link = (parent: string, type: FiliationType) =>
    filiationSchema.parse({
      id: tree.context.nextId(),
      treeId: tree.context.treeId,
      parentId: tree.id(parent),
      childId: tree.id('e'),
      type,
      certainty: 'certain',
    });

  it('un troisième parent de naissance est refusé, avec les autres types proposés', () => {
    const issues = checkNewFiliation(tree.data, link('c', 'birth'));
    expect(issues.map((found) => [found.code, found.severity])).toEqual([
      ['third_birth_parent', 'refusal'],
    ]);
    expect(issues[0]?.suggestedFiliationTypes).toEqual([
      'adoptive',
      'raised',
      'fostered',
      'guardian',
      'donor',
      'surrogacy',
    ]);
  });

  it('autant de liens d’autres types qu’on veut', () => {
    let data = tree.data;
    for (const [parent, type] of [
      ['c', 'adoptive'],
      ['d', 'adoptive'],
      ['f', 'raised'],
      ['c', 'guardian'],
      ['d', 'donor'],
      ['f', 'surrogacy'],
    ] as const) {
      const added = link(parent, type);
      expect(checkNewFiliation(data, added)).toEqual([]);
      data = { ...data, filiations: [...data.filiations, added] };
    }
    expect(findCoherenceIssues(data)).toEqual([]);
  });

  it('le même parent saisi deux fois n’est pas un troisième parent ; remplacer un lien par son identifiant non plus', () => {
    expect(checkNewFiliation(tree.data, link('a', 'birth'))).toEqual([]);
    const [first] = tree.data.filiations;
    if (first === undefined) throw new Error('missing filiation');
    expect(checkNewFiliation(tree.data, { ...first, parentId: tree.id('c') })).toEqual([]);
  });
});

describe('UNI-18 : le cycle est refusé', () => {
  it('une personne parent d’elle-même, même hors schéma, est un cycle', () => {
    const tree = family({});
    const self = { id: tree.context.nextId(), parentId: tree.id('e'), childId: tree.id('e') };
    const issues = checkNewFiliation(tree.data, { ...self, type: 'raised' });
    expect(issues.map((found) => found.code)).toEqual(['filiation_cycle']);
    expect(
      findCoherenceIssues({
        ...tree.data,
        filiations: [...tree.data.filiations, { ...self, type: 'raised' }],
      }).map((found) => found.code),
    ).toEqual(['filiation_cycle']);
  });

  it('deux boucles distinctes donnent deux refus ; l’implexe (deux chemins vers un ancêtre) aucun', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['a/M', 'b/F', 'c/M', 'd/F', 'x/M', 'y/F'],
        filiations: [
          { parents: ['a'], enfant: 'b' },
          { parents: ['a'], enfant: 'c' },
          { parents: ['b', 'c'], enfant: 'd' },
          { parents: ['x'], enfant: 'y' },
        ],
      }),
    );
    expect(findCoherenceIssues(tree.data)).toEqual([]);
    const back = (parent: string, child: string) => ({
      id: tree.context.nextId(),
      parentId: tree.id(parent),
      childId: tree.id(child),
      type: 'birth' as const,
    });
    const issues = findCoherenceIssues({
      ...tree.data,
      filiations: [...tree.data.filiations, back('d', 'a'), back('y', 'x')],
    });
    expect(issues.map((found) => found.code)).toEqual(['filiation_cycle', 'filiation_cycle']);
    expect(hasRefusal(issues)).toBe(true);
  });
});

describe('union d’une personne avec elle-même', () => {
  it('est refusée', () => {
    const tree = family({});
    const id = tree.context.nextId();
    const spouse = { personId: tree.id('p'), rank: 1 };
    expect(checkUnion({ id, spouses: [spouse, spouse] })).toEqual([
      {
        code: 'union_with_self',
        severity: 'refusal',
        objects: [
          { type: 'union', id },
          { type: 'person', id: tree.id('p') },
        ],
      },
    ]);
    expect(checkUnion({ id, spouses: [spouse, { personId: tree.id('e'), rank: 1 }] })).toEqual([]);
  });
});

describe('les dates lues sont celles des faits datés de la personne', () => {
  it('un fait de naissance en texte libre est ignoré ; deux versions sont réunies', () => {
    const tree = family({ parentBirth: exact('1990'), childBirth: exact('1960') });
    const extra = factFromScenario(tree.context, {
      personne: 'p',
      type: 'naissance',
      date: { qualificatif: 'exacte', date: '1930' },
    });
    // 1930 ou 1990 : le parent n'est plus certainement plus jeune que l'enfant.
    expect(
      findCoherenceIssues({ ...tree.data, facts: [...tree.data.facts, extra] }).map(
        (found) => found.code,
      ),
    ).toEqual([]);
    const text = factFromScenario(tree.context, {
      personne: 'p',
      type: 'naissance',
      date: { qualificatif: 'texte', texte: 'avant la guerre' },
    });
    expect(
      findCoherenceIssues({ ...tree.data, facts: [...tree.data.facts, text] }).map(
        (found) => found.code,
      ),
    ).toEqual(['parent_younger_than_child']);
  });
});
