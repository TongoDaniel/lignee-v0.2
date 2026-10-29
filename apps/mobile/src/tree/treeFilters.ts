// Filtres de l'arbre (PRD, ARB-11) : quels critères le lecteur peut choisir, et quelles personnes
// y répondent. Fonctions pures, sans Skia ni React. Elles ne lisent que le graphe reçu, déjà
// limité à ce que le lecteur peut voir : un filtre choisit parmi les personnes visibles, il n'en
// révèle aucune (« Les filtres n'affichent jamais une personne masquée »). Le calcul des côtés, des
// branches et des foyers est dans `packages/layout` (filters.ts) ; ici, la vie, les choix proposés
// et le dénombrement. Définitions : ADR 0033.
import type { Id } from '@lignee/domain';
import {
  ancestorRoots,
  branchMembers,
  foyerMembers,
  sideMembers,
  sideRoots,
  type LayoutGraph,
  type OutlineEntry,
  type Side,
} from '@lignee/layout';

import type { PersonCard } from './personCards';

/** Un seul filtre à la fois : le PRD n'en demande pas davantage (ADR 0033). */
export type TreeFilter =
  | { readonly kind: 'side'; readonly side: Side }
  | { readonly kind: 'vital'; readonly status: 'living' | 'deceased' }
  | { readonly kind: 'foyer'; readonly familyKey: string }
  | { readonly kind: 'branch'; readonly rootId: Id };

/** Ce dont les filtres ont besoin : tout vient du graphe filtré pour le lecteur. */
export interface FilterSource {
  readonly graph: LayoutGraph;
  readonly cards: ReadonlyMap<Id, PersonCard>;
  /** Personne au centre de la disposition : les côtés et le foyer se comptent depuis elle. */
  readonly centerId: Id;
  readonly outline: ReadonlyMap<Id, OutlineEntry>;
}

/** Générations d'ancêtres dont on propose la branche : parents, grands-parents. */
export const BRANCH_ROOT_GENERATIONS = 2;

/** Personnes qui répondent au filtre (placeholders compris : ils restent dessinés avec leur famille). */
export function matchingPeople(filter: TreeFilter, source: FilterSource): ReadonlySet<Id> {
  switch (filter.kind) {
    case 'side':
      return sideMembers(source.graph, source.centerId, filter.side);
    case 'branch':
      return branchMembers(source.graph, filter.rootId);
    case 'foyer': {
      const union = source.outline
        .get(source.centerId)
        ?.unions.find((candidate) => candidate.familyKey === filter.familyKey);
      return union === undefined ? new Set() : foyerMembers(source.centerId, union);
    }
    case 'vital': {
      const matching = new Set<Id>();
      for (const person of source.graph.people) {
        const card = source.cards.get(person.id);
        if (card === undefined || card.placeholder) continue;
        if (filter.status === 'living' ? card.living : card.deceased) matching.add(person.id);
      }
      return matching;
    }
  }
}

/**
 * Nombre de personnes à compter pour le lecteur : les places à compléter n'en sont pas, et, si
 * `drawn` est donné, seulement celles qui sont dessinées (les foyers repliés ne comptent pas :
 * le nombre dit ce que l'on voit, ADR 0033).
 */
export function countPeople(
  matching: ReadonlySet<Id>,
  cards: ReadonlyMap<Id, PersonCard>,
  drawn?: ReadonlyMap<Id, unknown>,
): number {
  let count = 0;
  for (const id of matching) {
    if (cards.get(id)?.placeholder === false && (drawn === undefined || drawn.has(id))) count += 1;
  }
  return count;
}

export interface FilterChoices {
  /** Côtés dont le parent est connu et de genre noté ; jamais un côté vide. */
  readonly sides: readonly Side[];
  /** Foyers de la personne au centre, dans l'ordre des rangs. */
  readonly foyers: readonly { readonly familyKey: string; readonly partnerId: Id }[];
  /** Parents puis grands-parents de naissance de la personne au centre. */
  readonly branchRoots: readonly Id[];
}

/** Choix proposés pour la personne au centre. */
export function filterChoices(source: FilterSource): FilterChoices {
  const sides = (['paternal', 'maternal'] as const).filter(
    (side) => sideRoots(source.graph, source.centerId, side).length > 0,
  );
  const foyers = (source.outline.get(source.centerId)?.unions ?? []).flatMap((union) =>
    union.kind === 'foyer' &&
    union.partnerId !== undefined &&
    source.cards.get(union.partnerId)?.placeholder === false
      ? [{ familyKey: union.familyKey, partnerId: union.partnerId }]
      : [],
  );
  const branchRoots = ancestorRoots(source.graph, source.centerId, BRANCH_ROOT_GENERATIONS).filter(
    (id) => source.cards.get(id)?.placeholder === false,
  );
  return { sides, foyers, branchRoots };
}

/** Identifiant de test d'une ligne de filtre ; jamais affiché. */
export function filterTestId(filter: TreeFilter): string {
  switch (filter.kind) {
    case 'side':
      return `filter-side-${filter.side}`;
    case 'vital':
      return `filter-vital-${filter.status}`;
    case 'foyer':
      return `filter-foyer-${filter.familyKey}`;
    case 'branch':
      return `filter-branch-${filter.rootId}`;
  }
}

export function sameFilter(a: TreeFilter | undefined, b: TreeFilter | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'side':
      return a.side === (b as typeof a).side;
    case 'vital':
      return a.status === (b as typeof a).status;
    case 'foyer':
      return a.familyKey === (b as typeof a).familyKey;
    case 'branch':
      return a.rootId === (b as typeof a).rootId;
  }
}

/** Tous les filtres que la feuille propose pour ces choix. */
export function allFilters(choices: FilterChoices): readonly TreeFilter[] {
  return [
    ...choices.sides.map((side) => ({ kind: 'side', side }) as const),
    { kind: 'vital', status: 'living' },
    { kind: 'vital', status: 'deceased' },
    ...choices.foyers.map((foyer) => ({ kind: 'foyer', familyKey: foyer.familyKey }) as const),
    ...choices.branchRoots.map((rootId) => ({ kind: 'branch', rootId }) as const),
  ];
}
