// Arbre généré chargé dans la base du téléphone, en développement seulement (T-016 ; TRD :
// « chargement d'un arbre généré (T-006) en développement seulement »).
//
// Jamais dans un build de production : l'app n'importe ce module que derrière `if (__DEV__)`
// (apps/mobile/src/db/LocalDatabaseProvider.tsx), branche que Metro retire du bundle de
// production ; le job `bundle-mobile` de la CI vérifie que `DEV_SEED_MARKER` n'y figure pas.
// ESLint interdit de l'importer ailleurs que dans apps/mobile/src/db/dev et les tests.
import { generateTree } from '@lignee/domain/tree-generator';

import {
  listLocalTrees,
  replaceTreeSnapshot,
  type LocalDatabase,
  type SnapshotCounts,
} from '../local-db/snapshot';
import { devReaderSnapshot } from './projection';

export { devReaderSnapshot } from './projection';

/** Chaîne propre à ce module, cherchée dans le bundle de production par la CI. */
export const DEV_SEED_MARKER = 'lignee-dev-seed-generated-tree';

export interface DevSeedOptions {
  /** Graine du générateur : même graine, même arbre. */
  readonly seed?: number;
  /** Nombre de personnes générées (avant la projection, qui en retire). */
  readonly size?: number;
  readonly now: number;
}

export interface DevSeedResult {
  readonly marker: typeof DEV_SEED_MARKER;
  readonly treeId: string;
  readonly counts: SnapshotCounts;
}

/** 500 personnes : la taille des budgets de démarrage et d'ouverture de l'arbre (TRD). */
export const DEV_SEED_DEFAULTS = { seed: 2016, size: 500 } as const;

/**
 * Génère un arbre, le projette pour le propriétaire de l'arbre généré (premier compte) et
 * l'écrit dans la base. Ne fait rien si la base contient déjà un arbre.
 */
export function seedGeneratedTree(
  db: LocalDatabase,
  options: DevSeedOptions,
): DevSeedResult | undefined {
  if (listLocalTrees(db).length > 0) return undefined;
  const generated = generateTree({
    seed: options.seed ?? DEV_SEED_DEFAULTS.seed,
    size: options.size ?? DEV_SEED_DEFAULTS.size,
  });
  const reader = generated.accounts[0];
  if (reader === undefined) throw new Error('Generated tree without an account');
  const snapshot = devReaderSnapshot(generated, reader.accountId);
  const counts = replaceTreeSnapshot(db, snapshot, { now: options.now });
  return { marker: DEV_SEED_MARKER, treeId: snapshot.tree.id, counts };
}
