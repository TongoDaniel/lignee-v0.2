// Cas limites de la saisie à la main (T-031), parties qui ne demandent ni arbre ni base : dates
// saisies par morceaux (CL-DON-05, CL-DON-06) et nom écrit d'un trait (CL-DON-01). Les personnes
// créées par un formulaire sont jouées par @lignee/sync, qui les enregistre pour de bon.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fuzzyDateSchema } from '../fuzzy-date';
import { parseDateDraft, splitFullName } from '../person-entry';
import {
  dateDraftFromEntry,
  entryScenarioSchema,
  fuzzyDateInputFromScenario,
  loadScenario,
  requireScenarioParts,
  scenarioFuzzyDateSchema,
  scenarioPrecisions,
  scenarioSchema,
} from '../test-support';

const expectedDate = (line: z.infer<typeof scenarioFuzzyDateSchema>) =>
  fuzzyDateSchema.parse(fuzzyDateInputFromScenario(line));

/** Parties jouées ici : les dates et le découpage ; le reste est joué par @lignee/sync. */
function playDates(id: 'CL-DON-05' | 'CL-DON-06') {
  const schema = scenarioSchema(id, {
    action: z.unknown(),
    attendu: z.looseObject({ saisie: entryScenarioSchema }),
  }).superRefine(requireScenarioParts('saisie', []));
  const { saisie } = loadScenario(id, schema).attendu;
  return saisie;
}

describe.each(['CL-DON-05', 'CL-DON-06'] as const)('%s — dates saisies par morceaux', (id) => {
  it('saisie : chaque formulaire donne la date floue attendue, sans texte d’origine inventé', () => {
    const { dates = [] } = playDates(id);
    expect(dates.length).toBeGreaterThan(0);
    for (const { formulaire, attendue } of dates) {
      const result = parseDateDraft(dateDraftFromEntry(formulaire));
      expect(result).toEqual({ ok: true, date: expectedDate(attendue) });
    }
  });

  it('saisie : les dates refusées le sont avec leur code, sur le bon champ', () => {
    const { dates_refusees: refused = [] } = playDates(id);
    for (const { formulaire, code } of refused) {
      const result = parseDateDraft(dateDraftFromEntry(formulaire));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issue.code).toBe(code);
    }
  });
});

describe('CL-DON-05 — « vers 1940 », « années 1940 »', () => {
  it('saisie : la précision de la décennie se déduit de la case, jamais de l’année', () => {
    const { dates = [] } = playDates('CL-DON-05');
    const decade = dates.find((line) => line.attendue.precision === 'decennie');
    expect(decade).toBeDefined();
    const parsed = parseDateDraft(dateDraftFromEntry(decade?.formulaire));
    if (!parsed.ok || parsed.date === undefined || parsed.date.qualifier === 'text') {
      throw new Error('expected a dated value');
    }
    expect(parsed.date.precision).toBe(scenarioPrecisions.decennie);
  });
});

describe('CL-DON-06 — « entre 1935 et 1940 »', () => {
  it('saisie : la seconde borne porte le refus des bornes inversées, égales ou inégales', () => {
    const { dates_refusees: refused = [] } = playDates('CL-DON-06');
    const second = refused.filter((line) => line.formulaire.annee_fin !== undefined);
    expect(second.length).toBeGreaterThanOrEqual(3);
    for (const { formulaire } of second) {
      const result = parseDateDraft(dateDraftFromEntry(formulaire));
      if (!result.ok) expect(result.issue.part).toBe('to');
    }
  });
});

describe('CL-DON-01 — nom donné dans l’ordre NOM Prénom', () => {
  it('saisie : un nom écrit d’un trait se sépare selon l’ordre de l’arbre', () => {
    const schema = scenarioSchema('CL-DON-01', {
      arbre: z.unknown(),
      attendu: z.looseObject({ saisie: entryScenarioSchema }),
    }).superRefine(requireScenarioParts('saisie', ['fiche']));
    const { decouper = [] } = loadScenario('CL-DON-01', schema).attendu.saisie;
    expect(decouper).toHaveLength(2);
    for (const line of decouper) {
      const order = line.ordre === 'nom_puis_prenoms' ? 'surname_first' : 'given_first';
      expect(splitFullName(line.texte, order)).toEqual({
        givenNames: line.prenoms,
        surname: line.nom,
      });
    }
  });
});
