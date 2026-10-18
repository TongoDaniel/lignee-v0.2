// L'arbre tel qu'il aurait été saisi sans des objets que le filtre de visibilité retire
// (personnes, unions, filiations) : référence des propriétés « masqué équivaut à jamais saisi »
// (masking.test.ts, alliance-properties.test.ts). Réservé aux tests.
import type { Filiation, Id, Union } from '@lignee/domain';
import type { TreeData } from '@lignee/domain/test-support';

/** L'arbre tel qu'il aurait été saisi sans les objets retirés. */
export function neverEntered(
  tree: TreeData,
  hiddenPeople: ReadonlySet<Id>,
  hiddenUnions: ReadonlySet<Id>,
  hiddenFiliations: ReadonlySet<Id>,
) {
  // Une mention « distincte de » vers une personne masquée n'aurait pas été saisie (ADR 0017).
  const people = tree.people
    .filter((person) => !hiddenPeople.has(person.id))
    .map((person) => {
      if (person.distinctFrom === undefined) return person;
      const distinctFrom = person.distinctFrom.filter((id) => !hiddenPeople.has(id));
      const copy = { ...person };
      delete copy.distinctFrom;
      return distinctFrom.length === 0 ? copy : { ...copy, distinctFrom };
    });
  const kept = tree.unions.filter(
    (union) =>
      !hiddenUnions.has(union.id) &&
      union.spouses.every((spouse) => !hiddenPeople.has(spouse.personId)),
  );
  // Rangs saisis : 1, 2, 3… dans l'ordre des rangs d'origine, parmi les unions restantes.
  const rankOf = new Map<string, number>();
  const byPerson = new Map<Id, Union[]>();
  for (const union of kept) {
    for (const spouse of union.spouses) {
      byPerson.set(spouse.personId, [...(byPerson.get(spouse.personId) ?? []), union]);
    }
  }
  for (const [personId, list] of byPerson) {
    const original = (union: Union) =>
      union.spouses.find((spouse) => spouse.personId === personId)?.rank ?? 0;
    [...list]
      .sort((x, y) => original(x) - original(y) || (x.id < y.id ? -1 : 1))
      .forEach((union, index) => rankOf.set(`${union.id}:${personId}`, index + 1));
  }
  const unions = kept.map((union) => ({
    ...union,
    spouses: union.spouses.map((spouse) => ({
      ...spouse,
      rank: rankOf.get(`${union.id}:${spouse.personId}`) ?? 1,
    })) as Union['spouses'],
  }));
  const unionIds = new Set(unions.map((union) => union.id));
  const filiations: Filiation[] = tree.filiations
    .filter(
      (filiation) =>
        !hiddenFiliations.has(filiation.id) &&
        !hiddenPeople.has(filiation.parentId) &&
        !hiddenPeople.has(filiation.childId),
    )
    .map((filiation) => {
      if (filiation.originUnionId === undefined || unionIds.has(filiation.originUnionId)) {
        return filiation;
      }
      const copy: Filiation = { ...filiation };
      delete copy.originUnionId;
      return copy;
    });
  // Un parent candidat n'aurait pas été proposé sans union avec un parent restant de l'enfant.
  const spousesOf = new Map<Id, Set<Id>>();
  for (const union of unions) {
    const [a, b] = union.spouses;
    spousesOf.set(a.personId, (spousesOf.get(a.personId) ?? new Set()).add(b.personId));
    spousesOf.set(b.personId, (spousesOf.get(b.personId) ?? new Set()).add(a.personId));
  }
  const parentCandidates = tree.parentCandidates.filter(
    (candidate) =>
      !hiddenPeople.has(candidate.childId) &&
      !hiddenPeople.has(candidate.candidateId) &&
      filiations.some(
        (filiation) =>
          filiation.childId === candidate.childId &&
          (spousesOf.get(filiation.parentId)?.has(candidate.candidateId) ?? false),
      ),
  );
  // Une réponse « simultanées ou successives » n'aurait pas été donnée sans ses deux unions, ni un
  // fait sur une personne jamais saisie (ADR 0012).
  const simultaneityAnswers = tree.simultaneityAnswers.filter((answer) =>
    answer.unionIds.every((id) => unionIds.has(id)),
  );
  const present = new Set(people.map((person) => person.id));
  const facts = tree.facts.filter(
    (fact) => fact.subject.kind !== 'person' || present.has(fact.subject.personId),
  );
  return { people, unions, filiations, parentCandidates, simultaneityAnswers, facts };
}
