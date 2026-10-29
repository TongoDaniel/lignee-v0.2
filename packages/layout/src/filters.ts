// Filtres de l'arbre (PRD, ARB-11) : côté paternel ou maternel, branche, foyer. Chaque fonction
// rend l'ensemble des personnes qui correspondent ; elle ne lit que le graphe reçu, déjà limité à
// ce que le lecteur peut voir (comme `layoutTree` et `layoutDescendants`, ADR 0024). Elle ne peut
// donc rendre aucune personne masquée : un filtre ne fait que choisir parmi les personnes
// visibles. Définitions et limites : ADR 0033. Fonctions pures, sans React ni Skia.
import type { Id } from '@lignee/domain';

import { findDescendants } from './descendants';
import type { OutlineUnion } from './scene/outline';
import type { LayoutGraph } from './types';

/** Côté de la famille de la personne au centre. */
export type Side = 'paternal' | 'maternal';

/** Parents de naissance (filiation `birth`) de chaque enfant, et enfants de chaque parent. */
function birthLinks(graph: LayoutGraph): {
  readonly parentsOf: ReadonlyMap<Id, readonly Id[]>;
  readonly childrenOf: ReadonlyMap<Id, readonly Id[]>;
} {
  const known = new Set(graph.people.map((person) => person.id));
  const parentsOf = new Map<Id, Id[]>();
  const childrenOf = new Map<Id, Id[]>();
  const push = (map: Map<Id, Id[]>, key: Id, value: Id) => {
    const list = map.get(key);
    if (list === undefined) map.set(key, [value]);
    else list.push(value);
  };
  for (const filiation of graph.filiations) {
    if (filiation.type !== 'birth') continue;
    if (!known.has(filiation.parentId) || !known.has(filiation.childId)) continue;
    push(parentsOf, filiation.childId, filiation.parentId);
    push(childrenOf, filiation.parentId, filiation.childId);
  }
  return { parentsOf, childrenOf };
}

/** Parcours en largeur depuis `starts` (compris) le long de `next`. */
function reach(starts: Iterable<Id>, next: ReadonlyMap<Id, readonly Id[]>): Set<Id> {
  const seen = new Set<Id>(starts);
  const queue = [...seen];
  for (let at = 0; at < queue.length; at += 1) {
    for (const id of next.get(queue[at] as Id) ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
  }
  return seen;
}

/**
 * Parents de naissance de la personne au centre qui donnent le côté : le père (genre « homme »)
 * pour le côté paternel, la mère (genre « femme ») pour le côté maternel. Un parent d'un autre
 * genre ou sans genre ne donne ni l'un ni l'autre : aucun genre n'est deviné.
 */
export function sideRoots(graph: LayoutGraph, centerId: Id, side: Side): readonly Id[] {
  const gender = side === 'paternal' ? 'male' : 'female';
  const { parentsOf } = birthLinks(graph);
  const genderOf = new Map(graph.people.map((person) => [person.id, person.gender] as const));
  return (parentsOf.get(centerId) ?? []).filter((id) => genderOf.get(id) === gender);
}

/**
 * Côté paternel ou maternel de la personne au centre : le parent qui le donne, tous ses ascendants
 * de naissance, et leurs autres descendants de naissance (frères et sœurs du parent, oncles,
 * tantes, cousins). Ni la personne au centre, ni ses frères et sœurs, ni ses descendants (ils
 * descendent du parent lui-même), ni les conjoints : la mère n'est pas du côté paternel. Vide si
 * le parent n'est pas connu.
 */
export function sideMembers(graph: LayoutGraph, centerId: Id, side: Side): ReadonlySet<Id> {
  const roots = sideRoots(graph, centerId, side);
  if (roots.length === 0) return new Set();
  const { parentsOf, childrenOf } = birthLinks(graph);
  const above = reach(roots, parentsOf);
  const strictAncestors = [...above].filter((id) => !roots.includes(id));
  const lateral = reach(strictAncestors, childrenOf);
  const rootLine = reach(roots, childrenOf);
  const members = new Set<Id>(above);
  for (const id of lateral) if (!rootLine.has(id)) members.add(id);
  return members;
}

/**
 * Branche d'une personne (PRD, CPT-08 : « cette personne, ses unions et toute sa descendance ») :
 * la personne, ses descendants tels que l'arbre les range, et leurs foyers entiers. Ce sont
 * exactement les personnes de la vue « descendance » (ARB-14, ADR 0024, règles 6 et 7).
 */
export function branchMembers(graph: LayoutGraph, rootId: Id): ReadonlySet<Id> {
  return findDescendants(graph, rootId).people;
}

/** Foyer (PRD, ARB-03) : les deux conjoints et les enfants rangés sous leur union. */
export function foyerMembers(centerId: Id, union: OutlineUnion): ReadonlySet<Id> {
  const members = new Set<Id>([centerId, ...union.childIds]);
  if (union.partnerId !== undefined) members.add(union.partnerId);
  return members;
}
