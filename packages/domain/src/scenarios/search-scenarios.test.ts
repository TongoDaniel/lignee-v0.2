// Cas limites des noms dans la recherche (T-034 du plan V1) : CL-DON-03 (particule « Ngo ») et
// CL-DON-04 (signes diacritiques). Chaque scénario est lu dans test/scenarios/<ID>.yaml : les noms
// sont gardés tels quels dans le modèle, et les termes indexables (`buildSearchTerms`) retrouvent
// exactement les personnes de `trouve`, au niveau attendu, pour chaque requête (`queryTerms`,
// `matchQuery`). La requête FTS5, Jaro-Winkler et le classement restent à T-038.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildSearchTerms, matchQuery, queryTerms, type TermMatchLevel } from '../name-search';
import { loadScenario, requireScenarioParts, scenarioSchema } from '../test-support/scenario';
import { buildScenarioTree, scenarioTreeSchema } from '../test-support/scenario-tree';

const LEVELS = {
  exact: 'exact',
  debut: 'prefix',
  phonetique: 'phonetic',
} as const satisfies Record<string, TermMatchLevel>;

const searchExpectedSchema = z.strictObject({
  /** Le nom de famille enregistré, inchangé (« Gardé dans le nom », « Gardé tel quel »). */
  noms_gardes: z.array(z.strictObject({ personne: z.string(), nom: z.string() })).min(1),
  requetes: z
    .array(
      z.strictObject({
        requete: z.string().min(1),
        /** Liste exacte des personnes retrouvées par leurs termes. */
        trouve: z.array(
          z.strictObject({
            personne: z.string(),
            niveau: z.enum(['exact', 'debut', 'phonetique']),
            sans_particule: z.boolean().default(false),
          }),
        ),
      }),
    )
    .min(1),
});

function play(id: string): void {
  const scenario = loadScenario(
    id,
    scenarioSchema(id, {
      arbre: scenarioTreeSchema,
      attendu: z.strictObject({ recherche: searchExpectedSchema }),
    }).superRefine(requireScenarioParts('recherche', [])),
  );
  const tree = buildScenarioTree(scenario.arbre);
  const { noms_gardes: kept, requetes } = scenario.attendu.recherche;

  for (const line of kept) {
    const personId = tree.id(line.personne);
    const surnames = tree.data.names
      .filter((name) => name.personId === personId && name.type !== 'former')
      .map((name) => name.surname);
    expect(surnames, line.personne).toContain(line.nom);
  }

  const index = buildSearchTerms(tree.data);
  for (const line of requetes) {
    const query = queryTerms(line.requete);
    const found = index
      .map((terms) => ({ terms, match: matchQuery(query, terms) }))
      .filter((entry) => entry.match !== undefined)
      .map(({ terms, match }) => ({
        personne: tree.keyOf(terms.personId),
        niveau: match?.level,
        sans_particule: match?.missingParticles,
      }));
    const expected = line.trouve.map((item) => ({
      personne: item.personne,
      niveau: LEVELS[item.niveau],
      sans_particule: item.sans_particule,
    }));
    const byPerson = (a: { personne: string | undefined }, b: { personne: string | undefined }) =>
      (a.personne ?? '').localeCompare(b.personne ?? '');
    expect([...found].sort(byPerson), line.requete).toEqual([...expected].sort(byPerson));
  }
}

describe('CL-DON-03 — préfixe « Ngo »', () => {
  it('garde la particule dans le nom et retrouve la personne avec ou sans elle', () => {
    play('CL-DON-03');
  });
});

describe('CL-DON-04 — signes diacritiques', () => {
  it('garde le nom tel quel et le retrouve sans les accents, jamais par l’ancien prénom', () => {
    play('CL-DON-04');
  });
});
