// Cas limites des chemins multiples, des liens non biologiques et de la certitude, joués depuis
// test/scenarios (T-022) : CL-POL-09, CL-POL-10, CL-POL-11, CL-FAM-02, CL-FAM-03, CL-FAM-04,
// CL-FAM-05, CL-FAM-09, CL-FAM-14. Chaque lien attendu, écrit en mots (le principal, puis
// `aussi`, dans l'ordre), est ramené à sa structure (`presentedMeaningOfWords`) et comparé à la
// présentation calculée. Le sens inverse est vérifié à chaque fois : exactement l'inverse, dans le
// même ordre. Pour CL-POL-09 et CL-POL-10 (T-026), les mots français de chaque lien sont aussi
// exactement ceux du dictionnaire ; l'anglais reste à T-027.
import type { Filiation, Id } from '@lignee/domain';
import type { TreeData } from '@lignee/domain/test-support';
import {
  buildScenarioTree,
  loadScenario,
  otherPartsShape,
  readScenarioYaml,
  requireScenarioParts,
  scenarioSchema,
  scenarioTreeSchema,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createAllianceContext } from './alliance';
import { createKinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { invertPresentedLink, presentRelationships, type PresentationResult } from './presentation';
import { frenchShortWords } from './test-support/french-words';
import { neverEntered } from './test-support/never-entered';
import {
  presentedMeaningOfWords,
  presentedMeaningsOfResult,
} from './test-support/presentation-words';

const words = z.strictObject({ fr: z.string().min(1), en: z.string().min(1) });

/** Lien présenté attendu : le principal, puis les autres (« aussi »), dans l'ordre. */
const expectedPresentedSchema = z.strictObject({
  de: z.string(),
  vers: z.string(),
  fr: z.string().min(1),
  en: z.string().min(1),
  aussi: z.array(words).optional(),
});
type ExpectedPresented = z.infer<typeof expectedPresentedSchema>;

function linksScenarioSchema(id: string) {
  // Partie disposition du même scénario (action et clés d'attendu de packages/layout), vérifiée
  // par packages/layout : déclarée sans être lue, admise seulement si `couverture.teste` contient
  // `disposition` ; `teste` contient toujours `lien` (`requireScenarioParts`).
  return scenarioSchema(id, {
    arbre: scenarioTreeSchema,
    ...otherPartsShape(['disposition'], 'racine'),
    attendu: z.strictObject({
      liens: z.array(expectedPresentedSchema).min(1),
      ...otherPartsShape(['disposition'], 'attendu'),
    }),
  }).superRefine(requireScenarioParts('lien', ['disposition']));
}

function present(data: TreeData, a: Id, b: Id): PresentationResult {
  return presentRelationships(createKinshipGraph(data), a, b, {
    allianceContext: createAllianceContext(data),
  });
}

/** Vérifie un lien attendu, et que le sens inverse en est exactement l'inverse. */
function expectPresented(tree: ScenarioTree, data: TreeData, lien: ExpectedPresented) {
  const graph = createKinshipGraph(data);
  const a = tree.id(lien.de);
  const b = tree.id(lien.vers);
  const forward = present(data, a, b);
  const expected = [lien, ...(lien.aussi ?? [])].map((entry) =>
    presentedMeaningOfWords(entry.fr, entry.en),
  );
  const actual = presentedMeaningsOfResult(graph, forward);
  const label = `${lien.de} → ${lien.vers}`;
  expect(actual, label).toHaveLength(expected.length);
  expected.forEach((meaning, index) => {
    expect(actual[index], `${label} (${String(index)})`).toMatchObject(meaning);
  });
  const backward = present(data, b, a);
  if (forward.status === 'related' && backward.status === 'related') {
    expect(backward.links).toEqual(forward.links.map(invertPresentedLink));
  } else {
    expect(backward.status).toBe(forward.status);
  }
}

/** Joue les liens d'un scénario ; avec `french`, compare aussi les mots du dictionnaire (T-026). */
function playLinks(id: string, french = false) {
  const scenario = loadScenario(id, linksScenarioSchema(id));
  const tree = buildScenarioTree(scenario.arbre);
  expect(scenario.couverture?.teste).toContain('lien');
  for (const lien of scenario.attendu.liens) {
    expectPresented(tree, tree.data, lien);
    if (!french) continue;
    const words = frenchShortWords(tree.data, tree.id(lien.de), tree.id(lien.vers));
    const expected = [lien.fr, ...(lien.aussi ?? []).map((entry) => entry.fr)];
    expect(words, `${lien.de} → ${lien.vers} (fr)`).toEqual(expected);
  }
  return { scenario, tree };
}

describe('PAR-05, UNI-21 — plusieurs chemins : le plus proche d’abord, les autres dessous', () => {
  it('CL-POL-09 — lévirat : demi-frères par la mère et cousins par les pères', () => {
    playLinks('CL-POL-09', true);
  });

  it('CL-POL-10 — sororat : demi-frères par le père et cousins par les mères', () => {
    playLinks('CL-POL-10', true);
  });

  it('CL-FAM-09 — mariage entre cousins : chaque ancêtre une fois, tous les liens', () => {
    const { tree } = playLinks('CL-FAM-09');
    const graph = createKinshipGraph(tree.data);
    const gaspard = tree.id('gaspard');
    const luc = tree.id('luc');
    // Implexe : Gaspard une seule fois parmi les ancêtres de Luc, à 3 générations.
    const ancestors = graph.ancestors(luc).filter((entry) => entry.personId === gaspard);
    expect(ancestors).toEqual([{ personId: gaspard, generations: 3 }]);
    // Deux chemins vers lui, l'un par son père, l'autre par sa mère, tous deux affichés.
    const result = present(tree.data, luc, gaspard);
    if (result.status !== 'related') throw new Error('Expected a link');
    expect(result.links.map((link) => [link.rank, link.fromSide?.side]).sort()).toEqual([
      ['also', 'mother'],
      ['main', 'father'],
    ]);
  });
});

describe('PAR-06 — liens non biologiques, jamais confondus avec la naissance', () => {
  it('CL-POL-11 — enfant élevé par une co-épouse après la mort de sa mère', () => {
    const { tree } = playLinks('CL-POL-11');
    const graph = createKinshipGraph(tree.data);
    const aicha = tree.id('aicha');
    // Santé (PAR-12, V3) : sur les seuls liens de naissance, Mariam est la mère, Fatou rien.
    const birthOnly = { filiationTypes: ['birth'] as const, maxUnions: 0 as const };
    expect(findRelationships(graph, aicha, tree.id('fatou'), birthOnly).status).toBe('none');
    expect(findRelationships(graph, aicha, tree.id('mariam'), birthOnly).status).toBe('related');
    expect(graph.ancestors(aicha, ['birth']).map((entry) => entry.personId)).not.toContain(
      tree.id('fatou'),
    );
  });

  it('CL-FAM-02 — beau-parent qui a élevé l’enfant', () => {
    playLinks('CL-FAM-02');
  });

  it('CL-FAM-03 — adoption, parents de naissance connus ; adoption masquée sans trace', () => {
    const { tree } = playLinks('CL-FAM-03');
    // Visibilité au choix : l'adoption masquée au lecteur est comme jamais saisie.
    const adoption = new Set(
      tree.data.filiations
        .filter((filiation) => filiation.type === 'adoptive')
        .map((filiation) => filiation.id),
    );
    const filtered: TreeData = {
      ...tree.data,
      filiations: tree.data.filiations.filter((filiation) => !adoption.has(filiation.id)),
    };
    const never = { ...tree.data, ...neverEntered(tree.data, new Set(), new Set(), adoption) };
    for (const [a, b] of [
      ['zoe', 'sam'],
      ['alain', 'zoe'],
      ['zoe', 'brigitte'],
    ] as const) {
      const masked = present(filtered, tree.id(a), tree.id(b));
      expect(masked).toEqual(present(never, tree.id(a), tree.id(b)));
    }
    expect(present(filtered, tree.id('zoe'), tree.id('sam'))).toEqual({ status: 'none' });
  });

  it('CL-FAM-04 — confiage à un oncle : les parents de naissance restent', () => {
    const { tree } = playLinks('CL-FAM-04');
    // Les parents de naissance restent les liens principaux de Kevin.
    for (const parent of ['pierre', 'marthe']) {
      const result = present(tree.data, tree.id('kevin'), tree.id(parent));
      if (result.status !== 'related') throw new Error('Expected a link');
      const [main] = result.links;
      expect(main?.basis).toBe('birth');
      expect(main?.relationships[0]?.segments).toMatchObject([
        { kind: 'blood', generationsUp: 1, generationsDown: 0 },
      ]);
    }
  });

  it('CL-FAM-05 — kafala : « confié à », ni filiation de naissance ni adoption', () => {
    const { tree } = playLinks('CL-FAM-05');
    const graph = createKinshipGraph(tree.data);
    const amina = tree.id('amina');
    const karim = tree.id('karim');
    const birthOnly = { filiationTypes: ['birth'] as const, maxUnions: 0 as const };
    expect(findRelationships(graph, karim, amina, birthOnly).status).toBe('none');
    // Fodé, fils de Karim : jamais frère, ni par la naissance, ni par adoption.
    const result = present(tree.data, amina, tree.id('fode'));
    if (result.status !== 'related') throw new Error('Expected a link');
    const [link] = result.links;
    expect(link?.sibling?.kind).toBe('other');
    expect(link?.basis).toBe('other');
    expect(link?.nonBirthTypes).toEqual(['fostered']);
    expect(result.links.some((entry) => entry.basis === 'birth')).toBe(false);
  });
});

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
  it('refuse une partie disposition quand `teste` ne contient pas `disposition`', () => {
    const schema = linksScenarioSchema('CL-POL-09');
    expect(schema.safeParse(withTested('CL-POL-09', ['disposition', 'lien'])).success).toBe(true);
    const result = schema.safeParse(withTested('CL-POL-09', ['lien']));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'action',
      'attendu.generations',
      'attendu.unites',
      'attendu.disposition',
    ]);
  });

  it('refuse une clé propre à layout ajoutée à un scénario de lien seul', () => {
    const schema = linksScenarioSchema('CL-POL-10');
    expect(schema.safeParse(withTested('CL-POL-10', ['lien'])).success).toBe(true);
    const extra = { apres_deplier: { lignes: {} } };
    expect(schema.safeParse(withTested('CL-POL-10', ['lien'], extra)).success).toBe(false);
    const both = withTested('CL-POL-10', ['lien', 'disposition'], extra);
    expect(schema.safeParse(both).success).toBe(true);
  });

  it('refuse des liens attendus quand `teste` ne contient pas `lien`', () => {
    const result = linksScenarioSchema('CL-POL-09').safeParse(
      withTested('CL-POL-09', ['disposition']),
    );
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['couverture.teste']);
  });
});

/** Action propre à CL-FAM-14 : le test ADN change le père de naissance. */
const dnaScenarioSchema = scenarioSchema('CL-FAM-14', {
  arbre: scenarioTreeSchema,
  action: z.strictObject({
    test_adn: z.strictObject({ enfant: z.string(), ancien: z.string(), nouveau: z.string() }),
  }),
  attendu: z.strictObject({
    avant: z.array(expectedPresentedSchema).min(1),
    apres: z.array(expectedPresentedSchema).min(1),
    lecteur_sans_le_nouveau_lien: z.array(expectedPresentedSchema).min(1),
  }),
});

describe('CL-FAM-14 — paternité révélée par un test ADN (partie calcul)', () => {
  it('avant, après, et pour un lecteur qui ne voit pas le nouveau lien', () => {
    const scenario = loadScenario('CL-FAM-14', dnaScenarioSchema);
    expect(scenario.couverture?.teste).toContain('lien');
    const tree = buildScenarioTree(scenario.arbre);
    const { enfant, ancien, nouveau } = scenario.action.test_adn;
    const before = tree.data;
    const old = before.filiations.find(
      (filiation) =>
        filiation.childId === tree.id(enfant) && filiation.parentId === tree.id(ancien),
    );
    if (old === undefined) throw new Error('Expected the legal father filiation');
    // Après le test : le lien avec le père légal devient « a élevé », un lien de naissance est
    // ajouté (même enfant, nouvel identifiant).
    const revealed: Filiation = {
      ...old,
      id: `${old.id.slice(0, -4)}dna0`,
      parentId: tree.id(nouveau),
    };
    const after: TreeData = {
      ...before,
      filiations: [
        ...before.filiations.map((filiation) =>
          filiation.id === old.id ? { ...filiation, type: 'raised' as const } : filiation,
        ),
        revealed,
      ],
    };
    // Projection exigée de T-052 (ADR 0021) : sans le nouveau lien, l'ancien garde son type
    // d'avant le test.
    const projected: TreeData = {
      ...after,
      filiations: after.filiations
        .filter((filiation) => filiation.id !== revealed.id)
        .map((filiation) => (filiation.id === old.id ? old : filiation)),
    };
    // Projection naïve : le nouveau lien retiré, l'ancien laissé « a élevé ».
    const naive: TreeData = {
      ...after,
      filiations: after.filiations.filter((filiation) => filiation.id !== revealed.id),
    };

    for (const lien of scenario.attendu.avant) expectPresented(tree, before, lien);
    for (const lien of scenario.attendu.apres) expectPresented(tree, after, lien);
    for (const lien of scenario.attendu.lecteur_sans_le_nouveau_lien) {
      expectPresented(tree, projected, lien);
    }
    // Pour ce lecteur, tout est exactement comme avant ; la projection naïve trahirait la
    // paternité masquée (Louis n'est plus « père », Serge n'est plus « frère »).
    const people = before.people.map((person) => person.id);
    for (const a of people) {
      for (const b of people) {
        expect(present(projected, a, b)).toEqual(present(before, a, b));
      }
    }
    const child = tree.id(enfant);
    for (const other of [tree.id(ancien), tree.id('serge')]) {
      expect(present(naive, child, other)).not.toEqual(present(before, child, other));
    }
  });
});
