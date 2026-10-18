import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  createId,
  createUuidV7Generator,
  idSchema,
  isUuidV7,
  uuidV7Timestamp,
  type UuidV7Source,
} from './ids';

/** Source dont l'horloge suit `clock` et dont l'aléa vient de `randomBytes`. */
function scriptedSource(clock: number[], randomBytes: number[]): UuidV7Source {
  let tick = 0;
  let cursor = 0;
  return {
    now: () => clock[Math.min(tick++, clock.length - 1)] ?? 0,
    fillRandom: (bytes) => {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = randomBytes[cursor++ % randomBytes.length] ?? 0;
      }
      return bytes;
    },
  };
}

describe('identifiants UUIDv7', () => {
  it('crée des UUIDv7 valides avec la source par défaut', () => {
    const id = createId();
    expect(isUuidV7(id)).toBe(true);
    expect(idSchema.safeParse(id).success).toBe(true);
    expect(Math.abs(uuidV7Timestamp(id) - Date.now())).toBeLessThan(60_000);
  });

  it('refuse les autres versions, les majuscules et les chaînes quelconques', () => {
    const v7 = '01890a5d-ac96-774b-bcce-b302099a8057';
    expect(idSchema.safeParse(v7).success).toBe(true);
    for (const invalid of [
      '01890a5d-ac96-474b-bcce-b302099a8057', // version 4
      '01890a5d-ac96-774b-7cce-b302099a8057', // variante fausse
      v7.toUpperCase(),
      'inconnu',
      '',
    ]) {
      expect(isUuidV7(invalid)).toBe(false);
      expect(idSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it('porte l’horodatage de sa création', () => {
    const next = createUuidV7Generator(scriptedSource([1_790_000_000_123], [42]));
    expect(uuidV7Timestamp(next())).toBe(1_790_000_000_123);
  });

  it('propriété : des identifiants successifs sont valides et strictement croissants, même quand l’horloge stagne ou recule', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 2 ** 48 - 10_000 }), { minLength: 1, maxLength: 300 }),
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 32 }),
        (clock, randomBytes) => {
          const next = createUuidV7Generator(scriptedSource(clock, randomBytes));
          const ids = clock.map(() => next());
          for (const id of ids) expect(isUuidV7(id)).toBe(true);
          for (let index = 1; index < ids.length; index += 1) {
            expect((ids[index - 1] ?? '') < (ids[index] ?? '')).toBe(true);
          }
        },
      ),
    );
  });

  it('dans la même milliseconde, le compteur avance d’un pas aléatoire, pas de 1', () => {
    const next = createUuidV7Generator(scriptedSource([1_790_000_000_000], [17, 200, 3, 91, 44]));
    const counter = (id: string) => Number.parseInt(id.slice(15, 18), 16);
    const counters = Array.from({ length: 20 }, () => counter(next()));
    const steps = counters.slice(1).map((value, index) => value - (counters[index] ?? 0));
    expect(steps.every((step) => step >= 1 && step <= 64)).toBe(true);
    expect(steps.some((step) => step > 1)).toBe(true);
  });

  it('reste croissant au-delà de 4 096 identifiants dans la même milliseconde', () => {
    const next = createUuidV7Generator(scriptedSource([1_790_000_000_000], [255]));
    let previous = next();
    for (let count = 0; count < 10_000; count += 1) {
      const id = next();
      expect(previous < id).toBe(true);
      previous = id;
    }
  });

  it('refuse un horodatage hors de la plage de 48 bits', () => {
    expect(() => createUuidV7Generator(scriptedSource([2 ** 48], [0]))()).toThrow(RangeError);
    expect(() => createUuidV7Generator(scriptedSource([-1], [0]))()).toThrow(RangeError);
  });
});
