// Exigences du PRD portées par T-008 (ARB-03, ARB-04, ARB-05, UNI-07, UNI-11) et étape 1 du TRD,
// sur de petits arbres écrits ici (noms générés). Chaque test échouerait si le critère était faux.
import {
  unionPair,
  type FuzzyDate,
  type Id,
  type SimultaneityAnswer,
  type Union,
} from '@lignee/domain';
import {
  buildScenarioTree,
  scenarioFuzzyDateSchema,
  scenarioTreeSchema,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { computeGenerations } from './generations';
import { buildTreeStructure, parentsFoyerKey } from './structure';
import { applyLayoutSteps } from './test-support/layout-scenario';
import type { TreeStructure } from './types';
import { orderUnions, unionsRelation } from './union-order';

function familyTree(section: z.input<typeof scenarioTreeSchema>): ScenarioTree {
  return buildScenarioTree(scenarioTreeSchema.parse(section));
}

function year(value: number): FuzzyDate {
  return { qualifier: 'exact', precision: 'year', date: { year: value }, calendar: 'gregorian' };
}

/** Union entre `a` et `b` (exactement une). */
function unionIndex(tree: ScenarioTree, [a, b]: [string, string]): number {
  const ids = new Set([tree.id(a), tree.id(b)]);
  const index = tree.data.unions.findIndex((union) =>
    union.spouses.every((spouse) => ids.has(spouse.personId)),
  );
  if (index < 0) throw new Error(`No union between ${a} and ${b}`);
  return index;
}

/** Modifie les dates de l'union entre `a` et `b`. */
function setUnion(
  tree: ScenarioTree,
  pair: [string, string],
  dates: { start?: FuzzyDate; end?: FuzzyDate },
) {
  const index = unionIndex(tree, pair);
  tree.data.unions[index] = { ...(tree.data.unions[index] as Union), ...dates };
}

/** Garde la même réponse pour chaque paire des unions citées (ADR 0012). */
function answerPairs(
  tree: ScenarioTree,
  pairs: [string, string][],
  simultaneity: 'simultaneous' | 'successive',
) {
  const ids = pairs.map((pair) => (tree.data.unions[unionIndex(tree, pair)] as Union).id);
  ids.forEach((first, index) => {
    for (const second of ids.slice(index + 1)) {
      tree.data.simultaneityAnswers.push({
        id: tree.context.nextId(),
        treeId: tree.context.treeId,
        unionIds: unionPair(first, second),
        simultaneity,
      } as SimultaneityAnswer);
    }
  });
}

function partners(structure: TreeStructure, tree: ScenarioTree, hub: string) {
  return structure.unitOf.get(tree.id(hub))?.foyers.map((foyer) => tree.keyOf(foyer.partnerId));
}

function childrenOf(structure: TreeStructure, tree: ScenarioTree, hub: string, partner: string) {
  const foyer = structure.unitOf
    .get(tree.id(hub))
    ?.foyers.find((candidate) => candidate.partnerId === tree.id(partner));
  return foyer?.children.map((id) => tree.keyOf(id));
}

describe('ARB-03 — foyers d’une personne aux unions simultanées', () => {
  it('un chef de famille avec 8 épouses et 40 enfants : un groupe, 8 foyers dans l’ordre des rangs, 5 enfants chacun', () => {
    const wives = Array.from({ length: 8 }, (_, index) => `epouse${String(index + 1)}`);
    // Unions saisies dans le désordre : seul le rang compte.
    const order = [5, 2, 8, 1, 7, 3, 6, 4];
    const tree = familyTree({
      personnes: [
        'chef/M',
        ...wives.map((wife) => `${wife}/F`),
        ...wives.flatMap((wife) =>
          [1, 2, 3, 4, 5].map((child) => `${wife}_enfant${String(child)}/N`),
        ),
      ],
      unions: order.map((rank) => ({
        conjoints: ['chef', `epouse${String(rank)}`],
        rang_chef: rank,
      })),
      filiations: wives.flatMap((wife) =>
        [1, 2, 3, 4, 5].map((child) => ({
          parents: ['chef', wife],
          enfant: `${wife}_enfant${String(child)}`,
        })),
      ),
    });
    const structure = buildTreeStructure(tree.data, tree.id('epouse6_enfant3'));
    const unit = structure.unitOf.get(tree.id('chef'));
    // Aucune date ni réponse : huit unions en cours sont montrées ensemble, question en attente.
    expect(unit?.kind).toBe('simultaneous');
    expect(unit?.simultaneityPending).toBe(true);
    expect(unit?.row).toBe(-1);
    expect(partners(structure, tree, 'chef')).toEqual(wives);
    expect(unit?.foyers.map((foyer) => foyer.children.length)).toEqual(Array(8).fill(5));
    expect(unit?.foyers.map((foyer) => foyer.leadsToCenter)).toEqual(
      wives.map((wife) => wife === 'epouse6'),
    );
    // Chaque épouse est en tête de la colonne de ses enfants, et seulement là.
    expect(structure.units).toHaveLength(1);
    expect(structure.placementOf.size).toBe(40);
  });
});

describe('ARB-04 — unions successives, de la plus ancienne à la plus récente', () => {
  const successive = () =>
    familyTree({
      personnes: ['marc/M', 'claire/F', 'irene/F', 'sylvie/F'],
      // Rangs donnés dans l'ordre de saisie, qui n'est pas l'ordre des mariages.
      unions: [
        { conjoints: ['marc', 'sylvie'] },
        { conjoints: ['marc', 'claire'] },
        { conjoints: ['marc', 'irene'] },
      ],
    });

  it('avec des dates : les dates l’emportent sur le rang de saisie, l’union en cours est la dernière', () => {
    const tree = successive();
    setUnion(tree, ['marc', 'claire'], { start: year(1960), end: year(1968) });
    setUnion(tree, ['marc', 'irene'], { start: year(1970), end: year(1979) });
    setUnion(tree, ['marc', 'sylvie'], { start: year(1981) });
    const structure = buildTreeStructure(tree.data, tree.id('marc'));
    const unit = structure.unitOf.get(tree.id('marc'));
    expect(unit?.kind).toBe('successive');
    expect(unit?.simultaneityPending).toBe(false);
    expect(partners(structure, tree, 'marc')).toEqual(['claire', 'irene', 'sylvie']);
    expect(unit?.foyers.map((foyer) => foyer.status)).toEqual(['ended', 'ended', 'ongoing']);
  });

  it('avec un rang saisi à la main et sans date : le rang décide', () => {
    const tree = successive();
    answerPairs(
      tree,
      [
        ['marc', 'claire'],
        ['marc', 'irene'],
        ['marc', 'sylvie'],
      ],
      'successive',
    );
    applyLayoutSteps(tree, [
      { rang: { conjoints: ['marc', 'sylvie'], de: 'marc', rang: 3 } },
      { rang: { conjoints: ['marc', 'claire'], de: 'marc', rang: 1 } },
      { rang: { conjoints: ['marc', 'irene'], de: 'marc', rang: 2 } },
    ]);
    const structure = buildTreeStructure(tree.data, tree.id('marc'));
    expect(structure.unitOf.get(tree.id('marc'))?.kind).toBe('successive');
    expect(partners(structure, tree, 'marc')).toEqual(['claire', 'irene', 'sylvie']);
  });

  it('dates et rangs mêlés : les unions datées se rangent par date, les autres gardent la place de leur rang', () => {
    const tree = successive();
    // Rangs : sylvie 1, claire 2, irene 3. Seules sylvie et irene sont datées, à l'envers.
    setUnion(tree, ['marc', 'sylvie'], { start: year(1990) });
    setUnion(tree, ['marc', 'irene'], { start: year(1970) });
    const unions = orderUnions(tree.id('marc'), tree.data.unions);
    const names = unions.map((union) =>
      tree.keyOf(
        union.spouses.find((spouse) => spouse.personId !== tree.id('marc'))?.personId ?? '',
      ),
    );
    expect(names).toEqual(['irene', 'claire', 'sylvie']);
  });

  it('simultanéité : la règle de packages/domain, et un repli d’affichage tant que la question est ouverte', () => {
    const tree = successive();
    const [a, b] = tree.data.unions;
    if (a === undefined || b === undefined) throw new Error('missing unions');
    let answers: Pick<SimultaneityAnswer, 'unionIds' | 'simultaneity'>[] = [];
    const relation = (first: Union, second: Union) =>
      unionsRelation(
        { unions: [first, second], facts: [], simultaneityAnswers: answers },
        first,
        second,
      );
    const answer = (value: 'simultaneous' | 'successive') => {
      answers = [{ unionIds: [...unionPair(a.id, b.id)] as [Id, Id], simultaneity: value }];
    };
    // Les dates d'abord, même contre une réponse gardée.
    expect(relation({ ...a, end: year(1970) }, { ...b, start: year(1975) })).toEqual({
      simultaneous: false,
      pending: false,
    });
    answer('successive');
    expect(
      relation({ ...a, start: year(1960), end: year(1980) }, { ...b, start: year(1975) }),
    ).toEqual({ simultaneous: true, pending: false });
    // Puis la réponse gardée pour la paire.
    expect(relation(a, b)).toEqual({ simultaneous: false, pending: false });
    answer('simultaneous');
    expect(relation({ ...a, endReason: 'death' }, b)).toEqual({
      simultaneous: true,
      pending: false,
    });
    answers = [];
    // Sinon, repli d'affichage (ADR 0013) : deux unions sans fin saisie sont montrées ensemble.
    expect(relation(a, b)).toEqual({ simultaneous: true, pending: true });
    expect(relation({ ...a, endReason: 'divorce' }, b)).toEqual({
      simultaneous: false,
      pending: true,
    });
  });
});

describe('Fin d’union par décès (variante de CL-POL-06)', () => {
  const widower = (death: z.input<typeof scenarioFuzzyDateSchema>) =>
    familyTree({
      personnes: ['jean/M', 'helene/F', 'berthe/F', 'luc/M', 'paul/M'],
      unions: [
        { conjoints: ['jean', 'helene'] },
        { conjoints: ['jean', 'berthe'], debut: { qualificatif: 'exacte', date: '1978' } },
      ],
      filiations: [
        { parents: ['jean', 'helene'], enfant: 'luc' },
        { parents: ['jean', 'berthe'], enfant: 'paul' },
      ],
      faits: [{ personne: 'helene', type: 'deces', date: death }],
    });

  it('seul un fait de décès, sans date utilisable : l’union est terminée, le veuf remarié n’est pas dessiné polygame', () => {
    const tree = widower({ qualificatif: 'texte', texte: 'pendant la guerre' });
    const structure = buildTreeStructure(tree.data, tree.id('paul'));
    const unit = structure.unitOf.get(tree.id('jean'));
    expect(unit?.kind).toBe('successive');
    expect(unit?.foyers.map((foyer) => foyer.status)).toEqual(['ended', 'ongoing']);
    // Rien ne dit encore si les unions se sont chevauchées : la question reste ouverte.
    expect(unit?.simultaneityPending).toBe(true);
    expect(structure.simultaneityPending).toEqual([tree.id('jean')]);
  });

  it('un décès daté avant le second mariage : les dates décident, sans question', () => {
    const tree = widower({ qualificatif: 'exacte', date: '1975-03-12' });
    const structure = buildTreeStructure(tree.data, tree.id('paul'));
    const unit = structure.unitOf.get(tree.id('jean'));
    expect(unit?.kind).toBe('successive');
    expect(unit?.simultaneityPending).toBe(false);
    expect(structure.simultaneityPending).toEqual([]);
  });

  it('sans le fait de décès, les deux unions en cours sont montrées ensemble, question ouverte', () => {
    const tree = widower({ qualificatif: 'texte', texte: 'pendant la guerre' });
    tree.data.facts = [];
    const unit = buildTreeStructure(tree.data, tree.id('paul')).unitOf.get(tree.id('jean'));
    expect(unit?.kind).toBe('simultaneous');
    expect(unit?.simultaneityPending).toBe(true);
  });
});

describe('Ordre des foyers portés (graine fast-check -1716122125, cas réduit)', () => {
  it('une union datée portée par l’autre conjoint ne déplace pas les places des unions datées', () => {
    // Paul a trois unions : avec Xavier (rang 1, datée 1990), Berthe (rang 2, sans date) et
    // Claire (rang 3, datée 1970). Xavier a autant d'unions et il est au centre : il porte
    // l'union avec Paul. Paul ne porte que Berthe et Claire, rangées entre elles : le rang de
    // Berthe passe d'abord, Claire seule datée garde la place datée. Avant correction, l'union
    // avec Xavier comptait dans l'ordre et Claire passait devant Berthe.
    const family = familyTree({
      personnes: ['paul/M', 'xavier/M', 'berthe/F', 'claire/F', 'yves/M', 'zoe/F'],
      unions: [
        {
          conjoints: ['paul', 'xavier'],
          rang_paul: 1,
          debut: { qualificatif: 'exacte', date: '1990' },
        },
        { conjoints: ['paul', 'berthe'], rang_paul: 2 },
        {
          conjoints: ['paul', 'claire'],
          rang_paul: 3,
          debut: { qualificatif: 'exacte', date: '1970' },
        },
        { conjoints: ['xavier', 'yves'] },
        { conjoints: ['xavier', 'zoe'] },
      ],
    });
    const structure = buildTreeStructure(family.data, family.id('xavier'));
    const paul = structure.unitOf.get(family.id('paul'));
    expect(paul?.foyersElsewhere).toHaveLength(1);
    expect(partners(structure, family, 'paul')).toEqual(['berthe', 'claire']);
  });
});

describe('UNI-07 — rang propre à chaque conjoint', () => {
  const tree = () =>
    familyTree({
      personnes: ['moussa/M', 'aicha/F', 'fatou/F', 'ibrahim/M', 'ami/F', 'sekou/M', 'nafi/F'],
      unions: [
        { conjoints: ['moussa', 'aicha'], rang_moussa: 1 },
        // 2e union de Moussa, 1re de Fatou.
        { conjoints: ['moussa', 'fatou'], rang_moussa: 2, rang_fatou: 1 },
        { conjoints: ['fatou', 'ibrahim'], rang_fatou: 2 },
      ],
      filiations: [
        { parents: ['moussa', 'aicha'], enfant: 'ami' },
        { parents: ['moussa', 'fatou'], enfant: 'sekou' },
        { parents: ['fatou', 'ibrahim'], enfant: 'nafi' },
      ],
    });

  it('chacun voit ses foyers dans l’ordre de ses propres rangs ; l’union commune n’est portée qu’une fois', () => {
    const family = tree();
    const fatouId = family.id('fatou');
    const structure = buildTreeStructure(family.data, family.id('sekou'));
    expect(partners(structure, family, 'moussa')).toEqual(['aicha', 'fatou']);
    const moussaFatou = structure.unitOf.get(family.id('moussa'))?.foyers[1];
    expect(moussaFatou?.hubRank).toBe(2);
    expect(moussaFatou?.partnerRank).toBe(1);
    // Fatou porte son autre union ; l'union avec Moussa est portée par Moussa.
    const fatou = structure.unitOf.get(fatouId);
    expect(fatou?.foyers.map((foyer) => family.keyOf(foyer.partnerId))).toEqual(['ibrahim']);
    // La forme ne compte que les foyers portés ; la question, elle, porte sur ses deux unions.
    expect(fatou?.kind).toBe('couple');
    expect(fatou?.simultaneityPending).toBe(true);
    expect(structure.simultaneityPending).toEqual([family.id('moussa'), fatouId]);
    expect(fatou?.foyersElsewhere).toEqual([moussaFatou?.key]);
    expect(
      orderUnions(
        fatouId,
        family.data.unions.filter((union) =>
          union.spouses.some((spouse) => spouse.personId === fatouId),
        ),
      ).map((union) => union.spouses.find((spouse) => spouse.personId !== fatouId)?.personId),
    ).toEqual([family.id('moussa'), family.id('ibrahim')]);
  });

  it('changer un rang réordonne les foyers au calcul suivant', () => {
    const family = tree();
    expect(partners(buildTreeStructure(family.data, family.id('ami')), family, 'moussa')).toEqual([
      'aicha',
      'fatou',
    ]);
    applyLayoutSteps(family, [
      { rang: { conjoints: ['moussa', 'fatou'], de: 'moussa', rang: 1 } },
      { rang: { conjoints: ['moussa', 'aicha'], de: 'moussa', rang: 2 } },
    ]);
    expect(partners(buildTreeStructure(family.data, family.id('ami')), family, 'moussa')).toEqual([
      'fatou',
      'aicha',
    ]);
  });
});

describe('ARB-05 et UNI-11 — enfant dont un parent n’est pas précisé', () => {
  const tree = () => {
    const family = familyTree({
      personnes: ['pierre/M', 'rose/F', 'odile/F', 'joseph/M', 'samuel/M'],
      unions: [
        { conjoints: ['pierre', 'odile'], rang_pierre: 2 },
        { conjoints: ['pierre', 'rose'], rang_pierre: 1 },
      ],
      filiations: [
        { parents: ['pierre', 'odile'], enfant: 'joseph' },
        { parents: ['pierre'], enfant: 'samuel' },
      ],
    });
    for (const candidate of ['odile', 'rose']) {
      family.data.parentCandidates.push({
        id: family.context.nextId(),
        treeId: family.context.treeId,
        childId: family.id('samuel'),
        candidateId: family.id(candidate),
      });
    }
    return family;
  };

  it('l’enfant est sous le père, dans la colonne « mère non précisée », épouses candidates dans l’ordre des foyers', () => {
    const family = tree();
    const structure = buildTreeStructure(family.data, family.id('samuel'));
    const column = structure.unitOf.get(family.id('pierre'))?.unspecified;
    expect(column?.missing).toBe('mother');
    expect(column?.children.map((child) => family.keyOf(child.childId))).toEqual(['samuel']);
    expect(column?.candidateIds.map((id) => family.keyOf(id))).toEqual(['rose', 'odile']);
    expect(column?.leadsToCenter).toBe(true);
    expect(structure.placementOf.get(family.id('samuel'))).toMatchObject({
      kind: 'unspecified',
      parentId: family.id('pierre'),
    });
    expect(childrenOf(structure, family, 'pierre', 'rose')).toEqual([]);
  });

  it('préciser la mère déplace l’enfant dans le bon foyer, et la colonne disparaît', () => {
    const family = tree();
    applyLayoutSteps(family, [{ preciser_parent: { enfant: 'samuel', parent: 'rose' } }]);
    const structure = buildTreeStructure(family.data, family.id('samuel'));
    expect(childrenOf(structure, family, 'pierre', 'rose')).toEqual(['samuel']);
    expect(structure.unitOf.get(family.id('pierre'))?.unspecified).toBeUndefined();
    expect(structure.placementOf.get(family.id('samuel'))).toMatchObject({ kind: 'foyer' });
  });

  it('sans candidats : « père non précisé » sous une mère, « parent non précisé » sans genre connu ou hors naissance', () => {
    const family = familyTree({
      personnes: ['awa/F', 'kofi/M', 'eli/N', 'sam/M', 'tia/F'],
      filiations: [
        { parents: ['awa'], enfant: 'kofi' },
        { parents: ['eli'], enfant: 'sam' },
        { parents: ['awa'], enfant: 'tia', type: 'adoptive' },
      ],
    });
    family.data.filiations.push({
      ...(family.data.filiations[0] as (typeof family.data.filiations)[number]),
      id: family.context.nextId(),
      parentId: family.id('eli'),
      childId: family.id('kofi'),
      type: 'raised',
    });
    const structure = buildTreeStructure(family.data, family.id('awa'));
    const awa = structure.unitOf.get(family.id('awa'));
    expect(awa?.kind).toBe('single');
    expect(
      awa?.unspecified?.children.map((child) => [family.keyOf(child.childId), child.missing]),
    ).toEqual([
      ['kofi', 'father'],
      ['tia', 'parent'],
    ]);
    expect(awa?.unspecified?.missing).toBe('parent');
    expect(structure.unitOf.get(family.id('eli'))?.unspecified?.missing).toBe('parent');
    // Le lien « a élevé » d'Eli vers Kofi ne range pas Kofi : c'est un lien secondaire.
    expect(structure.crossLinks).toContainEqual(
      expect.objectContaining({
        role: 'secondary',
        fromId: family.id('eli'),
        toId: family.id('kofi'),
      }),
    );
  });

  it('un candidat masqué (absent du graphe) n’apparaît nulle part', () => {
    const family = tree();
    const hidden = family.id('odile');
    const graph = {
      ...family.data,
      people: family.data.people.filter((person) => person.id !== hidden),
    };
    const structure = buildTreeStructure(graph, family.id('samuel'));
    const column = structure.unitOf.get(family.id('pierre'))?.unspecified;
    expect(column?.candidateIds).toEqual([family.id('rose')]);
    expect(JSON.stringify([...structure.rowOf.keys(), structure.units])).not.toContain(hidden);
  });
});

describe('Foyers : autres liens', () => {
  it('lien adoptif à côté des parents de naissance : l’enfant reste dans le foyer de naissance', () => {
    const family = familyTree({
      personnes: ['ana/F', 'ben/M', 'carl/M', 'dina/F'],
      unions: [{ conjoints: ['ana', 'ben'] }, { conjoints: ['ana', 'carl'] }],
      filiations: [
        { parents: ['ana', 'ben'], enfant: 'dina' },
        { parents: ['carl'], enfant: 'dina', type: 'adoptive' },
      ],
    });
    const structure = buildTreeStructure(family.data, family.id('dina'));
    expect(childrenOf(structure, family, 'ana', 'ben')).toEqual(['dina']);
    expect(childrenOf(structure, family, 'ana', 'carl')).toEqual([]);
    expect(structure.crossLinks).toEqual([
      expect.objectContaining({ role: 'secondary', fromId: family.id('carl'), rowSpan: 1 }),
    ]);
  });

  it('deux parents sans union enregistrée forment un foyer à part', () => {
    const family = familyTree({
      personnes: ['lea/F', 'tom/M', 'zoe/F'],
      filiations: [{ parents: ['lea', 'tom'], enfant: 'zoe' }],
    });
    const structure = buildTreeStructure(family.data, family.id('zoe'));
    const key = parentsFoyerKey(family.id('lea'), family.id('tom'));
    expect(structure.foyerOf.get(key)?.children).toEqual([family.id('zoe')]);
    expect(structure.foyerOf.get(key)?.unionId).toBeUndefined();
    expect(structure.units).toHaveLength(1);
    expect(structure.units[0]?.kind).toBe('couple');
  });

  it('deux unions du même couple : l’union d’origine saisie range l’enfant', () => {
    const family = familyTree({
      personnes: ['eve/F', 'max/M', 'kim/N'],
      unions: [{ conjoints: ['eve', 'max'] }, { conjoints: ['eve', 'max'] }],
      filiations: [{ parents: ['eve', 'max'], enfant: 'kim' }],
    });
    const second = family.data.unions[1]?.id as Id;
    family.data.filiations = family.data.filiations.map((filiation) => ({
      ...filiation,
      originUnionId: second,
    }));
    const structure = buildTreeStructure(family.data, family.id('kim'));
    expect(structure.placementOf.get(family.id('kim'))).toMatchObject({ foyerKey: second });
  });
});

describe('Étape 1 — générations', () => {
  it('ascendants au-dessus, descendants en dessous, conjoints sur la même rangée', () => {
    const family = familyTree({
      personnes: ['gp/M', 'gm/F', 'pere/M', 'mere/F', 'moi/N', 'conjoint/N', 'fils/M'],
      unions: [
        { conjoints: ['gp', 'gm'] },
        { conjoints: ['pere', 'mere'] },
        { conjoints: ['moi', 'conjoint'] },
      ],
      filiations: [
        { parents: ['gp', 'gm'], enfant: 'pere' },
        { parents: ['pere', 'mere'], enfant: 'moi' },
        { parents: ['moi', 'conjoint'], enfant: 'fils' },
      ],
    });
    const generations = computeGenerations(family.data, family.id('moi'));
    const rows: Record<string, number> = Object.fromEntries(
      [...generations.rowOf].map(([id, row]): [string, number] => [family.keyOf(id) ?? id, row]),
    );
    expect(rows).toEqual({ gp: -2, gm: -2, pere: -1, mere: -1, moi: 0, conjoint: 0, fils: 1 });
    expect(generations.rows.get(-2)?.map((id) => family.keyOf(id))).toEqual(['gp', 'gm']);
  });

  it('implexe (cousins germains mariés) : chaque ancêtre une seule fois, aucun trait long', () => {
    const family = familyTree({
      personnes: ['a/M', 'b/F', 'c/M', 'd/F', 'e/F', 'f/M', 'x/M', 'y/F', 'z/N'],
      unions: [
        { conjoints: ['a', 'b'] },
        { conjoints: ['c', 'e'] },
        { conjoints: ['f', 'd'] },
        { conjoints: ['x', 'y'] },
      ],
      filiations: [
        { parents: ['a', 'b'], enfant: 'c' },
        { parents: ['a', 'b'], enfant: 'd' },
        { parents: ['c', 'e'], enfant: 'x' },
        { parents: ['f', 'd'], enfant: 'y' },
        { parents: ['x', 'y'], enfant: 'z' },
      ],
    });
    const structure = buildTreeStructure(family.data, family.id('z'));
    expect(structure.rowOf.get(family.id('a'))).toBe(-3);
    expect(structure.rows.get(-3)?.map((id) => family.keyOf(id))).toEqual(['a', 'b']);
    expect(structure.crossLinks).toEqual([]);
  });

  it('chemins de longueurs différentes : la rangée du plus court, l’autre lien en trait long', () => {
    // Moi épouse Wendy, petite-fille de mon oncle : par l'union, Wendy est sur ma rangée (1 lien),
    // son père le cousin juste au-dessus (2 liens) ; par l'oncle, le cousin serait sur ma rangée
    // (4 liens). Le lien de l'oncle au cousin devient un trait long.
    const family = familyTree({
      personnes: ['moi/M', 'pere/M', 'gp/M', 'oncle/M', 'cousin/M', 'wendy/F'],
      unions: [{ conjoints: ['moi', 'wendy'] }],
      filiations: [
        { parents: ['gp'], enfant: 'pere' },
        { parents: ['gp'], enfant: 'oncle' },
        { parents: ['pere'], enfant: 'moi' },
        { parents: ['oncle'], enfant: 'cousin' },
        { parents: ['cousin'], enfant: 'wendy' },
      ],
    });
    const structure = buildTreeStructure(family.data, family.id('moi'));
    expect(structure.rowOf.get(family.id('wendy'))).toBe(0);
    expect(structure.rowOf.get(family.id('cousin'))).toBe(-1);
    expect(structure.rowOf.get(family.id('oncle'))).toBe(-1);
    expect(structure.crossLinks).toEqual([
      expect.objectContaining({
        kind: 'filiation',
        role: 'long',
        fromId: family.id('oncle'),
        toId: family.id('cousin'),
        rowSpan: 0,
      }),
    ]);
  });

  it('à longueur égale, la rangée la plus proche : une union entre générations devient un trait long', () => {
    // Zoé, demi-sœur de Moi (2 liens, rangée 0), a épousé Dan, fils de Moi (2 liens, rangée 1).
    const family = familyTree({
      personnes: ['moi/M', 'mere/F', 'zoe/F', 'dan/M'],
      unions: [{ conjoints: ['dan', 'zoe'] }],
      filiations: [
        { parents: ['mere'], enfant: 'moi' },
        { parents: ['mere'], enfant: 'zoe' },
        { parents: ['moi'], enfant: 'dan' },
      ],
    });
    const structure = buildTreeStructure(family.data, family.id('moi'));
    expect(structure.rowOf.get(family.id('zoe'))).toBe(0);
    expect(structure.crossLinks).toEqual([
      expect.objectContaining({ kind: 'union', role: 'long' }),
    ]);
    const link = structure.crossLinks[0];
    expect(Math.abs(link?.rowSpan ?? 0)).toBe(1);
  });

  it('personne sans chemin vers le centre : hors de la disposition ; centre absent : erreur', () => {
    const family = familyTree({ personnes: ['moi/N', 'autre/N'] });
    const structure = buildTreeStructure(family.data, family.id('moi'));
    expect([...structure.rowOf.keys()]).toEqual([family.id('moi')]);
    expect(structure.unreachable).toEqual([family.id('autre')]);
    expect(structure.units).toEqual([]);
    expect(() => buildTreeStructure({ ...family.data, people: [] }, family.id('moi'))).toThrow(
      RangeError,
    );
  });

  it('ne modifie pas le graphe reçu', () => {
    const family = familyTree({
      personnes: ['a/M', 'b/F', 'c/N'],
      unions: [{ conjoints: ['a', 'b'] }],
      filiations: [{ parents: ['a', 'b'], enfant: 'c' }],
    });
    const before = JSON.stringify(family.data);
    buildTreeStructure(family.data, family.id('c'));
    expect(JSON.stringify(family.data)).toBe(before);
  });
});
