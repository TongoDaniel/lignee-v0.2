// Outil qui fige un arbre généré dans le jeu de paires annotées (T-023) : la famille figée, relue
// au format des scénarios, donne exactement les mêmes liens que l'arbre généré, sur toutes les
// paires de personnes. Le jeu ne dépend pas du générateur ; ce test vérifie l'outil, pas le jeu.
import type { Id } from '@lignee/domain';
import {
  buildScenarioTree,
  generateTree,
  scenarioTreeSchema,
  type TreeData,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { createAllianceContext } from './alliance';
import { createKinshipGraph } from './graph';
import { presentRelationships } from './presentation';
import { resultSignature } from './test-support/annotated-pairs';
import { freezeGeneratedFamily, scenarioDateOf } from './test-support/generated-family';

function signatures(data: TreeData, keyOf: (id: Id) => string) {
  const graph = createKinshipGraph(data);
  const allianceContext = createAllianceContext(data);
  const ids = data.people.map((person) => person.id);
  const result = new Map<string, unknown>();
  for (const a of ids) {
    for (const b of ids) {
      const presented = presentRelationships(graph, a, b, { allianceContext });
      result.set(`${keyOf(a)} → ${keyOf(b)}`, resultSignature(presented, keyOf));
    }
  }
  return result;
}

describe('T-023 — familles générées figées (freezeGeneratedFamily)', () => {
  it.each([
    [46, 40],
    [6, 30],
    [11, 30],
    [27, 35],
  ])(
    'graine %i, %i personnes : la famille figée donne les mêmes liens que l’arbre généré',
    (seed, size) => {
      const generated = generateTree({ seed, size });
      const { arbre, keyOf } = freezeGeneratedFamily(generated);
      const frozen = buildScenarioTree(scenarioTreeSchema.parse(arbre));
      expect(frozen.data.people).toHaveLength(size);
      const original = signatures(generated, (id) => keyOf.get(id) ?? id);
      const copy = signatures(frozen.data, (id) => frozen.keyOf(id) ?? id);
      expect(copy).toEqual(original);
    },
    60_000,
  );

  it('les dates floues gardent leur forme (année, jour, « vers », « entre », texte)', () => {
    expect(
      scenarioDateOf({
        qualifier: 'exact',
        precision: 'day',
        date: { year: 1950, month: 3, day: 7 },
        calendar: 'gregorian',
      }),
    ).toEqual({ qualificatif: 'exacte', date: '1950-03-07' });
    expect(
      scenarioDateOf({
        qualifier: 'between',
        precision: 'year',
        from: { year: 1950 },
        to: { year: 1953 },
        originalText: 'entre 1950 et 1953',
        calendar: 'gregorian',
      }),
    ).toEqual({ qualificatif: 'entre', de: '1950', a: '1953', texte: 'entre 1950 et 1953' });
    expect(scenarioDateOf({ qualifier: 'text', originalText: 'l’année de l’éclipse' })).toEqual({
      qualificatif: 'texte',
      texte: 'l’année de l’éclipse',
    });
  });
});
