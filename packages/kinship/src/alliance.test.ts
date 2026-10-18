// Liens par alliance nommés structurellement (T-021, ADR 0020 ; TRD, « Moteur de parenté »,
// question 1 : conjoint, parents du conjoint, conjoint d'un parent, co-épouse ; PRD, PAR-04).
// Petits arbres au format des scénarios ; la simultanéité vient des dates des unions, des décès
// et des réponses gardées (ADR 0012), lus par `createAllianceContext`.
import type { Id } from '@lignee/domain';
import type { TreeData } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { classifyAlliance, createAllianceContext, type AllianceContext } from './alliance';
import { createKinshipGraph } from './graph';
import { findRelationships } from './kinship';
import { invertAlliance, invertRelationship, type AllianceLink } from './relationship';
import { fixture, type Fixture } from './test-support/fixtures';

const year = (value: string) => ({ qualificatif: 'exacte', date: value });

function contextOf(f: Fixture, data: TreeData = f.data): AllianceContext {
  return createAllianceContext(data);
}

/** Liens par alliance de A vers B, dans l'ordre des chemins. */
function alliances(f: Fixture, a: string, b: string, context = contextOf(f)): AllianceLink[] {
  const result = findRelationships(f.graph, f.id(a), f.id(b), { allianceContext: context });
  if (result.status !== 'related') return [];
  return result.relationships.flatMap((relationship) =>
    relationship.alliance === undefined ? [] : [relationship.alliance],
  );
}

/** Le premier lien par alliance de A vers B. */
function closest(f: Fixture, a: string, b: string, context = contextOf(f)): AllianceLink {
  const [link] = alliances(f, a, b, context);
  if (link === undefined) throw new Error(`No alliance from ${a} to ${b}`);
  return link;
}

/** Un homme, ses épouses et un enfant de chacune ; `section` complète l'arbre. */
function polygamous(section: Record<string, unknown> = {}) {
  return fixture({
    personnes: ['moussa/M', 'mariam/F', 'fatou/F', 'aicha/F', 'ali/M'],
    unions: [{ conjoints: ['moussa', 'mariam'] }, { conjoints: ['moussa', 'fatou'] }],
    filiations: [
      { parents: ['moussa', 'mariam'], enfant: 'aicha' },
      { parents: ['moussa', 'fatou'], enfant: 'ali' },
    ],
    ...section,
  });
}

describe('conjoint', () => {
  it('sans fin connue : jamais présumée en cours, mais rien de plus n’est affirmé', () => {
    const f = polygamous();
    const link = closest(f, 'moussa', 'mariam');
    expect(link.kind).toBe('spouse');
    expect(link.crossings).toHaveLength(1);
    expect(link.crossings[0]?.unions.map((union) => union.ending)).toEqual([
      { status: 'no_end_known' },
    ]);
  });

  it('terminée par divorce, séparation, décès (motif ou fait de décès), ou fin sans motif', () => {
    const f = fixture({
      personnes: ['a/M', 'b/F', 'c/M', 'd/F', 'e/M', 'g/F', 'h/M', 'k/F'],
      unions: [
        { conjoints: ['a', 'b'], motif: 'divorce' },
        { conjoints: ['c', 'd'], motif: 'separation' },
        { conjoints: ['e', 'g'], fin: year('2001') },
        { conjoints: ['h', 'k'] },
      ],
      faits: [{ personne: 'k', type: 'deces', date: year('2010') }],
    });
    const ending = (a: string, b: string) => closest(f, a, b).crossings[0]?.unions[0]?.ending;
    expect(ending('a', 'b')).toEqual({ status: 'ended', reason: 'divorce' });
    expect(ending('c', 'd')).toEqual({ status: 'ended', reason: 'separation' });
    expect(ending('e', 'g')).toEqual({ status: 'ended', reason: 'unspecified' });
    expect(ending('h', 'k')).toEqual({ status: 'ended', reason: 'death' });
    // Sans le fait de décès (masqué ou jamais saisi), rien n'est affirmé.
    expect(closest(f, 'h', 'k', createAllianceContext({})).crossings[0]?.unions[0]?.ending).toEqual(
      { status: 'no_end_known' },
    );
  });

  it('un couple remarié : un seul passage, ses deux unions et leur état, rangs renumérotés', () => {
    const f = fixture({
      personnes: ['p/M', 'q/F'],
      unions: [
        { conjoints: ['p', 'q'], debut: year('1980'), fin: year('1985'), motif: 'divorce' },
        { conjoints: ['p', 'q'], debut: year('1990') },
      ],
    });
    const result = findRelationships(f.graph, f.id('p'), f.id('q'));
    if (result.status !== 'related') throw new Error('Expected a link');
    expect(result.relationships).toHaveLength(1);
    const [relationship] = result.relationships;
    const crossing = relationship?.alliance?.crossings[0];
    expect(crossing?.unions.map((union) => union.unionId)).toEqual(relationship?.unionIds);
    expect(crossing?.unions.map((union) => union.ending.status).sort()).toEqual([
      'ended',
      'no_end_known',
    ]);
  });
});

describe('parents du conjoint, gendre et bru', () => {
  it('parent du conjoint ↔ conjoint de l’enfant', () => {
    const f = fixture({
      personnes: ['beau/M', 'belle/F', 'epoux/M', 'epouse/F'],
      unions: [{ conjoints: ['beau', 'belle'] }, { conjoints: ['epoux', 'epouse'] }],
      filiations: [{ parents: ['beau', 'belle'], enfant: 'epouse' }],
    });
    expect(closest(f, 'epoux', 'beau').kind).toBe('parent_of_spouse');
    expect(closest(f, 'epoux', 'belle').kind).toBe('parent_of_spouse');
    expect(closest(f, 'beau', 'epoux').kind).toBe('spouse_of_child');
    // Le parent du conjoint n'est pas atteint en descendant d'une union : pas de côté enfant.
    const crossing = closest(f, 'epoux', 'beau').crossings[0];
    expect(crossing?.fromChild).toBeUndefined();
    expect(crossing?.toChild).toBeUndefined();
  });
});

describe('PAR-04 — conjoint d’un parent : « épouse de votre père », jamais « belle-mère »', () => {
  it('l’épouse du père est « conjoint d’un parent », jamais « parent du conjoint »', () => {
    const f = polygamous();
    const link = closest(f, 'aicha', 'fatou');
    expect(link.kind).toBe('spouse_of_parent');
    expect(link.crossings[0]).toMatchObject({ fromId: f.id('moussa'), toId: f.id('fatou') });
    expect(closest(f, 'fatou', 'aicha').kind).toBe('child_of_spouse');
  });

  it('la mère n’est jamais aussi « épouse de votre père »', () => {
    const f = polygamous();
    expect(alliances(f, 'aicha', 'mariam')).toEqual([]);
    expect(alliances(f, 'mariam', 'aicha')).toEqual([]);
  });

  it('union du père simultanée avec celle de la mère (réponse gardée)', () => {
    const f = polygamous({
      simultaneites: [
        {
          unions: [
            ['moussa', 'mariam'],
            ['moussa', 'fatou'],
          ],
          reponse: 'simultanees',
        },
      ],
    });
    const side = closest(f, 'aicha', 'fatou').crossings[0]?.fromChild;
    expect(side?.timing).toBe('simultaneous');
    expect(side?.childId).toBe(f.id('aicha'));
    expect(side?.parentId).toBe(f.id('moussa'));
    expect(side?.unions).toHaveLength(1);
    expect(side?.unions[0]).toMatchObject({
      otherParentId: f.id('mariam'),
      timing: { source: 'answer', value: 'simultaneous' },
    });
  });

  it('union successive (dates : divorce, puis remariage), inconnue sans dates ni réponse', () => {
    const dated = polygamous({
      unions: [
        { conjoints: ['moussa', 'mariam'], debut: year('1980'), fin: year('1990') },
        { conjoints: ['moussa', 'fatou'], debut: year('1992') },
      ],
    });
    expect(closest(dated, 'aicha', 'fatou').crossings[0]?.fromChild?.timing).toBe('successive');
    expect(closest(polygamous(), 'aicha', 'fatou').crossings[0]?.fromChild?.timing).toBe('unknown');
  });

  it('le père sans union avec la mère : aucune union à comparer', () => {
    const f = fixture({
      personnes: ['pere/M', 'mere/F', 'epouse/F', 'enfant/M'],
      unions: [{ conjoints: ['pere', 'epouse'] }],
      filiations: [{ parents: ['pere', 'mere'], enfant: 'enfant' }],
    });
    const side = closest(f, 'enfant', 'epouse').crossings[0]?.fromChild;
    expect(side?.timing).toBe('none');
    expect(side?.unions).toEqual([]);
  });

  it('« mari de votre mère » : sans règle de genre, le même calcul', () => {
    const f = fixture({
      personnes: ['mere/F', 'pere/M', 'mari/M', 'enfant/F'],
      unions: [
        { conjoints: ['mere', 'pere'], debut: year('1980'), fin: year('1990'), motif: 'deces' },
        { conjoints: ['mere', 'mari'], debut: year('1995') },
      ],
      filiations: [{ parents: ['pere', 'mere'], enfant: 'enfant' }],
    });
    const link = closest(f, 'enfant', 'mari');
    expect(link.kind).toBe('spouse_of_parent');
    expect(link.crossings[0]?.fromChild?.timing).toBe('successive');
  });

  it('conjoint d’un grand-parent (« la 2e femme de mon grand-père ») : forme générale, côté enfant', () => {
    const f = fixture({
      personnes: ['gp/M', 'gm/F', 'seconde/F', 'pere/M', 'moi/M'],
      unions: [{ conjoints: ['gp', 'gm'] }, { conjoints: ['gp', 'seconde'] }],
      filiations: [
        { parents: ['gp', 'gm'], enfant: 'pere' },
        { parents: ['pere'], enfant: 'moi' },
      ],
    });
    const link = closest(f, 'moi', 'seconde');
    expect(link.kind).toBe('other');
    expect(link.crossings[0]?.fromChild).toMatchObject({
      childId: f.id('pere'),
      parentId: f.id('gp'),
      timing: 'unknown',
    });
  });
});

describe('CL-FAM-01 — enfant du conjoint d’un parent, jamais « demi-frère »', () => {
  it('« fils de l’épouse de votre père », et l’inverse', () => {
    const f = fixture({
      personnes: ['paul/M', 'anne/F', 'carine/F', 'marc/M', 'emma/F', 'luc/M'],
      unions: [
        { conjoints: ['paul', 'anne'] },
        { conjoints: ['carine', 'marc'] },
        { conjoints: ['paul', 'carine'] },
      ],
      filiations: [
        { parents: ['paul', 'anne'], enfant: 'emma' },
        { parents: ['carine', 'marc'], enfant: 'luc' },
      ],
    });
    const result = findRelationships(f.graph, f.id('emma'), f.id('luc'));
    if (result.status !== 'related') throw new Error('Expected a link');
    expect(result.relationships.map((relationship) => relationship.kind)).toEqual(['alliance']);
    const link = closest(f, 'emma', 'luc');
    expect(link.kind).toBe('step_sibling');
    expect(link.crossings[0]?.fromChild?.childId).toBe(f.id('emma'));
    expect(link.crossings[0]?.toChild?.childId).toBe(f.id('luc'));
    expect(closest(f, 'luc', 'emma').kind).toBe('step_sibling');
  });

  it('le demi-frère par le père n’est jamais aussi « fils de l’épouse de votre père »', () => {
    const f = polygamous();
    const result = findRelationships(f.graph, f.id('aicha'), f.id('ali'));
    if (result.status !== 'related') throw new Error('Expected a link');
    expect(result.relationships.map((relationship) => relationship.kind)).toEqual(['blood']);
  });
});

describe('beau-frère, belle-sœur : chaque sens à part, sans trancher', () => {
  const f = fixture({
    personnes: ['moi/M', 'epouse/F', 'frere/M', 'soeur/F', 'mari/M', 'pere/M', 'mere/F'],
    unions: [{ conjoints: ['moi', 'epouse'] }, { conjoints: ['soeur', 'mari'] }],
    filiations: [
      { parents: ['pere', 'mere'], enfant: 'moi' },
      { parents: ['pere', 'mere'], enfant: 'soeur' },
      { parents: ['pere'], enfant: 'frere' },
    ],
  });

  it('frère du conjoint ↔ conjoint du frère, quel que soit le partage', () => {
    expect(closest(f, 'epouse', 'soeur').kind).toBe('sibling_of_spouse');
    expect(closest(f, 'epouse', 'frere').kind).toBe('sibling_of_spouse');
    expect(closest(f, 'soeur', 'epouse').kind).toBe('spouse_of_sibling');
    expect(closest(f, 'moi', 'mari').kind).toBe('spouse_of_sibling');
    expect(closest(f, 'mari', 'moi').kind).toBe('sibling_of_spouse');
  });

  it('conjoint du frère du conjoint (deux unions)', () => {
    expect(closest(f, 'epouse', 'mari').kind).toBe('spouse_of_sibling_of_spouse');
    expect(closest(f, 'mari', 'epouse').kind).toBe('spouse_of_sibling_of_spouse');
  });
});

describe('PAR-04 — co-épouse : deux unions simultanées avec la même personne', () => {
  const answered = (reponse: 'simultanees' | 'successives') =>
    polygamous({
      simultaneites: [
        {
          unions: [
            ['moussa', 'mariam'],
            ['moussa', 'fatou'],
          ],
          reponse,
        },
      ],
    });

  it('co-épouse quand la réponse gardée dit « simultanées », dans les deux sens', () => {
    const f = answered('simultanees');
    const link = closest(f, 'mariam', 'fatou');
    expect(link.kind).toBe('co_spouse');
    expect(link.sharedSpouse?.spouseId).toBe(f.id('moussa'));
    expect(link.sharedSpouse?.timing).toBe('simultaneous');
    expect(link.sharedSpouse?.pairs).toHaveLength(1);
    expect(link.sharedSpouse?.pairs[0]?.timing).toEqual({
      source: 'answer',
      value: 'simultaneous',
    });
    expect(closest(f, 'fatou', 'mariam').kind).toBe('co_spouse');
  });

  it('co-épouse quand les dates le montrent, sans réponse', () => {
    const f = polygamous({
      unions: [
        { conjoints: ['moussa', 'mariam'], debut: year('1970'), fin: year('2000') },
        { conjoints: ['moussa', 'fatou'], debut: year('1980'), fin: year('2005') },
      ],
    });
    const link = closest(f, 'mariam', 'fatou');
    expect(link.kind).toBe('co_spouse');
    expect(link.sharedSpouse?.pairs[0]?.timing).toEqual({ source: 'dates', value: 'simultaneous' });
  });

  it('« autre épouse de votre mari » quand les unions sont successives ou quand rien ne le dit', () => {
    const successive = closest(answered('successives'), 'mariam', 'fatou');
    expect(successive.kind).toBe('spouse_of_spouse');
    expect(successive.sharedSpouse?.timing).toBe('successive');
    const unknown = closest(polygamous(), 'mariam', 'fatou');
    expect(unknown.kind).toBe('spouse_of_spouse');
    expect(unknown.sharedSpouse?.timing).toBe('unknown');
    expect(unknown.sharedSpouse?.pairs[0]?.timing).toEqual({ source: 'unknown' });
  });

  it('chevauchement en chaîne : la 1re et la 3e épouse ne sont pas co-épouses', () => {
    const f = fixture({
      personnes: ['h/M', 'w1/F', 'w2/F', 'w3/F'],
      unions: [
        { conjoints: ['h', 'w1'], debut: year('1950'), fin: year('1965') },
        { conjoints: ['h', 'w2'], debut: year('1960'), fin: year('1980') },
        { conjoints: ['h', 'w3'], debut: year('1970'), fin: year('1990') },
      ],
    });
    expect(closest(f, 'w1', 'w2').kind).toBe('co_spouse');
    expect(closest(f, 'w2', 'w3').kind).toBe('co_spouse');
    expect(closest(f, 'w1', 'w3').kind).toBe('spouse_of_spouse');
  });

  it('sans règle de genre : deux maris d’une même femme, deux épouses d’une femme', () => {
    const f = fixture({
      personnes: ['femme/F', 'm1/M', 'm2/M', 'e1/F', 'e2/F'],
      unions: [
        { conjoints: ['femme', 'm1'] },
        { conjoints: ['femme', 'm2'] },
        { conjoints: ['e1', 'e2'] },
        { conjoints: ['e1', 'm1'] },
      ],
      simultaneites: [
        {
          unions: [
            ['femme', 'm1'],
            ['femme', 'm2'],
          ],
          reponse: 'simultanees',
        },
        {
          unions: [
            ['e1', 'e2'],
            ['e1', 'm1'],
          ],
          reponse: 'simultanees',
        },
      ],
    });
    expect(closest(f, 'm1', 'm2').kind).toBe('co_spouse');
    expect(closest(f, 'e2', 'm1').kind).toBe('co_spouse');
  });

  it('le sang avant l’alliance : deux sœurs épouses du même homme (sororat)', () => {
    const f = fixture({
      personnes: ['pere/M', 'mere/F', 's1/F', 's2/F', 'h/M'],
      unions: [{ conjoints: ['h', 's1'] }, { conjoints: ['h', 's2'] }],
      filiations: [
        { parents: ['pere', 'mere'], enfant: 's1' },
        { parents: ['pere', 'mere'], enfant: 's2' },
      ],
      simultaneites: [
        {
          unions: [
            ['h', 's1'],
            ['h', 's2'],
          ],
          reponse: 'simultanees',
        },
      ],
    });
    const result = findRelationships(f.graph, f.id('s1'), f.id('s2'), {
      allianceContext: contextOf(f),
    });
    if (result.status !== 'related') throw new Error('Expected a link');
    expect(result.relationships.map((r) => r.kind)).toEqual(['blood', 'alliance']);
    expect(result.relationships[0]?.alliance).toBeUndefined();
    expect(result.relationships[1]?.alliance?.kind).toBe('co_spouse');
  });
});

describe('PAR-09 — une union masquée ne produit aucun lien d’alliance', () => {
  const f = fixture({
    personnes: ['h/M', 'w1/F', 'w2/F', 'w3/F', 'c1/M'],
    unions: [{ conjoints: ['h', 'w1'] }, { conjoints: ['h', 'w2'] }, { conjoints: ['h', 'w3'] }],
    filiations: [{ parents: ['h', 'w1'], enfant: 'c1' }],
    simultaneites: [
      {
        unions: [
          ['h', 'w1'],
          ['h', 'w2'],
          ['h', 'w3'],
        ],
        reponse: 'simultanees',
      },
    ],
  });
  const hidden = f.data.unions.find((union) =>
    union.spouses.some((spouse) => spouse.personId === f.id('w2')),
  );
  if (hidden === undefined) throw new Error('Missing union');
  const masked = {
    ...f,
    graph: createKinshipGraph({
      ...f.data,
      unions: f.data.unions.filter((union) => union.id !== hidden.id),
    }),
  };
  // Le filtre retire aussi les réponses qui citent l'union masquée (ADR 0012) ; le moteur ne les
  // lit de toute façon jamais : le contexte non filtré donne la même réponse.
  const filtered = createAllianceContext({
    ...f.data,
    simultaneityAnswers: f.data.simultaneityAnswers.filter(
      (answer) => !answer.unionIds.includes(hidden.id),
    ),
  });
  const unfiltered = createAllianceContext(f.data);

  it('aucun lien vers l’épouse dont l’union est masquée, ni par elle', () => {
    for (const context of [filtered, unfiltered]) {
      expect(alliances(masked, 'w1', 'w2', context)).toEqual([]);
      expect(alliances(masked, 'c1', 'w2', context)).toEqual([]);
      const link = closest(masked, 'w1', 'w3', context);
      expect(link.kind).toBe('co_spouse');
      const cited = JSON.stringify(link);
      expect(cited).not.toContain(hidden.id);
    }
  });

  it('même réponse avec le contexte filtré ou non', () => {
    for (const [a, b] of [
      ['w1', 'w3'],
      ['c1', 'w3'],
      ['w3', 'c1'],
      ['h', 'w3'],
    ] as const) {
      expect(
        findRelationships(masked.graph, f.id(a), f.id(b), { allianceContext: unfiltered }),
      ).toEqual(findRelationships(masked.graph, f.id(a), f.id(b), { allianceContext: filtered }));
    }
  });
});

describe('symétrie et forme', () => {
  const f = polygamous({
    personnes: ['moussa/M', 'mariam/F', 'fatou/F', 'aicha/F', 'ali/M', 'gendre/M'],
    unions: [
      { conjoints: ['moussa', 'mariam'] },
      { conjoints: ['moussa', 'fatou'] },
      { conjoints: ['aicha', 'gendre'], motif: 'divorce' },
    ],
    simultaneites: [
      {
        unions: [
          ['moussa', 'mariam'],
          ['moussa', 'fatou'],
        ],
        reponse: 'simultanees',
      },
    ],
  });
  const names = ['moussa', 'mariam', 'fatou', 'aicha', 'ali', 'gendre'];

  it('le lien de B vers A est l’inverse exact ; classer le chemin inversé donne le lien inversé', () => {
    const context = contextOf(f);
    for (const a of names) {
      for (const b of names) {
        if (a === b) continue;
        const forward = findRelationships(f.graph, f.id(a), f.id(b), { allianceContext: context });
        const backward = findRelationships(f.graph, f.id(b), f.id(a), { allianceContext: context });
        if (forward.status !== 'related' || backward.status !== 'related') {
          expect(backward.status).toBe(forward.status);
          continue;
        }
        expect(backward.relationships).toEqual(forward.relationships.map(invertRelationship));
        for (const relationship of forward.relationships) {
          const alliance = classifyAlliance(f.graph, relationship, context);
          expect(alliance).toEqual(relationship.alliance);
          if (alliance === undefined) continue;
          expect(classifyAlliance(f.graph, invertRelationship(relationship), context)).toEqual(
            invertAlliance(alliance),
          );
        }
      }
    }
  });

  it('un chemin de sang n’a pas de lien d’alliance ; un chemin par alliance en a toujours un', () => {
    for (const a of names) {
      for (const b of names) {
        const result = findRelationships(f.graph, f.id(a), f.id(b));
        if (result.status !== 'related') continue;
        for (const relationship of result.relationships) {
          expect(relationship.alliance === undefined).toBe(relationship.kind === 'blood');
        }
      }
    }
  });

  it('gendre : conjoint de l’enfant, union terminée par divorce', () => {
    const link = closest(f, 'moussa', 'gendre');
    expect(link.kind).toBe('spouse_of_child');
    expect(link.crossings[0]?.unions[0]?.ending).toEqual({ status: 'ended', reason: 'divorce' });
    expect(closest(f, 'gendre', 'mariam').kind).toBe('parent_of_spouse');
    // Fatou, épouse du père de l'épouse : forme générale, jamais « belle-mère ».
    expect(alliances(f, 'gendre', 'fatou').map((link) => link.kind)).not.toContain(
      'parent_of_spouse',
    );
  });

  it('les identifiants d’un lien par alliance sont tous des personnes et unions du graphe', () => {
    const ids = new Set<Id>([
      ...names.map((name) => f.id(name)),
      ...f.data.unions.map((union) => union.id),
    ]);
    const link = closest(f, 'aicha', 'fatou');
    const cited = JSON.stringify(link).match(/[0-9a-f]{8}-[0-9a-f-]{27}/g) ?? [];
    expect(cited.length).toBeGreaterThan(4);
    for (const id of cited) expect(ids.has(id)).toBe(true);
  });
});
