import { describe, expect, it } from 'vitest';

import { MemoryKeyStore, nodeRandomBytesSource } from '../test-support/node-database';
import {
  DATABASE_KEY_BYTES,
  generateDatabaseKey,
  isDatabaseKey,
  keyPragma,
  readStoredKey,
  rekeyPragma,
  type DatabaseKey,
} from './key';

describe('clé de la base locale', () => {
  it('est faite de 32 octets aléatoires, en 64 chiffres hexadécimaux', () => {
    const a = generateDatabaseKey(nodeRandomBytesSource);
    const b = generateDatabaseKey(nodeRandomBytesSource);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(DATABASE_KEY_BYTES).toBe(32);
  });

  it('refuse une source qui renvoie trop peu d’octets, ou que des zéros', () => {
    expect(() => generateDatabaseKey(() => new Uint8Array(16))).toThrow();
    expect(() => generateDatabaseKey(() => new Uint8Array(32))).toThrow();
  });

  it('est passée en clé brute SQLCipher, sans dérivation par mot de passe', () => {
    const key = 'ab'.repeat(32) as DatabaseKey;
    expect(keyPragma(key)).toBe(`PRAGMA key = "x'${key}'"`);
    expect(rekeyPragma(key)).toBe(`PRAGMA rekey = "x'${key}'"`);
  });

  it('ne laisse entrer dans une instruction SQL qu’un hexadécimal de 64 chiffres', () => {
    for (const value of ["ab'; DROP TABLE people; --", 'AB'.repeat(32), 'ab'.repeat(31), '']) {
      expect(isDatabaseKey(value)).toBe(false);
      expect(() => keyPragma(value as DatabaseKey)).toThrow();
    }
  });

  it('tient pour absente une entrée du trousseau qui n’a pas la forme d’une clé', async () => {
    const store = new MemoryKeyStore();
    await store.set('k', 'pas une clé');
    expect(await readStoredKey(store, 'k')).toBeNull();
    expect(await readStoredKey(store, 'absente')).toBeNull();
  });
});
