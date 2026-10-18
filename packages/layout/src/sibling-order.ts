// Étape 3, premier temps : l'ordre des frères et sœurs (TRD : « par date de naissance, ou ordre
// saisi »). Même principe que l'ordre des foyers (ADR 0013, règle 2) : les enfants gardent
// l'ordre saisi (celui des filiations reçues), puis ceux dont la naissance est datée sont remis
// dans l'ordre de leurs dates, aux places qu'occupent des enfants datés. Des jumeaux nés le même
// jour suivent l'ordre de leur naissance multiple. Règles retenues : ADR 0016.
import { fuzzyDateSortKey, type Id } from '@lignee/domain';

import type { LayoutGraph } from './types';

/** Trie des enfants d'une même famille, donnés dans l'ordre saisi. */
export type SiblingSorter = (children: readonly Id[]) => Id[];

export function createSiblingSorter(graph: LayoutGraph): SiblingSorter {
  // Clé de naissance de chaque personne : la plus ancienne de ses naissances datées.
  const birthKey = new Map<Id, string>();
  for (const fact of graph.facts ?? []) {
    if (fact.type !== 'birth' || fact.subject.kind !== 'person') continue;
    const key = fuzzyDateSortKey(fact.date);
    if (!key.startsWith('0:')) continue;
    const { personId } = fact.subject;
    const previous = birthKey.get(personId);
    if (previous === undefined || key < previous) birthKey.set(personId, key);
  }
  const birthOrder = new Map<Id, number>();
  for (const birth of graph.multipleBirths ?? []) {
    for (const member of birth.members) {
      if (member.birthOrder !== undefined) birthOrder.set(member.personId, member.birthOrder);
    }
  }

  return (children) => {
    const entries = children.map((id, arrival) => ({ id, arrival, key: birthKey.get(id) }));
    const dated = entries
      .filter((entry) => entry.key !== undefined)
      .sort((a, b) => {
        const left = a.key ?? '';
        const right = b.key ?? '';
        if (left !== right) return left < right ? -1 : 1;
        return (
          (birthOrder.get(a.id) ?? Infinity) - (birthOrder.get(b.id) ?? Infinity) ||
          a.arrival - b.arrival
        );
      });
    let next = 0;
    return entries.map((entry) => {
      if (entry.key === undefined) return entry.id;
      const replacement = dated[next];
      next += 1;
      return replacement?.id ?? entry.id;
    });
  };
}
