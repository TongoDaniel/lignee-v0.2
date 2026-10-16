// Tous les fichiers de test/scenarios suivent le format complet, et leur arbre de départ se
// construit en objets valides du modèle. Cette lecture ne compte pas un scénario comme joué :
// chaque scénario garde son propre test, qui le charge avec `loadScenario`.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { treeDataIssues } from './tree-data';
import {
  actionExpectedSchema,
  applyExpectedPlan,
  listScenarioIds,
  readScenarioFile,
  scenarioFileSchema,
  scenarioIdSchema,
  unexpectedScenarioFiles,
} from './scenario-format';
import { buildScenarioTree, scenarioTreeSchema } from './scenario-tree';

const DOCS = fileURLToPath(new URL('../../../../docs/', import.meta.url));
const edgeCases = readFileSync(
  join(DOCS, 'cahier-des-charges/cahier-des-charges-4-cas-limites.md'),
  'utf8',
);
const plan = readFileSync(join(DOCS, 'plan/v1-decoupage.md'), 'utf8');

const VARIABLE = 'LIGNEE_SCENARIOS_PLAYED_DIR';
const previous = process.env[VARIABLE];
afterEach(() => {
  if (previous === undefined) delete process.env.LIGNEE_SCENARIOS_PLAYED_DIR;
  else process.env[VARIABLE] = previous;
});

const ids = listScenarioIds();

describe('fichiers de scénarios', () => {
  it('test/scenarios ne contient que des scénarios .yaml et le README', () => {
    expect(ids.length).toBeGreaterThan(0);
    expect(unexpectedScenarioFiles()).toEqual([]);
  });

  describe.each(ids)('%s', (id) => {
    it('a un identifiant de l’onglet Cas limites', () => {
      expect(scenarioIdSchema.parse(id)).toBe(id);
      expect(edgeCases).toContain(`| ${id} |`);
    });

    it('suit le format complet, et son arbre de départ se construit en objets valides du modèle', () => {
      const scenario = readScenarioFile(id);
      if (scenario.arbre === undefined) return;
      const tree = buildScenarioTree(scenario.arbre);
      expect(tree.data.people).toHaveLength(scenario.arbre.personnes.length);
      expect(treeDataIssues(tree.data)).toEqual([]);
      if (scenario.action !== undefined && 'locuteur' in scenario.action) {
        const attendu = actionExpectedSchema.parse(scenario.attendu);
        if (attendu.plan !== undefined) {
          expect(treeDataIssues(applyExpectedPlan(tree, attendu.plan).data)).toEqual([]);
        }
      }
    });

    it('sa couverture partielle renvoie à des tickets du plan V1', () => {
      for (const ticket of readScenarioFile(id).couverture?.reste ?? []) {
        expect(plan, `${ticket} absent de docs/plan/v1-decoupage.md`).toContain(`#### ${ticket} —`);
      }
    });
  });

  it('la lecture de contrôle ne compte pas un scénario comme joué', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lignee-played-'));
    try {
      process.env[VARIABLE] = dir;
      for (const id of ids) readScenarioFile(id);
      expect(existsSync(join(dir, ids[0] ?? ''))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('le format refuse ce qui est mal formé', () => {
  const base = {
    id: 'CL-POL-03',
    titre: 'Essai',
    arbre: { personnes: ['ama/F', 'kofi/M'] },
    action: { locuteur: 'ama', dictee: 'Kofi est mon frère' },
    attendu: { questions: 0 },
  };
  const parse = (value: unknown) => scenarioFileSchema('CL-POL-03').safeParse(value).success;

  it('accepte un scénario minimal bien formé', () => {
    expect(parse(base)).toBe(true);
  });

  it('refuse un identifiant qui n’est pas celui du fichier', () => {
    expect(parse({ ...base, id: 'CL-POL-04' })).toBe(false);
  });

  it('refuse une clé inconnue, en tête, dans l’arbre ou dans l’action', () => {
    expect(parse({ ...base, lieu: 'x' })).toBe(false);
    expect(parse({ ...base, arbre: { ...base.arbre, ethnie: [] } })).toBe(false);
    expect(parse({ ...base, action: { ...base.action, ton: 'calme' } })).toBe(false);
  });

  it('accepte un cas sans arbre, avec une action propre au cas (date, T-005)', () => {
    expect(
      parse({
        id: 'CL-POL-03',
        titre: 'Essai',
        action: { saisie: 'vers 1940' },
        attendu: { valide: true },
      }),
    ).toBe(true);
  });

  it('refuse un locuteur absent de l’arbre, une dictée sans arbre et une personne déclarée deux fois', () => {
    expect(parse({ ...base, action: { ...base.action, locuteur: 'yaw' } })).toBe(false);
    expect(parse({ ...base, arbre: undefined })).toBe(false);
    expect(parse({ ...base, action: { locuteur: 'ama' } })).toBe(false);
    expect(parse({ ...base, arbre: { personnes: ['ama/F', 'ama/F'] } })).toBe(false);
  });

  it('refuse un attendu vide, ou, avec une dictée, une clé hors du vocabulaire partagé', () => {
    expect(parse({ ...base, attendu: {} })).toBe(false);
    expect(parse({ ...base, attendu: { questions: 0, humeur: 'bonne' } })).toBe(false);
    expect(parse({ ...base, attendu: { questions: -1 } })).toBe(false);
    expect(parse({ ...base, attendu: { lien: { de: 'ama', vers: 'kofi', fr: 'frère' } } })).toBe(
      false,
    );
    expect(parse({ ...base, attendu: { plan: [{ supprimer: 'kofi' }] } })).toBe(false);
  });

  it('refuse une couverture qui nomme une partie inconnue ou un ticket mal écrit', () => {
    expect(parse({ ...base, couverture: { teste: ['lecture'], reste: ['T-020'] } })).toBe(true);
    expect(parse({ ...base, couverture: { teste: ['devine'], reste: [] } })).toBe(false);
    expect(parse({ ...base, couverture: { teste: ['lecture'], reste: ['T20'] } })).toBe(false);
  });

  it('la construction donne le rang suivant à un conjoint sans rang, et les types de filiation du cahier', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['moussa/M', 'awa/F', 'fanta/F', 'binta/F', 'issa/M'],
        unions: [
          { conjoints: ['moussa', 'awa'], rang_moussa: 2 },
          { conjoints: ['moussa', 'fanta'] },
          { conjoints: ['binta', 'moussa'], rang_binta: 3 },
        ],
        filiations: [
          { parents: ['moussa', 'awa'], enfant: 'issa' },
          { parents: ['fanta'], enfant: 'issa', type: 'a_eleve', certitude: 'probable' },
        ],
      }),
    );
    const ranks = tree.data.unions.map((union) =>
      union.spouses.map((spouse) => [tree.keyOf(spouse.personId), spouse.rank]),
    );
    expect(ranks).toEqual([
      [
        ['moussa', 2],
        ['awa', 1],
      ],
      [
        ['moussa', 3],
        ['fanta', 1],
      ],
      [
        ['binta', 3],
        ['moussa', 4],
      ],
    ]);
    expect(
      tree.data.filiations.map((filiation) => [
        tree.keyOf(filiation.parentId),
        filiation.type,
        filiation.certainty,
      ]),
    ).toEqual([
      ['moussa', 'birth', 'certain'],
      ['awa', 'birth', 'certain'],
      ['fanta', 'raised', 'probable'],
    ]);
  });

  it('la construction refuse un rang déjà pris par la même personne, écrit ou déduit', () => {
    const build = (unions: unknown[]) => () =>
      buildScenarioTree(
        scenarioTreeSchema.parse({ personnes: ['moussa/M', 'awa/F', 'fanta/F'], unions }),
      );
    // Rang écrit qui double un rang déduit.
    expect(
      build([{ conjoints: ['moussa', 'awa'] }, { conjoints: ['moussa', 'fanta'], rang_moussa: 1 }]),
    ).toThrow(/Rank 1 is already used by moussa/);
    // Deux rangs écrits identiques.
    expect(
      build([
        { conjoints: ['moussa', 'awa'], rang_moussa: 2 },
        { conjoints: ['moussa', 'fanta'], rang_moussa: 2 },
      ]),
    ).toThrow(/Rank 2/);
    expect(
      build([{ conjoints: ['moussa', 'awa'] }, { conjoints: ['moussa', 'fanta'], rang_moussa: 2 }]),
    ).not.toThrow();
  });

  it('un plan crée une personne avec le genre écrit (samuel/M), non renseigné sans genre', () => {
    const tree = buildScenarioTree(scenarioTreeSchema.parse({ personnes: ['ama/F'] }));
    const steps = actionExpectedSchema.parse({
      plan: [{ creer: 'samuel/M' }, { creer: 'kofi' }],
    }).plan;
    if (steps === undefined) throw new Error('missing plan');
    const after = applyExpectedPlan(tree, steps);
    const genderOf = (key: string) =>
      after.data.people.find((person) => person.id === after.id(key))?.gender;
    expect(genderOf('samuel')).toBe('male');
    expect(genderOf('kofi')).toBe('unspecified');
    expect(actionExpectedSchema.safeParse({ plan: [{ creer: 'samuel/X' }] }).success).toBe(false);
    expect(actionExpectedSchema.safeParse({ plan: [{ creer: 'Samuel' }] }).success).toBe(false);
  });

  it('la construction refuse une référence à une personne non déclarée', () => {
    const section = scenarioTreeSchema.parse({
      personnes: ['ama/F'],
      filiations: [{ parents: ['kofi'], enfant: 'ama' }],
    });
    expect(() => buildScenarioTree(section)).toThrow(/kofi/);
  });

  it('la construction refuse ce que le modèle refuse (union d’une personne avec elle-même)', () => {
    const section = scenarioTreeSchema.parse({
      personnes: ['ama/F'],
      unions: [{ conjoints: ['ama', 'ama'] }],
    });
    expect(() => buildScenarioTree(section)).toThrow();
  });

  it('un plan attendu ne crée pas une personne qui existe, ni ne vise une personne absente', () => {
    const tree = buildScenarioTree(scenarioTreeSchema.parse({ personnes: ['ama/F'] }));
    expect(() => applyExpectedPlan(tree, [{ creer: { key: 'ama', gender: 'female' } }])).toThrow(
      /already exists/,
    );
    expect(() =>
      applyExpectedPlan(tree, [{ filiation: { parent: 'yaw', enfant: 'ama', type: 'naissance' } }]),
    ).toThrow(/yaw/);
  });
});
