// Vue « descendance » d'un ancêtre (PRD, ARB-14) : tous ses descendants, foyer par foyer. Les
// descendants sont ceux que l'arbre range sous ses familles, puis sous celles de ses descendants
// (mêmes règles de rangement qu'ailleurs : ADR 0013, règle 6). La vue garde aussi l'autre parent
// de chaque famille et les conjoints des descendants, pour que chaque foyer soit entier ; rien
// d'autre (ni les parents de l'ancêtre, ni la famille d'un conjoint). Tout est déplié par défaut ;
// l'implexe (un descendant atteint par deux chemins) donne une seule fiche et un lien (étape 6).
// Règles retenues : ADR 0024. Fonctions pures : le sous-graphe ne contient que des objets du
// graphe reçu, déjà limité à ce que le lecteur peut voir.
import type { Id } from '@lignee/domain';

import type { FoldChoices, LayoutOptions, TreeLayout } from './layout-types';
import { buildTreeStructure } from './structure';
import { layoutPrepared, prepareTree, type PreparedTree } from './tree-layout';
import type { LayoutGraph } from './types';

/** Descendants d'un ancêtre et personnes gardées par la vue « descendance ». */
export interface DescendantSet {
  readonly ancestorId: Id;
  /** L'ancêtre et ses descendants, dans l'ordre de découverte. */
  readonly descendants: ReadonlySet<Id>;
  /** Les descendants, puis l'autre parent de chaque famille et les conjoints des descendants. */
  readonly people: ReadonlySet<Id>;
}

/** Descendants de `ancestorId` d'après les familles où l'arbre range chaque enfant. */
export function findDescendants(graph: LayoutGraph, ancestorId: Id): DescendantSet {
  const structure = buildTreeStructure(graph, ancestorId);
  // Familles de chaque parent : foyers (les deux parents) et colonne « non précisé ».
  const familiesOf = new Map<Id, { parents: readonly Id[]; children: readonly Id[] }[]>();
  const add = (parent: Id, family: { parents: readonly Id[]; children: readonly Id[] }) => {
    const list = familiesOf.get(parent);
    if (list === undefined) familiesOf.set(parent, [family]);
    else list.push(family);
  };
  for (const foyer of structure.foyerOf.values()) {
    const family = { parents: [foyer.hubId, foyer.partnerId], children: foyer.children };
    add(foyer.hubId, family);
    add(foyer.partnerId, family);
  }
  for (const unit of structure.units) {
    const column = unit.unspecified;
    if (column === undefined) continue;
    add(column.parentId, {
      parents: [column.parentId],
      children: column.children.map((child) => child.childId),
    });
  }

  const descendants = new Set<Id>([ancestorId]);
  const queue: Id[] = [ancestorId];
  for (let next = 0; next < queue.length; next += 1) {
    for (const family of familiesOf.get(queue[next] as Id) ?? []) {
      for (const child of family.children) {
        if (!descendants.has(child)) {
          descendants.add(child);
          queue.push(child);
        }
      }
    }
  }
  const people = new Set(descendants);
  for (const id of descendants) {
    for (const family of familiesOf.get(id) ?? []) {
      for (const parent of family.parents) people.add(parent);
    }
  }
  return { ancestorId, descendants, people };
}

/**
 * Le sous-graphe de la vue « descendance » : les personnes de `findDescendants`, les unions qui
 * touchent un descendant, les filiations vers un descendant (sauf vers l'ancêtre), et ce qui
 * les accompagne (candidats, faits, réponses de simultanéité, naissances multiples). Chaque
 * objet vient du graphe reçu, dans le même ordre.
 */
export function descendantsGraph(graph: LayoutGraph, set: DescendantSet): LayoutGraph {
  const { ancestorId, descendants, people } = set;
  const unions = graph.unions.filter(
    (union) =>
      union.spouses.every((spouse) => people.has(spouse.personId)) &&
      union.spouses.some((spouse) => descendants.has(spouse.personId)),
  );
  const unionIds = new Set(unions.map((union) => union.id));
  return {
    people: graph.people.filter((person) => people.has(person.id)),
    unions,
    filiations: graph.filiations.filter(
      (filiation) =>
        filiation.childId !== ancestorId &&
        descendants.has(filiation.childId) &&
        people.has(filiation.parentId),
    ),
    parentCandidates: (graph.parentCandidates ?? []).filter(
      (candidate) =>
        candidate.childId !== ancestorId &&
        descendants.has(candidate.childId) &&
        people.has(candidate.candidateId),
    ),
    facts: (graph.facts ?? []).filter(
      (fact) => fact.subject.kind === 'person' && people.has(fact.subject.personId),
    ),
    simultaneityAnswers: (graph.simultaneityAnswers ?? []).filter((answer) =>
      answer.unionIds.every((id) => unionIds.has(id)),
    ),
    multipleBirths: graph.multipleBirths ?? [],
  };
}

/**
 * Étapes 1 et 2 de la vue « descendance », toutes les familles dépliées par défaut (ARB-14 :
 * « tous ses descendants ») ; le lecteur peut en replier avec les mêmes choix qu'ailleurs.
 */
export function prepareDescendants(graph: LayoutGraph, ancestorId: Id): PreparedTree {
  const prepared = prepareTree(
    descendantsGraph(graph, findDescendants(graph, ancestorId)),
    ancestorId,
  );
  const foldedByDefault = new Map(
    [...prepared.families.families.keys()].map((key) => [key, false] as const),
  );
  return { ...prepared, families: { ...prepared.families, foldedByDefault } };
}

const NO_FOLDS: FoldChoices = new Map();

/**
 * Vue « descendance » de `ancestorId` (ARB-14) : l'ancêtre en x = 0 sur la rangée 0, ses foyers
 * dans l'ordre des rangs, puis tous ses descendants foyer par foyer, chacun une seule fois.
 */
export function layoutDescendants(
  graph: LayoutGraph,
  ancestorId: Id,
  options: LayoutOptions = {},
): TreeLayout {
  return layoutPrepared(prepareDescendants(graph, ancestorId), {
    folds: options.folds ?? NO_FOLDS,
  });
}
