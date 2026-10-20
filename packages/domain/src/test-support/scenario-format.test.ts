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
  stepsExpectedSchema,
  stepsScenarioSchema,
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

// Lit et valide tous les scénarios du dépôt : le délai par défaut de vitest (5 s) est trop court
// sous la charge de la CI.
describe('fichiers de scénarios', { timeout: 30_000 }, () => {
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
      if (scenario.action !== undefined && 'etapes' in scenario.action) {
        // Dictées successives : chaque plan s'applique à l'arbre laissé par les précédents.
        let current = tree;
        for (const step of stepsExpectedSchema.parse(scenario.attendu).etapes) {
          current = applyExpectedPlan(current, step.plan ?? []);
          expect(treeDataIssues(current.data)).toEqual([]);
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

  it('la section faits construit des naissances et des décès datés, et refuse une date invalide', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['ama/F'],
        faits: [
          { personne: 'ama', type: 'naissance', date: { qualificatif: 'vers', date: '1940' } },
          { personne: 'ama', type: 'deces', date: { qualificatif: 'exacte', date: '2001-03-04' } },
        ],
      }),
    );
    expect(treeDataIssues(tree.data)).toEqual([]);
    expect(tree.data.facts.map((fact) => [fact.type, fact.date?.qualifier])).toEqual([
      ['birth', 'about'],
      ['death', 'exact'],
    ]);
    expect(
      scenarioTreeSchema.safeParse({
        personnes: ['ama/F'],
        faits: [
          { personne: 'ama', type: 'mariage', date: { qualificatif: 'exacte', date: '1960' } },
        ],
      }).success,
    ).toBe(false);
    const invalid = scenarioTreeSchema.parse({
      personnes: ['ama/F'],
      faits: [{ personne: 'ama', type: 'naissance', date: { qualificatif: 'entre', de: '1940' } }],
    });
    expect(() => buildScenarioTree(invalid)).toThrow();
    const unknown = scenarioTreeSchema.parse({
      personnes: ['ama/F'],
      faits: [
        { personne: 'kofi', type: 'naissance', date: { qualificatif: 'exacte', date: '1940' } },
      ],
    });
    expect(() => buildScenarioTree(unknown)).toThrow(/kofi/);
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

  it('la section a_completer construit des places à compléter, sans nom, et refuse un inconnu', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({ personnes: ['ama/F', 'x/N'], a_completer: ['x'] }),
    );
    expect(treeDataIssues(tree.data)).toEqual([]);
    const natureOf = (key: string) =>
      tree.data.people.find((person) => person.id === tree.id(key))?.nature;
    expect(natureOf('x')).toBe('placeholder');
    expect(natureOf('ama')).toBe('known');
    expect(tree.data.names.some((name) => name.personId === tree.id('x'))).toBe(false);
    const unknown = scenarioTreeSchema.parse({ personnes: ['ama/F'], a_completer: ['kofi'] });
    expect(() => buildScenarioTree(unknown)).toThrow(/kofi/);
  });

  it('un plan crée une place à compléter, puis la précise : ses filiations passent à la personne', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['jules/M', 'irene/F', 'carine/F'],
        filiations: [{ parents: ['jules', 'irene'], enfant: 'carine' }],
      }),
    );
    const plan = actionExpectedSchema.parse({
      plan: [
        { creer: 'bruno/M' },
        { a_completer: 'mere/F', distincte_de: ['irene'] },
        { filiation: { parent: 'jules', enfant: 'bruno', type: 'naissance' } },
        { filiation: { parent: 'mere', enfant: 'bruno', type: 'naissance' } },
      ],
    }).plan;
    if (plan === undefined) throw new Error('missing plan');
    const first = applyExpectedPlan(tree, plan);
    expect(treeDataIssues(first.data)).toEqual([]);
    const mere = first.data.people.find((person) => person.id === first.id('mere'));
    expect(mere?.nature).toBe('placeholder');
    expect(mere?.distinctFrom).toEqual([first.id('irene')]);
    expect(() =>
      applyExpectedPlan(tree, [
        { a_completer: { key: 'x', gender: 'female' }, distincte_de: ['yaw'] },
      ]),
    ).toThrow(/yaw/);
    // Une mention qui vise une personne absente de l'arbre est signalée.
    const dangling = structuredClone(first.data);
    dangling.people = dangling.people.filter((person) => person.id !== first.id('irene'));
    expect(treeDataIssues(dangling).some((issue) => issue.message.includes('missing'))).toBe(true);
    // Préciser l'emporte sur la mention (correction dictée, CL-VOI-08).
    const second = applyExpectedPlan(first, [{ preciser: { place: 'mere', personne: 'irene' } }]);
    expect(treeDataIssues(second.data)).toEqual([]);
    expect(second.data.people.some((person) => person.id === first.id('mere'))).toBe(false);
    expect(
      second.data.filiations
        .filter((filiation) => filiation.childId === second.id('bruno'))
        .map((filiation) => second.keyOf(filiation.parentId)),
    ).toEqual(['jules', 'irene']);
    // L'arbre d'avant est intact.
    expect(first.data.people.some((person) => person.id === first.id('mere'))).toBe(true);
    // Seule une place à compléter se précise.
    expect(() =>
      applyExpectedPlan(first, [{ preciser: { place: 'jules', personne: 'irene' } }]),
    ).toThrow(/Not a placeholder/);
    expect(() =>
      applyExpectedPlan(first, [{ preciser: { place: 'mere', personne: 'mere' } }]),
    ).toThrow(/itself/);
    expect(() =>
      applyExpectedPlan(first, [{ preciser: { place: 'mere', personne: 'bruno' } }]),
    ).toThrow(/own parent/);
  });

  it('préciser refuse une union d’une personne avec elle-même et une union en double', () => {
    const tree = buildScenarioTree(
      scenarioTreeSchema.parse({
        personnes: ['jules/M', 'irene/F', 'x/F', 'y/F', 'bruno/M'],
        a_completer: ['x', 'y'],
        unions: [
          { conjoints: ['jules', 'irene'] },
          { conjoints: ['jules', 'x'] },
          { conjoints: ['irene', 'y'] },
        ],
        filiations: [{ parents: ['jules', 'x'], enfant: 'bruno' }],
      }),
    );
    expect(treeDataIssues(tree.data)).toEqual([]);
    // x épouse de Jules, précisée comme Irène, déjà épouse de Jules : doublon.
    expect(() =>
      applyExpectedPlan(tree, [{ preciser: { place: 'x', personne: 'irene' } }]),
    ).toThrow(/Duplicate union/);
    // y épouse d'Irène, précisée comme Irène : union d'Irène avec elle-même.
    expect(() =>
      applyExpectedPlan(tree, [{ preciser: { place: 'y', personne: 'irene' } }]),
    ).toThrow(/themselves/);
    // Sans conflit : l'union de x passe à la personne.
    const after = applyExpectedPlan(tree, [{ preciser: { place: 'x', personne: 'y' } }]);
    expect(treeDataIssues(after.data)).toEqual([]);
  });

  it('des dictées successives (etapes) : une forme de dictée et un attendu par étape', () => {
    const steps = {
      id: 'CL-POL-03',
      titre: 'Essai',
      arbre: { personnes: ['ama/F', 'kofi/M'] },
      action: {
        etapes: [
          { locuteur: 'ama', dictee: 'Kofi est mon frère de même père' },
          { locuteur: 'ama', dictee: 'Même père même mère' },
        ],
      },
      attendu: { etapes: [{ questions: 0 }, { questions: 0 }] },
    };
    expect(parse(steps)).toBe(true);
    expect(stepsScenarioSchema('CL-POL-03').safeParse(steps).success).toBe(true);
    const shorter = { ...steps, attendu: { etapes: [{ questions: 0 }, { questions: 0 }, {}] } };
    expect(parse(shorter)).toBe(false);
    expect(stepsScenarioSchema('CL-POL-03').safeParse(shorter).success).toBe(false);
    const stranger = {
      ...steps,
      action: { etapes: [steps.action.etapes[0], { locuteur: 'yaw', dictee: 'Bonjour' }] },
    };
    expect(parse(stranger)).toBe(false);
    expect(parse({ ...steps, attendu: { etapes: [{ humeur: 'bonne' }, {}] } })).toBe(false);
  });

  it('la couverture reconnaît la partie lien', () => {
    expect(parse({ ...base, couverture: { teste: ['lecture', 'lien'], reste: [] } })).toBe(true);
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
