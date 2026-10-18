// Clé de la base du téléphone (TRD : « base SQLite chiffrée avec SQLCipher, clé dans le trousseau
// du système (expo-secure-store) » ; CL-SEC-14). ADR 0023.
//
// - La clé est tirée au hasard (32 octets d'un générateur cryptographique), jamais dérivée d'un
//   mot de passe ni d'un identifiant : elle ne se devine pas et ne quitte pas le trousseau.
// - Elle est passée à SQLCipher en clé brute (`x'…'`), ce qui évite la dérivation PBKDF2
//   (256 000 tours) à chaque ouverture : du temps de démarrage en moins sur l'Android de
//   référence. Le sel reste celui du fichier (ses 16 premiers octets).
// - Le trousseau garde deux entrées : la clé en service et, pendant une rotation seulement, la
//   clé suivante. Une rotation interrompue se termine à l'ouverture suivante (open.ts).

/** Trousseau du système (expo-secure-store sur le téléphone, mémoire dans les tests). */
export interface KeyStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}

/** Noms des entrées du trousseau (lettres, chiffres, `.`, `-`, `_` : règle d'expo-secure-store). */
export const DATABASE_KEY_ENTRY = 'lignee.local-db.key';
export const NEXT_DATABASE_KEY_ENTRY = 'lignee.local-db.key.next';

declare const databaseKeyBrand: unique symbol;
/** 64 chiffres hexadécimaux minuscules : 256 bits. */
export type DatabaseKey = string & { readonly [databaseKeyBrand]: true };

/** Source d'octets aléatoires cryptographiques (expo-crypto, ou `crypto` de Node dans les tests). */
export type RandomBytes = (length: number) => Uint8Array;

export const DATABASE_KEY_BYTES = 32;
const KEY_PATTERN = /^[0-9a-f]{64}$/;

export function isDatabaseKey(value: unknown): value is DatabaseKey {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

/** Nouvelle clé de 256 bits. Refuse une source qui renvoie trop peu d'octets, ou que des zéros. */
export function generateDatabaseKey(randomBytes: RandomBytes): DatabaseKey {
  const bytes = randomBytes(DATABASE_KEY_BYTES);
  if (bytes.length !== DATABASE_KEY_BYTES) {
    throw new Error('Random source returned the wrong number of bytes');
  }
  if (bytes.every((byte) => byte === 0)) throw new Error('Random source returned only zeros');
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!isDatabaseKey(key)) throw new Error('Unexpected key format');
  return key;
}

function rawKeyLiteral(key: DatabaseKey): string {
  // Vérifiée à nouveau : la clé entre dans une instruction SQL, rien d'autre qu'un hexadécimal.
  if (!isDatabaseKey(key)) throw new Error('Invalid database key');
  return `"x'${key}'"`;
}

/** Première instruction après l'ouverture du fichier : clé brute SQLCipher. */
export function keyPragma(key: DatabaseKey): string {
  return `PRAGMA key = ${rawKeyLiteral(key)}`;
}

/** Rechiffre toute la base avec une autre clé. */
export function rekeyPragma(key: DatabaseKey): string {
  return `PRAGMA rekey = ${rawKeyLiteral(key)}`;
}

/** Lit une entrée du trousseau ; une valeur qui n'a pas la forme d'une clé compte comme absente. */
export async function readStoredKey(store: KeyStore, entry: string): Promise<DatabaseKey | null> {
  const value = await store.get(entry);
  return isDatabaseKey(value) ? value : null;
}
