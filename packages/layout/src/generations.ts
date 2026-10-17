// Étape 1 de la disposition (TRD) : un parcours en largeur depuis la personne centrale donne à
// chacun une rangée, les ascendants au-dessus, les descendants en dessous. Une filiation fait
// monter ou descendre d'une rangée, une union reste sur la même. Une personne atteinte par deux
// chemins de longueurs différentes garde la rangée du plus court ; à longueur égale, la rangée
// la plus proche de la personne centrale, puis la plus haute (ADR 0013). L'autre lien devient un
// trait long (`crossLinks`, structure.ts).
import type { Id } from '@lignee/domain';

import { indexGraph, type GraphIndex } from './graph';
import type { Generations, LayoutGraph } from './types';

/** Vrai si la rangée `candidate` est préférée à `current`, à distance égale. */
function closer(candidate: number, current: number): boolean {
  const a = Math.abs(candidate);
  const b = Math.abs(current);
  return a < b || (a === b && candidate < current);
}

export function generationsFromIndex(index: GraphIndex, centerId: Id): Generations {
  if (!index.people.has(centerId)) {
    throw new RangeError('The central person is not in the graph');
  }
  const rowOf = new Map<Id, number>([[centerId, 0]]);
  const distanceOf = new Map<Id, number>([[centerId, 0]]);
  const order: Id[] = [centerId];
  let frontier: Id[] = [centerId];
  let distance = 0;

  while (frontier.length > 0) {
    distance += 1;
    const proposals = new Map<Id, number>();
    const next: Id[] = [];
    const propose = (id: Id, row: number) => {
      if (rowOf.has(id)) return;
      const current = proposals.get(id);
      if (current === undefined) {
        proposals.set(id, row);
        next.push(id);
      } else if (closer(row, current)) {
        proposals.set(id, row);
      }
    };
    for (const id of frontier) {
      const row = rowOf.get(id) ?? 0;
      for (const link of index.parentLinksOf.get(id) ?? []) propose(link.parentId, row - 1);
      for (const union of index.unionsOf.get(id) ?? []) {
        for (const spouse of union.spouses) propose(spouse.personId, row);
      }
      for (const link of index.childLinksOf.get(id) ?? []) propose(link.childId, row + 1);
    }
    for (const id of next) {
      rowOf.set(id, proposals.get(id) ?? 0);
      distanceOf.set(id, distance);
      order.push(id);
    }
    frontier = next;
  }

  const rows = new Map<number, Id[]>();
  for (const id of order) {
    const row = rowOf.get(id) ?? 0;
    const list = rows.get(row);
    if (list === undefined) rows.set(row, [id]);
    else list.push(id);
  }
  const unreachable = [...index.people.keys()].filter((id) => !rowOf.has(id));
  return { centerId, rowOf, distanceOf, rows, unreachable };
}

/** Étape 1 seule : la rangée de chaque personne reliée à `centerId`. */
export function computeGenerations(graph: LayoutGraph, centerId: Id): Generations {
  return generationsFromIndex(indexGraph(graph), centerId);
}
