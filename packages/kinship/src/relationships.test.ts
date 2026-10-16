// « Quel lien entre A et B ? » (TRD, « Moteur de parenté », question 1), partie structurelle :
// générations de chaque côté, ancêtres communs, demi ou non, alliance, ordre et certitude.
// Arbres inventés, noms courts au format des scénarios.
import { describe, expect, it } from 'vitest';

import { closestCommonAncestors, findRelationships } from './kinship';
import type { BloodSegment, KinshipResult, Relationship } from './relationship';
import {
  describeRelationship,
  fixture,
  relationshipIssues,
  type Fixture,
} from './test-support/fixtures';

function related(result: KinshipResult): Relationship[] {
  if (result.status !== 'related') throw new Error(`Expected related, got ${result.status}`);
  return result.relationships;
}

/** Chemins de `a` vers `b`, décrits en noms courts, après vérification de leur forme. */
function paths(f: Fixture, a: string, b: string): string[] {
  const relationships = related(findRelationships(f.graph, f.id(a), f.id(b)));
  for (const relationship of relationships) {
    expect(relationshipIssues(f.graph, relationship, f.id(a), f.id(b))).toEqual([]);
  }
  return relationships.map((relationship) => describeRelationship(relationship, f.keyOf));
}

function firstBlood(f: Fixture, a: string, b: string): BloodSegment {
  const [first] = related(findRelationships(f.graph, f.id(a), f.id(b)));
  const segment = first?.segments[0];
  if (first?.kind !== 'blood' || segment?.kind !== 'blood') throw new Error('Expected blood');
  return segment;
}

// Quatre générations, deux lignées : sert aux degrés du TRD.
const lineage = fixture({
  personnes: [
    'aba/M',
    'abi/F', // arrière-grands-parents
    'bako/M',
    'bela/F',
    'bimo/M', // leurs enfants : bako et bimo frères
    'caro/F',
    'cedi/M',
    'cola/F', // petits-enfants : caro (de bako), cedi et cola (de bimo)
    'dano/M',
    'dila/F', // arrière-petits-enfants : dano (de caro), dila (de cedi)
    'emo/M', // enfant de dila
  ],
  unions: [{ conjoints: ['aba', 'abi'] }, { conjoints: ['bako', 'bela'] }],
  filiations: [
    { parents: ['aba', 'abi'], enfant: 'bako' },
    { parents: ['aba', 'abi'], enfant: 'bimo' },
    { parents: ['bako', 'bela'], enfant: 'caro' },
    { parents: ['bimo'], enfant: 'cedi' },
    { parents: ['bimo'], enfant: 'cola' },
    { parents: ['caro'], enfant: 'dano' },
    { parents: ['cedi'], enfant: 'dila' },
    { parents: ['dila'], enfant: 'emo' },
  ],
});

describe('liens de sang : générations de chaque côté (TRD)', () => {
  it.each([
    ['bako', 'bimo', 1, 1, 'fratrie'],
    ['bako', 'cedi', 1, 2, 'oncle vers neveu'],
    ['cedi', 'bako', 2, 1, 'neveu vers oncle'],
    ['caro', 'cedi', 2, 2, 'cousins germains'],
    ['dano', 'dila', 3, 3, 'cousins issus de germains'],
    ['dano', 'cedi', 3, 2, 'à la mode de Bretagne'],
    ['dano', 'emo', 3, 4, 'au-delà : degré civil 7'],
    ['caro', 'bako', 1, 0, 'enfant vers parent'],
    ['aba', 'dano', 0, 3, 'arrière-grand-parent vers arrière-petit-enfant'],
  ])('%s → %s : %i et %i (%s)', (a, b, up, down) => {
    const segment = firstBlood(lineage, a, b);
    expect([segment.generationsUp, segment.generationsDown]).toEqual([up, down]);
  });

  it('deux parents communs font des frères ; les ancêtres communs sont les deux parents', () => {
    const segment = firstBlood(lineage, 'bako', 'bimo');
    expect(segment.sharing).toBe('full');
    expect(segment.commonAncestors.map((c) => lineage.keyOf(c.personId)).sort()).toEqual([
      'aba',
      'abi',
    ]);
    expect(paths(lineage, 'bako', 'bimo')).toEqual(['1/1[aba+abi]']);
  });

  it('cousins germains par deux grands-parents communs : « full » ; par un seul : « half »', () => {
    expect(firstBlood(lineage, 'caro', 'cedi').sharing).toBe('full');
    expect(firstBlood(lineage, 'cedi', 'cola').sharing).toBe('half');
  });

  it('ligne directe : l’ancêtre est le début ou la fin du segment', () => {
    const segment = firstBlood(lineage, 'aba', 'dano');
    expect(segment.sharing).toBe('direct_line');
    expect(segment.commonAncestors).toHaveLength(1);
    expect(segment.commonAncestors[0]?.personId).toBe(lineage.id('aba'));
    expect(segment.commonAncestors[0]?.fromSide).toBeUndefined();
  });

  it('ancêtres communs les plus proches seulement (pas les grands-parents de deux frères)', () => {
    const common = closestCommonAncestors(lineage.graph, lineage.id('caro'), lineage.id('cedi'));
    expect(
      common.map((c) => [lineage.keyOf(c.personId), c.generationsFromA, c.generationsFromB]).sort(),
    ).toEqual([
      ['aba', 2, 2],
      ['abi', 2, 2],
    ]);
  });

  it('même personne, personne absente du graphe', () => {
    expect(findRelationships(lineage.graph, lineage.id('aba'), lineage.id('aba'))).toEqual({
      status: 'same_person',
    });
    const absent = '01900000-0000-7000-8000-000000000000';
    expect(findRelationships(lineage.graph, lineage.id('aba'), absent)).toEqual({ status: 'none' });
    expect(findRelationships(lineage.graph, absent, absent)).toEqual({ status: 'none' });
  });
});

describe('polygamie : demi-frères, co-épouses (PAR-03, PAR-04)', () => {
  const family = fixture({
    personnes: ['moussa/M', 'fanta/F', 'awa/F', 'ali/M', 'bintou/F', 'issa/M'],
    unions: [
      { conjoints: ['moussa', 'fanta'], rang_moussa: 1 },
      { conjoints: ['moussa', 'awa'], rang_moussa: 2 },
    ],
    filiations: [
      { parents: ['moussa', 'fanta'], enfant: 'ali' },
      { parents: ['moussa', 'fanta'], enfant: 'issa' },
      { parents: ['moussa', 'awa'], enfant: 'bintou' },
    ],
  });

  it('enfants de deux épouses : un seul parent commun, le père', () => {
    const segment = firstBlood(family, 'ali', 'bintou');
    expect(segment.sharing).toBe('half');
    expect(segment.commonAncestors.map((c) => family.keyOf(c.personId))).toEqual(['moussa']);
  });

  it('le demi-frère n’est pas aussi « fils de l’épouse de votre père » (chemin redondant écarté)', () => {
    expect(paths(family, 'ali', 'bintou')).toEqual(['1/1[moussa]']);
    expect(paths(family, 'ali', 'issa')).toEqual(['1/1[fanta+moussa]']);
  });

  it('co-épouses : deux unions avec la même personne', () => {
    const [relationship, ...rest] = related(
      findRelationships(family.graph, family.id('fanta'), family.id('awa')),
    );
    expect(rest).toEqual([]);
    expect(relationship?.kind).toBe('alliance');
    expect(relationship?.unionCount).toBe(2);
    expect(describeRelationship(relationship as Relationship, family.keyOf)).toBe(
      '0/0[fanta] =moussa 0/0[moussa] =awa 0/0[awa]',
    );
    const ranks = relationship?.segments.flatMap((s) =>
      s.kind === 'union' ? [[s.fromRank, s.toRank]] : [],
    );
    expect(ranks).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it('épouse du père : conjoint d’un parent, la mère elle-même écartée', () => {
    expect(paths(family, 'ali', 'awa')).toEqual(['1/0[moussa] =awa 0/0[awa]']);
    // Fanta est la mère d'Ali : seulement le lien de sang, pas « épouse de votre père ».
    expect(paths(family, 'ali', 'fanta')).toEqual(['1/0[fanta]']);
  });

  it('conjoint, et chef de famille vers une épouse', () => {
    expect(paths(family, 'moussa', 'awa')).toEqual(['0/0[moussa] =awa 0/0[awa]']);
  });
});

describe('places à compléter et parents non précisés', () => {
  it('deux personnes à compléter différentes ne sont jamais supposées identiques', () => {
    const f = fixture(
      {
        personnes: ['paul/M', 'x/N', 'y/N', 'lea/F', 'tom/M'],
        filiations: [
          { parents: ['paul', 'x'], enfant: 'lea' },
          { parents: ['paul', 'y'], enfant: 'tom' },
        ],
      },
      { placeholders: ['x', 'y'] },
    );
    const segment = firstBlood(f, 'lea', 'tom');
    expect(segment.sharing).toBe('half');
    expect(segment.commonAncestors.map((c) => f.keyOf(c.personId))).toEqual(['paul']);
  });

  it('une même place à compléter partagée fait des frères (UNI-12)', () => {
    const f = fixture(
      {
        personnes: ['x/N', 'y/N', 'lea/F', 'tom/M'],
        filiations: [
          { parents: ['x', 'y'], enfant: 'lea' },
          { parents: ['x', 'y'], enfant: 'tom' },
        ],
      },
      { placeholders: ['x', 'y'] },
    );
    expect(firstBlood(f, 'lea', 'tom').sharing).toBe('full');
  });

  it('les parents candidats sont consultables, jamais traversés', () => {
    const tree = fixture({
      personnes: ['pierre/M', 'rose/F', 'odile/F', 'joseph/M', 'samuel/M'],
      unions: [{ conjoints: ['pierre', 'rose'] }, { conjoints: ['pierre', 'odile'] }],
      filiations: [
        { parents: ['pierre', 'odile'], enfant: 'joseph' },
        { parents: ['pierre'], enfant: 'samuel' },
      ],
    });
    expect(firstBlood(tree, 'joseph', 'samuel').sharing).toBe('half');
  });
});

describe('lévirat, sororat, implexe : tous les chemins (UNI-21)', () => {
  it('lévirat : demi-frères par la mère et cousins par les pères, le plus proche d’abord', () => {
    const f = fixture({
      personnes: ['gp/M', 'gm/F', 'oumar/M', 'yaya/M', 'kadi/F', 'sidi/M', 'hawa/F'],
      unions: [
        { conjoints: ['gp', 'gm'] },
        { conjoints: ['oumar', 'kadi'] },
        { conjoints: ['yaya', 'kadi'] },
      ],
      filiations: [
        { parents: ['gp', 'gm'], enfant: 'oumar' },
        { parents: ['gp', 'gm'], enfant: 'yaya' },
        { parents: ['oumar', 'kadi'], enfant: 'sidi' },
        { parents: ['yaya', 'kadi'], enfant: 'hawa' },
      ],
    });
    const found = paths(f, 'sidi', 'hawa');
    expect(found[0]).toBe('1/1[kadi]');
    expect(found[1]).toBe('2/2[gm+gp]');
    // Les chemins par alliance viennent après le sang (« fils du mari de votre mère »…).
    const kinds = related(findRelationships(f.graph, f.id('sidi'), f.id('hawa'))).map(
      (r) => r.kind,
    );
    expect(kinds.indexOf('alliance') === -1 || kinds.indexOf('alliance') > 1).toBe(true);
    expect(kinds.slice(0, 2)).toEqual(['blood', 'blood']);
  });

  it('implexe (mariage entre cousins germains) : chaque ancêtre une seule fois', () => {
    const f = fixture({
      personnes: ['g1/M', 'g2/F', 'p1/M', 'p2/F', 'c1/M', 'c2/F', 'k/M'],
      unions: [{ conjoints: ['g1', 'g2'] }, { conjoints: ['c1', 'c2'] }],
      filiations: [
        { parents: ['g1', 'g2'], enfant: 'p1' },
        { parents: ['g1', 'g2'], enfant: 'p2' },
        { parents: ['p1'], enfant: 'c1' },
        { parents: ['p2'], enfant: 'c2' },
        { parents: ['c1', 'c2'], enfant: 'k' },
      ],
    });
    const ancestors = f.graph.ancestors(f.id('k'));
    const ids = ancestors.map((a) => a.personId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.map((id) => f.keyOf(id)).sort()).toEqual(['c1', 'c2', 'g1', 'g2', 'p1', 'p2']);
    expect(ancestors.find((a) => a.personId === f.id('g1'))?.generations).toBe(3);
    // K est le fils de C2 et aussi le fils de son cousin germain : les deux chemins sont gardés.
    // « Fils du mari de votre mère » est écarté : C1 est aussi son père.
    expect(paths(f, 'k', 'c2')).toEqual(['1/0[c2]', '3/2[g1+g2]']);
  });
});

describe('alliance : conjoint, parents du conjoint, conjoint d’un parent, famille recomposée', () => {
  const f = fixture({
    personnes: [
      'jean/M',
      'marie/F',
      'luc/M',
      'anne/F',
      'paul/M',
      'sara/F',
      'eve/F',
      'noe/M',
      'iris/F',
    ],
    unions: [
      { conjoints: ['jean', 'marie'] }, // parents de luc
      { conjoints: ['luc', 'anne'] }, // luc épouse anne
      { conjoints: ['paul', 'sara'] }, // parents d'anne
      { conjoints: ['jean', 'eve'] }, // seconde union de jean
    ],
    filiations: [
      { parents: ['jean', 'marie'], enfant: 'luc' },
      { parents: ['paul', 'sara'], enfant: 'anne' },
      { parents: ['eve'], enfant: 'noe' }, // enfant d'eve, d'une autre union
      { parents: ['paul', 'sara'], enfant: 'iris' }, // sœur d'anne
    ],
  });

  it('conjoint', () => {
    expect(paths(f, 'luc', 'anne')).toEqual(['0/0[luc] =anne 0/0[anne]']);
  });

  it('parent du conjoint, et l’inverse', () => {
    expect(paths(f, 'luc', 'paul')).toEqual(['0/0[luc] =anne 1/0[paul]']);
    expect(paths(f, 'paul', 'luc')).toEqual(['0/1[paul] =luc 0/0[luc]']);
  });

  it('frère ou sœur du conjoint (sang au sommet : deux parents communs)', () => {
    const [relationship] = related(findRelationships(f.graph, f.id('luc'), f.id('iris')));
    const last = relationship?.segments[2];
    expect(last?.kind === 'blood' && last.sharing).toBe('full');
  });

  it('enfant du conjoint d’un parent : alliance, jamais un lien de sang (CL-FAM-01, structure)', () => {
    const relationships = related(findRelationships(f.graph, f.id('luc'), f.id('noe')));
    expect(relationships.every((r) => r.kind === 'alliance')).toBe(true);
    expect(relationships.map((r) => describeRelationship(r, f.keyOf))).toEqual([
      '1/0[jean] =eve 0/1[eve]',
    ]);
  });
});

describe('certitude, types de filiation, options', () => {
  const f = fixture({
    personnes: ['ma/F', 'pa/M', 'lu/M', 'li/F', 'ado/M'],
    filiations: [
      { parents: ['ma'], enfant: 'lu' },
      { parents: ['ma'], enfant: 'li', certitude: 'probable' },
      { parents: ['pa'], enfant: 'lu', certitude: 'hypothetique' },
      { parents: ['pa'], enfant: 'li' },
      { parents: ['ma'], enfant: 'ado', type: 'adoptive' },
    ],
  });

  it('certitude la plus faible du chemin (PAR-08)', () => {
    const [relationship] = related(findRelationships(f.graph, f.id('lu'), f.id('li')));
    expect(relationship?.certainty).toBe('hypothetical');
  });

  it('type de filiation traversé, jamais confondu avec la naissance (PAR-06)', () => {
    const [relationship] = related(findRelationships(f.graph, f.id('lu'), f.id('ado')));
    expect(relationship?.filiationTypes).toEqual(['birth', 'adoptive']);
  });

  it('on peut ne suivre que les liens de naissance (degré santé, V3)', () => {
    expect(
      findRelationships(f.graph, f.id('lu'), f.id('ado'), { filiationTypes: ['birth'] }),
    ).toEqual({
      status: 'none',
    });
  });

  it('deux parents communs de types différents ne font pas des frères « full »', () => {
    const g = fixture({
      personnes: ['ma/F', 'pa/M', 'x/M', 'y/F'],
      filiations: [
        { parents: ['ma', 'pa'], enfant: 'x' },
        { parents: ['ma'], enfant: 'y' },
        { parents: ['pa'], enfant: 'y', type: 'a_eleve' },
      ],
    });
    const blood = related(findRelationships(g.graph, g.id('x'), g.id('y'))).filter(
      (r) => r.kind === 'blood',
    );
    expect(blood).toHaveLength(2);
    expect(
      blood.map((r) => (r.segments[0]?.kind === 'blood' ? r.segments[0].sharing : '')),
    ).toEqual(['half', 'half']);
    expect(blood[0]?.filiationTypes).toEqual(['birth']);
  });
});

describe('visibilité : le graphe ne contient que ce que le lecteur voit (PAR-09)', () => {
  const section = {
    personnes: ['gp/M', 'pere/M', 'oncle/M', 'moi/F', 'cousin/M'],
    filiations: [
      { parents: ['gp'], enfant: 'pere' },
      { parents: ['gp'], enfant: 'oncle' },
      { parents: ['pere'], enfant: 'moi' },
      { parents: ['oncle'], enfant: 'cousin' },
    ],
  };

  it('une personne masquée sur le seul chemin : aucun lien, sans autre indice', () => {
    const f = fixture(section, { hidden: ['gp'] });
    // Les filiations qui citent gp sont restées dans l'entrée : le moteur les ignore.
    expect(findRelationships(f.graph, f.id('moi'), f.id('cousin'))).toEqual({ status: 'none' });
    expect(closestCommonAncestors(f.graph, f.id('moi'), f.id('cousin'))).toEqual([]);
    expect(f.graph.ancestors(f.id('moi')).map((a) => f.keyOf(a.personId))).toEqual(['pere']);
  });

  it('la même requête vers une personne masquée et vers une personne sans lien répond pareil', () => {
    const f = fixture(
      { ...section, personnes: [...section.personnes, 'seul/F'] },
      { hidden: ['cousin'] },
    );
    expect(findRelationships(f.graph, f.id('moi'), f.id('cousin'))).toEqual(
      findRelationships(f.graph, f.id('moi'), f.id('seul')),
    );
  });
});

describe('données corrompues', () => {
  it('un cycle de filiation ne bloque pas le calcul', () => {
    const f = fixture({
      personnes: ['a/M', 'b/M', 'c/M'],
      filiations: [
        { parents: ['a'], enfant: 'b' },
        { parents: ['b'], enfant: 'c' },
        { parents: ['c'], enfant: 'a' },
      ],
    });
    expect(
      f.graph
        .ancestors(f.id('a'))
        .map((x) => f.keyOf(x.personId))
        .sort(),
    ).toEqual(['b', 'c']);
    const result = findRelationships(f.graph, f.id('a'), f.id('c'));
    expect(result.status).toBe('related');
    for (const relationship of related(result)) {
      expect(relationshipIssues(f.graph, relationship, f.id('a'), f.id('c'))).toEqual([]);
    }
  });
});
