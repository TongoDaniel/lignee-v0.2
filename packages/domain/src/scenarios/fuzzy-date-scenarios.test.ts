// Cas limites cités par T-005, joués pour ce qui relève de la date floue : chaque scénario est lu
// dans test/scenarios/<ID>.yaml, ses dates converties puis validées par `fuzzyDateSchema`.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  birthDateFromAge,
  compareFuzzyDates,
  fuzzyDateSchema,
  fuzzyDateSpan,
  isApproximate,
  type FuzzyDate,
} from '../fuzzy-date';
import {
  fuzzyDateInputFromScenario,
  loadScenario,
  scenarioFuzzyDateSchema,
  scenarioPrecisions,
  type ScenarioFuzzyDate,
} from '../test-support/scenario';

const toDate = (line: ScenarioFuzzyDate): FuzzyDate =>
  fuzzyDateSchema.parse(fuzzyDateInputFromScenario(line));

/** Les dates dans l'ordre attendu : mélangées, puis triées, elles retrouvent cet ordre. */
function expectSortedAs(lines: readonly ScenarioFuzzyDate[]) {
  const expected = lines.map(toDate);
  const shuffled = [...expected.slice(1).reverse(), expected[0]].filter(
    (date): date is FuzzyDate => date !== undefined,
  );
  expect(shuffled.sort(compareFuzzyDates)).toEqual(expected);
  for (let index = 1; index < expected.length; index += 1) {
    expect(compareFuzzyDates(expected[index - 1], expected[index])).toBeLessThan(0);
  }
}

describe('CL-DON-05 — « Né vers 1940 »', () => {
  const scenario = loadScenario(
    'CL-DON-05',
    z.looseObject({
      action: z.object({ saisie: z.string(), date: scenarioFuzzyDateSchema }),
      attendu: z.object({
        valide: z.literal(true),
        approximative: z.literal(true),
        precision: z.enum(Object.keys(scenarioPrecisions) as [keyof typeof scenarioPrecisions]),
        ordre: z.array(scenarioFuzzyDateSchema).min(2),
      }),
    }),
  );

  it('enregistre une date approximative, à l’année, avec son texte d’origine', () => {
    const date = toDate(scenario.action.date);
    expect(date.qualifier).toBe('about');
    expect(isApproximate(date)).toBe(scenario.attendu.approximative);
    if (date.qualifier === 'text') throw new Error('expected a dated value');
    expect(date.precision).toBe(scenarioPrecisions[scenario.attendu.precision]);
    expect(date.originalText).toBe(scenario.action.saisie.replace(/^né /, ''));
  });

  it('la place à son rang parmi des dates de précisions différentes, texte libre en fin', () => {
    expect(scenario.attendu.ordre).toContainEqual(scenario.action.date);
    expectSortedAs(scenario.attendu.ordre);
  });
});

describe('CL-DON-06 — « Entre 1935 et 1940 »', () => {
  const scenario = loadScenario(
    'CL-DON-06',
    z.looseObject({
      action: z.object({ saisie: z.string(), date: scenarioFuzzyDateSchema }),
      attendu: z.object({
        valide: z.literal(true),
        approximative: z.literal(true),
        intervalle: z.object({ du: z.string(), au: z.string() }),
        ordre: z.array(scenarioFuzzyDateSchema).min(2),
        refuse: z.array(scenarioFuzzyDateSchema).min(1),
      }),
    }),
  );

  const day = (value: string) => {
    const [year = 0, month = 0, dayOfMonth = 0] = value.split('-').map(Number);
    return { year, month, day: dayOfMonth };
  };

  it('enregistre un intervalle à deux bornes, du premier au dernier jour', () => {
    const date = toDate(scenario.action.date);
    expect(date.qualifier).toBe('between');
    expect(isApproximate(date)).toBe(scenario.attendu.approximative);
    expect(fuzzyDateSpan(date)).toEqual({
      earliest: day(scenario.attendu.intervalle.du),
      latest: day(scenario.attendu.intervalle.au),
    });
  });

  it('le place au début de son intervalle dans un tri', () => {
    expect(scenario.attendu.ordre).toContainEqual(scenario.action.date);
    expectSortedAs(scenario.attendu.ordre);
  });

  it('refuse des bornes inversées, égales, de précisions différentes, ou une seule borne', () => {
    for (const line of scenario.attendu.refuse) {
      const result = fuzzyDateSchema.safeParse(fuzzyDateInputFromScenario(line));
      expect({ line, ok: result.success }).toEqual({ line, ok: false });
    }
  });
});

describe('CL-VOI-16 — « Il est mort à 80 ans en 2010 » (VOX-14, partie calcul)', () => {
  const scenario = loadScenario(
    'CL-VOI-16',
    z.looseObject({
      action: z.object({
        dictee: z.string(),
        calcul: z.object({ age: z.int(), deces: scenarioFuzzyDateSchema }),
      }),
      attendu: z.object({
        naissance: scenarioFuzzyDateSchema,
        approximative: z.literal(true),
      }),
    }),
  );

  it('calcule une naissance vers 1930, marquée calculée et approximative', () => {
    const birth = birthDateFromAge(
      scenario.action.calcul.age,
      toDate(scenario.action.calcul.deces),
    );
    expect(birth).toEqual(toDate(scenario.attendu.naissance));
    if (birth === undefined) throw new Error('missing birth');
    expect(birth.qualifier).toBe('calculated');
    expect(isApproximate(birth)).toBe(scenario.attendu.approximative);
  });
});
