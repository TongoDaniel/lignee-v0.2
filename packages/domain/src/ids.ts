// Identifiants UUIDv7 (RFC 9562), créés sur le téléphone (TRD, « Hors-ligne et synchronisation »,
// point 1) : uniques sans coordination et triés dans le temps.
import { z } from 'zod';

/** Forme canonique : minuscules, version 7, variante RFC 9562 (10xx). */
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Vrai si `value` est un UUIDv7 sous sa forme canonique (minuscules). */
export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_PATTERN.test(value);
}

/**
 * Schéma d'un identifiant. Les majuscules sont refusées : les identifiants se comparent comme des
 * chaînes (tri dans le temps), ce qui n'est vrai que sous une seule forme.
 */
export const idSchema = z.uuid({ version: 'v7' }).refine((value) => value === value.toLowerCase(), {
  message: 'Identifier must be lowercase',
});
export type Id = z.infer<typeof idSchema>;

/** Source de temps et d'aléa, injectable pour les tests. */
export interface UuidV7Source {
  /** Millisecondes depuis l'époque Unix. */
  now(): number;
  /** Remplit `bytes` d'octets aléatoires sûrs et le renvoie. */
  fillRandom(bytes: Uint8Array): Uint8Array;
}

interface WebCryptoLike {
  getRandomValues(array: Uint8Array): Uint8Array;
}

/**
 * Source par défaut : horloge du système et `crypto.getRandomValues` (Node, navigateurs ; sur
 * React Native, l'app installe le polyfill d'Expo avant le premier identifiant).
 */
export const defaultUuidV7Source: UuidV7Source = {
  now: () => Date.now(),
  fillRandom: (bytes) => {
    const crypto = (globalThis as { crypto?: WebCryptoLike }).crypto;
    if (crypto === undefined) {
      throw new Error('crypto.getRandomValues is not available: cannot create a UUIDv7');
    }
    return crypto.getRandomValues(bytes);
  },
};

const MAX_TIMESTAMP = 2 ** 48 - 1;
const MAX_COUNTER = 0xfff;

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * Crée un générateur d'UUIDv7 strictement croissants, même dans la même milliseconde ou si
 * l'horloge recule (RFC 9562, section 6.2, méthode 1 : les 12 bits `rand_a` servent de compteur,
 * remis à une valeur aléatoire de 11 bits à chaque nouvelle milliseconde).
 */
export function createUuidV7Generator(source: UuidV7Source = defaultUuidV7Source): () => Id {
  let lastTimestamp = -1;
  let counter = 0;

  return () => {
    const random = source.fillRandom(new Uint8Array(10));
    const now = Math.floor(source.now());
    if (!Number.isFinite(now) || now < 0 || now > MAX_TIMESTAMP) {
      throw new RangeError('UUIDv7 timestamp out of range');
    }

    if (now > lastTimestamp) {
      lastTimestamp = now;
      counter = (((random[0] ?? 0) << 8) | (random[1] ?? 0)) & 0x7ff;
    } else if (counter < MAX_COUNTER) {
      counter += 1;
    } else {
      // Compteur épuisé dans la milliseconde : on avance l'horodatage d'une milliseconde.
      lastTimestamp += 1;
      if (lastTimestamp > MAX_TIMESTAMP) throw new RangeError('UUIDv7 timestamp out of range');
      counter = (((random[0] ?? 0) << 8) | (random[1] ?? 0)) & 0x7ff;
    }

    const bytes = new Uint8Array(16);
    let timestamp = lastTimestamp;
    for (let index = 5; index >= 0; index -= 1) {
      bytes[index] = timestamp % 256;
      timestamp = Math.floor(timestamp / 256);
    }
    bytes[6] = 0x70 | (counter >> 8);
    bytes[7] = counter & 0xff;
    bytes[8] = 0x80 | ((random[2] ?? 0) & 0x3f);
    bytes.set(random.subarray(3, 10), 9);

    const h = hex(bytes);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}

/** Crée un identifiant avec la source par défaut. */
export const createId: () => Id = createUuidV7Generator();

/** Horodatage (millisecondes Unix) porté par un UUIDv7. */
export function uuidV7Timestamp(id: Id): number {
  return Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}
