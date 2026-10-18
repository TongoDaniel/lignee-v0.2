// La lecture simple des scénarios : schéma strict et trace des scénarios réellement chargés.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadScenario, scenarioSchema, scenarioUnionSchema } from './scenario';
import { buildScenarioTree, scenarioTreeSchema } from './scenario-tree';

const VARIABLE = 'LIGNEE_SCENARIOS_PLAYED_DIR';
const previous = process.env[VARIABLE];

afterEach(() => {
  if (previous === undefined) delete process.env.LIGNEE_SCENARIOS_PLAYED_DIR;
  else process.env[VARIABLE] = previous;
});

describe('lecture simple des scénarios', () => {
  it('refuse un scénario dont une clé n’est pas lue par le test', () => {
    // CL-DON-02 a une section `attendu` que ce schéma ne déclare pas.
    expect(() =>
      loadScenario('CL-DON-02', scenarioSchema('CL-DON-02', { arbre: z.unknown() })),
    ).toThrow();
  });

  it('refuse un identifiant qui ne correspond pas au fichier', () => {
    expect(() =>
      loadScenario(
        'CL-DON-02',
        scenarioSchema('CL-DON-01', { arbre: z.unknown(), attendu: z.unknown() }),
      ),
    ).toThrow();
  });

  it('laisse une trace du scénario chargé quand la variable de la CI est définie', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lignee-played-'));
    try {
      process.env[VARIABLE] = join(dir, 'played');
      loadScenario(
        'CL-DON-02',
        scenarioSchema('CL-DON-02', { arbre: z.unknown(), attendu: z.unknown() }),
      );
      expect(readdirSync(join(dir, 'played'))).toEqual(['CL-DON-02']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ne laisse aucune trace d’un scénario refusé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lignee-played-'));
    try {
      process.env[VARIABLE] = dir;
      expect(() => loadScenario('CL-DON-02', scenarioSchema('CL-DON-02', {}))).toThrow();
      expect(existsSync(join(dir, 'CL-DON-02'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('une union a des rangs facultatifs, entiers positifs, et aucune autre clé', () => {
    expect(scenarioUnionSchema.parse({ conjoints: ['a', 'b'], rang_a: 1, rang_b: 2 })).toEqual({
      spouses: ['a', 'b'],
      ranks: [1, 2],
    });
    // Format du TRD (CL-POL-03) : seul le rang du mari est écrit.
    expect(scenarioUnionSchema.parse({ conjoints: ['a', 'b'], rang_a: 2 })).toEqual({
      spouses: ['a', 'b'],
      ranks: [2, undefined],
    });
    expect(
      scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 1, rang_b: 1, lieu: 'x' })
        .success,
    ).toBe(false);
    expect(scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_c: 1 }).success).toBe(false);
    expect(
      scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 0, rang_b: 1 }).success,
    ).toBe(false);
    expect(scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 1.5 }).success).toBe(
      false,
    );
  });
  it('une union peut dire ses dates et son motif de fin ; la simultanéité se dit par paire d’unions (T-008)', () => {
    const line = {
      conjoints: ['a', 'b'],
      debut: { qualificatif: 'vers', date: '1970' },
      fin: { qualificatif: 'exacte', date: '1980-05-02' },
      motif: 'deces',
    };
    expect(scenarioUnionSchema.parse(line)).toMatchObject({ endReason: 'death' });
    for (const wrong of [
      { motif: 'abandon' },
      { simultaneite_a: 'simultanee' },
      { debut: '1970' },
    ]) {
      expect(scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], ...wrong }).success).toBe(
        false,
      );
    }
    const section = {
      personnes: ['a/M', 'b/F', 'c/F', 'd/F', 'e/N'],
      unions: [line, { conjoints: ['a', 'c'] }, { conjoints: ['a', 'd'] }],
      filiations: [{ parents: ['a'], enfant: 'e' }],
      candidats: [{ enfant: 'e', candidates: ['b', 'c'] }],
      simultaneites: [
        {
          unions: [
            ['a', 'b'],
            ['a', 'c'],
            ['d', 'a'],
          ],
          reponse: 'simultanees',
        },
      ],
    };
    const tree = buildScenarioTree(scenarioTreeSchema.parse(section));
    const [union] = tree.data.unions;
    expect(union?.start).toMatchObject({ qualifier: 'about', date: { year: 1970 } });
    expect(union?.end).toMatchObject({ qualifier: 'exact', precision: 'day' });
    expect(union?.endReason).toBe('death');
    // Trois unions : trois paires, chacune rangée, toutes simultanées.
    expect(tree.data.simultaneityAnswers).toHaveLength(3);
    for (const answer of tree.data.simultaneityAnswers) {
      expect(answer.unionIds[0] < answer.unionIds[1]).toBe(true);
      expect(answer.simultaneity).toBe('simultaneous');
    }
    expect(tree.data.parentCandidates.map((candidate) => candidate.candidateId)).toEqual([
      tree.id('b'),
      tree.id('c'),
    ]);
    expect(() =>
      buildScenarioTree(
        scenarioTreeSchema.parse({
          ...section,
          simultaneites: [
            {
              unions: [
                ['a', 'b'],
                ['b', 'c'],
              ],
              reponse: 'successives',
            },
          ],
        }),
      ),
    ).toThrow(/exactly one union/);
    expect(() =>
      buildScenarioTree(
        scenarioTreeSchema.parse({
          personnes: ['a/M'],
          candidats: [{ enfant: 'a', candidates: ['z'] }],
        }),
      ),
    ).toThrow(/Unknown person/);
  });
});
