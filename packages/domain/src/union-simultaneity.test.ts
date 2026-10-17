// UNI-08 : simultanées ou successives, déduit des dates de début et de fin ; sans dates, une seule
// question, réponse gardée et modifiable (ADR 0012). CL-POL-05 est joué à part.
import { describe, expect, it } from 'vitest';

import { fuzzyDateSchema, type FuzzyDate } from './fuzzy-date';
import {
  factFromScenario,
  buildScenarioTree,
  scenarioTreeSchema,
} from './test-support/scenario-tree';
import type { Union } from './union';
import {
  answerSimultaneity,
  resolveSimultaneity,
  simultaneityFromDates,
  simultaneityQuestionFor,
  simultaneityQuestions,
} from './union-simultaneity';

const year = (value: number, qualifier: 'exact' | 'about' = 'exact'): FuzzyDate =>
  fuzzyDateSchema.parse({ qualifier, precision: 'year', date: { year: value } });

/** Un homme et deux épouses, unions datées comme demandé. */
function household(
  first: Partial<Pick<Union, 'start' | 'end'>>,
  second: Partial<Pick<Union, 'start' | 'end'>>,
  deaths: { personne: string; annee: number }[] = [],
) {
  const tree = buildScenarioTree(
    scenarioTreeSchema.parse({
      personnes: ['h/M', 'w1/F', 'w2/F'],
      unions: [{ conjoints: ['h', 'w1'] }, { conjoints: ['h', 'w2'] }],
      faits: deaths.map(({ personne, annee }) => ({
        personne,
        type: 'deces',
        date: { qualificatif: 'exacte', date: String(annee) },
      })),
    }),
  );
  const [a, b] = tree.data.unions as [Union, Union];
  const unions = [
    { ...a, ...first },
    { ...b, ...second },
  ];
  return { tree, data: { ...tree.data, unions }, a: unions[0] as Union, b: unions[1] as Union };
}

describe('UNI-08 : déduit des dates', () => {
  it('successives quand l’une finit avant que l’autre commence, dans un sens ou dans l’autre', () => {
    const { data, a, b } = household({ start: year(1950), end: year(1960) }, { start: year(1962) });
    expect(simultaneityFromDates(data, a, b)).toBe('successive');
    expect(simultaneityFromDates(data, b, a)).toBe('successive');
  });

  it('simultanées quand chacune commence avant la fin certaine de l’autre', () => {
    const { data, a, b } = household(
      { start: year(1950), end: year(1980) },
      { start: year(1960), end: year(1990) },
    );
    expect(simultaneityFromDates(data, a, b)).toBe('simultaneous');
  });

  it('une union sans fin n’est pas présumée en cours : rien n’est déduit', () => {
    const { data, a, b } = household({ start: year(1950) }, { start: year(1960) });
    expect(simultaneityFromDates(data, a, b)).toBeUndefined();
  });

  it('la mort d’un conjoint termine l’union : la veuve remariée a des unions successives', () => {
    const { data, a, b } = household({ start: year(1950) }, { start: year(1962) }, [
      { personne: 'w1', annee: 1958 },
    ]);
    expect(simultaneityFromDates(data, a, b)).toBe('successive');
  });

  it('les marges des dates « vers » laissent la question ouverte', () => {
    const { data, a, b } = household(
      { start: year(1950), end: year(1960, 'about') },
      { start: year(1962) },
    );
    expect(simultaneityFromDates(data, a, b)).toBeUndefined();
  });

  it('les dates priment sur la réponse gardée', () => {
    const { data, a, b, tree } = household(
      { start: year(1950), end: year(1960) },
      { start: year(1962) },
    );
    const question = { personId: tree.id('h'), unionIds: [a.id, b.id] };
    const answered = answerSimultaneity([a, b], question, 'simultaneous');
    const [first, second] = answered as [Union, Union];
    expect(resolveSimultaneity({ ...data, unions: answered }, tree.id('h'), first, second)).toEqual(
      { source: 'dates', value: 'successive' },
    );
  });
});

describe('UNI-08 : sans dates, une seule question, réponse gardée et modifiable', () => {
  it('une seule question pour l’homme, aucune pour les épouses (une union chacune)', () => {
    const { data, tree, a, b } = household({}, {});
    expect(simultaneityQuestions(data)).toEqual([
      { personId: tree.id('h'), unionIds: [a.id, b.id] },
    ]);
    expect(simultaneityQuestionFor(data, tree.id('w1'))).toBeUndefined();
  });

  it('trois unions sans dates : une question qui les couvre toutes', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['h/M', 'a/F', 'b/F', 'c/F'],
        unions: [{ conjoints: ['h', 'a'] }, { conjoints: ['h', 'b'] }, { conjoints: ['h', 'c'] }],
      }),
    );
    const questions = simultaneityQuestions(tree.data);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.unionIds).toHaveLength(3);
    const unions = answerSimultaneity(tree.data.unions, questions[0] as never, 'simultaneous');
    expect(simultaneityQuestions({ ...tree.data, unions })).toEqual([]);
  });

  it('la réponse est gardée du côté du conjoint interrogé seulement (lévirat)', () => {
    // Le frère a déjà une épouse ; la veuve avait un premier mari.
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['frere/M', 'epouse/F', 'veuve/F', 'defunt/M'],
        unions: [
          { conjoints: ['frere', 'epouse'] },
          { conjoints: ['defunt', 'veuve'] },
          { conjoints: ['frere', 'veuve'] },
        ],
      }),
    );
    const [forBrother, forWidow] = simultaneityQuestions(tree.data);
    expect(forBrother?.personId).toBe(tree.id('frere'));
    expect(forWidow?.personId).toBe(tree.id('veuve'));
    if (forBrother === undefined || forWidow === undefined) throw new Error('missing questions');
    let unions = answerSimultaneity(tree.data.unions, forBrother, 'simultaneous');
    unions = answerSimultaneity(unions, forWidow, 'successive');
    const data = { ...tree.data, unions };
    expect(simultaneityQuestions(data)).toEqual([]);
    const [first, second, levirate] = unions as [Union, Union, Union];
    expect(resolveSimultaneity(data, tree.id('frere'), first, levirate)).toEqual({
      source: 'answer',
      value: 'simultaneous',
    });
    expect(resolveSimultaneity(data, tree.id('veuve'), second, levirate)).toEqual({
      source: 'answer',
      value: 'successive',
    });
  });

  it('un couple remarié : la paire n’est demandée qu’une fois, et la réponse vaut pour les deux', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['a/M', 'b/F'],
        unions: [{ conjoints: ['a', 'b'] }, { conjoints: ['a', 'b'] }],
      }),
    );
    const questions = simultaneityQuestions(tree.data);
    expect(questions).toHaveLength(1);
    const unions = answerSimultaneity(tree.data.unions, questions[0] as never, 'successive');
    expect(simultaneityQuestions({ ...tree.data, unions })).toEqual([]);
    const [first, second] = unions as [Union, Union];
    expect(resolveSimultaneity({ ...tree.data, unions }, tree.id('b'), first, second)).toEqual({
      source: 'answer',
      value: 'successive',
    });
  });

  it('répondre ne touche que les unions de la question, et renvoie de nouveaux objets', () => {
    const { data, tree, a, b } = household({}, {});
    const other = { ...a, id: tree.context.nextId() };
    const unions = answerSimultaneity(
      [a, b, other],
      { personId: tree.id('h'), unionIds: [a.id] },
      'successive',
    );
    expect(unions[2]).toBe(other);
    expect(unions[0]).not.toBe(a);
    expect(a.spouses[0].simultaneity).toBeUndefined();
    expect(unions[0]?.spouses.map((spouse) => spouse.simultaneity)).toEqual([
      'successive',
      undefined,
    ]);
    expect(data.unions).toHaveLength(2);
  });

  it('le décès d’une autre personne n’entre pas : seuls ceux des conjoints comptent', () => {
    const { tree, a, b } = household({ start: year(1950) }, { start: year(1962) });
    const elsewhere = factFromScenario(tree.context, {
      personne: 'ailleurs',
      type: 'deces',
      date: { qualificatif: 'exacte', date: '1955' },
    });
    expect(simultaneityFromDates({ unions: [a, b], facts: [elsewhere] }, a, b)).toBeUndefined();
  });
});
