// Règle des garde-fous de performance (README racine, « Tests de performance ») : facteur 3 en
// CI, 1,5 sur un poste, réglable par LIGNEE_PERF_FACTOR ; médiane après chauffe.
import { describe, expect, it } from 'vitest';

import {
  CI_PERF_FACTOR,
  LOCAL_PERF_FACTOR,
  median,
  medianTime,
  perfCeiling,
  perfFactor,
} from './timing';

describe('facteur des garde-fous de performance', () => {
  it('3 en CI, 1,5 sur un poste', () => {
    expect(CI_PERF_FACTOR).toBe(3);
    expect(LOCAL_PERF_FACTOR).toBe(1.5);
    expect(perfFactor({ CI: 'true' })).toBe(3);
    expect(perfFactor({ CI: '1' })).toBe(3);
    expect(perfFactor({})).toBe(1.5);
    expect(perfFactor({ CI: 'false' })).toBe(1.5);
    expect(perfFactor({ CI: '' })).toBe(1.5);
  });

  it('LIGNEE_PERF_FACTOR l’emporte, et refuse une valeur qui n’est pas un nombre positif', () => {
    expect(perfFactor({ CI: 'true', LIGNEE_PERF_FACTOR: '1' })).toBe(1);
    expect(perfFactor({ LIGNEE_PERF_FACTOR: '4.5' })).toBe(4.5);
    expect(() => perfFactor({ LIGNEE_PERF_FACTOR: '0' })).toThrow();
    expect(() => perfFactor({ LIGNEE_PERF_FACTOR: 'vite' })).toThrow();
  });

  it('le plafond est le budget du cahier multiplié par le facteur', () => {
    expect(perfCeiling(300, 3)).toBe(900);
    expect(perfCeiling(100, 1.5)).toBe(150);
  });
});

describe('médiane après chauffe', () => {
  it('une exécution lente isolée ne fait pas la médiane', () => {
    expect(median([5, 400, 6, 4, 7])).toBe(6);
    expect(median([1, 2, 3, 4])).toBe(2);
    expect(() => median([])).toThrow();
  });

  it('chauffe et préparation hors des exécutions comptées', () => {
    let setups = 0;
    let calls = 0;
    const timing = medianTime(
      () => {
        calls += 1;
      },
      {
        warmup: 2,
        runs: 3,
        setup: () => {
          setups += 1;
        },
      },
    );
    expect(calls).toBe(5);
    expect(setups).toBe(5);
    expect(timing.samplesMs).toHaveLength(3);
    expect(timing.medianMs).toBeGreaterThanOrEqual(0);
  });
});
