// Données de l'arbre pour l'écran (T-017) : de la copie locale (T-016) au graphe de la disposition,
// aux fiches affichées, aux liens supposés. Pas de logique de parenté ici : l'écran affiche.
import type { Id } from '@lignee/domain';
import { supposedKey, type LayoutGraph } from '@lignee/layout';
import {
  listLocalTrees,
  readTreeSnapshot,
  type LocalDatabase,
  type LocalTreeSnapshot,
} from '@lignee/sync';

import { buildPersonCards, type PersonCard } from './personCards';

export interface TreeModel {
  /** Arbre affiché : la route de la fiche d'une personne le nomme (plusieurs arbres, CPT-04). */
  readonly treeId: Id;
  readonly graph: LayoutGraph;
  readonly cards: ReadonlyMap<Id, PersonCard>;
  /** Personne au centre, « Vous » (provisoire, voir `chooseCenter`). */
  readonly centerId: Id;
  /**
   * Filiations dont la certitude n'est pas « certain » (clé `supposedKey(parent, enfant)`) : leur
   * trait est en pointillés. Une adoption certaine reste un trait plein (06-arbre.md).
   */
  readonly supposedFiliations: ReadonlySet<string>;
}

/**
 * « Vous » : la personne dont le compte est relié à sa fiche (CPT-06). Ce lien n'existe pas encore
 * dans la copie locale (T-048, T-050) : en attendant, la personne la plus reliée de l'arbre, à
 * égalité la première par identifiant. Remplacé dès que la fiche reliée est connue (ADR 0025).
 */
export function chooseCenter(snapshot: LocalTreeSnapshot): Id | undefined {
  const degree = new Map<Id, number>();
  const bump = (id: Id) => degree.set(id, (degree.get(id) ?? 0) + 1);
  for (const filiation of snapshot.filiations) {
    bump(filiation.parentId);
    bump(filiation.childId);
  }
  for (const union of snapshot.unions) for (const spouse of union.spouses) bump(spouse.personId);
  let best: Id | undefined;
  for (const person of snapshot.people) {
    if (person.nature !== 'known') continue;
    const score = degree.get(person.id) ?? 0;
    if (best === undefined || score > (degree.get(best) ?? 0)) best = person.id;
  }
  return best;
}

export function modelFromSnapshot(
  snapshot: LocalTreeSnapshot,
  centerId: Id | undefined = chooseCenter(snapshot),
): TreeModel | undefined {
  if (centerId === undefined) return undefined;
  return {
    treeId: snapshot.tree.id,
    graph: snapshot,
    cards: buildPersonCards({
      people: snapshot.people,
      names: snapshot.names,
      facts: snapshot.facts,
      nameOrder: snapshot.tree.nameOrder,
    }),
    centerId,
    supposedFiliations: new Set(
      snapshot.filiations
        .filter((filiation) => filiation.certainty !== 'certain')
        .map((filiation) => supposedKey(filiation.parentId, filiation.childId)),
    ),
  };
}

/** Premier arbre de la base du téléphone (CPT-04 : le choix entre plusieurs arbres viendra avec T-0xx). */
export function readFirstTreeModel(db: LocalDatabase): TreeModel | undefined {
  const first = listLocalTrees(db)[0];
  if (first === undefined) return undefined;
  const snapshot = readTreeSnapshot(db, first.id);
  return snapshot === undefined ? undefined : modelFromSnapshot(snapshot);
}
