// Fratrie calculée, jamais saisie (UNI-13, PAR-03 ; TRD, « Moteur de parenté », question 1) :
// frère, demi-frère par le père ou par la mère, « frère ou demi-frère » tant qu'un parent n'est
// pas précisé, enfant du conjoint d'un parent. Règles : ADR 0017. Arbres inventés.
import { describe, expect, it } from 'vitest';

import { findRelationships } from './kinship';
import {
  ascentSide,
  invertSiblingLink,
  parentSide,
  siblingLink,
  siblingsOf,
  type SiblingLink,
  type SiblingResult,
  type StepSiblingLink,
} from './siblings';
import { fixture, type Fixture, type FixtureOptions } from './test-support/fixtures';

function sibling(f: Fixture, a: string, b: string): SiblingLink {
  const result = siblingLink(f.graph, f.id(a), f.id(b));
  if (result?.kind !== 'sibling')
    throw new Error(`Expected a sibling, got ${result?.kind ?? 'nothing'}`);
  return result;
}

function step(f: Fixture, a: string, b: string): StepSiblingLink {
  const result = siblingLink(f.graph, f.id(a), f.id(b));
  if (result?.kind !== 'step_sibling') throw new Error(`Expected a step sibling`);
  return result;
}

/** Résumé lisible : partage, côté, genre de la personne visée. */
function summary(f: Fixture, a: string, b: string): string {
  const result = siblingLink(f.graph, f.id(a), f.id(b));
  if (result === undefined) return 'aucun';
  if (result.kind === 'step_sibling') return `alliance ${result.toGender}`;
  return [result.sharing, result.side ?? '-', result.toGender].join(' ');
}

// Une famille polygame : Moussa et ses épouses Awa et Fanta ; Kadi, mère d'Issa avant d'épouser
// Moussa ; Samba, enfant de Moussa dont la mère n'est pas précisée (candidates : Awa, Fanta).
const polygamous = (options: FixtureOptions = {}, extra: object[] = []) =>
  fixture(
    {
      personnes: [
        'moussa/M',
        'awa/F',
        'fanta/F',
        'kadi/F',
        'yaya/M',
        'ali/M',
        'aminata/F',
        'binta/F',
        'issa/M',
        'samba/M',
      ],
      unions: [
        { conjoints: ['moussa', 'awa'] },
        { conjoints: ['moussa', 'fanta'] },
        { conjoints: ['moussa', 'kadi'] },
        { conjoints: ['yaya', 'kadi'] },
      ],
      filiations: [
        { parents: ['moussa', 'awa'], enfant: 'ali' },
        { parents: ['moussa', 'awa'], enfant: 'aminata' },
        { parents: ['moussa', 'fanta'], enfant: 'binta' },
        { parents: ['yaya', 'kadi'], enfant: 'issa' },
        { parents: ['moussa'], enfant: 'samba' },
        ...extra,
      ],
      candidats: [{ enfant: 'samba', candidates: ['awa', 'fanta'] }],
    },
    options,
  );

describe('fratrie : frère, demi-frère par le père ou par la mère (UNI-13, PAR-03)', () => {
  const f = polygamous();

  it('mêmes parents : frère ou sœur, avec le genre de la personne visée', () => {
    expect(summary(f, 'ali', 'aminata')).toBe('full - female');
    expect(summary(f, 'aminata', 'ali')).toBe('full - male');
    const link = sibling(f, 'ali', 'aminata');
    expect(link.basis).toBe('birth');
    expect(link.sharedParents.map((p) => f.keyOf(p.personId)).sort()).toEqual(['awa', 'moussa']);
    expect(link.certainty).toBe('certain');
    expect(link.filiationTypes).toEqual(['birth']);
  });

  it('enfants de deux épouses : demi, même père (CL-POL-02)', () => {
    expect(summary(f, 'ali', 'binta')).toBe('half father female');
    const link = sibling(f, 'binta', 'ali');
    expect(link.sharedParents.map((p) => f.keyOf(p.personId))).toEqual(['moussa']);
    expect(link.fromOtherParent).toEqual({ status: 'known', personId: f.id('fanta') });
    expect(link.toOtherParent).toEqual({ status: 'known', personId: f.id('awa') });
  });

  it('même mère, pères différents : demi, même mère', () => {
    const g = fixture({
      personnes: ['kadi/F', 'oumar/M', 'yaya/M', 'sidi/M', 'hawa/F'],
      filiations: [
        { parents: ['oumar', 'kadi'], enfant: 'sidi' },
        { parents: ['yaya', 'kadi'], enfant: 'hawa' },
      ],
    });
    expect(summary(g, 'sidi', 'hawa')).toBe('half mother female');
  });

  it('parent commun de genre autre ou non renseigné : côté « parent »', () => {
    const g = fixture({
      personnes: ['cam/A', 'dom/N', 'eve/F', 'jo/M', 'lu/F', 'max/M', 'ned/M'],
      filiations: [
        { parents: ['cam', 'eve'], enfant: 'lu' },
        { parents: ['cam', 'jo'], enfant: 'max' },
        { parents: ['dom', 'eve'], enfant: 'ned' },
      ],
    });
    expect(summary(g, 'lu', 'max')).toBe('half parent male');
    expect(summary(g, 'lu', 'ned')).toBe('half mother male');
  });
});

describe('« frère ou demi-frère » tant qu’un parent n’est pas précisé (PAR-03, TRD)', () => {
  it('mère non précisée, épouses candidates : frère ou demi-frère (CL-POL-03), côté du père', () => {
    const f = polygamous();
    expect(summary(f, 'ali', 'samba')).toBe('full_or_half father male');
    const link = sibling(f, 'ali', 'samba');
    expect(link.toOtherParent).toEqual({
      status: 'unspecified',
      candidateIds: [f.id('awa'), f.id('fanta')].sort(),
    });
    expect(link.fromOtherParent).toEqual({ status: 'known', personId: f.id('awa') });
  });

  it('le lien change dès que la mère est précisée : frère, ou demi-frère (PAR-03)', () => {
    const awa = polygamous({}, [{ parents: ['awa'], enfant: 'samba' }]);
    expect(summary(awa, 'ali', 'samba')).toBe('full - male');
    expect(summary(awa, 'binta', 'samba')).toBe('half father male');
    const fanta = polygamous({}, [{ parents: ['fanta'], enfant: 'samba' }]);
    expect(summary(fanta, 'ali', 'samba')).toBe('half father male');
    expect(summary(fanta, 'binta', 'samba')).toBe('full - male');
  });

  it('deux mères à compléter différentes ne sont jamais supposées identiques', () => {
    const f = fixture(
      {
        personnes: ['paul/M', 'x/F', 'y/F', 'lea/F', 'tom/M'],
        filiations: [
          { parents: ['paul', 'x'], enfant: 'lea' },
          { parents: ['paul', 'y'], enfant: 'tom' },
        ],
      },
      { placeholders: ['x', 'y'] },
    );
    expect(summary(f, 'lea', 'tom')).toBe('full_or_half father male');
    expect(sibling(f, 'lea', 'tom').fromOtherParent).toEqual({
      status: 'placeholder',
      personId: f.id('x'),
    });
  });

  it('une même place à compléter partagée fait des frères (UNI-12, CL-GEN-07)', () => {
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
    expect(summary(f, 'lea', 'tom')).toBe('full - male');
  });

  it('une mère à compléter face à une mère connue : demi-frère (CL-VOI-08, « sans mère commune »)', () => {
    const f = fixture(
      {
        personnes: ['jules/M', 'irene/F', 'x/F', 'carine/F', 'bruno/M'],
        filiations: [
          { parents: ['jules', 'irene'], enfant: 'carine' },
          { parents: ['jules', 'x'], enfant: 'bruno' },
        ],
      },
      { placeholders: ['x'] },
    );
    expect(summary(f, 'carine', 'bruno')).toBe('half father male');
    expect(summary(f, 'bruno', 'carine')).toBe('half father female');
  });

  it('les deux sans autre parent, ou un seul : frère ou demi-frère', () => {
    const f = fixture(
      {
        personnes: ['paul/M', 'x/F', 'lea/F', 'tom/M', 'zoe/F'],
        filiations: [
          { parents: ['paul'], enfant: 'lea' },
          { parents: ['paul'], enfant: 'tom' },
          { parents: ['paul', 'x'], enfant: 'zoe' },
        ],
      },
      { placeholders: ['x'] },
    );
    expect(summary(f, 'lea', 'tom')).toBe('full_or_half father male');
    expect(summary(f, 'lea', 'zoe')).toBe('full_or_half father female');
  });

  it('jamais « frère » quand un seul parent est commun, même si l’autre est candidat', () => {
    const f = polygamous();
    for (const other of ['ali', 'aminata', 'binta']) {
      expect(sibling(f, other, 'samba').sharing).not.toBe('full');
    }
  });
});

describe('« changer un parent met à jour tous les liens de fratrie » (UNI-13)', () => {
  it('changer la mère d’Ali d’Awa à Fanta change ses liens avec chacun', () => {
    const before = polygamous();
    const after = fixture({
      personnes: ['moussa/M', 'awa/F', 'fanta/F', 'ali/M', 'aminata/F', 'binta/F'],
      filiations: [
        { parents: ['moussa', 'fanta'], enfant: 'ali' },
        { parents: ['moussa', 'awa'], enfant: 'aminata' },
        { parents: ['moussa', 'fanta'], enfant: 'binta' },
      ],
    });
    expect(summary(before, 'ali', 'aminata')).toBe('full - female');
    expect(summary(before, 'ali', 'binta')).toBe('half father female');
    expect(summary(after, 'ali', 'aminata')).toBe('half father female');
    expect(summary(after, 'ali', 'binta')).toBe('full - female');
  });

  it('siblingsOf rend toute la fratrie, demi-frères et enfants du conjoint d’un parent compris', () => {
    const f = polygamous();
    const names = (list: readonly SiblingResult[]) =>
      list.map(
        (link) => `${f.keyOf(link.toId) ?? '?'}:${link.kind === 'sibling' ? link.sharing : 'step'}`,
      );
    expect(names(siblingsOf(f.graph, f.id('ali')))).toEqual(
      expect.arrayContaining(['aminata:full', 'binta:half', 'samba:full_or_half', 'issa:step']),
    );
    expect(siblingsOf(f.graph, f.id('ali'))).toHaveLength(4);
    // Chaque lien de la liste est celui que donne siblingLink, et dans l'ordre des identifiants.
    for (const link of siblingsOf(f.graph, f.id('ali'))) {
      expect(siblingLink(f.graph, link.fromId, link.toId)).toEqual(link);
    }
    const ids = siblingsOf(f.graph, f.id('ali')).map((link) => link.toId);
    expect(ids).toEqual([...ids].sort());
  });
});

describe('enfant du conjoint d’un parent (alliance, exposé pour T-021)', () => {
  it('Issa, fils de Kadi, épouse de Moussa : jamais demi-frère d’Ali', () => {
    const f = polygamous();
    const link = step(f, 'ali', 'issa');
    expect(link.via).toHaveLength(1);
    const [via] = link.via;
    expect(f.keyOf(via?.fromParentId ?? '')).toBe('moussa');
    expect(f.keyOf(via?.toParentId ?? '')).toBe('kadi');
    expect(via?.fromSide).toBe('father');
    expect(via?.toSide).toBe('mother');
    expect(via?.unionIds).toHaveLength(1);
    expect(link.toGender).toBe('male');
  });

  it('un enfant qui partage un parent n’est jamais aussi « enfant du conjoint » (CL-FAM-01)', () => {
    const f = polygamous();
    expect(siblingLink(f.graph, f.id('ali'), f.id('binta'))?.kind).toBe('sibling');
  });

  it('le parent lui-même, ou son conjoint, n’est pas un frère', () => {
    const f = polygamous();
    expect(siblingLink(f.graph, f.id('ali'), f.id('moussa'))).toBeUndefined();
    expect(siblingLink(f.graph, f.id('ali'), f.id('fanta'))).toBeUndefined();
    expect(siblingLink(f.graph, f.id('ali'), f.id('ali'))).toBeUndefined();
  });
});

describe('types de filiation et certitude', () => {
  it('deux enfants adoptés par le même couple : frères, sur une autre base que la naissance', () => {
    const f = fixture({
      personnes: ['marc/M', 'anne/F', 'lea/F', 'tom/M'],
      filiations: [
        { parents: ['marc', 'anne'], enfant: 'lea' },
        { parents: ['marc', 'anne'], enfant: 'tom', type: 'adoptive' },
      ],
    });
    const link = sibling(f, 'lea', 'tom');
    expect(link.basis).toBe('other');
    expect(link.sharing).toBe('full');
    expect(link.filiationTypes).toEqual(['birth', 'adoptive']);
  });

  it('élevé par l’épouse de son père : demi-frère de naissance, le lien « a élevé » à part', () => {
    const f = fixture({
      personnes: ['paul/M', 'rose/F', 'jeanne/F', 'marc/M', 'luc/M'],
      filiations: [
        { parents: ['paul', 'rose'], enfant: 'marc' },
        { parents: ['jeanne'], enfant: 'marc', type: 'a_eleve' },
        { parents: ['paul', 'jeanne'], enfant: 'luc' },
      ],
    });
    const link = sibling(f, 'marc', 'luc');
    expect(link.basis).toBe('birth');
    expect(link.sharing).toBe('half');
    expect(link.side).toBe('father');
    expect(
      link.alsoShared.map((p) => [f.keyOf(p.personId), p.fromLink.type, p.toLink.type]),
    ).toEqual([['jeanne', 'raised', 'birth']]);
  });

  it('la certitude est la plus faible des filiations vers les parents communs (PAR-08)', () => {
    const f = fixture({
      personnes: ['paul/M', 'rose/F', 'lea/F', 'tom/M'],
      filiations: [
        { parents: ['paul', 'rose'], enfant: 'lea' },
        { parents: ['rose'], enfant: 'tom' },
        { parents: ['paul'], enfant: 'tom', certitude: 'probable' },
      ],
    });
    expect(sibling(f, 'lea', 'tom').certainty).toBe('probable');
    expect(sibling(f, 'lea', 'tom').sharing).toBe('full');
  });
});

describe('visibilité : le calcul ne voit que le graphe du lecteur (PAR-09)', () => {
  it('parent commun masqué : aucun lien de fratrie, sans autre indice', () => {
    const f = fixture(
      {
        personnes: ['paul/M', 'lea/F', 'tom/M'],
        filiations: [
          { parents: ['paul'], enfant: 'lea' },
          { parents: ['paul'], enfant: 'tom' },
        ],
      },
      { hidden: ['paul'] },
    );
    expect(siblingLink(f.graph, f.id('lea'), f.id('tom'))).toBeUndefined();
    expect(siblingsOf(f.graph, f.id('lea'))).toEqual([]);
  });

  it('autre parent masqué : comme s’il n’avait jamais été saisi (frère ou demi-frère)', () => {
    const section = {
      personnes: ['paul/M', 'rose/F', 'lea/F', 'tom/M'],
      filiations: [
        { parents: ['paul', 'rose'], enfant: 'lea' },
        { parents: ['paul', 'rose'], enfant: 'tom' },
      ],
    };
    const masked = fixture(section, { hidden: ['rose'] });
    const neverEntered = fixture({
      personnes: ['paul/M', 'lea/F', 'tom/M'],
      filiations: [
        { parents: ['paul'], enfant: 'lea' },
        { parents: ['paul'], enfant: 'tom' },
      ],
    });
    expect(summary(masked, 'lea', 'tom')).toBe(summary(neverEntered, 'lea', 'tom'));
    expect(summary(masked, 'lea', 'tom')).toBe('full_or_half father male');
  });

  it('personne absente du graphe : aucun lien', () => {
    const f = polygamous({ hidden: ['binta'] });
    expect(siblingLink(f.graph, f.id('ali'), f.id('binta'))).toBeUndefined();
  });
});

describe('côté d’un parent et d’une montée (CL-FAM-08)', () => {
  const f = fixture({
    personnes: ['ada/F', 'bea/F', 'carl/M', 'lea/F', 'tom/M', 'gp/M', 'oncle/M', 'cousin/M'],
    filiations: [
      { parents: ['ada', 'bea'], enfant: 'lea' },
      { parents: ['ada', 'carl'], enfant: 'tom' },
      { parents: ['gp'], enfant: 'carl' },
      { parents: ['gp'], enfant: 'oncle' },
      { parents: ['oncle'], enfant: 'cousin' },
    ],
  });

  it('deux mères : « parent » pour chacune ; un père et une mère : père, mère', () => {
    expect(parentSide(f.graph, f.id('lea'), f.id('ada'))).toBe('parent');
    expect(parentSide(f.graph, f.id('lea'), f.id('bea'))).toBe('parent');
    expect(parentSide(f.graph, f.id('tom'), f.id('ada'))).toBe('mother');
    expect(parentSide(f.graph, f.id('tom'), f.id('carl'))).toBe('father');
    expect(parentSide(f.graph, f.id('tom'), f.id('lea'))).toBeUndefined();
  });

  it('le côté d’un demi-frère est le même vu des deux : « parent » dès qu’un des deux a deux mères', () => {
    expect(summary(f, 'lea', 'tom')).toBe('half parent male');
    expect(summary(f, 'tom', 'lea')).toBe('half parent female');
  });

  it('côté de la montée d’un lien de sang : cousin par le père', () => {
    const [first] = (() => {
      const result = findRelationships(f.graph, f.id('tom'), f.id('cousin'));
      return result.status === 'related' ? result.relationships : [];
    })();
    const segment = first?.segments[0];
    if (segment?.kind !== 'blood') throw new Error('Expected blood');
    expect(ascentSide(f.graph, segment)).toBe('father');
    const back = findRelationships(f.graph, f.id('carl'), f.id('tom'));
    const down = back.status === 'related' ? back.relationships[0]?.segments[0] : undefined;
    if (down?.kind !== 'blood') throw new Error('Expected blood');
    expect(ascentSide(f.graph, down)).toBeUndefined();
  });
});

describe('inverse', () => {
  it('le lien de B vers A est l’inverse de celui de A vers B', () => {
    const f = polygamous();
    for (const [a, b] of [
      ['ali', 'binta'],
      ['ali', 'samba'],
      ['ali', 'issa'],
      ['ali', 'aminata'],
    ] as const) {
      const forward = siblingLink(f.graph, f.id(a), f.id(b));
      if (forward === undefined) throw new Error('Expected a link');
      expect(siblingLink(f.graph, f.id(b), f.id(a))).toEqual(invertSiblingLink(forward));
      expect(invertSiblingLink(invertSiblingLink(forward))).toEqual(forward);
    }
  });
});
