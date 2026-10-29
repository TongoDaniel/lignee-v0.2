// Ce que l'arbre affiche de chaque personne (T-017) : prénom, nom entier, années, nom de naissance
// pour la teinte de l'avatar. Construit depuis la copie locale, déjà limitée à ce que le lecteur
// peut voir : rien de masqué n'y entre. Aucun lien de parenté n'est calculé ici.
import {
  describeFuzzyDate,
  formatName,
  type Fact,
  type FuzzyDate,
  type Id,
  type Name,
  type NameOrder,
  type Person,
} from '@lignee/domain';

export interface PersonCard {
  readonly id: Id;
  /** Place à compléter : ni nom ni années. */
  readonly placeholder: boolean;
  /** Prénom affiché sous l'avatar ; vide pour une place à compléter. */
  readonly firstName: string;
  /** Nom entier, dans l'ordre choisi pour l'arbre (CL-DON-01). */
  readonly fullName: string;
  /** Nom de naissance : la teinte de l'avatar le suit, jamais le genre (ADR 0022). */
  readonly birthName: string;
  readonly deceased: boolean;
  /** Statut « vivante » noté sur la fiche (filtre « vivants », ARB-11) ; inconnu n'est ni l'un ni l'autre. */
  readonly living: boolean;
  readonly birthYear: number | undefined;
  readonly deathYear: number | undefined;
}

export interface CardSource {
  readonly people: readonly Person[];
  readonly names: readonly Name[];
  readonly facts: readonly Fact[];
  readonly nameOrder: NameOrder;
}

/** Année d'une date floue ; aucune pour un texte libre (« vers la fin de la guerre »). */
export function yearOf(date: FuzzyDate | undefined): number | undefined {
  if (date === undefined) return undefined;
  const shown = describeFuzzyDate(date);
  if (shown.kind === 'point') return shown.date.year;
  if (shown.kind === 'range') return shown.from.year;
  return undefined;
}

/** Nom retenu : d'usage, sinon de naissance, sinon le premier ; jamais un ancien nom (UNI-22). */
function chosenName(names: readonly Name[]): Name | undefined {
  const usable = names.filter((name) => name.type !== 'former');
  return (
    usable.find((name) => name.type === 'usage') ??
    usable.find((name) => name.type === 'birth') ??
    usable[0]
  );
}

function firstWord(name: Name): string {
  const given = name.givenNames?.trim().split(/\s+/)[0];
  if (given !== undefined && given !== '') return given;
  return (name.displayForm ?? name.surname ?? '').trim();
}

export function buildPersonCards(source: CardSource): ReadonlyMap<Id, PersonCard> {
  const namesOf = new Map<Id, Name[]>();
  for (const name of source.names) {
    const list = namesOf.get(name.personId);
    if (list === undefined) namesOf.set(name.personId, [name]);
    else list.push(name);
  }
  const years = new Map<string, number>();
  for (const fact of source.facts) {
    if (fact.subject.kind !== 'person') continue;
    if (fact.type !== 'birth' && fact.type !== 'death') continue;
    const year = yearOf(fact.date);
    if (year !== undefined) years.set(`${fact.type}|${fact.subject.personId}`, year);
  }
  const cards = new Map<Id, PersonCard>();
  for (const person of source.people) {
    const own = namesOf.get(person.id) ?? [];
    const name = chosenName(own);
    const birth = own.find((candidate) => candidate.type === 'birth') ?? name;
    const fullName = name === undefined ? '' : formatName(name, source.nameOrder);
    cards.set(person.id, {
      id: person.id,
      placeholder: person.nature === 'placeholder',
      firstName: name === undefined ? '' : firstWord(name),
      fullName,
      birthName: (birth?.surname ?? birth?.givenNames ?? fullName).trim(),
      deceased: person.vitalStatus === 'deceased',
      living: person.vitalStatus === 'living',
      birthYear: years.get(`birth|${person.id}`),
      deathYear: years.get(`death|${person.id}`),
    });
  }
  return cards;
}
