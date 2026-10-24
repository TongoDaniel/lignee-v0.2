// Fiche d'une personne (T-024 du plan V1 ; PRD, UNI-01, UNI-14, UNI-17, UNI-22) : ce que l'écran
// affiche, calculé sans mot ni mise en page. Le texte est celui de packages/i18n, la mise en page
// celle de l'app ; ici, les décisions : quel nom, quels noms de plus, qui voit l'ancien prénom,
// quelle naissance multiple, dans quel ordre.
//
// Entrée : la copie locale de l'arbre pour un lecteur (`LocalTreeSnapshot` de @lignee/sync, déjà
// filtrée par le serveur). Ce module ne recalcule aucun filtre de visibilité (T-052), mais ne se
// fie pas non plus à la copie pour deux données sensibles :
// - l'ancien prénom (`former`) ne sort que par `canViewFormerName` ;
// - la cause de décès (`death_cause`) ne sort jamais : le PRD (UNI-15) la dit visible de son seul
//   auteur et absente de l'arbre, des notifications et des exports ; il ne l'ouvre pas à la fiche
//   (ADR 0029). Elle est une donnée de santé, ce qui renvoie au calque santé de la V3.
import { compareFuzzyDates, describeFuzzyDate, type FuzzyDateDisplay } from './fuzzy-date';
import type { CalendarDay } from './fuzzy-date';
import { projectMultipleBirth, type Fact, type MultipleBirth, type TitleRole } from './fact';
import type { Id } from './ids';
import { formatName, type Gender, type Name, type NameType, type Person } from './person';
import type { Place } from './place';
import type { Tree } from './tree';
import { isPresumedLiving } from './vital-status';

/** Qui lit la fiche : son compte, et sa propre fiche si elle est reliée (CPT-06). */
export interface ProfileViewer {
  readonly accountId: Id;
  /**
   * Fiche reliée au compte du lecteur : « la personne concernée » par un ancien prénom. Aucun
   * écran ne la fournit en V1 (la base locale ne garde pas le lien compte-fiche) ; sans elle, seul
   * l'auteur du nom le voit.
   */
  readonly ownPersonId?: Id;
}

/** Ce que la fiche lit : la copie locale de l'arbre pour ce lecteur. */
export interface ProfileSource {
  readonly tree: Pick<Tree, 'name' | 'nameOrder'>;
  readonly people: readonly Person[];
  readonly names: readonly Name[];
  readonly facts: readonly Fact[];
  readonly titleRoles: readonly TitleRole[];
  readonly multipleBirths: readonly MultipleBirth[];
  readonly places: readonly Place[];
}

/**
 * Qui a droit à un ancien prénom (UNI-22) : l'auteur du nom, ou la personne concernée. Ni le
 * propriétaire de l'arbre, ni un responsable de branche, ni un administrateur de Lignée n'y ont
 * droit en tant que tels (relectures de T-021 et T-052). Seule décision de ce module sur ce
 * point : T-052 la remplacera par la règle de visibilité du nom (cible `name`), qui pourra
 * l'ouvrir à d'autres lecteurs. Un nom qui n'est pas un ancien prénom n'est pas concerné.
 */
export function canViewFormerName(name: Name, viewer: ProfileViewer): boolean {
  if (name.type !== 'former') return false;
  if (name.authorAccountId === viewer.accountId) return true;
  return viewer.ownPersonId !== undefined && name.personId === viewer.ownPersonId;
}

/** Ordre des types de nom quand plusieurs sont en cours : celui qu'on emploie d'abord. */
const NAME_TYPE_PRIORITY: Readonly<Record<Exclude<NameType, 'former'>, number>> = {
  usage: 0,
  birth: 1,
  nickname: 2,
  variant: 3,
  title: 4,
};

export type DisplayableName = Name & { readonly type: Exclude<NameType, 'former'> };

function isDisplayable(name: Name): name is DisplayableName {
  return name.type !== 'former';
}

/**
 * Le nom affiché d'une personne (CL-FAM-17, CL-FAM-18). Seule fonction de choix du nom : elle
 * n'a jamais d'ancien prénom (`former`) à choisir, quoi que contienne la liste.
 * 1. Les noms en cours (sans date de fin) passent avant les noms terminés ; si tous sont
 *    terminés, le plus récemment terminé.
 * 2. À égalité : nom d'usage, nom de naissance, surnom, variante, titre. Un surnom sert de nom
 *    quand il est le seul (CL-FAM-17).
 * 3. À égalité encore : l'ordre de saisie.
 */
export function chooseDisplayName(names: readonly Name[]): DisplayableName | undefined {
  const candidates = names.filter(isDisplayable);
  const ranked = candidates.map((name, index) => ({ name, index }));
  ranked.sort((a, b) => {
    const open = Number(a.name.end !== undefined) - Number(b.name.end !== undefined);
    if (open !== 0) return open;
    if (a.name.end !== undefined && b.name.end !== undefined) {
      // Le plus récemment terminé d'abord.
      const ended = compareFuzzyDates(b.name.end, a.name.end);
      if (ended !== 0) return ended;
    }
    const type = NAME_TYPE_PRIORITY[a.name.type] - NAME_TYPE_PRIORITY[b.name.type];
    return type !== 0 ? type : a.index - b.index;
  });
  return ranked[0]?.name;
}

/** Un nom de plus à montrer sur la fiche, hors nom affiché et ancien prénom. */
export interface ProfileName {
  readonly id: Id;
  readonly type: NameType;
  readonly text: string;
  readonly start?: FuzzyDateDisplay;
  readonly end?: FuzzyDateDisplay;
}

/** Titre ou rôle daté, affiché sous le nom (UNI-17). Le libellé ne se traduit pas. */
export interface ProfileTitle {
  readonly id: Id;
  readonly label: string;
  readonly start?: FuzzyDateDisplay;
  readonly end?: FuzzyDateDisplay;
}

export type MultipleBirthKind = 'twins' | 'triplets' | 'quadruplets' | 'multiple';

/** Naissance multiple vue de cette fiche (UNI-14) : « Jumeaux » sur chacune des fiches. */
export interface ProfileMultipleBirth {
  readonly kind: MultipleBirthKind;
  /** Nombre d'enfants de la naissance, celui de la fiche compris, parmi ceux que le lecteur voit. */
  readonly count: number;
  /** Rang de naissance de cette personne, s'il est connu. */
  readonly order?: number;
  /** Les autres enfants de la naissance, dans l'ordre de naissance connu puis de saisie. */
  readonly others: readonly { readonly personId: Id; readonly name: string | undefined }[];
}

/** Naissance ou décès : une date floue et un lieu, tous deux facultatifs. */
export interface ProfileEvent {
  readonly date?: FuzzyDateDisplay;
  readonly place?: string;
}

export interface ProfileFact extends ProfileEvent {
  readonly id: Id;
  /** Profession (`occupation`) : le texte saisi. Vide pour une résidence. */
  readonly value?: string;
}

/** Blocs de la fiche, dans l'ordre d'affichage ; un bloc sans contenu n'est pas listé. */
export type ProfileSectionKey =
  'identity' | 'life' | 'residences' | 'occupations' | 'names' | 'notes';

export interface Profile {
  readonly personId: Id;
  /** Place à compléter (UNI-02) : aucun nom, l'écran dit « Inconnu ». */
  readonly placeholder: boolean;
  /** Le nom affiché, dans l'ordre réglé par l'arbre (CL-DON-01). */
  readonly name: string | undefined;
  /** Premier prénom pour l'initiale de l'avatar (jamais un ancien prénom). */
  readonly firstName: string | undefined;
  /**
   * Nom qui donne sa teinte à l'avatar (charte : nom de naissance). Un nom de famille, jamais un
   * prénom : l'ancien prénom d'une personne trans ne doit pas colorer sa fiche.
   */
  readonly tintName: string;
  readonly titles: readonly ProfileTitle[];
  /** Les autres noms (nom de naissance, surnom, variantes), hors ancien prénom. */
  readonly otherNames: readonly ProfileName[];
  /** Anciens prénoms visibles pour ce lecteur seulement (UNI-22). */
  readonly formerNames: readonly ProfileName[];
  /** Personne connue sans nom de naissance (CL-FAM-17) : « à compléter », sans action. */
  readonly birthNameMissing: boolean;
  readonly gender: Gender;
  readonly multipleBirth?: ProfileMultipleBirth;
  readonly birth?: ProfileEvent;
  /** La date de naissance d'une personne présumée vivante est une donnée à protéger. */
  readonly birthIsPrivate: boolean;
  /** Décédée : statut saisi ou fait de décès. */
  readonly deceased: boolean;
  readonly death?: ProfileEvent;
  readonly residences: readonly ProfileFact[];
  readonly occupations: readonly ProfileFact[];
  readonly notes?: string;
  readonly sections: readonly ProfileSectionKey[];
}

export interface BuildProfileOptions {
  readonly viewer: ProfileViewer;
  /** Jour de référence pour « présumée vivante » : aucune horloge n'est lue ici. */
  readonly today: CalendarDay;
}

function toProfileName(name: Name, order: Tree['nameOrder']): ProfileName {
  return {
    id: name.id,
    type: name.type,
    text: formatName(name, order),
    ...(name.start === undefined ? {} : { start: describeFuzzyDate(name.start) }),
    ...(name.end === undefined ? {} : { end: describeFuzzyDate(name.end) }),
  };
}

function firstNameOf(name: Name): string | undefined {
  return name.givenNames ?? name.displayForm ?? name.surname;
}

function surnameOf(name: Name): string | undefined {
  return name.surname ?? name.displayForm ?? name.givenNames;
}

const MULTIPLE_BIRTH_KIND: Readonly<Record<number, MultipleBirthKind>> = {
  2: 'twins',
  3: 'triplets',
  4: 'quadruplets',
};

function multipleBirthOf(
  personId: Id,
  source: ProfileSource,
  nameOf: (id: Id) => string | undefined,
): ProfileMultipleBirth | undefined {
  const known = new Set(source.people.map((person) => person.id));
  for (const birth of source.multipleBirths) {
    // Les enfants que le lecteur ne voit pas sont retirés ; sous deux, plus de naissance multiple.
    const seen = projectMultipleBirth(birth, (id) => known.has(id));
    const self = seen?.members.find((member) => member.personId === personId);
    if (seen === undefined || self === undefined) continue;
    const others = seen.members
      .map((member, index) => ({ member, index }))
      .filter(({ member }) => member.personId !== personId)
      .sort((a, b) => {
        const left = a.member.birthOrder ?? Number.POSITIVE_INFINITY;
        const right = b.member.birthOrder ?? Number.POSITIVE_INFINITY;
        return left === right ? a.index - b.index : left - right;
      })
      .map(({ member }) => ({ personId: member.personId, name: nameOf(member.personId) }));
    return {
      kind: MULTIPLE_BIRTH_KIND[seen.members.length] ?? 'multiple',
      count: seen.members.length,
      ...(self.birthOrder === undefined ? {} : { order: self.birthOrder }),
      others,
    };
  }
  return undefined;
}

/**
 * La fiche d'une personne pour un lecteur, ou `undefined` si la personne n'est pas dans sa copie
 * locale (jamais d'indice sur une personne masquée : même réponse qu'une personne inexistante).
 */
export function buildProfile(
  source: ProfileSource,
  personId: Id,
  options: BuildProfileOptions,
): Profile | undefined {
  const person = source.people.find((candidate) => candidate.id === personId);
  if (person === undefined) return undefined;
  const order = source.tree.nameOrder;

  const namesOf = (id: Id): Name[] => source.names.filter((name) => name.personId === id);
  const displayNameOf = (id: Id): string | undefined => {
    const chosen = chooseDisplayName(namesOf(id));
    return chosen === undefined ? undefined : formatName(chosen, order);
  };

  const names = namesOf(person.id);
  const chosen = chooseDisplayName(names);
  const birthName = names.find((name) => name.type === 'birth');
  const tintSource = birthName ?? chosen;

  const placeName = (placeId: Id | undefined): string | undefined =>
    placeId === undefined ? undefined : source.places.find((place) => place.id === placeId)?.name;
  const eventOf = (fact: Fact): ProfileEvent => {
    const place = placeName(fact.placeId);
    return {
      ...(fact.date === undefined ? {} : { date: describeFuzzyDate(fact.date) }),
      ...(place === undefined ? {} : { place }),
    };
  };
  // Les faits de cette personne, sauf la cause de décès, qui ne sort jamais d'ici.
  const facts = source.facts.filter(
    (fact) =>
      fact.subject.kind === 'person' &&
      fact.subject.personId === person.id &&
      fact.type !== 'death_cause',
  );
  const byDate = (a: Fact, b: Fact) => compareFuzzyDates(a.date, b.date);
  const listOf = (type: Fact['type']): ProfileFact[] =>
    facts
      .filter((fact) => fact.type === type)
      .sort(byDate)
      .map((fact) => ({
        id: fact.id,
        ...eventOf(fact),
        ...(fact.value === undefined ? {} : { value: fact.value }),
      }));
  const birthFact = facts.find((fact) => fact.type === 'birth');
  const deathFact = facts.find((fact) => fact.type === 'death');
  const residences = listOf('residence');
  const occupations = listOf('occupation');

  const placeholder = person.nature === 'placeholder';
  const presumedLiving = isPresumedLiving(
    { people: source.people, facts: source.facts },
    person.id,
    options.today,
  );
  const deceased = person.vitalStatus === 'deceased' || deathFact !== undefined;

  const shown = chosen === undefined ? undefined : toProfileName(chosen, order);
  const otherNames = names
    .filter(isDisplayable)
    .filter((name) => name.id !== chosen?.id)
    .map((name) => toProfileName(name, order));
  const formerNames = names
    .filter((name) => canViewFormerName(name, options.viewer))
    .map((name) => toProfileName(name, order));
  const titles = source.titleRoles
    .filter((title) => title.personId === person.id)
    .sort((a, b) => compareFuzzyDates(a.start, b.start))
    .map((title): ProfileTitle => ({
      id: title.id,
      label: title.label,
      ...(title.start === undefined ? {} : { start: describeFuzzyDate(title.start) }),
      ...(title.end === undefined ? {} : { end: describeFuzzyDate(title.end) }),
    }));
  const multipleBirth = multipleBirthOf(person.id, source, displayNameOf);
  const birthNameMissing = !placeholder && birthName === undefined;
  const life = birthFact !== undefined || deceased;

  const sections: ProfileSectionKey[] = [];
  // Le genre actuel (UNI-22) ; « non renseigné » ne se dit pas.
  if (person.gender !== 'unspecified') sections.push('identity');
  if (life) sections.push('life');
  if (residences.length > 0) sections.push('residences');
  if (occupations.length > 0) sections.push('occupations');
  if (otherNames.length > 0 || formerNames.length > 0 || birthNameMissing) sections.push('names');
  if (person.notes !== undefined) sections.push('notes');

  return {
    personId: person.id,
    placeholder,
    name: shown?.text,
    firstName: chosen === undefined ? undefined : firstNameOf(chosen),
    tintName: (tintSource === undefined ? undefined : surnameOf(tintSource)) ?? '',
    titles,
    otherNames,
    formerNames,
    birthNameMissing,
    gender: person.gender,
    ...(multipleBirth === undefined ? {} : { multipleBirth }),
    ...(birthFact === undefined ? {} : { birth: eventOf(birthFact) }),
    birthIsPrivate: presumedLiving && birthFact?.date !== undefined,
    deceased,
    ...(deathFact === undefined ? {} : { death: eventOf(deathFact) }),
    residences,
    occupations,
    ...(person.notes === undefined ? {} : { notes: person.notes }),
    sections,
  };
}
