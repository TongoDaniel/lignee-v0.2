// Développement seulement : charge un arbre généré (T-006) dans une base vide. Importé par
// LocalDatabaseProvider derrière `if (__DEV__)` : Metro retire cette branche, et donc ce module
// et le générateur d'arbres, du bundle de production (vérifié par le job `bundle-mobile`).
import type { LocalDatabase } from '@lignee/sync';
import { seedGeneratedTree } from '@lignee/sync/dev-seed';

export function seedDevelopmentTree(db: LocalDatabase): void {
  const result = seedGeneratedTree(db, { now: Date.now() });
  if (result !== undefined) {
    // Seulement des nombres et le repère du module, jamais une donnée de l'arbre.
    console.info(`[${result.marker}] ${String(result.counts.people)} personnes chargées`);
  }
}
