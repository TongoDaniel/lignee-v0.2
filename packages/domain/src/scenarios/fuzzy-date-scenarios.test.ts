// Cas limites cités par T-005, joués pour ce qui relève de la date floue : chaque scénario est lu
// dans test/scenarios/<ID>.yaml (schéma strict), ses dates converties puis validées par
// `fuzzyDateSchema`. Ce qui reste à jouer ailleurs est listé dans le champ `couverture`.
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
  scenarioSchema,
  type ScenarioFuzzyDate,
} from '../test-support/scenario';

const toDate = (line: ScenarioFuzzyDate): FuzzyDate =>
  fuzzyDateSchema.parse(fuzzyDateInputFromScenario(line));

/** Les dates dans l'ordre attendu : mélangées, puis triées, elles retrouvent cet ordre. */
function expectSortedAs(lines: readonly ScenarioFuzzyDate[]) {
  const expected = lines.map(toDate);
  const shuffled = [...expected.slice(1).reverse(), ...expected.slice(0, 1)];
  expect(shuffled.sort(compareFuzzyDates)).toEqual(expected);
  for (let index = 1; index < expected.length; index += 1) {
    expect(compareFuzzyDates(expected[index - 1], expected[index])).toBeLessThan(0);
  }
}

const enteredDate = z.strictObject({ saisie: z.string(), date: scenarioFuzzyDateSchema });

describe('CL-DON-05 — « Né vers 1940 »', () => {
  const schema = scenarioSchema('CL-DON-05', {
    action: enteredDate,
    attendu: z.strictObject({
      valide: z.literal(true),
      approximative: z.literal(true),
      precision: z.enum(Object.keys(scenarioPrecisions) as [keyof typeof scenarioPrecisions]),
      ordre: z.array(scenarioFuzzyDateSchema).min(2),
    }),
  });

  it('modèle : une date approximative, à l’année, avec son texte d’origine', () => {
    const scenario = loadScenario('CL-DON-05', schema);
    const date = toDate(scenario.action.date);
    expect(date.qualifier).toBe('about');
    expect(isApproximate(date)).toBe(scenario.attendu.approximative);
    if (date.qualifier === 'text') throw new Error('expected a dated value');
    expect(date.precision).toBe(scenarioPrecisions[scenario.attendu.precision]);
    expect(date.originalText).toBeDefined();
    expect(scenario.action.saisie.endsWith(date.originalText ?? '')).toBe(true);
  });

  it('modèle : placée à son rang parmi des dates de précisions différentes, texte libre en fin', () => {
    const scenario = loadScenario('CL-DON-05', schema);
    expect(scenario.attendu.ordre).toContainEqual(scenario.action.date);
    expectSortedAs(scenario.attendu.ordre);
  });
});

describe('CL-DON-06 — « Entre 1935 et 1940 »', () => {
  const schema = scenarioSchema('CL-DON-06', {
    action: enteredDate,
    attendu: z.strictObject({
      valide: z.literal(true),
      approximative: z.literal(true),
      intervalle: z.strictObject({ du: z.string(), au: z.string() }),
      ordre: z.array(scenarioFuzzyDateSchema).min(2),
      refuse: z.array(scenarioFuzzyDateSchema).min(1),
    }),
  });

  const day = (value: string) => {
    const [year = 0, month = 0, dayOfMonth = 0] = value.split('-').map(Number);
    return { year, month, day: dayOfMonth };
  };

  it('modèle : un intervalle à deux bornes, du premier au dernier jour', () => {
    const scenario = loadScenario('CL-DON-06', schema);
    const date = toDate(scenario.action.date);
    expect(date.qualifier).toBe('between');
    expect(isApproximate(date)).toBe(scenario.attendu.approximative);
    if (date.qualifier === 'text') throw new Error('expected a dated value');
    expect(date.originalText).toBe(scenario.action.saisie);
    expect(fuzzyDateSpan(date)).toEqual({
      earliest: day(scenario.attendu.intervalle.du),
      latest: day(scenario.attendu.intervalle.au),
    });
  });

  it('modèle : placé au début de son intervalle dans un tri', () => {
    const scenario = loadScenario('CL-DON-06', schema);
    expect(scenario.attendu.ordre).toContainEqual(scenario.action.date);
    expectSortedAs(scenario.attendu.ordre);
  });

  it('modèle : refuse des bornes inversées, égales, de précisions différentes, ou une seule', () => {
    const scenario = loadScenario('CL-DON-06', schema);
    for (const line of scenario.attendu.refuse) {
      const result = fuzzyDateSchema.safeParse(fuzzyDateInputFromScenario(line));
      expect({ line, ok: result.success }).toEqual({ line, ok: false });
    }
  });
});

describe('CL-VOI-16 — « Il est mort à 80 ans en 2010 » (VOX-14, partie calcul)', () => {
  const schema = scenarioSchema('CL-VOI-16', {
    action: z.strictObject({
      dictee: z.string(),
      calcul: z.strictObject({ age: z.int(), deces: scenarioFuzzyDateSchema }),
    }),
    attendu: z.strictObject({
      naissance: scenarioFuzzyDateSchema,
      approximative: z.literal(true),
    }),
  });

  it('modèle : une naissance vers 1930, marquée calculée et approximative', () => {
    const scenario = loadScenario('CL-VOI-16', schema);
    // La phrase est comprise par la voix (T-066) ; ici, le calcul qu'elle demande.
    expect(scenario.action.dictee).toContain(String(scenario.action.calcul.age));
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
