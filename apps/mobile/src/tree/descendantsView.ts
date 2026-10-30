// Vue « descendance » d'un ancêtre ouverte depuis l'arbre (PRD, ARB-14, T-025). La disposition est
// celle de `layoutDescendants` (packages/layout) et la scène celle du dessin ordinaire (T-017) :
// ce module ne décide que de qui peut ouvrir la vue. Il ne reçoit que le graphe déjà filtré pour
// le lecteur (ADR 0024, obligation de T-025). Fonctions pures, sans Skia.
import type { Id } from '@lignee/domain';
import {
  layoutDescendants,
  type FoldChoices,
  type LayoutGraph,
  type OutlineEntry,
  type TreeLayout,
} from '@lignee/layout';

import type { PersonCard } from './personCards';

/**
 * La vue a un sens quand la personne a au moins un enfant visible : sinon elle montrerait une
 * fiche seule. Les enfants d'un foyer replié comptent (l'entrée de parcours les liste tous).
 */
export function hasDescendants(entry: OutlineEntry | undefined): boolean {
  return entry?.unions.some((union) => union.childIds.length > 0) === true;
}

/** Peut-on ouvrir la descendance de cette personne ? Pas une place à compléter, et des enfants. */
export function canOpenDescendants(
  personId: Id,
  cards: ReadonlyMap<Id, PersonCard>,
  outline: ReadonlyMap<Id, OutlineEntry>,
): boolean {
  return cards.get(personId)?.placeholder === false && hasDescendants(outline.get(personId));
}

/** Disposition de la vue « descendance » : tout déplié, l'ancêtre en x = 0 (ARB-14). */
export function descendantsLayout(
  graph: LayoutGraph,
  ancestorId: Id,
  folds: FoldChoices,
): TreeLayout {
  return layoutDescendants(graph, ancestorId, { folds });
}
