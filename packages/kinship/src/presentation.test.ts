// Présentation des liens (T-022, ADR 0021) : plusieurs chemins, le plus proche d'abord (PAR-05,
// UNI-21) ; liens non biologiques jamais confondus avec la naissance (PAR-06) ; certitude la plus
// faible du lien affiché (PAR-08, UNI-10) ; fratrie qualifiée par l'adoption (co-mère adoptive,
// ADR 0017). Arbres inventés.
import { describe, expect, it } from 'vitest';

import {
  ascentSide,
  invertPresentedLink,
  presentRelationships,
  type PresentedLink,
} from './presentation';
import { fixture, type Fixture, type FixtureOptions } from './test-support/fixtures';

function links(f: Fixture, a: string, b: string): PresentedLink[] {
  const result = presentRelationships(f.graph, f.id(a), f.id(b));
  if (result.status !== 'related') throw new Error(`Expected a link, got ${result.status}`);
  return result.links;
}

function main(f: Fixture, a: string, b: string): PresentedLink {
  const [first] = links(f, a, b);
  if (first === undefined) throw new Error('Expected a main link');
  return first;
}

/** Résumé lisible : rang, nature, base et types, générations, côté pour A, fratrie. */
function summary(f: Fixture, link: PresentedLink): string {
  const [first] = link.relationships;
  const blood = first?.segments[0];
  const shape =
    link.nature === 'blood' && blood?.kind === 'blood'
      ? `${String(blood.generationsUp)}/${String(blood.generationsDown)}`
      : (link.alliance?.kind ?? '?');
  const side =
    link.fromSide === undefined
      ? '-'
      : `${f.keyOf(link.fromSide.parentId) ?? '?'}:${link.fromSide.side}:${link.fromSide.type}`;
  const basis = link.basis === 'birth' ? 'birth' : link.nonBirthTypes.join('+');
  const sibling = link.sibling === undefined ? '' : ` ${link.sibling.kind}:${link.sibling.sharing}`;
  return `${link.rank} ${link.nature} ${shape} ${basis} ${side} ${link.certainty}${sibling}`;
}

function summaries(f: Fixture, a: string, b: string): string[] {
  return links(f, a, b).map((link) => summary(f, link));
}

describe('PAR-05, UNI-21 — le lien le plus proche d’abord, les autres dessous', () => {
  // Lévirat : Wanda, veuve d'André, épouse son frère Benoît ; Wim est fils d'André, Wes de Benoît.
  const levirate = fixture({
    personnes: ['pa/M', 'ma/F', 'andre/M', 'benoit/M', 'wanda/F', 'wim/M', 'wes/M'],
    unions: [
      { conjoints: ['pa', 'ma'] },
      { conjoints: ['andre', 'wanda'] },
      { conjoints: ['benoit', 'wanda'] },
    ],
    filiations: [
      { parents: ['pa', 'ma'], enfant: 'andre' },
      { parents: ['pa', 'ma'], enfant: 'benoit' },
      { parents: ['andre', 'wanda'], enfant: 'wim' },
      { parents: ['benoit', 'wanda'], enfant: 'wes' },
    ],
  });

  it('un enfant du lévirat : demi-frère par la mère, puis cousin par le père', () => {
    expect(summaries(levirate, 'wes', 'wim')).toEqual([
      'main blood 1/1 birth wanda:mother:birth certain birth:half',
      'also blood 2/2 birth benoit:father:birth certain',
    ]);
    const [, cousin] = links(levirate, 'wes', 'wim');
    // Le côté pour Wim aussi : par son père André.
    expect(cousin?.toSide).toMatchObject({ parentId: levirate.id('andre'), side: 'father' });
    // Les deux chemins de fratrie et de cousinage sont tous là, chacun une fois.
    expect(cousin?.relationships).toHaveLength(1);
  });

  it('le sens inverse est exactement l’inverse, dans le même ordre', () => {
    expect(links(levirate, 'wim', 'wes')).toEqual(
      links(levirate, 'wes', 'wim').map(invertPresentedLink),
    );
  });

  it('les chemins de fratrie sont réunis en une seule entrée, à la place du premier', () => {
    // Deux parents communs, plus une personne qui les a élevés tous les deux : une entrée.
    const f = fixture({
      personnes: ['p/M', 'm/F', 'r/F', 'a/M', 'b/F'],
      filiations: [
        { parents: ['p', 'm'], enfant: 'a' },
        { parents: ['p', 'm'], enfant: 'b' },
        { parents: ['r'], enfant: 'a', type: 'a_eleve' },
        { parents: ['r'], enfant: 'b', type: 'a_eleve' },
      ],
    });
    const result = links(f, 'a', 'b');
    expect(result.map((link) => summary(f, link))).toEqual([
      'main blood 1/1 birth - certain birth:full',
    ]);
    // Le chemin par celle qui les a élevés est gardé dans l'entrée, et dans la fratrie détaillée.
    expect(result[0]?.relationships).toHaveLength(2);
    expect(result[0]?.sibling?.link.alsoShared.map((shared) => f.keyOf(shared.personId))).toEqual([
      'r',
    ]);
  });

  it('ascentSide : le parent par lequel un segment monte, absent pour des frères', () => {
    const [, cousin] = links(levirate, 'wes', 'wim');
    const segment = cousin?.relationships[0]?.segments[0];
    if (segment?.kind !== 'blood') throw new Error('Expected a blood segment');
    expect(ascentSide(levirate.graph, segment)).toEqual({
      parentId: levirate.id('benoit'),
      side: 'father',
      type: 'birth',
    });
    const full = fixture({
      personnes: ['p/M', 'm/F', 'a/M', 'b/M'],
      filiations: [
        { parents: ['p', 'm'], enfant: 'a' },
        { parents: ['p', 'm'], enfant: 'b' },
      ],
    });
    const brothers = links(full, 'a', 'b')[0]?.relationships[0]?.segments[0];
    if (brothers?.kind !== 'blood') throw new Error('Expected a blood segment');
    expect(ascentSide(full.graph, brothers)).toBeUndefined();
  });
});

describe('PAR-06 — liens non biologiques, jamais confondus avec la naissance', () => {
  it('un père de naissance qui a aussi élevé : « père » d’abord, puis « l’a élevé »', () => {
    // Les deux filiations relient les mêmes personnes : la naissance passe devant à égalité.
    const f = fixture({
      personnes: ['p/M', 'c/M'],
      filiations: [
        { parents: ['p'], enfant: 'c', type: 'a_eleve' },
        { parents: ['p'], enfant: 'c' },
      ],
    });
    expect(summaries(f, 'c', 'p')).toEqual([
      'main blood 1/0 birth p:father:birth certain',
      'also blood 1/0 raised p:father:raised certain',
    ]);
    expect(summaries(f, 'p', 'c')).toEqual([
      'main blood 0/1 birth - certain',
      'also blood 0/1 raised - certain',
    ]);
  });

  it('cousin par la personne qui vous a élevé : le côté porte le type, jamais « père » seul', () => {
    const f = fixture({
      personnes: ['gp/M', 'x/M', 'y/M', 'a/F', 'b/M'],
      filiations: [
        { parents: ['gp'], enfant: 'x' },
        { parents: ['gp'], enfant: 'y' },
        { parents: ['x'], enfant: 'a', type: 'a_eleve' },
        { parents: ['y'], enfant: 'b' },
      ],
    });
    const link = main(f, 'a', 'b');
    expect(summary(f, link)).toBe('main blood 2/2 raised x:father:raised certain');
    expect(link.nonBirth.map((filiation) => filiation.type)).toEqual(['raised']);
  });

  it('adoption : « fils adoptif » distinct de « fils », dans les deux sens', () => {
    const f = fixture({
      personnes: ['p/M', 'a/M', 'n/M'],
      filiations: [
        { parents: ['p'], enfant: 'a', type: 'adoptive' },
        { parents: ['p'], enfant: 'n' },
      ],
    });
    expect(summary(f, main(f, 'p', 'a'))).toBe('main blood 0/1 adoptive - certain');
    expect(summary(f, main(f, 'p', 'n'))).toBe('main blood 0/1 birth - certain');
    // Deux enfants, l'un adopté, l'autre né du même père : frère par adoption, jamais « frère ».
    expect(summary(f, main(f, 'a', 'n'))).toBe(
      'main blood 1/1 adoptive p:father:adoptive certain adoption:full_or_half',
    );
  });

  it('enfant élevé par le conjoint de sa mère : « l’a élevé » et aussi « mari de votre mère »', () => {
    const f = fixture({
      personnes: ['m/F', 'x/M', 'c/M'],
      unions: [{ conjoints: ['m', 'x'] }],
      filiations: [
        { parents: ['m'], enfant: 'c' },
        { parents: ['x'], enfant: 'c', type: 'a_eleve' },
      ],
    });
    expect(summaries(f, 'c', 'x')).toEqual([
      'main blood 1/0 raised x:father:raised certain',
      'also alliance spouse_of_parent birth m:mother:birth certain',
    ]);
    // Adopté par lui, il devient son parent : plus de « mari de votre mère » (ADR 0010).
    const adopted = fixture({
      personnes: ['m/F', 'x/M', 'c/M'],
      unions: [{ conjoints: ['m', 'x'] }],
      filiations: [
        { parents: ['m'], enfant: 'c' },
        { parents: ['x'], enfant: 'c', type: 'adoptive' },
      ],
    });
    expect(summaries(adopted, 'c', 'x')).toEqual([
      'main blood 1/0 adoptive x:father:adoptive certain',
    ]);
  });
});

describe('co-mère adoptive : « frère » qualifié par l’adoption (ADR 0017, ADR 0021)', () => {
  const coMothers = (extra: object[] = [], options: FixtureOptions = {}) =>
    fixture(
      {
        personnes: ['anne/F', 'bea/F', 'x/M', 'y/F', 'd1/M', 'd2/M'],
        unions: [{ conjoints: ['anne', 'bea'] }],
        filiations: [
          { parents: ['anne'], enfant: 'x' },
          { parents: ['anne'], enfant: 'y' },
          { parents: ['bea'], enfant: 'x', type: 'adoptive' },
          { parents: ['bea'], enfant: 'y', type: 'adoptive' },
          ...extra,
        ],
      },
      options,
    );

  it('nés de la même mère, adoptés par sa conjointe : frère par la naissance et l’adoption', () => {
    const f = coMothers();
    const link = main(f, 'x', 'y');
    expect(summary(f, link)).toBe('main blood 1/1 adoptive - certain birth_and_adoption:full');
    expect(link.sibling?.adoptiveParents.map((shared) => f.keyOf(shared.personId))).toEqual([
      'bea',
    ]);
    // La fratrie détaillée ne compte que la naissance : « frère ou demi-frère » (santé, V3).
    expect(link.sibling?.link.sharing).toBe('full_or_half');
    expect(link.sibling?.link.basis).toBe('birth');
  });

  it('avec des pères de naissance connus et différents : demi-sœur, l’adoption à part', () => {
    const f = coMothers([
      { parents: ['d1'], enfant: 'x' },
      { parents: ['d2'], enfant: 'y' },
    ]);
    const link = main(f, 'x', 'y');
    expect(summary(f, link)).toBe('main blood 1/1 birth anne:parent:birth certain birth:half');
    expect(link.sibling?.link.alsoShared.map((shared) => f.keyOf(shared.personId))).toEqual([
      'bea',
    ]);
  });

  it('chacune mère de naissance de l’un et adoptive de l’autre : frère par adoption', () => {
    const f = fixture({
      personnes: ['anne/F', 'bea/F', 'x/M', 'y/M'],
      filiations: [
        { parents: ['anne'], enfant: 'x' },
        { parents: ['bea'], enfant: 'y' },
        { parents: ['bea'], enfant: 'x', type: 'adoptive' },
        { parents: ['anne'], enfant: 'y', type: 'adoptive' },
      ],
    });
    expect(summary(f, main(f, 'x', 'y'))).toBe('main blood 1/1 adoptive - certain adoption:full');
  });
});

describe('PAR-08, UNI-10 — la certitude la plus faible du lien affiché', () => {
  it('un lien probable sur le chemin : « Peut-être son cousin »', () => {
    const f = fixture({
      personnes: ['gp/M', 'x/M', 'y/M', 'a/M', 'b/M'],
      filiations: [
        { parents: ['gp'], enfant: 'x' },
        { parents: ['gp'], enfant: 'y', certitude: 'probable' },
        { parents: ['x'], enfant: 'a' },
        { parents: ['y'], enfant: 'b' },
      ],
    });
    expect(main(f, 'a', 'b').certainty).toBe('probable');
  });

  it('hypothétique plus faible que probable', () => {
    const f = fixture({
      personnes: ['gp/M', 'x/M', 'y/M', 'a/M', 'b/M'],
      filiations: [
        { parents: ['gp'], enfant: 'x', certitude: 'probable' },
        { parents: ['gp'], enfant: 'y' },
        { parents: ['x'], enfant: 'a' },
        { parents: ['y'], enfant: 'b', certitude: 'hypothetique' },
      ],
    });
    expect(main(f, 'a', 'b').certainty).toBe('hypothetical');
  });

  it('frères dont le père est probable : « Peut-être son frère » (UNI-10)', () => {
    const f = fixture({
      personnes: ['p/M', 'm/F', 'a/M', 'b/M'],
      filiations: [
        { parents: ['m'], enfant: 'a' },
        { parents: ['m'], enfant: 'b' },
        { parents: ['p'], enfant: 'a' },
        { parents: ['p'], enfant: 'b', certitude: 'probable' },
      ],
    });
    expect(summary(f, main(f, 'a', 'b'))).toBe('main blood 1/1 birth - probable birth:full');
  });

  it('un lien hors du lien affiché ne l’affaiblit pas (« a élevé » probable)', () => {
    const f = fixture({
      personnes: ['p/M', 'm/F', 'r/F', 'a/M', 'b/M'],
      filiations: [
        { parents: ['p', 'm'], enfant: 'a' },
        { parents: ['p', 'm'], enfant: 'b' },
        { parents: ['r'], enfant: 'a', type: 'a_eleve', certitude: 'probable' },
        { parents: ['r'], enfant: 'b', type: 'a_eleve' },
      ],
    });
    expect(main(f, 'a', 'b').certainty).toBe('certain');
  });
});

describe('PAR-09 — personne masquée sur le seul chemin', () => {
  it('« Lien non disponible », sans autre indice', () => {
    const tree = {
      personnes: ['gp/M', 'x/M', 'y/M', 'a/M', 'b/M'],
      filiations: [
        { parents: ['gp'], enfant: 'x' },
        { parents: ['gp'], enfant: 'y' },
        { parents: ['x'], enfant: 'a' },
        { parents: ['y'], enfant: 'b' },
      ],
    };
    const f = fixture(tree, { hidden: ['gp'] });
    expect(presentRelationships(f.graph, f.id('a'), f.id('b'))).toEqual({ status: 'none' });
    expect(presentRelationships(f.graph, f.id('a'), f.id('gp'))).toEqual({ status: 'none' });
  });
});
