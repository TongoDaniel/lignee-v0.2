// Filtres de l'arbre (ARB-11, T-025) : côtés, branche, foyer. Arbres inventés au format des
// scénarios ; les preuves visent des critères qui échoueraient s'ils étaient faux (la mère n'est
// pas du côté paternel, un cousin maternel non plus, un masqué n'est jamais rendu).
import type { Id } from '@lignee/domain';
import {
  buildScenarioTree,
  scenarioTreeSchema,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { branchMembers, foyerMembers, sideMembers, sideRoots } from './filters';
import { buildOutline } from './scene/outline';
import { withoutPeople } from './test-support/layout-scenario';
import { layoutTree } from './tree-layout';

function tree(section: unknown): ScenarioTree {
  return buildScenarioTree(scenarioTreeSchema.parse(section));
}

/** Moi, mes parents, mes grands-parents des deux côtés, un oncle et une tante de chaque côté. */
const FAMILY = {
  personnes: [
    'moi/N',
    'soeur/F',
    'papa/M',
    'maman/F',
    'gpp/M',
    'gmp/F',
    'gpm/M',
    'gmm/F',
    'oncle/M',
    'tantepouse/F',
    'cousine/F',
    'tante/F',
    'cousinm/M',
    'enfant/N',
    'beauparent/M',
  ],
  unions: [
    { conjoints: ['papa', 'maman'] },
    { conjoints: ['gpp', 'gmp'] },
    { conjoints: ['gpm', 'gmm'] },
    { conjoints: ['oncle', 'tantepouse'] },
  ],
  filiations: [
    { parents: ['papa', 'maman'], enfant: 'moi' },
    { parents: ['papa', 'maman'], enfant: 'soeur' },
    { parents: ['gpp', 'gmp'], enfant: 'papa' },
    { parents: ['gpp', 'gmp'], enfant: 'oncle' },
    { parents: ['oncle', 'tantepouse'], enfant: 'cousine' },
    { parents: ['gpm', 'gmm'], enfant: 'maman' },
    { parents: ['gpm', 'gmm'], enfant: 'tante' },
    { parents: ['tante'], enfant: 'cousinm' },
    { parents: ['moi'], enfant: 'enfant' },
  ],
};

function keys(scenario: ScenarioTree, ids: ReadonlySet<Id>): string[] {
  return [...ids].map((id) => scenario.keyOf(id) ?? '').sort();
}

describe('côtés (ARB-11)', () => {
  it('côté paternel : le père, ses ascendants, ses frères et sœurs et leurs enfants', () => {
    const scenario = tree(FAMILY);
    const members = sideMembers(scenario.data, scenario.id('moi'), 'paternal');
    expect(keys(scenario, members)).toEqual(['cousine', 'gmp', 'gpp', 'oncle', 'papa'].sort());
  });

  it('côté maternel : la mère, ses ascendants, sa fratrie et leurs enfants', () => {
    const scenario = tree(FAMILY);
    const members = sideMembers(scenario.data, scenario.id('moi'), 'maternal');
    expect(keys(scenario, members)).toEqual(['cousinm', 'gmm', 'gpm', 'maman', 'tante'].sort());
  });

  it('ni la personne au centre, ni sa fratrie, ni ses enfants, ni les conjoints', () => {
    const scenario = tree(FAMILY);
    for (const side of ['paternal', 'maternal'] as const) {
      const members = sideMembers(scenario.data, scenario.id('moi'), side);
      for (const out of ['moi', 'soeur', 'enfant', 'tantepouse', 'beauparent']) {
        expect(members.has(scenario.id(out)), `${side} ${out}`).toBe(false);
      }
    }
  });

  it('le genre donne le côté, jamais deviné : un parent sans genre ne donne aucun côté', () => {
    const scenario = tree({
      personnes: ['moi/N', 'pere/N', 'mere/F', 'gp/M'],
      filiations: [
        { parents: ['pere'], enfant: 'moi' },
        { parents: ['mere'], enfant: 'moi' },
        { parents: ['gp'], enfant: 'pere' },
      ],
    });
    const me = scenario.id('moi');
    expect(sideRoots(scenario.data, me, 'paternal')).toEqual([]);
    expect(sideMembers(scenario.data, me, 'paternal').size).toBe(0);
    expect(keys(scenario, sideMembers(scenario.data, me, 'maternal'))).toEqual(['mere']);
  });

  it('un parent adoptif ne donne pas de côté (les côtés suivent la naissance)', () => {
    const scenario = tree({
      personnes: ['moi/N', 'papa/M', 'maman/F'],
      filiations: [
        { parents: ['maman'], enfant: 'moi' },
        { parents: ['papa'], enfant: 'moi', type: 'adoptive' },
      ],
    });
    expect(sideMembers(scenario.data, scenario.id('moi'), 'paternal').size).toBe(0);
    expect(sideMembers(scenario.data, scenario.id('moi'), 'maternal').size).toBe(1);
  });

  it('non-fuite : une personne masquée n’est jamais rendue, ni ce qui ne passe que par elle', () => {
    const scenario = tree(FAMILY);
    const me = scenario.id('moi');
    const oncle = scenario.id('oncle');
    const reader = withoutPeople(scenario.data, new Set([oncle]));
    const members = sideMembers(reader, me, 'paternal');
    expect(members.has(oncle)).toBe(false);
    // La cousine n'est plus reliée à la lignée que par l'oncle masqué : elle disparaît aussi.
    expect(members.has(scenario.id('cousine'))).toBe(false);
    // Sans masque, ils y sont : le test échouerait si le filtre ignorait le graphe reçu.
    expect(sideMembers(scenario.data, me, 'paternal').has(oncle)).toBe(true);
    // Un parent masqué : plus de côté du tout.
    const noFather = withoutPeople(scenario.data, new Set([scenario.id('papa')]));
    expect(sideMembers(noFather, me, 'paternal').size).toBe(0);
  });
});

describe('branche et foyer (ARB-11)', () => {
  it('branche : la personne, sa descendance et les foyers entiers, pas ses ascendants', () => {
    const scenario = tree(FAMILY);
    const members = branchMembers(scenario.data, scenario.id('papa'));
    expect(keys(scenario, members)).toEqual(['enfant', 'maman', 'moi', 'papa', 'soeur'].sort());
  });

  it('branche : un descendant masqué n’apparaît pas', () => {
    const scenario = tree(FAMILY);
    const reader = withoutPeople(scenario.data, new Set([scenario.id('moi')]));
    const members = branchMembers(reader, scenario.id('papa'));
    expect(members.has(scenario.id('moi'))).toBe(false);
    expect(members.has(scenario.id('enfant'))).toBe(false);
    expect(members.has(scenario.id('soeur'))).toBe(true);
  });

  it('foyer : la personne, le conjoint et leurs enfants, sans les petits-enfants', () => {
    const scenario = tree(FAMILY);
    const me = scenario.id('papa');
    const outline = buildOutline(layoutTree(scenario.data, me));
    const union = outline.get(me)?.unions.find((candidate) => candidate.kind === 'foyer');
    expect(union).toBeDefined();
    if (union === undefined) return;
    expect(keys(scenario, foyerMembers(me, union))).toEqual(['maman', 'moi', 'papa', 'soeur']);
  });
});
