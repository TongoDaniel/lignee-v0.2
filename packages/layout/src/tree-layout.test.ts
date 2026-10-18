// Étapes 3 à 5 de la disposition (T-012) sur de petits arbres écrits ici (noms générés) : ordre
// des frères et sœurs, union en cours au plus près, colonne « non précisé », repli au-delà de 3
// générations et dépliage, API de repli. Chaque test échouerait si la règle était fausse.
import {
  buildScenarioTree,
  scenarioTreeSchema,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import type { TreeLayout } from './layout-types';
import { expectLayoutInvariants, familyKeyOf } from './test-support/layout-checks';
import { withoutPeople } from './test-support/layout-scenario';
import { layoutTree, setFolded, toggleFamily } from './tree-layout';

function familyTree(section: z.input<typeof scenarioTreeSchema>): ScenarioTree {
  return buildScenarioTree(scenarioTreeSchema.parse(section));
}

/** Personnes dessinées à la hauteur `y`, de gauche à droite. */
function line(layout: TreeLayout, tree: ScenarioTree, y: number) {
  return [...layout.people.values()]
    .filter((person) => person.y === y)
    .sort((a, b) => a.x - b.x)
    .map((person) => tree.keyOf(person.personId));
}

const year = (value: string) => ({ qualificatif: 'exacte' as const, date: value });

describe('étape 3 : ordre des frères et sœurs', () => {
  it('par date de naissance aux places des enfants datés, sinon l’ordre saisi ; des jumeaux par leur ordre', () => {
    const tree = familyTree({
      personnes: ['papa/M', 'maman/F', 'ainee/F', 'cadet/M', 'sans_date/M', 'jum_a/F', 'jum_b/M'],
      unions: [{ conjoints: ['papa', 'maman'] }],
      filiations: [
        { parents: ['papa', 'maman'], enfant: 'cadet' },
        { parents: ['papa', 'maman'], enfant: 'sans_date' },
        { parents: ['papa', 'maman'], enfant: 'jum_b' },
        { parents: ['papa', 'maman'], enfant: 'ainee' },
        { parents: ['papa', 'maman'], enfant: 'jum_a' },
      ],
      faits: [
        { personne: 'ainee', type: 'naissance', date: year('1970') },
        { personne: 'cadet', type: 'naissance', date: year('1975') },
        { personne: 'jum_a', type: 'naissance', date: year('1980-02-03') },
        { personne: 'jum_b', type: 'naissance', date: year('1980-02-03') },
      ],
      naissances_multiples: [{ enfants: ['jum_a', 'jum_b'], ordre: [1, 2] }],
    });
    const layout = layoutTree(tree.data, tree.id('papa'));
    expectLayoutInvariants(layout);
    // Places saisies : cadet, sans_date, jum_b, ainee, jum_a ; les datées (1, 3, 4, 5) sont
    // remises dans l'ordre des dates, sans_date garde la sienne.
    expect(line(layout, tree, 1)).toEqual(['ainee', 'sans_date', 'cadet', 'jum_a', 'jum_b']);
    const foyer = familyKeyOf(layout.structure, tree, ['papa', 'maman']);
    expect(layout.families.get(foyer)?.shownChildren.map((id) => tree.keyOf(id))).toEqual([
      'ainee',
      'sans_date',
      'cadet',
      'jum_a',
      'jum_b',
    ]);
  });
});

describe('étape 3 : jumeaux visibles parmi des triplés (non-fuite)', () => {
  it('le deuxième triplé masqué : même ordre et même disposition que des jumeaux saisis seuls', () => {
    const section = (children: string[], order: number[]) =>
      familyTree({
        personnes: ['papa/M', 'maman/F', ...children.map((key) => `${key}/F`)],
        unions: [{ conjoints: ['papa', 'maman'] }],
        // Saisis dans le désordre : seul l'ordre de la naissance multiple les range.
        filiations: [...children]
          .reverse()
          .map((enfant) => ({ parents: ['papa', 'maman'], enfant })),
        faits: children.map((personne) => ({
          personne,
          type: 'naissance',
          date: year('2001-04-05'),
        })),
        naissances_multiples: [{ enfants: children, ordre: order }],
      });
    const triplets = section(['t1', 't2', 't3'], [1, 2, 3]);
    const masked = withoutPeople(triplets.data, new Set([triplets.id('t2')]));
    expect(masked.multipleBirths[0]?.members.map((member) => member.birthOrder)).toEqual([1, 2]);
    const seen = layoutTree(masked, triplets.id('papa'));
    expect(line(seen, triplets, 1)).toEqual(['t1', 't3']);
    const twins = section(['t1', 't3'], [1, 2]);
    const alone = layoutTree(twins.data, twins.id('papa'));
    const shape = (layout: TreeLayout, tree: ScenarioTree) =>
      [...layout.people.values()].map((person) => ({
        ...person,
        personId: tree.keyOf(person.personId),
      }));
    const strip = (rows: ReturnType<typeof shape>) =>
      rows.map(({ foldedParentsKey: _key, block: _block, ...rest }) => rest);
    expect(strip(shape(seen, triplets))).toEqual(strip(shape(alone, twins)));
  });
});

describe('étape 4 : placement', () => {
  it('unions successives : la plus ancienne loin, l’union en cours au plus près, même saisie dans un autre rang (ARB-04)', () => {
    const tree = familyTree({
      personnes: ['marc/M', 'ines/F', 'lina/F', 'zoe/F', 'enfant/M'],
      unions: [
        { conjoints: ['marc', 'lina'], rang_marc: 1, debut: year('1990') },
        {
          conjoints: ['marc', 'ines'],
          rang_marc: 2,
          debut: year('1980'),
          fin: year('1985'),
          motif: 'divorce',
        },
        {
          conjoints: ['marc', 'zoe'],
          rang_marc: 3,
          debut: year('1970'),
          fin: year('1975'),
          motif: 'divorce',
        },
      ],
      filiations: [{ parents: ['marc', 'lina'], enfant: 'enfant' }],
    });
    const layout = layoutTree(tree.data, tree.id('enfant'));
    expectLayoutInvariants(layout);
    expect(line(layout, tree, -1)).toEqual(['zoe', 'ines', 'lina', 'marc']);
  });

  it('co-épouse déjà mariée avant : le chef reste centré sur ses épouses, l’autre mari hors de la demi-rangée, quelle que soit la personne centrale', () => {
    const tree = familyTree({
      personnes: ['pierre/M', 'rose/F', 'odile/F', 'marc/M', 'jean/M', 'ana/F', 'luc/M', 'kid/F'],
      unions: [
        { conjoints: ['marc', 'rose'], debut: year('1960'), fin: year('1965'), motif: 'divorce' },
        { conjoints: ['pierre', 'rose'], rang_pierre: 1, debut: year('1970') },
        { conjoints: ['pierre', 'odile'], rang_pierre: 2, debut: year('1975') },
      ],
      filiations: [
        { parents: ['pierre', 'rose'], enfant: 'jean' },
        { parents: ['pierre', 'odile'], enfant: 'ana' },
        { parents: ['marc', 'rose'], enfant: 'luc' },
        { parents: ['marc', 'rose'], enfant: 'kid' },
      ],
    });
    for (const center of ['jean', 'luc', 'ana']) {
      const layout = layoutTree(tree.data, tree.id(center));
      expectLayoutInvariants(layout);
      const at = (key: string) => layout.people.get(tree.id(key));
      // Les deux épouses sur la demi-rangée, dans l'ordre des rangs, le chef au-dessus de leur
      // milieu ; Marc sur la rangée, à l'extérieur du groupe, pas entre elles ni sous le chef.
      expect(line(layout, tree, -0.5), center).toEqual(['rose', 'odile']);
      expect(line(layout, tree, -1), center).toEqual(['marc', 'pierre']);
      expect(at('pierre')?.x).toBeCloseTo(((at('rose')?.x ?? NaN) + (at('odile')?.x ?? NaN)) / 2);
      expect(at('marc')?.x ?? NaN).toBeLessThan(at('rose')?.x ?? NaN);
      // Le foyer de Marc et Rose s'attache entre eux, pas sous Rose comme celui de Pierre.
      const marcRose = layout.families.get(familyKeyOf(layout.structure, tree, ['marc', 'rose']));
      const pierreRose = layout.families.get(
        familyKeyOf(layout.structure, tree, ['pierre', 'rose']),
      );
      expect(pierreRose?.anchor?.x).toBe(at('rose')?.x);
      expect(marcRose?.anchor?.x).toBeLessThan(at('rose')?.x ?? NaN);
    }
  });

  it('colonne « mère non précisée » : une place sur la demi-rangée, ses enfants dessous (ARB-05)', () => {
    const tree = familyTree({
      personnes: ['ali/M', 'awa/F', 'fils/M', 'sans_mere/F'],
      unions: [{ conjoints: ['ali', 'awa'] }],
      filiations: [
        { parents: ['ali', 'awa'], enfant: 'fils' },
        { parents: ['ali'], enfant: 'sans_mere' },
      ],
    });
    const layout = layoutTree(tree.data, tree.id('ali'));
    expectLayoutInvariants(layout);
    const column = layout.families.get(familyKeyOf(layout.structure, tree, ['ali']));
    expect(column?.kind).toBe('unspecified');
    expect(column?.header?.y).toBe(0.5);
    expect(column?.shownChildren.map((id) => tree.keyOf(id))).toEqual(['sans_mere']);
    const child = layout.people.get(tree.id('sans_mere'));
    expect(child?.x).toBe(column?.header?.x);
    expect(line(layout, tree, 1)).toEqual(['fils', 'sans_mere']);
  });

  it('les parents se centrent au-dessus de leurs enfants, et les enfants sous leurs parents', () => {
    const tree = familyTree({
      personnes: ['gp/M', 'gm/F', 'pere/M', 'mere/F', 'a/F', 'b/M', 'c/F'],
      unions: [{ conjoints: ['gp', 'gm'] }, { conjoints: ['pere', 'mere'] }],
      filiations: [
        { parents: ['gp', 'gm'], enfant: 'pere' },
        { parents: ['pere', 'mere'], enfant: 'a' },
        { parents: ['pere', 'mere'], enfant: 'b' },
        { parents: ['pere', 'mere'], enfant: 'c' },
      ],
    });
    const layout = layoutTree(tree.data, tree.id('b'));
    expectLayoutInvariants(layout);
    const x = (key: string) => layout.people.get(tree.id(key))?.x ?? NaN;
    expect((x('pere') + x('mere')) / 2).toBeCloseTo((x('a') + x('c')) / 2);
    expect((x('gp') + x('gm')) / 2).toBeCloseTo(x('pere'));
  });
});

describe('étape 5 : repli', () => {
  // Six générations en ligne droite au-dessus de « moi », et trois en dessous.
  const ancestry = () =>
    familyTree({
      personnes: [
        'g6/M',
        'g5/M',
        'g4/M',
        'g3/M',
        'g2/M',
        'g1/M',
        'moi/F',
        'd1/M',
        'd2/F',
        'd3/M',
        'd4/F',
        'tante/F',
        'cousin/M',
      ],
      filiations: [
        { parents: ['g6'], enfant: 'g5' },
        { parents: ['g5'], enfant: 'g4' },
        { parents: ['g4'], enfant: 'g3' },
        { parents: ['g3'], enfant: 'g2' },
        { parents: ['g2'], enfant: 'g1' },
        { parents: ['g2'], enfant: 'tante' },
        { parents: ['tante'], enfant: 'cousin' },
        { parents: ['g1'], enfant: 'moi' },
        { parents: ['moi'], enfant: 'd1' },
        { parents: ['d1'], enfant: 'd2' },
        { parents: ['d2'], enfant: 'd3' },
        { parents: ['d3'], enfant: 'd4' },
      ],
    });

  it('au-delà de 3 générations, au-dessus comme en dessous, la branche est repliée ; les foyers hors de la ligne aussi', () => {
    const tree = ancestry();
    const layout = layoutTree(tree.data, tree.id('moi'));
    expectLayoutInvariants(layout);
    const shown = [...layout.people.keys()].map((id) => tree.keyOf(id)).sort();
    expect(shown).toEqual(['d1', 'd2', 'd3', 'g1', 'g2', 'g3', 'moi', 'tante'].sort());
    // L'arrière-grand-parent porte la clé qui déplie ses parents.
    const g3 = layout.people.get(tree.id('g3'));
    expect(g3?.foldedParentsKey).toBe(familyKeyOf(layout.structure, tree, ['g4']));
    // La tante est dessinée (foyer des grands-parents ouvert), ses enfants repliés : « + 1 ».
    const aunt = layout.families.get(familyKeyOf(layout.structure, tree, ['tante']));
    expect(aunt).toMatchObject({ folded: true, foldedByDefault: true, childCount: 1 });
    expect(aunt?.shownChildren).toEqual([]);
    // L'arrière-petit-enfant est dessiné, ses enfants (4e génération) repliés.
    const d3 = layout.families.get(familyKeyOf(layout.structure, tree, ['d3']));
    expect(d3).toMatchObject({ folded: true, childCount: 1 });
  });

  it('déplier puis replier une branche, par sa clé', () => {
    const tree = ancestry();
    const layout = layoutTree(tree.data, tree.id('moi'));
    const key = familyKeyOf(layout.structure, tree, ['g4']);
    const unfolded = layoutTree(tree.data, tree.id('moi'), { folds: toggleFamily(layout, key) });
    expectLayoutInvariants(unfolded);
    expect(unfolded.people.has(tree.id('g4'))).toBe(true);
    expect(unfolded.families.get(key)?.folded).toBe(false);
    // g4 reste replié au-dessus de lui (sa propre famille d'origine n'a pas été dépliée).
    expect(unfolded.people.has(tree.id('g5'))).toBe(false);
    const folded = layoutTree(tree.data, tree.id('moi'), {
      folds: setFolded(unfolded.folds, key, true),
    });
    expect(folded.people.has(tree.id('g4'))).toBe(false);
    // Les choix reçus ne sont pas modifiés.
    expect(layout.folds.size).toBe(0);
  });

  it('les conjoints d’une personne dessinée le sont toujours, foyer replié compris', () => {
    const tree = familyTree({
      personnes: ['moi/F', 'frere/M', 'belle_soeur/F', 'neveu/M', 'pere/M'],
      unions: [{ conjoints: ['frere', 'belle_soeur'] }],
      filiations: [
        { parents: ['pere'], enfant: 'moi' },
        { parents: ['pere'], enfant: 'frere' },
        { parents: ['frere', 'belle_soeur'], enfant: 'neveu' },
      ],
    });
    const layout = layoutTree(tree.data, tree.id('moi'));
    expectLayoutInvariants(layout);
    expect(layout.people.has(tree.id('belle_soeur'))).toBe(true);
    expect(layout.people.has(tree.id('neveu'))).toBe(false);
    expect(line(layout, tree, 0)).toEqual(['moi', 'frere', 'belle_soeur']);
  });
});
