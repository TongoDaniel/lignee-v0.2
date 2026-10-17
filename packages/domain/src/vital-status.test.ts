// UNI-16 : une personne sans décès et née il y a moins de 100 ans est présumée vivante ; dans le
// doute, elle l'est (ADR 0011). Le jour de référence est un paramètre.
import { describe, expect, it } from 'vitest';

import type { VitalStatus } from './person';
import type { ScenarioFuzzyDate } from './test-support/scenario';
import { buildScenarioTree, scenarioTreeSchema } from './test-support/scenario-tree';
import {
  assessVitalStatus,
  assessVitalStatuses,
  isPresumedLiving,
  PRESUMED_LIVING_YEARS,
} from './vital-status';

const today = { year: 2026, month: 10, day: 16 };

function person(options: {
  status?: VitalStatus;
  birth?: ScenarioFuzzyDate;
  death?: ScenarioFuzzyDate;
}) {
  const tree = buildScenarioTree(
    scenarioTreeSchema.parse({
      personnes: ['p/F'],
      faits: [
        ...(options.birth === undefined
          ? []
          : [{ personne: 'p', type: 'naissance', date: options.birth }]),
        ...(options.death === undefined
          ? []
          : [{ personne: 'p', type: 'deces', date: options.death }]),
      ],
    }),
  );
  const data = {
    ...tree.data,
    people: tree.data.people.map((entry) => ({
      ...entry,
      vitalStatus: options.status ?? 'unknown',
    })),
  };
  return { data, id: tree.id('p') };
}

const assess = (options: Parameters<typeof person>[0], on = today) => {
  const { data, id } = person(options);
  return assessVitalStatus(data, id, on);
};

describe('UNI-16 : présumée vivante', () => {
  it('née il y a moins de 100 ans, sans décès : présumée vivante', () => {
    expect(PRESUMED_LIVING_YEARS).toBe(100);
    expect(assess({ birth: { qualificatif: 'exacte', date: '1950' } })).toEqual({
      presumedLiving: true,
      reason: 'born_less_than_100_years_ago',
    });
  });

  it('100 ans tout juste au jour donné : plus présumée vivante ; la veille, encore', () => {
    const birth: ScenarioFuzzyDate = { qualificatif: 'exacte', date: '1926-10-16' };
    expect(assess({ birth }).presumedLiving).toBe(false);
    expect(assess({ birth }, { year: 2026, month: 10, day: 15 }).presumedLiving).toBe(true);
  });

  it('la date de référence est un paramètre : la même fiche change avec elle', () => {
    const birth: ScenarioFuzzyDate = { qualificatif: 'exacte', date: '1930' };
    expect(assess({ birth }, { year: 2020, month: 1, day: 1 }).presumedLiving).toBe(true);
    expect(assess({ birth }, { year: 2031, month: 1, day: 1 }).presumedLiving).toBe(false);
  });

  it('dans le doute, vivante : « vers 1925 » peut être 1930 ; « entre 1920 et 1935 » aussi', () => {
    expect(assess({ birth: { qualificatif: 'vers', date: '1925' } })).toEqual({
      presumedLiving: true,
      reason: 'born_less_than_100_years_ago',
    });
    expect(assess({ birth: { qualificatif: 'entre', de: '1920', a: '1935' } }).presumedLiving).toBe(
      true,
    );
    expect(assess({ birth: { qualificatif: 'vers', date: '1915' } }).presumedLiving).toBe(false);
    expect(assess({ birth: { qualificatif: 'avant', date: '1920' } }).presumedLiving).toBe(false);
  });

  it('naissance inconnue, en texte libre ou « après » : présumée vivante', () => {
    for (const birth of [
      undefined,
      { qualificatif: 'texte', texte: "l'année de la grande crue" },
      { qualificatif: 'apres', date: '1900' },
    ] as const) {
      expect(assess(birth === undefined ? {} : { birth })).toEqual({
        presumedLiving: true,
        reason: 'birth_unknown',
      });
    }
  });

  it('un décès enregistré, même sans date ou en texte, l’emporte sur l’âge', () => {
    expect(
      assess({
        birth: { qualificatif: 'exacte', date: '1990' },
        death: { qualificatif: 'texte', texte: 'pendant la guerre' },
      }),
    ).toEqual({ presumedLiving: false, reason: 'death_recorded' });
  });

  it('une cause de décès seule ne lève pas la protection : donnée de santé de son seul auteur', () => {
    const { data, id } = person({ birth: { qualificatif: 'exacte', date: '1990' } });
    const cause = {
      id: '0190a000-0000-7000-8000-0000000000c1',
      treeId: data.tree.id,
      subject: { kind: 'person' as const, personId: id },
      type: 'death_cause' as const,
      value: 'Cause générée pour les tests',
      authorAccountId: data.tree.ownerAccountId,
    };
    expect(assessVitalStatus({ ...data, facts: [...data.facts, cause] }, id, today)).toEqual({
      presumedLiving: true,
      reason: 'born_less_than_100_years_ago',
    });
  });

  it('le statut saisi prime : vivante, puis décédée', () => {
    expect(assess({ status: 'living', birth: { qualificatif: 'exacte', date: '1900' } })).toEqual({
      presumedLiving: true,
      reason: 'declared_living',
    });
    expect(assess({ status: 'deceased', birth: { qualificatif: 'exacte', date: '1990' } })).toEqual(
      { presumedLiving: false, reason: 'declared_deceased' },
    );
  });

  it('le calcul en une passe donne le même résultat que fiche par fiche', () => {
    const { data, id } = person({ birth: { qualificatif: 'exacte', date: '1910' } });
    expect(assessVitalStatuses(data, today).get(id)).toEqual(assessVitalStatus(data, id, today));
    expect(isPresumedLiving(data, id, today)).toBe(false);
  });

  it('une personne absente de l’arbre est une erreur', () => {
    const { data } = person({});
    expect(() => assessVitalStatus(data, '0190a000-0000-7000-8000-000000000000', today)).toThrow(
      RangeError,
    );
  });
});
