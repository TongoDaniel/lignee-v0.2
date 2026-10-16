// La lecture simple des scénarios : schéma strict et trace des scénarios réellement chargés.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadScenario, scenarioSchema, scenarioUnionSchema } from './scenario';

const VARIABLE = 'LIGNEE_SCENARIOS_PLAYED_DIR';
const previous = process.env[VARIABLE];

afterEach(() => {
  if (previous === undefined) delete process.env[VARIABLE];
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

  it('une union exige exactement ses deux rangs', () => {
    expect(
      scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 1, rang_b: 2 }).success,
    ).toBe(true);
    expect(scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 1 }).success).toBe(false);
    expect(
      scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 1, rang_b: 1, lieu: 'x' })
        .success,
    ).toBe(false);
    expect(
      scenarioUnionSchema.safeParse({ conjoints: ['a', 'b'], rang_a: 0, rang_b: 1 }).success,
    ).toBe(false);
  });
});
