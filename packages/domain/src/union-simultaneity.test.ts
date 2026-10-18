// UNI-08 : simultanées ou successives, déduit des dates de début et de fin ; sans dates, une seule
// question par personne, réponse gardée par paire d'unions et modifiable (ADR 0012). CL-POL-05 est
// joué à part.
import { describe, expect, it } from 'vitest';

import { fuzzyDateSchema, type FuzzyDate } from './fuzzy-date';
import type { Id } from './ids';
import {
  buildScenarioTree,
  factFromScenario,
  scenarioTreeSchema,
  type ScenarioTree,
} from './test-support/scenario-tree';
import { treeDataIssues, type TreeData } from './test-support/tree-data';
import type { Union, UnionSimultaneity } from './union';
import {
  answerSimultaneity,
  pairAnswersFromHouseholds,
  resolveSimultaneity,
  simultaneityFromDates,
  simultaneityQuestionFor,
  simultaneityQuestions,
  uniformPairAnswers,
  unionPair,
  type PairAnswer,
  type SimultaneityQuestion,
} from './union-simultaneity';

const year = (value: number, qualifier: 'exact' | 'about' = 'exact'): FuzzyDate =>
  fuzzyDateSchema.parse({ qualifier, precision: 'year', date: { year: value } });

/** Arbre de scénario avec des unions ; `dates` donne début et fin par rang d'union. */
function treeWith(
  section: unknown,
  dates: Partial<Pick<Union, 'start' | 'end'>>[] = [],
): { tree: ScenarioTree; data: TreeData; unions: Union[] } {
  const tree = buildScenarioTree(scenarioTreeSchema.parse(section));
  const unions = tree.data.unions.map((union, index) => ({ ...union, ...dates[index] }));
  return { tree, data: { ...tree.data, unions }, unions };
}

/** Un homme et ses épouses `w1`, `w2`… dans l'ordre. */
const household = (wives: number, dates: Partial<Pick<Union, 'start' | 'end'>>[] = []) =>
  treeWith(
    {
      personnes: ['h/M', ...Array.from({ length: wives }, (_, index) => `w${String(index + 1)}/F`)],
      unions: Array.from({ length: wives }, (_, index) => ({
        conjoints: ['h', `w${String(index + 1)}`],
      })),
    },
    dates,
  );

function answer(data: TreeData, tree: ScenarioTree, pairs: readonly PairAnswer[]): TreeData {
  const simultaneityAnswers = answerSimultaneity(data.simultaneityAnswers, pairs, {
    treeId: tree.context.treeId,
    nextId: tree.context.nextId,
  });
  return { ...data, simultaneityAnswers };
}

const value = (data: TreeData, a: Union, b: Union) => resolveSimultaneity(data, a, b);

function only<T>(list: readonly T[]): T {
  expect(list).toHaveLength(1);
  return list[0] as T;
}

describe('UNI-08 : déduit des dates', () => {
  it('successives quand l’une finit avant que l’autre commence, dans un sens ou dans l’autre', () => {
    const { data, unions } = household(2, [
      { start: year(1950), end: year(1960) },
      { start: year(1962) },
    ]);
    const [a, b] = unions as [Union, Union];
    expect(simultaneityFromDates(data, a, b)).toBe('successive');
    expect(simultaneityFromDates(data, b, a)).toBe('successive');
  });

  it('simultanées quand chacune commence avant la fin certaine de l’autre', () => {
    const { data, unions } = household(2, [
      { start: year(1950), end: year(1980) },
      { start: year(1960), end: year(1990) },
    ]);
    const [a, b] = unions as [Union, Union];
    expect(simultaneityFromDates(data, a, b)).toBe('simultaneous');
  });

  it('une union sans fin n’est pas présumée en cours : rien n’est déduit', () => {
    const { data, unions } = household(2, [{ start: year(1950) }, { start: year(1960) }]);
    const [a, b] = unions as [Union, Union];
    expect(simultaneityFromDates(data, a, b)).toBeUndefined();
  });

  it('la mort d’un conjoint termine l’union', () => {
    const { tree, data, unions } = household(2, [{ start: year(1950) }, { start: year(1962) }]);
    const death = factFromScenario(tree.context, {
      personne: 'w1',
      type: 'deces',
      date: { qualificatif: 'exacte', date: '1958' },
    });
    const [a, b] = unions as [Union, Union];
    expect(simultaneityFromDates({ facts: [...data.facts, death] }, a, b)).toBe('successive');
  });

  it('les marges des dates « vers » laissent la question ouverte', () => {
    const { data, unions } = household(2, [
      { start: year(1950), end: year(1960, 'about') },
      { start: year(1962) },
    ]);
    const [a, b] = unions as [Union, Union];
    expect(simultaneityFromDates(data, a, b)).toBeUndefined();
  });

  it('chevauchement en chaîne : u1 et u2 ensemble, u2 et u3 ensemble, u1 avant u3', () => {
    const { data, unions } = household(3, [
      { start: year(1950), end: year(1965) },
      { start: year(1960), end: year(1980) },
      { start: year(1970), end: year(1990) },
    ]);
    const [u1, u2, u3] = unions as [Union, Union, Union];
    expect(value(data, u1, u2)).toEqual({ source: 'dates', value: 'simultaneous' });
    expect(value(data, u2, u3)).toEqual({ source: 'dates', value: 'simultaneous' });
    // Jamais co-épouses : u1 a fini avant que u3 commence.
    expect(value(data, u1, u3)).toEqual({ source: 'dates', value: 'successive' });
    expect(simultaneityQuestions(data)).toEqual([]);
  });

  it('les dates priment sur la réponse gardée', () => {
    const { tree, data, unions } = household(2, [
      { start: year(1950), end: year(1960) },
      { start: year(1962) },
    ]);
    const [a, b] = unions as [Union, Union];
    const answered = answer(data, tree, [
      { unionIds: unionPair(a.id, b.id), simultaneity: 'simultaneous' },
    ]);
    expect(value(answered, a, b)).toEqual({ source: 'dates', value: 'successive' });
  });
});

describe('UNI-08 : sans dates, une seule question, une valeur par paire', () => {
  it('une seule question pour l’homme, aucune pour les épouses (une union chacune)', () => {
    const { tree, data, unions } = household(2);
    const [a, b] = unions as [Union, Union];
    expect(simultaneityQuestions(data)).toEqual([
      { personId: tree.id('h'), unionIds: [a.id, b.id], pairs: [unionPair(a.id, b.id)] },
    ]);
    expect(simultaneityQuestionFor(data, tree.id('w1'))).toBeUndefined();
  });

  it('deux épouses en même temps, puis une troisième après leur mort : en foyers successifs', () => {
    const { tree, data, unions } = household(3);
    const [u1, u2, u3] = unions as [Union, Union, Union];
    const question = only(simultaneityQuestions(data));
    expect(question.pairs).toHaveLength(3);
    const answered = answer(
      data,
      tree,
      pairAnswersFromHouseholds(question, [[u1.id, u2.id], [u3.id]]),
    );
    expect(value(answered, u1, u2)).toEqual({ source: 'answer', value: 'simultaneous' });
    expect(value(answered, u1, u3)).toEqual({ source: 'answer', value: 'successive' });
    expect(value(answered, u2, u3)).toEqual({ source: 'answer', value: 'successive' });
    expect(simultaneityQuestions(answered)).toEqual([]);
    expect(treeDataIssues(answered)).toEqual([]);
  });

  it('chevauchement en chaîne sans dates : une valeur par paire, u1 et u3 jamais co-épouses', () => {
    const { tree, data, unions } = household(3);
    const [u1, u2, u3] = unions as [Union, Union, Union];
    only(simultaneityQuestions(data));
    const answered = answer(data, tree, [
      { unionIds: unionPair(u1.id, u2.id), simultaneity: 'simultaneous' },
      { unionIds: unionPair(u2.id, u3.id), simultaneity: 'simultaneous' },
      { unionIds: unionPair(u1.id, u3.id), simultaneity: 'successive' },
    ]);
    expect(value(answered, u1, u3)).toEqual({ source: 'answer', value: 'successive' });
    expect(value(answered, u1, u2)).toEqual({ source: 'answer', value: 'simultaneous' });
    expect(simultaneityQuestions(answered)).toEqual([]);
  });

  it('les foyers refusent une union oubliée ou comptée deux fois', () => {
    const { data, unions } = household(3);
    const [u1, u2, u3] = unions as [Union, Union, Union];
    const question = only(simultaneityQuestions(data));
    expect(() => pairAnswersFromHouseholds(question, [[u1.id, u2.id]])).toThrow(RangeError);
    expect(() =>
      pairAnswersFromHouseholds(question, [
        [u1.id, u2.id],
        [u2.id, u3.id],
      ]),
    ).toThrow(RangeError);
  });

  it('lévirat : les paires du frère et de la veuve sont distinctes, chacune sa réponse', () => {
    const { tree, data, unions } = treeWith({
      personnes: ['frere/M', 'epouse/F', 'veuve/F', 'defunt/M'],
      unions: [
        { conjoints: ['frere', 'epouse'] },
        { conjoints: ['defunt', 'veuve'] },
        { conjoints: ['frere', 'veuve'] },
      ],
    });
    const [first, earlier, levirate] = unions as [Union, Union, Union];
    const questions = simultaneityQuestions(data);
    expect(questions.map((question) => tree.keyOf(question.personId))).toEqual(['frere', 'veuve']);
    const [forBrother, forWidow] = questions as [SimultaneityQuestion, SimultaneityQuestion];
    let answered = answer(data, tree, uniformPairAnswers(forBrother, 'simultaneous'));
    answered = answer(answered, tree, uniformPairAnswers(forWidow, 'successive'));
    expect(simultaneityQuestions(answered)).toEqual([]);
    expect(value(answered, first, levirate)).toEqual({ source: 'answer', value: 'simultaneous' });
    expect(value(answered, earlier, levirate)).toEqual({ source: 'answer', value: 'successive' });
    expect(answered.simultaneityAnswers).toHaveLength(2);
  });

  it('un couple remarié qui a d’autres unions : sa paire n’est demandée qu’une fois', () => {
    const { tree, data, unions } = treeWith({
      personnes: ['a/M', 'b/F', 'c/F', 'd/M'],
      unions: [
        { conjoints: ['a', 'b'] },
        { conjoints: ['a', 'c'] },
        { conjoints: ['a', 'b'] },
        { conjoints: ['d', 'b'] },
      ],
    });
    const [ab1, ac, ab2, db] = unions as [Union, Union, Union, Union];
    const questions = simultaneityQuestions(data);
    const asked = questions.flatMap((question) => question.pairs.map((pair) => pair.join('|')));
    // a : (ab1, ac), (ab1, ab2), (ac, ab2) ; b : (ab1, db), (ab2, db) ; le couple une seule fois.
    expect(asked).toHaveLength(5);
    expect(new Set(asked).size).toBe(5);
    expect(asked.filter((pair) => pair === unionPair(ab1.id, ab2.id).join('|'))).toHaveLength(1);
    let answered = data;
    for (const question of questions) {
      answered = answer(answered, tree, uniformPairAnswers(question, 'successive'));
    }
    expect(simultaneityQuestions(answered)).toEqual([]);
    expect(value(answered, ab2, ab1)).toEqual({ source: 'answer', value: 'successive' });
    // Deux unions sans conjoint commun ne forment pas une paire.
    expect(value(answered, ac, db)).toEqual({ source: 'unknown' });
    expect(treeDataIssues(answered)).toEqual([]);
  });

  it('modifier une réponse garde le même objet ; les autres réponses ne changent pas', () => {
    const { tree, data, unions } = household(3);
    const [u1, u2, u3] = unions as [Union, Union, Union];
    const first = answer(
      data,
      tree,
      uniformPairAnswers(only(simultaneityQuestions(data)), 'simultaneous'),
    );
    const pair = (a: Union, b: Union, simultaneity: UnionSimultaneity): PairAnswer => ({
      unionIds: unionPair(b.id, a.id),
      simultaneity,
    });
    const second = answer(first, tree, [pair(u1, u3, 'successive')]);
    const byPair = (list: TreeData['simultaneityAnswers'], a: Id, b: Id) =>
      list.find((entry) => entry.unionIds.join('|') === unionPair(a, b).join('|'));
    expect(byPair(second.simultaneityAnswers, u1.id, u3.id)?.id).toBe(
      byPair(first.simultaneityAnswers, u1.id, u3.id)?.id,
    );
    expect(byPair(second.simultaneityAnswers, u1.id, u3.id)?.simultaneity).toBe('successive');
    expect(byPair(second.simultaneityAnswers, u1.id, u2.id)).toBe(
      byPair(first.simultaneityAnswers, u1.id, u2.id),
    );
    expect(second.simultaneityAnswers).toHaveLength(3);
  });

  it('une paire d’une union avec elle-même est refusée', () => {
    const { tree, data, unions } = household(2);
    const [a] = unions as [Union];
    expect(() =>
      answer(data, tree, [{ unionIds: [a.id, a.id], simultaneity: 'successive' }]),
    ).toThrow(RangeError);
  });

  it('l’arbre refuse une réponse en double, ou pour deux unions sans conjoint commun', () => {
    const { tree, data, unions } = treeWith({
      personnes: ['a/M', 'b/F', 'c/M', 'd/F'],
      unions: [{ conjoints: ['a', 'b'] }, { conjoints: ['c', 'd'] }, { conjoints: ['a', 'd'] }],
    });
    const [ab, cd, ad] = unions as [Union, Union, Union];
    const stray = answer(data, tree, [
      { unionIds: unionPair(ab.id, cd.id), simultaneity: 'successive' },
    ]);
    expect(treeDataIssues(stray).map((found) => found.message)).toContain(
      'The two unions share no spouse',
    );
    const once = answer(data, tree, [
      { unionIds: unionPair(ab.id, ad.id), simultaneity: 'successive' },
    ]);
    const [kept] = once.simultaneityAnswers;
    if (kept === undefined) throw new Error('missing answer');
    const twice = {
      ...once,
      simultaneityAnswers: [kept, { ...kept, id: tree.context.nextId() }],
    };
    expect(treeDataIssues(twice).map((found) => found.message)).toContain(
      'Two answers for the same pair',
    );
  });
});
