// Index du graphe reçu, construit une fois par calcul. Tout objet qui cite une personne absente
// du graphe (masquée pour le lecteur) est ignoré : la disposition n'en laisse aucune trace.
import type { Id } from '@lignee/domain';

import type {
  LayoutFact,
  LayoutFiliation,
  LayoutSimultaneityAnswer,
  LayoutGraph,
  LayoutParentCandidate,
  LayoutPerson,
  LayoutUnion,
} from './types';

export interface GraphIndex {
  readonly people: ReadonlyMap<Id, LayoutPerson>;
  /** Unions de chaque personne, dans l'ordre reçu. */
  readonly unionsOf: ReadonlyMap<Id, readonly LayoutUnion[]>;
  /** Filiations vers les parents de chaque enfant. */
  readonly parentLinksOf: ReadonlyMap<Id, readonly LayoutFiliation[]>;
  /** Filiations vers les enfants de chaque parent. */
  readonly childLinksOf: ReadonlyMap<Id, readonly LayoutFiliation[]>;
  /** Candidats de chaque enfant, sans doublon. */
  readonly candidatesOf: ReadonlyMap<Id, readonly Id[]>;
  /** Faits de chaque personne (décès compris). */
  readonly factsOf: ReadonlyMap<Id, readonly LayoutFact[]>;
  /** Réponses de simultanéité de chaque union (une réponse figure sous ses deux unions). */
  readonly answersOf: ReadonlyMap<Id, readonly LayoutSimultaneityAnswer[]>;
  readonly unions: readonly LayoutUnion[];
  readonly filiations: readonly LayoutFiliation[];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

export function indexGraph(graph: LayoutGraph): GraphIndex {
  const people = new Map<Id, LayoutPerson>();
  for (const person of graph.people) people.set(person.id, person);

  const unionsOf = new Map<Id, LayoutUnion[]>();
  const unions: LayoutUnion[] = [];
  for (const union of graph.unions) {
    const [a, b] = union.spouses;
    if (!people.has(a.personId) || !people.has(b.personId) || a.personId === b.personId) continue;
    unions.push(union);
    push(unionsOf, a.personId, union);
    push(unionsOf, b.personId, union);
  }

  const parentLinksOf = new Map<Id, LayoutFiliation[]>();
  const childLinksOf = new Map<Id, LayoutFiliation[]>();
  const filiations: LayoutFiliation[] = [];
  for (const filiation of graph.filiations) {
    const { parentId, childId } = filiation;
    if (!people.has(parentId) || !people.has(childId) || parentId === childId) continue;
    filiations.push(filiation);
    push(parentLinksOf, childId, filiation);
    push(childLinksOf, parentId, filiation);
  }

  const candidatesOf = new Map<Id, Id[]>();
  for (const candidate of graph.parentCandidates ?? ([] as readonly LayoutParentCandidate[])) {
    const { childId, candidateId } = candidate;
    if (!people.has(childId) || !people.has(candidateId) || childId === candidateId) continue;
    if (candidatesOf.get(childId)?.includes(candidateId) === true) continue;
    push(candidatesOf, childId, candidateId);
  }

  const factsOf = new Map<Id, LayoutFact[]>();
  for (const fact of graph.facts ?? []) {
    if (fact.subject.kind === 'person' && people.has(fact.subject.personId)) {
      push(factsOf, fact.subject.personId, fact);
    }
  }

  const known = new Set(unions.map((union) => union.id));
  const answersOf = new Map<Id, LayoutSimultaneityAnswer[]>();
  for (const answer of graph.simultaneityAnswers ?? []) {
    const [a, b] = answer.unionIds;
    if (!known.has(a) || !known.has(b)) continue;
    push(answersOf, a, answer);
    push(answersOf, b, answer);
  }

  return {
    people,
    unionsOf,
    parentLinksOf,
    childLinksOf,
    candidatesOf,
    factsOf,
    answersOf,
    unions,
    filiations,
  };
}
