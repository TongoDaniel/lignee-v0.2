// Scénarios à plusieurs parties (test/scenarios/README.md) : le schéma de disposition exige
// `disposition` dans `couverture.teste`, et n'admet la partie lien (`attendu.liens`) que si
// `teste` contient aussi `lien`. Les clés propres à layout, déclarées une fois dans
// @lignee/domain/test-support pour les autres paquets, restent celles de ce schéma.
import { readScenarioYaml, scenarioPartKeys } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { layoutExpectedSchema, layoutScenarioSchema } from '../test-support/layout-scenario';

/** Contenu brut d'un scénario, `couverture.teste` remplacé, sans trace de scénario joué. */
function withTested(id: string, teste: string[], extra: Record<string, unknown> = {}) {
  const raw = readScenarioYaml(id) as Record<string, unknown> & {
    couverture: Record<string, unknown>;
    attendu: Record<string, unknown>;
  };
  return {
    ...raw,
    couverture: { ...raw.couverture, teste },
    attendu: { ...raw.attendu, ...extra },
  };
}

describe('scénarios à plusieurs parties : chaque partie présente est jouée', () => {
  it('refuse des liens attendus quand `teste` ne contient pas `lien`', () => {
    const schema = layoutScenarioSchema('CL-POL-09');
    expect(schema.safeParse(withTested('CL-POL-09', ['disposition', 'lien'])).success).toBe(true);
    const result = schema.safeParse(withTested('CL-POL-09', ['disposition']));
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['attendu.liens']);
  });

  it('refuse des liens ajoutés à un scénario de disposition seule', () => {
    const schema = layoutScenarioSchema('CL-POL-01');
    expect(schema.safeParse(withTested('CL-POL-01', ['disposition'])).success).toBe(true);
    const extra = { liens: [{ de: 'a', vers: 'b', fr: 'frère', en: 'brother' }] };
    expect(schema.safeParse(withTested('CL-POL-01', ['disposition'], extra)).success).toBe(false);
  });

  it('refuse un scénario de disposition dont `teste` ne contient pas `disposition`', () => {
    const result = layoutScenarioSchema('CL-POL-09').safeParse(withTested('CL-POL-09', ['lien']));
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['couverture.teste']);
    const missing = { ...withTested('CL-POL-01', ['disposition']), couverture: undefined };
    expect(layoutScenarioSchema('CL-POL-01').safeParse(missing).success).toBe(false);
  });

  it('les clés propres à layout déclarées pour les autres paquets sont celles de ce schéma', () => {
    const own = Object.keys(layoutExpectedSchema.shape).filter(
      (key) => !(scenarioPartKeys.lien.attendu as readonly string[]).includes(key),
    );
    expect(new Set(own)).toEqual(new Set(scenarioPartKeys.disposition.attendu));
    expect(scenarioPartKeys.disposition.racine).toEqual(['action']);
  });
});
