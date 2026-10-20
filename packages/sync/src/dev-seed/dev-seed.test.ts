// Chargement d'un arbre généré dans la base du téléphone, en développement (T-016).
import { join } from 'node:path';

import { medianTime, reportBudget } from '@lignee/domain/test-support';
import { afterAll, describe, expect, it } from 'vitest';

import { openTestDatabase, temporaryDirectory } from '../test-support/node-database';
import {
  eraseLocalTree,
  listLocalTrees,
  readTreeSnapshot,
  snapshotPrivacyIssues,
} from '../local-db/snapshot';
import { DEV_SEED_DEFAULTS, DEV_SEED_MARKER, seedGeneratedTree } from './index';

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});

// Génération, projection et écriture chiffrée de 500 personnes : le délai par défaut de vitest
// (5 s) est trop court sous la charge de la CI.
describe('arbre généré chargé en développement', { timeout: 60_000 }, () => {
  it('écrit un arbre de 500 personnes générées, projeté pour son propriétaire', async () => {
    const { db, connection } = await openTestDatabase(join(tmp.dir, 'seed.db'));
    const result = seedGeneratedTree(db, { now: 1 });
    expect(result?.marker).toBe(DEV_SEED_MARKER);
    expect(DEV_SEED_DEFAULTS.size).toBe(500);
    const counts = result?.counts;
    expect(counts?.people).toBeGreaterThan(400);
    expect(counts?.people).toBeLessThanOrEqual(500);
    expect(counts?.unions).toBeGreaterThan(50);
    expect(counts?.filiations).toBeGreaterThan(300);
    const stored = readTreeSnapshot(db, result?.treeId ?? '');
    expect(stored?.people).toHaveLength(counts?.people ?? -1);
    expect(stored === undefined ? ['absent'] : snapshotPrivacyIssues(stored)).toEqual([]);
    connection.close();
  });

  it('ne fait rien si la base contient déjà un arbre', async () => {
    const { db, connection } = await openTestDatabase(join(tmp.dir, 'twice.db'));
    const first = seedGeneratedTree(db, { seed: 7, size: 40, now: 1 });
    expect(first).toBeDefined();
    expect(seedGeneratedTree(db, { seed: 8, size: 40, now: 2 })).toBeUndefined();
    expect(listLocalTrees(db).map((tree) => tree.id)).toEqual([first?.treeId]);
    connection.close();
  });

  it('garde-fou de temps : génération, projection et écriture de 500 personnes', async () => {
    const { db, connection } = await openTestDatabase(join(tmp.dir, 'perf.db'));
    const { medianMs } = medianTime(
      () => {
        seedGeneratedTree(db, { now: 1 });
      },
      {
        runs: 3,
        setup: () => {
          for (const tree of listLocalTrees(db)) eraseLocalTree(db, tree.id);
        },
      },
    );
    connection.close();
    // Pas de budget du TRD pour ce chargement de développement : plafond large, contre une
    // régression grossière seulement.
    const report = reportBudget('chargement d’un arbre généré de 500 personnes', medianMs, 2_000);
    expect(medianMs).toBeLessThan(report.ceilingMs);
  }, 60_000);
});
