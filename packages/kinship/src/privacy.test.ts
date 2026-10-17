// Le graphe ne laisse rien deviner de ce que le filtre de visibilité a retiré (PAR-09 ; relecture
// gardien-confidentialite, ADR 0010) : rangs renumérotés, objets réduits à leur structure, union
// d'origine et parents candidats retirés quand ils citent un objet absent, filiation masquée
// (paternité non officielle) sans trace.
import type { Filiation, Union } from '@lignee/domain';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph, type KinshipGraphInput } from './graph';
import { findRelationships } from './kinship';
import { fixture, type Fixture } from './test-support/fixtures';

function input(
  f: Fixture,
  keep: { unions?: (u: Union) => boolean; filiations?: (x: Filiation) => boolean } = {},
): KinshipGraphInput {
  return {
    people: f.data.people,
    unions: f.data.unions.filter(keep.unions ?? (() => true)),
    filiations: f.data.filiations.filter(keep.filiations ?? (() => true)),
    parentCandidates: f.data.parentCandidates,
  };
}

describe('union masquée entre deux personnes visibles', () => {
  // Moussa : Fanta (rang 1), Awa (rang 2, union masquée pour le lecteur), Binta (rang 3).
  const f = fixture({
    personnes: ['moussa/M', 'fanta/F', 'awa/F', 'binta/F', 'ali/M'],
    unions: [
      { conjoints: ['moussa', 'fanta'], rang_moussa: 1 },
      { conjoints: ['moussa', 'awa'], rang_moussa: 2 },
      { conjoints: ['moussa', 'binta'], rang_moussa: 3 },
    ],
    filiations: [{ parents: ['moussa', 'fanta'], enfant: 'ali' }],
  });
  const hidden = f.data.unions.find((u) => u.spouses.some((s) => s.personId === f.id('awa')));
  const masked = createKinshipGraph(input(f, { unions: (u) => u !== hidden }));
  // Le même arbre où cette union n'a jamais existé : Binta y est la 2e épouse.
  const never = createKinshipGraph({
    ...input(f, { unions: (u) => u !== hidden }),
    unions: f.data.unions
      .filter((u) => u !== hidden)
      .map((u) =>
        u.spouses.some((s) => s.personId === f.id('binta'))
          ? {
              ...u,
              spouses: [
                { ...u.spouses[0], rank: u.spouses[0].personId === f.id('moussa') ? 2 : 1 },
                { ...u.spouses[1], rank: u.spouses[1].personId === f.id('moussa') ? 2 : 1 },
              ] as Union['spouses'],
            }
          : u,
      ),
  });

  it('rangs renumérotés : Binta est la 2e, comme si l’union n’avait jamais existé', () => {
    for (const [a, b] of [
      ['ali', 'binta'],
      ['fanta', 'binta'],
      ['moussa', 'binta'],
      ['binta', 'awa'],
    ] as const) {
      expect(findRelationships(masked, f.id(a), f.id(b))).toEqual(
        findRelationships(never, f.id(a), f.id(b)),
      );
    }
    expect(masked.unionsOf(f.id('moussa'))).toEqual(never.unionsOf(f.id('moussa')));
    const ranks = masked
      .unionsOf(f.id('moussa'))
      .map((u) => u.spouses.find((s) => s.personId === f.id('moussa'))?.rank);
    expect(ranks).toEqual([1, 2]);
  });

  it('Awa et Moussa : aucun lien, sans autre indice', () => {
    expect(findRelationships(masked, f.id('awa'), f.id('moussa'))).toEqual({ status: 'none' });
  });
});

describe('objets réduits à leur structure', () => {
  it('ni notes, ni lieux, ni sources, ni statut de reconnaissance ; union d’origine absente retirée', () => {
    const f = fixture({
      personnes: ['pa/M', 'ma/F', 'fils/M'],
      unions: [{ conjoints: ['pa', 'ma'] }],
      filiations: [{ parents: ['pa', 'ma'], enfant: 'fils' }],
    });
    const [union] = f.data.unions;
    if (union === undefined) throw new Error('No union');
    const sourceId = f.data.tree.id;
    const graph = createKinshipGraph({
      people: f.data.people.map((p) => ({ ...p, notes: 'Note privée' })),
      unions: [], // l'union est masquée
      filiations: f.data.filiations.map((x) => ({
        ...x,
        originUnionId: union.id,
        sourceId,
        recognitionStatus: 'unofficial' as const,
      })),
    });
    const fils = f.id('fils');
    expect(Object.keys(graph.person(fils) ?? {}).sort()).toEqual(['gender', 'id', 'nature']);
    for (const filiation of graph.parentsOf(fils)) {
      expect(Object.keys(filiation).sort()).toEqual([
        'certainty',
        'childId',
        'id',
        'parentId',
        'type',
      ]);
    }
    // L'objet complet du modèle, avec des champs que le graphe ne doit pas recopier.
    const complete: Union = {
      ...union,
      notes: 'Note privée',
      placeId: sourceId,
      declaredOption: 'polygamy',
    };
    const full = createKinshipGraph({
      people: f.data.people,
      unions: [complete],
      filiations: f.data.filiations.map((x) => ({ ...x, originUnionId: union.id })),
    });
    expect(Object.keys(full.union(union.id) ?? {}).sort()).toEqual(['id', 'spouses', 'type']);
    expect(full.parentsOf(fils).every((x) => x.originUnionId === union.id)).toBe(true);
  });
});

describe('parents candidats (UNI-11)', () => {
  const f = fixture({
    personnes: ['pierre/M', 'rose/F', 'odile/F', 'samuel/M'],
    unions: [{ conjoints: ['pierre', 'rose'] }, { conjoints: ['pierre', 'odile'] }],
    filiations: [{ parents: ['pierre'], enfant: 'samuel' }],
  });
  const candidates = ['rose', 'odile'].map((key, index) => ({
    id: `c${String(index)}`,
    treeId: f.data.tree.id,
    childId: f.id('samuel'),
    candidateId: f.id(key),
  }));
  const odileUnion = f.data.unions.find((u) => u.spouses.some((s) => s.personId === f.id('odile')));

  it('gardés quand une union présente les relie au parent présent', () => {
    const graph = createKinshipGraph({ ...input(f), parentCandidates: candidates });
    expect(graph.parentCandidatesOf(f.id('samuel'))).toEqual([f.id('rose'), f.id('odile')].sort());
  });

  it('retiré quand son union avec le père est masquée (« parmi ses épouses » la trahirait)', () => {
    const graph = createKinshipGraph({
      ...input(f, { unions: (u) => u !== odileUnion }),
      parentCandidates: candidates,
    });
    expect(graph.parentCandidatesOf(f.id('samuel'))).toEqual([f.id('rose')]);
  });

  it('retiré quand le parent connu est masqué', () => {
    const graph = createKinshipGraph({
      ...input(f),
      people: f.data.people.filter((p) => p.id !== f.id('pierre')),
      parentCandidates: candidates,
    });
    expect(graph.parentCandidatesOf(f.id('samuel'))).toEqual([]);
  });
});

describe('PAR-09 : paternité non officielle masquée', () => {
  // Kofi est le père non officiel de Yao ; le lecteur ne voit pas cette filiation (« moi seul »
  // proposé, CON-04). Yao et Ama, fille officielle de Kofi, ne doivent pas apparaître liés.
  const f = fixture({
    personnes: ['kofi/M', 'efua/F', 'yao/M', 'ama/F', 'abla/F'],
    filiations: [
      { parents: ['kofi'], enfant: 'yao' },
      { parents: ['efua'], enfant: 'yao' },
      { parents: ['kofi', 'abla'], enfant: 'ama' },
    ],
  });
  const secret = f.data.filiations.find(
    (x) => x.parentId === f.id('kofi') && x.childId === f.id('yao'),
  );
  const filtered = createKinshipGraph(input(f, { filiations: (x) => x !== secret }));

  it('sans la filiation : aucun lien entre Yao et Kofi ni avec Ama, comme si elle n’existait pas', () => {
    expect(findRelationships(filtered, f.id('yao'), f.id('kofi'))).toEqual({ status: 'none' });
    expect(findRelationships(filtered, f.id('yao'), f.id('ama'))).toEqual({ status: 'none' });
    expect(filtered.parentsOf(f.id('yao')).map((x) => x.parentId)).toEqual([f.id('efua')]);
  });

  it('avec la filiation (lecteur autorisé) : demi-frère et sœur', () => {
    const all = createKinshipGraph(input(f));
    const result = findRelationships(all, f.id('yao'), f.id('ama'));
    const segment = result.status === 'related' ? result.relationships[0]?.segments[0] : undefined;
    expect(segment?.kind === 'blood' && segment.sharing).toBe('half');
  });
});

describe('unions répétées entre deux personnes', () => {
  it('mariés deux fois : un seul chemin, qui porte les deux unions', () => {
    const f = fixture({
      personnes: ['jo/M', 'lu/F'],
      unions: [{ conjoints: ['jo', 'lu'] }, { conjoints: ['jo', 'lu'] }],
    });
    const result = findRelationships(f.graph, f.id('jo'), f.id('lu'));
    if (result.status !== 'related') throw new Error('Expected related');
    expect(result.relationships).toHaveLength(1);
    const [link] = result.relationships[0]?.segments.filter((s) => s.kind === 'union') ?? [];
    expect(link?.kind === 'union' && link.unions.map((u) => u.unionId)).toEqual(
      f.data.unions.map((u) => u.id).sort(),
    );
    expect(link?.kind === 'union' && link.unions.map((u) => [u.fromRank, u.toRank])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });
});
