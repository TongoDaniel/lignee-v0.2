// Budget des noms dans la recherche (T-034 du plan V1, ARB-10, ADR 0034), lancé seul par
// `test:budget` pour que la charge des autres tests ne fausse pas la mesure, sur l'arbre type de
// 5 000 personnes généré (aucune donnée réelle). Les budgets visent l'Android de référence ; ils
// sont ramenés au poste par le facteur de ralentissement estimé (`onThisMachine`, ADR 0026), puis
// comparés au garde-fou habituel (`reportBudget` : × 1,5 sur un poste, × 3 en CI).
//
// - Requête : ARB-10 donne 300 ms à toute la recherche hors-ligne pour 5 000 personnes. Ici, le
//   découpage de la requête et sa comparaison aux termes de toutes les personnes, en mémoire et
//   sans index : c'est le pire cas, celui où FTS5 ne réduirait pas les candidats (T-038 y ajoute
//   la base locale, Jaro-Winkler sur les candidats et le classement, dans le même budget).
// - Index : les termes de toutes les personnes, calculés quand la copie locale change (après une
//   synchronisation), jamais pendant la frappe. Budget retenu par l'ADR 0034 : 1 000 ms sur le
//   téléphone, celui de l'ouverture de l'arbre.
import { describe, expect, it } from 'vitest';

import { buildSearchTerms, matchQuery, queryTerms, type PersonSearchTerms } from './name-search';
import { formatName } from './person';
import { deviceSlowdown, onThisMachine } from './test-support/reference-device';
import { medianTime, reportBudget } from './test-support/timing';
import { referenceTree } from './test-support/tree-generator';

const QUERY_DEVICE_BUDGET_MS = 300;
const INDEX_DEVICE_BUDGET_MS = 1_000;

function check(label: string, measuredMs: number, deviceBudgetMs: number): void {
  const budgetMs = Math.round(onThisMachine(deviceBudgetMs) * 100) / 100;
  const report = reportBudget(
    `${label} (budget du téléphone ${String(deviceBudgetMs)} ms ÷ ${String(deviceSlowdown())})`,
    measuredMs,
    budgetMs,
  );
  expect(report.measuredMs).toBeLessThan(report.ceilingMs);
}

// Génération de l'arbre de 5 000 personnes et mesures répétées : délai explicite.
describe('noms dans la recherche : budget, 5 000 personnes', { timeout: 60_000 }, () => {
  const tree = referenceTree(5000);

  it('calcule les termes indexables de 5 000 personnes dans le budget', () => {
    expect(tree.people).toHaveLength(5000);
    let index: PersonSearchTerms[] = [];
    const timing = medianTime(
      () => {
        index = buildSearchTerms(tree);
      },
      { warmup: 2, runs: 7 },
    );
    expect(index).toHaveLength(5000);
    check('termes indexables, 5 000 personnes', timing.medianMs, INDEX_DEVICE_BUDGET_MS);
  });

  it('compare une requête aux termes de 5 000 personnes dans le budget d’ARB-10', () => {
    const index = buildSearchTerms(tree);
    const someone = tree.names.find((name) => name.type === 'birth' && name.surname !== undefined);
    if (someone === undefined) throw new Error('Expected a birth name with a surname');
    // Une requête réelle : prénoms et nom d'une personne, le dernier mot tronqué (frappe en
    // cours), et une requête qui ne trouve personne (toutes les personnes parcourues jusqu'au bout).
    const text = formatName(someone, 'given_first');
    const queries = [text, text.slice(0, -2), 'Ngo Zqxwvutsr'];
    let found = 0;
    const timing = medianTime(
      () => {
        found = 0;
        for (const query of queries) {
          const terms = queryTerms(query);
          for (const person of index) if (matchQuery(terms, person) !== undefined) found += 1;
        }
      },
      { warmup: 3, runs: 9 },
    );
    expect(found).toBeGreaterThan(0);
    check(
      'requête sur 5 000 personnes (×3 requêtes)',
      timing.medianMs / queries.length,
      QUERY_DEVICE_BUDGET_MS,
    );
  });
});
