// Projection prudente d'un arbre généré pour un lecteur, en développement seulement.
//
// Le vrai filtrage par lecteur est fait sur le serveur par le module de droits (T-049, T-052,
// T-056). En attendant, un arbre généré (T-006) contient des objets masqués par des règles :
// pour ne jamais mettre sur le téléphone ce que le lecteur ne verrait pas, on retire TOUT objet
// qui porte une règle autre que « tout l'arbre » (même si le lecteur aurait pu le voir), avec
// tout ce qui en dépend (TRD, « Confidentialité appliquée », point 2). Retirer trop est sans
// risque ; ce module ne doit pas servir de modèle au module de droits.
import { projectMultipleBirth, type Id } from '@lignee/domain';
import type { GeneratedTree } from '@lignee/domain/tree-generator';

import type { LocalTreeSnapshot } from '../local-db/snapshot';

export function devReaderSnapshot(
  generated: GeneratedTree,
  readerAccountId: Id,
): LocalTreeSnapshot {
  const restricted = new Set(
    generated.visibilityRules
      .filter((rule) => rule.level !== 'tree')
      .map((rule) => `${rule.target.type}:${rule.target.id}`),
  );
  const open = (type: string, id: Id) => !restricted.has(`${type}:${id}`);

  const people = generated.people.filter((person) => open('person', person.id));
  const personIds = new Set(people.map((person) => person.id));
  const anyPersonRemoved = people.length !== generated.people.length;

  const unions = generated.unions.filter(
    (union) =>
      open('union', union.id) && union.spouses.every((spouse) => personIds.has(spouse.personId)),
  );
  const unionIds = new Set(unions.map((union) => union.id));

  // Une union masquée masque les filiations qui en dépendent.
  const filiations = generated.filiations.filter(
    (filiation) =>
      open('filiation', filiation.id) &&
      personIds.has(filiation.parentId) &&
      personIds.has(filiation.childId) &&
      (filiation.originUnionId === undefined || unionIds.has(filiation.originUnionId)),
  );
  const filiationIds = new Set(filiations.map((filiation) => filiation.id));

  const names = generated.names.filter(
    (name) =>
      open('name', name.id) &&
      personIds.has(name.personId) &&
      (name.type !== 'former' || name.authorAccountId === readerAccountId),
  );

  const facts = generated.facts.filter((fact) => {
    if (!open('fact', fact.id)) return false;
    const subjectVisible =
      fact.subject.kind === 'person'
        ? personIds.has(fact.subject.personId)
        : unionIds.has(fact.subject.unionId);
    if (!subjectVisible) return false;
    if (fact.filiationId !== undefined && !filiationIds.has(fact.filiationId)) return false;
    // Cause de décès : son auteur seul (UNI-15).
    return fact.type !== 'death_cause' || fact.authorAccountId === readerAccountId;
  });

  // « Mère parmi ses épouses » : un candidat reste si une union visible le relie à un parent
  // visible de l'enfant ; sinon il révélerait une union masquée.
  const parentsOf = new Map<Id, Set<Id>>();
  for (const filiation of filiations) {
    const parents = parentsOf.get(filiation.childId) ?? new Set<Id>();
    parents.add(filiation.parentId);
    parentsOf.set(filiation.childId, parents);
  }
  const partners = new Map<Id, Set<Id>>();
  for (const union of unions) {
    const [a, b] = union.spouses.map((spouse) => spouse.personId) as [Id, Id];
    partners.set(a, (partners.get(a) ?? new Set<Id>()).add(b));
    partners.set(b, (partners.get(b) ?? new Set<Id>()).add(a));
  }
  const parentCandidates = generated.parentCandidates.filter((candidate) => {
    if (!personIds.has(candidate.childId) || !personIds.has(candidate.candidateId)) return false;
    const parents = parentsOf.get(candidate.childId) ?? new Set<Id>();
    const candidatePartners = partners.get(candidate.candidateId) ?? new Set<Id>();
    return [...parents].some((parent) => candidatePartners.has(parent));
  });

  const titleRoles = generated.titleRoles.filter((title) => personIds.has(title.personId));
  const multipleBirths = generated.multipleBirths.flatMap((birth) => {
    const projected = projectMultipleBirth(birth, (id) => personIds.has(id));
    return projected === undefined ? [] : [projected];
  });
  const simultaneityAnswers = generated.simultaneityAnswers.filter((answer) =>
    answer.unionIds.every((id) => unionIds.has(id)),
  );
  // Le chemin d'un « À placer » peut passer par une personne masquée sans la nommer : dès
  // qu'une personne est retirée, aucun « À placer » n'est gardé.
  const toPlace = anyPersonRemoved
    ? []
    : generated.toPlace.filter(
        (entry) => personIds.has(entry.personId) && personIds.has(entry.referencePersonId),
      );

  // Mention « distincte de » (ADR 0017) : seulement vers des personnes présentes.
  const projectedPeople = people.map((person) => {
    if (person.distinctFrom === undefined) return person;
    const { distinctFrom, ...rest } = person;
    const kept = distinctFrom.filter((id) => personIds.has(id));
    return kept.length === 0 ? rest : { ...rest, distinctFrom: kept };
  });

  // Lieux : seulement ceux que cite un objet gardé.
  const usedPlaces = new Set<Id>();
  for (const object of [...unions, ...facts, ...titleRoles]) {
    if (object.placeId !== undefined) usedPlaces.add(object.placeId);
  }
  const placesKept = generated.places.filter((place) => usedPlaces.has(place.id));

  return {
    readerAccountId,
    tree: generated.tree,
    people: projectedPeople,
    names,
    unions,
    simultaneityAnswers,
    filiations,
    parentCandidates,
    facts,
    titleRoles,
    multipleBirths,
    places: placesKept,
    toPlace,
  };
}
