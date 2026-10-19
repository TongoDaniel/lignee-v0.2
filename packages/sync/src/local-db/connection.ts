// Connexion SQLite brute, commune au téléphone (expo-sqlite compilé avec SQLCipher) et aux tests
// sur le poste (better-sqlite3-multiple-ciphers en mode SQLCipher 4). Seules l'ouverture, la clé,
// les migrations et la rotation de clé passent par elle ; le reste passe par Drizzle.

/** Une connexion ouverte sur le fichier de la base. Synchrone, comme Drizzle sur expo-sqlite. */
export interface SqlConnection {
  /** Exécute une ou plusieurs instructions, sans résultat. */
  exec(sql: string): void;
  /** Première ligne d'une requête, ou `undefined`. */
  get(sql: string): Record<string, unknown> | undefined;
  close(): void;
}

/**
 * Accès au fichier de la base, fourni par l'app (expo-sqlite) ou par les tests (Node). Les
 * réglages propres au moteur de chiffrement (choix du chiffrement SQLCipher 4 dans
 * SQLite3MultipleCiphers) sont faits par `open`, avant la clé.
 */
export interface DatabaseFile {
  /** Ouvre (ou crée) le fichier. Aucune requête ne doit lire la base avant la clé. */
  open(): SqlConnection;
  /**
   * Efface le fichier et ses fichiers annexes (journal WAL), s'ils existent. Renvoie vrai si le
   * fichier de la base existait.
   */
  deleteIfExists(): boolean;
}

/** Message d'erreur de SQLite quand la clé ne déchiffre pas le fichier. */
export function isNotADatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === 'SQLITE_NOTADB' || /file is not a database|not a database/i.test(error.message);
}
