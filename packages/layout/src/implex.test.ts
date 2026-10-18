// Étape 6 (T-019) : liens hors des foyers et renvois « voir aussi » ; vue « descendance »
// (ARB-14). Arbres inventés, construits au format des scénarios.
import type { Id } from '@lignee/domain';
import {
  buildScenarioTree,
  scenarioTreeSchema,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { findDescendants, layoutDescendants } from './descendants';
import type { TreeLayout } from './layout-types';
import { MAX_LINE_CROSSINGS, MAX_LINE_ROW_SPAN } from './links';
import {
  expectDisposition,
  expectLayoutInvariants,
  familyKeyOf,
} from './test-support/layout-checks';
import { neverEntered, withoutObjects, withoutPeople } from './test-support/layout-scenario';
import { layoutTree, prepareTree } from './tree-layout';

function tree(section: unknown): ScenarioTree {
  return buildScenarioTree(scenarioTreeSchema.parse(section));
}

function unfoldedLayout(scenario: ScenarioTree, center: string): TreeLayout {
  const centerId = scenario.id(center);
  const prepared = prepareTree(scenario.data, centerId);
  const folds = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
  return layoutTree(scenario.data, centerId, { folds });
}

function serialized(layout: TreeLayout): string {
  return JSON.stringify(
    {
      people: [...layout.people.values()],
      families: [...layout.families.values()],
      blocks: layout.blocks,
      links: layout.links,
      structure: { ...layout.structure },
    },
    (_key, value: unknown) =>
      value instanceof Map
        ? [...(value as Map<unknown, unknown>).entries()]
        : value instanceof Set
          ? [...(value as Set<unknown>)]
          : value,
  );
}

describe('étape 6 : renvoi « voir aussi »', () => {
  it('un lien qui traverse plus de deux rangées devient un renvoi, pas une seconde fiche', () => {
    // Théo, fils d'Anne (l'épouse de Luc), a été élevé par Hortense, la grand-mère de Luc. Vu
    // depuis Luc, Hortense est deux rangées au-dessus, Théo une rangée en dessous : le trait
    // traverserait trois rangées.
    const scenario = tree({
      personnes: ['gilbert/M', 'hortense/F', 'paul/M', 'mireille/F', 'luc/M', 'anne/F', 'theo/M'],
      unions: [
        { conjoints: ['gilbert', 'hortense'] },
        { conjoints: ['paul', 'mireille'] },
        { conjoints: ['luc', 'anne'] },
      ],
      filiations: [
        { parents: ['gilbert', 'hortense'], enfant: 'paul' },
        { parents: ['paul', 'mireille'], enfant: 'luc' },
        { parents: ['anne'], enfant: 'theo' },
        { parents: ['hortense'], enfant: 'theo', type: 'a_eleve' },
      ],
    });
    const layout = unfoldedLayout(scenario, 'luc');
    expectLayoutInvariants(layout);
    expect(layout.people.size).toBe(7);
    expectDisposition(layout, scenario, {
      liens_hors_foyers: [
        { nature: 'secondaire', de: ['hortense'], vers: 'theo', trace: 'renvoi' },
      ],
    });
    const [link] = layout.links;
    expect(link?.rowSpan).toBe(3);
    expect(link?.rowSpan).toBeGreaterThan(MAX_LINE_ROW_SPAN);
    // Une seule fiche pour Théo et pour Hortense : le renvoi pointe vers elles.
    expect(link?.to).toEqual({
      x: layout.people.get(scenario.id('theo'))?.x,
      y: layout.people.get(scenario.id('theo'))?.y,
    });
  });

  it('un lien qui croiserait trop de traits de foyers devient un renvoi ; rien ne bouge', () => {
    // Huit enfants de Gaston et Berthe, chacun marié avec un enfant. Luc, fils de l'aîné, a été
    // élevé par l'oncle dessiné le plus loin de lui : le trait croiserait ceux des cousins.
    const siblings = ['paul', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
    const section = {
      personnes: [
        'gaston/M',
        'berthe/F',
        ...siblings.map((key) => `${key}/M`),
        ...siblings.map((key) => `${key}_w/F`),
        ...siblings.map((key) => `${key}_c/M`),
      ],
      unions: [
        { conjoints: ['gaston', 'berthe'] },
        ...siblings.map((key) => ({ conjoints: [key, `${key}_w`] })),
      ],
      filiations: [
        ...siblings.map((key) => ({ parents: ['gaston', 'berthe'], enfant: key })),
        ...siblings.map((key) => ({ parents: [key, `${key}_w`], enfant: `${key}_c` })),
      ],
    };
    const before = unfoldedLayout(tree(section), 'paul_c');
    expectLayoutInvariants(before);
    const luc = before.people.get(before.centerId);
    const farthest = siblings
      .slice(1)
      .map((key) => ({
        key,
        distance: Math.abs((before.people.get(tree(section).id(key))?.x ?? 0) - (luc?.x ?? 0)),
      }))
      .sort((a, b) => b.distance - a.distance)[0];
    if (farthest === undefined) throw new Error('Aucun oncle');

    const raised = tree({
      ...section,
      filiations: [
        ...section.filiations,
        { parents: [farthest.key], enfant: 'paul_c', type: 'a_eleve' },
      ],
    });
    const after = unfoldedLayout(raised, 'paul_c');
    expectLayoutInvariants(after);
    // Un lien secondaire ne déplace aucune fiche.
    expect([...after.people.values()]).toEqual([...before.people.values()]);
    const link = after.links.find((candidate) => candidate.nature === 'secondary');
    expect(link?.crossings).toBeGreaterThan(MAX_LINE_CROSSINGS);
    expect(link?.rowSpan).toBe(1);
    expect(link?.drawing).toBe('seeAlso');
  });
});

/** Pierre, ses parents et son frère, trois épouses, quatre générations de descendants. */
const PIERRE = {
  personnes: [
    'jacques/M',
    'lea/F',
    'andre/M',
    'pierre/M',
    'rose/F',
    'odile/F',
    'clarisse/F',
    'jean/M',
    'marthe/F',
    'paul/M',
    'anne/F',
    'bruno/M',
    'carla/F',
    'serge/M',
    'luc/M',
    'lise/F',
    'noe/M',
    'tom/M',
    'zoe/F',
    'ugo/M',
    'yvette/F',
    'vic/M',
  ],
  unions: [
    { conjoints: ['jacques', 'lea'] },
    { conjoints: ['pierre', 'rose'] },
    { conjoints: ['pierre', 'odile'] },
    { conjoints: ['pierre', 'clarisse'] },
    { conjoints: ['bruno', 'carla'] },
    { conjoints: ['jean', 'anne'] },
    { conjoints: ['marthe', 'serge'] },
    { conjoints: ['luc', 'zoe'] },
    { conjoints: ['ugo', 'yvette'] },
  ],
  filiations: [
    { parents: ['jacques', 'lea'], enfant: 'pierre' },
    { parents: ['jacques', 'lea'], enfant: 'andre' },
    { parents: ['bruno', 'carla'], enfant: 'anne' },
    { parents: ['pierre', 'rose'], enfant: 'jean' },
    { parents: ['pierre', 'odile'], enfant: 'marthe' },
    { parents: ['pierre', 'clarisse'], enfant: 'paul' },
    { parents: ['jean', 'anne'], enfant: 'luc' },
    { parents: ['jean', 'anne'], enfant: 'lise' },
    { parents: ['marthe', 'serge'], enfant: 'noe' },
    { parents: ['paul'], enfant: 'tom' },
    { parents: ['luc', 'zoe'], enfant: 'ugo' },
    { parents: ['ugo', 'yvette'], enfant: 'vic' },
  ],
  simultaneites: [
    {
      unions: [
        ['pierre', 'rose'],
        ['pierre', 'odile'],
        ['pierre', 'clarisse'],
      ],
      reponse: 'simultanees',
    },
  ],
};

describe('vue « descendance » (ARB-14)', () => {
  it('la descendance de Pierre montre ses trois foyers et leurs petits-enfants, et rien d’autre', () => {
    const scenario = tree(PIERRE);
    const pierre = scenario.id('pierre');
    const layout = layoutDescendants(scenario.data, pierre);
    expectLayoutInvariants(layout);
    expectDisposition(layout, scenario, {
      visibles: [
        'pierre',
        'rose',
        'odile',
        'clarisse',
        'jean',
        'anne',
        'marthe',
        'serge',
        'paul',
        'luc',
        'zoe',
        'lise',
        'noe',
        'tom',
        'ugo',
        'yvette',
        'vic',
      ],
      lignes: { '0': ['pierre'], '0.5': ['rose', 'odile', 'clarisse'] },
      liens_hors_foyers: [],
    });
    expect(layout.people.get(pierre)?.x).toBe(0);
    // Ses trois foyers, dépliés, chacun avec son enfant dessiné juste en dessous de la mère.
    for (const [wife, child] of [
      ['rose', 'jean'],
      ['odile', 'marthe'],
      ['clarisse', 'paul'],
    ] as const) {
      const family = layout.families.get(familyKeyOf(layout.structure, scenario, ['pierre', wife]));
      expect(family?.folded).toBe(false);
      expect(family?.shownChildren).toEqual([scenario.id(child)]);
      expect(layout.people.get(scenario.id(child))?.row).toBe(1);
    }
    // Leurs petits-enfants, colonne « mère non précisée » de Paul comprise.
    for (const grandchild of ['luc', 'lise', 'noe', 'tom']) {
      expect(layout.people.get(scenario.id(grandchild))?.row).toBe(2);
    }
    // Toutes les générations : la vue ordinaire depuis Pierre replie au-delà de 3.
    expect(layout.people.get(scenario.id('vic'))?.row).toBe(4);
    expect(layoutTree(scenario.data, pierre).people.has(scenario.id('vic'))).toBe(false);
  });

  it('ne garde ni les ascendants de l’ancêtre ni la famille d’un conjoint', () => {
    const scenario = tree(PIERRE);
    const set = findDescendants(scenario.data, scenario.id('pierre'));
    const keys = (ids: ReadonlySet<Id>) => [...ids].map((id) => scenario.keyOf(id)).sort();
    expect(keys(set.descendants)).toEqual(
      ['jean', 'lise', 'luc', 'marthe', 'noe', 'paul', 'pierre', 'tom', 'ugo', 'vic'].sort(),
    );
    for (const outside of ['jacques', 'lea', 'andre', 'bruno', 'carla']) {
      expect(set.people.has(scenario.id(outside))).toBe(false);
    }
  });

  it('un descendant masqué n’apparaît pas, ni ce qui ne passe que par lui (non-fuite)', () => {
    const scenario = tree(PIERRE);
    const pierre = scenario.id('pierre');
    const luc = scenario.id('luc');
    const reader = withoutPeople(scenario.data, new Set([luc]));
    const layout = layoutDescendants(reader, pierre);
    expectLayoutInvariants(layout);
    const text = serialized(layout);
    expect(text).not.toContain(luc);
    // Ugo et Vic ne descendent de Pierre que par Luc : le lecteur ne les voit pas dans cette vue,
    // et Zoé, épouse de Luc, non plus.
    for (const key of ['ugo', 'vic', 'zoe', 'yvette']) {
      expect(layout.people.has(scenario.id(key)), key).toBe(false);
    }
    // Sans masque, ils y sont : le test échouerait si la vue ignorait le graphe reçu.
    const whole = layoutDescendants(scenario.data, pierre);
    for (const key of ['luc', 'ugo', 'vic', 'zoe']) {
      expect(whole.people.has(scenario.id(key)), key).toBe(true);
    }
    // Le foyer de Jean et Anne compte un seul enfant visible.
    const foyer = familyKeyOf(layout.structure, scenario, ['jean', 'anne']);
    expect(layout.families.get(foyer)?.childCount).toBe(1);
  });

  it('fonction pure : le graphe reçu n’est pas modifié, l’ancêtre absent est refusé', () => {
    const scenario = tree(PIERRE);
    const before = JSON.stringify(scenario.data);
    layoutDescendants(scenario.data, scenario.id('pierre'));
    expect(JSON.stringify(scenario.data)).toBe(before);
    expect(() => layoutDescendants(scenario.data, 'absent')).toThrow(RangeError);
  });
});

describe('étape 6 : seuils du renvoi et trait long', () => {
  it('un lien d’exactement deux rangées reste un trait : la grand-mère qui a élevé son petit-fils', () => {
    // Vu depuis Luc : Mireille, mère de son épouse Anne, est une rangée au-dessus ; Théo, fils
    // d'Anne, une rangée en dessous. Mireille a élevé Théo : deux rangées, un trait.
    const scenario = tree({
      personnes: ['mireille/F', 'luc/M', 'anne/F', 'theo/M'],
      unions: [{ conjoints: ['luc', 'anne'] }],
      filiations: [
        { parents: ['mireille'], enfant: 'anne' },
        { parents: ['anne'], enfant: 'theo' },
        { parents: ['mireille'], enfant: 'theo', type: 'a_eleve' },
      ],
    });
    const layout = unfoldedLayout(scenario, 'luc');
    expectLayoutInvariants(layout);
    expectDisposition(layout, scenario, {
      liens_hors_foyers: [{ nature: 'secondaire', de: ['mireille'], vers: 'theo', trace: 'trait' }],
    });
    expect(layout.links[0]?.rowSpan).toBe(MAX_LINE_ROW_SPAN);
  });

  it('un lien qui croise exactement quatre traits reste un trait, un de plus en fait un renvoi', () => {
    // Même famille que plus haut : huit enfants de Gaston et Berthe, chacun avec un enfant. Luc a
    // été élevé par chacun de ses oncles tour à tour ; on garde les tracés à 4 et 5 croisements.
    const siblings = ['paul', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
    const section = {
      personnes: [
        'gaston/M',
        'berthe/F',
        ...siblings.map((key) => `${key}/M`),
        ...siblings.map((key) => `${key}_w/F`),
        ...siblings.map((key) => `${key}_c/M`),
      ],
      unions: [
        { conjoints: ['gaston', 'berthe'] },
        ...siblings.map((key) => ({ conjoints: [key, `${key}_w`] })),
      ],
      filiations: [
        ...siblings.map((key) => ({ parents: ['gaston', 'berthe'], enfant: key })),
        ...siblings.map((key) => ({ parents: [key, `${key}_w`], enfant: `${key}_c` })),
      ],
    };
    const drawings = new Map<number, string>();
    for (const uncle of siblings.slice(1)) {
      const raised = tree({
        ...section,
        filiations: [
          ...section.filiations,
          { parents: [uncle], enfant: 'paul_c', type: 'a_eleve' },
        ],
      });
      const layout = unfoldedLayout(raised, 'paul_c');
      expectLayoutInvariants(layout);
      const link = layout.links.find((candidate) => candidate.nature === 'secondary');
      if (link !== undefined) drawings.set(link.crossings, link.drawing);
    }
    expect(drawings.get(MAX_LINE_CROSSINGS)).toBe('line');
    expect(drawings.get(MAX_LINE_CROSSINGS + 1)).toBe('seeAlso');
  });

  it('un enfant dessiné sur une rangée non voisine de sa famille est relié par un trait long', () => {
    // Nadia, fille d'Hervé (frère de Mireille), a épousé Paul, le père de Luc. Vu depuis Luc,
    // Nadia est à la rangée de Paul (par l'union), comme son père Hervé (par Mireille) : le lien
    // d'Hervé à Nadia ne descend d'aucune rangée, c'est un trait long.
    const scenario = tree({
      personnes: ['gerard/M', 'jeanne/F', 'paul/M', 'mireille/F', 'herve/M', 'nadia/F', 'luc/M'],
      unions: [
        { conjoints: ['gerard', 'jeanne'] },
        { conjoints: ['paul', 'mireille'], motif: 'deces' },
        { conjoints: ['paul', 'nadia'] },
      ],
      filiations: [
        { parents: ['gerard', 'jeanne'], enfant: 'mireille' },
        { parents: ['gerard', 'jeanne'], enfant: 'herve' },
        { parents: ['herve'], enfant: 'nadia' },
        { parents: ['paul', 'mireille'], enfant: 'luc' },
      ],
    });
    const layout = unfoldedLayout(scenario, 'luc');
    expectLayoutInvariants(layout);
    expect(layout.people.get(scenario.id('nadia'))?.row).toBe(-1);
    expect(layout.people.get(scenario.id('herve'))?.row).toBe(-1);
    const long = layout.links.filter((link) => link.nature === 'long');
    expect(long.map((link) => [scenario.keyOf(link.fromId), scenario.keyOf(link.toId)])).toEqual([
      ['herve', 'nadia'],
    ]);
    expect(long[0]?.rowSpan).toBe(0);
    expect(long[0]?.drawing).toBe('line');
  });
});

describe('étape 6 : filiation secondaire masquée (gardien-confidentialite)', () => {
  // Théa a ses deux parents de naissance, Paul et Rose ; Odile, seconde épouse de Paul, l'a
  // adoptée (enfant du conjoint adopté par un beau-parent).
  const section = {
    personnes: ['paul/M', 'rose/F', 'odile/F', 'thea/F'],
    unions: [{ conjoints: ['paul', 'rose'], motif: 'divorce' }, { conjoints: ['paul', 'odile'] }],
    filiations: [
      { parents: ['paul', 'rose'], enfant: 'thea' },
      { parents: ['odile'], enfant: 'thea', type: 'adoptive' },
    ],
  };
  const comparable = (layout: TreeLayout) => ({
    people: [...layout.people.values()],
    families: [...layout.families.values()],
    links: layout.links,
  });

  it('adoption visible : un lien secondaire, qui disparaît quand l’adoption est masquée', () => {
    const scenario = tree(section);
    const thea = scenario.id('thea');
    const visible = layoutTree(scenario.data, thea);
    expect(visible.links.map((link) => link.nature)).toEqual(['secondary']);

    const adoption = scenario.data.filiations.find((filiation) => filiation.type === 'adoptive');
    if (adoption === undefined) throw new Error('Adoption absente');
    const masked = {
      unions: new Set<Id>(),
      filiations: new Set([adoption.id]),
      facts: new Set<Id>(),
    };
    const reader = layoutTree(withoutObjects(scenario.data, masked), thea);
    expect(reader.links.filter((link) => link.nature === 'secondary')).toEqual([]);
    expect(comparable(reader)).toEqual(
      comparable(layoutTree(neverEntered(scenario.data, masked), thea)),
    );
    expect(serialized(reader)).not.toContain(adoption.id);
  });

  it('naissances masquées, adoption visible : l’enfant est rangé chez Odile, sans lien secondaire', () => {
    const scenario = tree(section);
    const thea = scenario.id('thea');
    const births = scenario.data.filiations.filter((filiation) => filiation.type === 'birth');
    const masked = {
      unions: new Set<Id>(),
      filiations: new Set(births.map((filiation) => filiation.id)),
      facts: new Set<Id>(),
    };
    const reader = layoutTree(withoutObjects(scenario.data, masked), thea);
    expect(reader.links).toEqual([]);
    expect(reader.structure.placementOf.get(thea)).toMatchObject({
      kind: 'unspecified',
      parentId: scenario.id('odile'),
    });
    expect(comparable(reader)).toEqual(
      comparable(layoutTree(neverEntered(scenario.data, masked), thea)),
    );
    for (const filiation of births) expect(serialized(reader)).not.toContain(filiation.id);
  });
});
