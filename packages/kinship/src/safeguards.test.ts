// Garde-fous du calcul (ADR 0010, point 7) : un arbre où les chemins se multiplient (échelle
// d'implexe : chaque génération a deux parents communs aux deux branches) ne doit ni bloquer, ni
// rendre « aucun lien » à tort, ni casser la symétrie A vers B, B vers A. Chaque limite
// (maxChains, maxPathChecks, maxRelationships) est signalée par `truncated`, et l'absence de
// chemin sous une limite atteinte est `incomplete`, jamais `none`.
import type { Filiation, Id, Person } from '@lignee/domain';
import { medianTime, reportBudget } from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';

import { createKinshipGraph, type KinshipGraph } from './graph';
import { commonAncestorsOfPaths, findRelationships } from './kinship';
import { invertRelationship, type KinshipResult } from './relationship';
import { fixture } from './test-support/fixtures';

/**
 * Garde-fou de temps du calcul borné : « en moins d'une seconde » (ADR 0010, Mesure), × facteur
 * (README racine, « Tests de performance »).
 */
const SAFEGUARD_BUDGET_MS = 1000;

/** Médiane de trois calculs sur un graphe neuf (cache froid), comparée au garde-fou. */
function expectWithinSafeguard(label: string, run: () => void) {
  const { medianMs } = medianTime(run, { warmup: 0, runs: 3 });
  const report = reportBudget(`garde-fou du moteur, ${label}`, medianMs, SAFEGUARD_BUDGET_MS);
  expect(report.measuredMs).toBeLessThan(report.ceilingMs);
}

/** Petit constructeur d'arbre : identifiants lisibles, filiations de naissance certaines. */
function builder() {
  let counter = 0;
  const people: Person[] = [];
  const filiations: Filiation[] = [];
  const next = (prefix: string) => `${prefix}${String((counter += 1)).padStart(5, '0')}`;
  return {
    people,
    filiations,
    person(): Id {
      const id = next('p');
      people.push({
        id,
        treeId: 't',
        nature: 'known',
        gender: 'unspecified',
        vitalStatus: 'unknown',
        version: 0,
      });
      return id;
    },
    child(parentId: Id, childId: Id) {
      filiations.push({
        id: next('f'),
        treeId: 't',
        parentId,
        childId,
        type: 'birth',
        certainty: 'certain',
        recognitionStatus: 'unknown',
      });
    },
    graph(): KinshipGraph {
      return createKinshipGraph({ people, unions: [], filiations });
    },
  };
}

/**
 * Échelle d'implexe de `height` générations au-dessus de `base` : à chaque génération, deux
 * personnes, toutes deux parents des deux personnes de la génération du dessous. Le nombre de
 * chaînes montantes double à chaque génération.
 */
function ladder(tree: ReturnType<typeof builder>, base: Id, height: number): [Id, Id] {
  let x = tree.person();
  let y = tree.person();
  const bottom: [Id, Id] = [x, y];
  tree.child(x, base);
  tree.child(y, base);
  for (let level = 0; level < height; level += 1) {
    const nx = tree.person();
    const ny = tree.person();
    for (const parent of [nx, ny]) for (const child of [x, y]) tree.child(parent, child);
    x = nx;
    y = ny;
  }
  return bottom;
}

function expectInverse(graph: KinshipGraph, a: Id, b: Id, options = {}) {
  const forward = findRelationships(graph, a, b, options);
  const backward = findRelationships(graph, b, a, options);
  if (forward.status === 'related' && backward.status === 'related') {
    expect(backward.relationships).toEqual(forward.relationships.map(invertRelationship));
    expect(backward.truncated).toBe(forward.truncated);
  } else {
    expect(backward).toEqual(forward);
  }
  return forward;
}

function sharingOf(result: KinshipResult) {
  if (result.status !== 'related') return result.status;
  const segment = result.relationships[0]?.segments[0];
  return segment?.kind === 'blood' ? segment.sharing : 'alliance';
}

// Échelle de 30 générations : des milliers de chemins à parcourir, le délai par défaut de vitest
// (5 s) est trop court sous la charge de la CI.
describe('échelle d’implexe', { timeout: 30_000 }, () => {
  it('deux frères sous une échelle de 30 générations : frères, dans les deux sens, complet', () => {
    const tree = builder();
    const [a, b, p, q] = [tree.person(), tree.person(), tree.person(), tree.person()];
    for (const parent of [p, q]) for (const child of [a, b]) tree.child(parent, child);
    ladder(tree, p, 30);
    const graph = tree.graph();
    const result = expectInverse(graph, a, b);
    expectWithinSafeguard('échelle de 30 générations, deux frères', () =>
      expectInverse(tree.graph(), a, b),
    );
    expect(sharingOf(result)).toBe('full');
    // Aucun ancêtre au-dessus de P n'est atteint par deux montées disjointes : écartés avant
    // l'énumération, aucune fausse limite.
    expect(result.status === 'related' && result.truncated).toBe(false);
    expect(
      commonAncestorsOfPaths(graph, a, b)
        .ancestors.map((c) => c.personId)
        .sort(),
    ).toEqual([p, q].sort());
  });

  it('cousins dans l’échelle : des chemins réellement innombrables, limite signalée', () => {
    const tree = builder();
    const base = tree.person();
    const [x, y] = ladder(tree, base, 30);
    const [a, b] = [tree.person(), tree.person()];
    tree.child(x, a);
    tree.child(y, b);
    const graph = tree.graph();
    const result = expectInverse(graph, a, b);
    expectWithinSafeguard('échelle de 30 générations, cousins', () =>
      expectInverse(tree.graph(), a, b),
    );
    // Cousins germains par les deux grands-parents d'abord, puis d'autres chemins par l'implexe.
    expect(sharingOf(result)).toBe('full');
    expect(result.status === 'related' && result.relationships.length).toBe(32);
    expect(result.status === 'related' && result.truncated).toBe(true);
  });

  it('demi-frères dont un seul parent porte l’échelle : demi-frères, sans limite atteinte', () => {
    const tree = builder();
    const [a, b, p, q, r] = [
      tree.person(),
      tree.person(),
      tree.person(),
      tree.person(),
      tree.person(),
    ];
    tree.child(p, a);
    tree.child(q, a);
    tree.child(q, b);
    tree.child(r, b);
    ladder(tree, p, 30);
    const graph = tree.graph();
    const result = expectInverse(graph, a, b);
    // Les ancêtres de P ne sont pas ancêtres de B : la montée par P est élaguée.
    expect(sharingOf(result)).toBe('half');
    expect(result.status === 'related' && result.truncated).toBe(false);
    expect(commonAncestorsOfPaths(graph, a, b)).toEqual({
      ancestors: [{ personId: q, generationsFromA: 1, generationsFromB: 1 }],
      truncated: false,
    });
  });
});

describe('chaque garde-fou est signalé', () => {
  const cousins = fixture({
    personnes: ['gp/M', 'gm/F', 'pa/M', 'oncle/M', 'moi/F', 'cousin/M'],
    filiations: [
      { parents: ['gp', 'gm'], enfant: 'pa' },
      { parents: ['gp', 'gm'], enfant: 'oncle' },
      { parents: ['pa'], enfant: 'moi' },
      { parents: ['oncle'], enfant: 'cousin' },
    ],
  });
  const [moi, cousin] = [cousins.id('moi'), cousins.id('cousin')];

  it('sans limite : cousins germains, rien de tronqué', () => {
    const result = findRelationships(cousins.graph, moi, cousin);
    expect(sharingOf(result)).toBe('full');
    expect(result.status === 'related' && result.truncated).toBe(false);
  });

  it('maxChains atteint avant le sommet : « incomplete », jamais « none »', () => {
    const options = { maxChains: 1, maxUnions: 0 } as const;
    expect(findRelationships(cousins.graph, moi, cousin, options)).toEqual({
      status: 'incomplete',
      truncated: true,
    });
    expect(findRelationships(cousins.graph, cousin, moi, options)).toEqual({
      status: 'incomplete',
      truncated: true,
    });
    expect(commonAncestorsOfPaths(cousins.graph, moi, cousin, { maxChains: 1 }).truncated).toBe(
      true,
    );
  });

  it('maxPathChecks atteint : « incomplete » ou chemins partiels, toujours signalés', () => {
    const result = expectInverse(cousins.graph, moi, cousin, { maxPathChecks: 1, maxUnions: 0 });
    expect(
      result.status === 'incomplete' || (result.status === 'related' && result.truncated),
    ).toBe(true);
  });

  it('maxRelationships : les plus proches seulement, tronqué', () => {
    const levirate = fixture({
      personnes: ['gp/M', 'gm/F', 'oumar/M', 'yaya/M', 'kadi/F', 'sidi/M', 'hawa/F'],
      unions: [{ conjoints: ['oumar', 'kadi'] }, { conjoints: ['yaya', 'kadi'] }],
      filiations: [
        { parents: ['gp', 'gm'], enfant: 'oumar' },
        { parents: ['gp', 'gm'], enfant: 'yaya' },
        { parents: ['oumar', 'kadi'], enfant: 'sidi' },
        { parents: ['yaya', 'kadi'], enfant: 'hawa' },
      ],
    });
    const [sidi, hawa] = [levirate.id('sidi'), levirate.id('hawa')];
    const all = findRelationships(levirate.graph, sidi, hawa);
    const one = expectInverse(levirate.graph, sidi, hawa, { maxRelationships: 1 });
    expect(all.status === 'related' && all.relationships.length).toBeGreaterThan(1);
    expect(one.status === 'related' && one.relationships).toEqual(
      all.status === 'related' && all.relationships.slice(0, 1),
    );
    expect(one.status === 'related' && one.truncated).toBe(true);
  });
});
