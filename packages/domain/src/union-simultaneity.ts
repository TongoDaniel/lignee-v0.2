// Unions simultanées ou successives (PRD, UNI-08 ; TRD, table `unions`, « simultanéité déduite des
// dates, saisie sinon » ; cas limite CL-POL-05). Règles de déduction et place de la réponse :
// ADR 0012 (proposée).
//
// Deux unions d'une même personne sont :
// - successives, si les dates montrent que l'une a certainement fini quand l'autre commence ;
// - simultanées, si elles montrent que chacune a certainement commencé avant la fin de l'autre ;
// - sinon, inconnues : Lignée pose une seule question pour cette personne et garde la réponse,
//   modifiable, sur chaque union, du côté de ce conjoint (`spouses[i].simultaneity`).
// Les dates priment sur la réponse gardée. Une union sans date de fin n'est pas présumée en
// cours : l'absence de fin ne dit rien (ADR 0012).
import { createLifeEvents, toleratedSpan, type CoherenceTree, type LifeEvents } from './coherence';
import { compareCalendarDays, type CalendarDay } from './fuzzy-date';
import type { Id } from './ids';
import type { Union, UnionSimultaneity } from './union';

/** Ce que lit la déduction : les unions, et les faits pour les décès des conjoints. */
export interface SimultaneityTree {
  readonly unions: readonly Pick<Union, 'id' | 'spouses' | 'start' | 'end'>[];
  readonly facts: CoherenceTree['facts'];
}

/** D'où vient la réponse : des dates, de la réponse gardée, ou de nulle part (question). */
export type SimultaneityResolution =
  | { readonly source: 'dates' | 'answer'; readonly value: UnionSimultaneity }
  | { readonly source: 'unknown' };

/** La question unique posée pour une personne : ses unions dont la place est inconnue. */
export interface SimultaneityQuestion {
  readonly personId: Id;
  /** Unions de cette personne en cause, dans l'ordre de l'arbre. */
  readonly unionIds: readonly Id[];
}

/** Bornes d'une union ; `undefined` : sans borne de ce côté. */
interface UnionBounds {
  startLow: CalendarDay | undefined;
  startHigh: CalendarDay | undefined;
  endLow: CalendarDay | undefined;
  endHigh: CalendarDay | undefined;
}

const earlier = (a: CalendarDay | undefined, b: CalendarDay | undefined) =>
  a === undefined ? b : b === undefined ? a : compareCalendarDays(a, b) <= 0 ? a : b;
const later = (a: CalendarDay | undefined, b: CalendarDay | undefined) =>
  a === undefined ? b : b === undefined ? a : compareCalendarDays(a, b) >= 0 ? a : b;

/**
 * Bornes d'une union : début et fin dits (avec la marge des dates approximatives), la fin au plus
 * tard à la mort du premier conjoint qui meurt, le début avant la fin.
 */
function unionBounds(
  events: LifeEvents,
  union: Pick<Union, 'spouses' | 'start' | 'end'>,
): UnionBounds {
  const start = union.start && toleratedSpan(union.start);
  const end = union.end && toleratedSpan(union.end);
  let endHigh = end?.latest;
  for (const spouse of union.spouses) {
    endHigh = earlier(endHigh, events.death(spouse.personId)?.latest);
  }
  return {
    startLow: start?.earliest,
    startHigh: earlier(start?.latest, endHigh),
    endLow: later(end?.earliest, start?.earliest),
    endHigh,
  };
}

/** Vrai si `a` finit certainement au plus tard quand `b` commence. */
function endsBefore(a: UnionBounds, b: UnionBounds): boolean {
  return (
    a.endHigh !== undefined &&
    b.startLow !== undefined &&
    compareCalendarDays(a.endHigh, b.startLow) <= 0
  );
}

/** Vrai si `a` commence certainement avant que `b` ne puisse finir. */
function startsBeforeEndOf(a: UnionBounds, b: UnionBounds): boolean {
  return (
    a.startHigh !== undefined &&
    b.endLow !== undefined &&
    compareCalendarDays(a.startHigh, b.endLow) < 0
  );
}

/** Ce que les dates seules disent de deux unions ; `undefined` si elles ne suffisent pas. */
export function simultaneityFromDates(
  tree: SimultaneityTree,
  a: Pick<Union, 'spouses' | 'start' | 'end'>,
  b: Pick<Union, 'spouses' | 'start' | 'end'>,
): UnionSimultaneity | undefined {
  return fromDates(createLifeEvents(tree.facts), a, b);
}

function fromDates(
  events: LifeEvents,
  a: Pick<Union, 'spouses' | 'start' | 'end'>,
  b: Pick<Union, 'spouses' | 'start' | 'end'>,
): UnionSimultaneity | undefined {
  const first = unionBounds(events, a);
  const second = unionBounds(events, b);
  if (endsBefore(first, second) || endsBefore(second, first)) return 'successive';
  if (startsBeforeEndOf(first, second) && startsBeforeEndOf(second, first)) return 'simultaneous';
  return undefined;
}

/**
 * Réponse gardée pour deux unions, du côté de `personId` : simultanées si les deux réponses le
 * disent, successives si l'une des deux le dit, inconnue s'il en manque une. Quand les deux
 * unions relient aussi le même autre conjoint (un couple remarié), sa réponse vaut aussi.
 */
function storedAnswer(
  personId: Id,
  a: Pick<Union, 'spouses'>,
  b: Pick<Union, 'spouses'>,
): UnionSimultaneity | undefined {
  const shared = [
    personId,
    ...a.spouses
      .map((spouse) => spouse.personId)
      .filter((id) => id !== personId && b.spouses.some((other) => other.personId === id)),
  ];
  for (const id of shared) {
    const first = a.spouses.find((spouse) => spouse.personId === id)?.simultaneity;
    const second = b.spouses.find((spouse) => spouse.personId === id)?.simultaneity;
    if (first !== undefined && second !== undefined) {
      return first === 'simultaneous' && second === 'simultaneous' ? 'simultaneous' : 'successive';
    }
  }
  return undefined;
}

/**
 * Deux unions de `personId` : simultanées ou successives, déduit des dates d'abord, sinon de la
 * réponse gardée ; `unknown` quand il faut poser la question.
 */
export function resolveSimultaneity(
  tree: SimultaneityTree,
  personId: Id,
  a: Pick<Union, 'spouses' | 'start' | 'end'>,
  b: Pick<Union, 'spouses' | 'start' | 'end'>,
): SimultaneityResolution {
  return resolve(createLifeEvents(tree.facts), personId, a, b);
}

function resolve(
  events: LifeEvents,
  personId: Id,
  a: Pick<Union, 'spouses' | 'start' | 'end'>,
  b: Pick<Union, 'spouses' | 'start' | 'end'>,
): SimultaneityResolution {
  const deduced = fromDates(events, a, b);
  if (deduced !== undefined) return { source: 'dates', value: deduced };
  const answer = storedAnswer(personId, a, b);
  return answer === undefined ? { source: 'unknown' } : { source: 'answer', value: answer };
}

/** Unions de chaque personne, dans l'ordre de l'arbre. */
function unionsByPerson(tree: SimultaneityTree) {
  const byPerson = new Map<Id, SimultaneityTree['unions'][number][]>();
  for (const union of tree.unions) {
    for (const spouse of union.spouses) {
      const list = byPerson.get(spouse.personId);
      if (list === undefined) byPerson.set(spouse.personId, [union]);
      else if (!list.includes(union)) list.push(union);
    }
  }
  return byPerson;
}

function questionFor(
  events: LifeEvents,
  personId: Id,
  unions: readonly SimultaneityTree['unions'][number][],
  covered: Set<string>,
): SimultaneityQuestion | undefined {
  const involved = new Set<Id>();
  let fresh = false;
  for (let i = 0; i < unions.length; i += 1) {
    for (let j = i + 1; j < unions.length; j += 1) {
      const a = unions[i] as SimultaneityTree['unions'][number];
      const b = unions[j] as SimultaneityTree['unions'][number];
      if (resolve(events, personId, a, b).source !== 'unknown') continue;
      involved.add(a.id);
      involved.add(b.id);
      const key = [a.id, b.id].sort().join('|');
      if (!covered.has(key)) fresh = true;
      covered.add(key);
    }
  }
  if (!fresh) return undefined;
  return { personId, unionIds: unions.map((union) => union.id).filter((id) => involved.has(id)) };
}

/**
 * Questions à poser : au plus une par personne, pour ses unions dont la place reste inconnue
 * (CL-POL-05 : « une seule question »). Une paire d'unions déjà couverte par la question d'une
 * autre personne (le même couple remarié) n'en crée pas une deuxième.
 */
export function simultaneityQuestions(tree: SimultaneityTree): SimultaneityQuestion[] {
  const covered = new Set<string>();
  const questions: SimultaneityQuestion[] = [];
  const events = createLifeEvents(tree.facts);
  for (const [personId, unions] of unionsByPerson(tree)) {
    if (unions.length < 2) continue;
    const question = questionFor(events, personId, unions, covered);
    if (question !== undefined) questions.push(question);
  }
  return questions;
}

/** La question à poser pour une personne, s'il y en a une (à la saisie d'une union). */
export function simultaneityQuestionFor(
  tree: SimultaneityTree,
  personId: Id,
): SimultaneityQuestion | undefined {
  const unions = unionsByPerson(tree).get(personId) ?? [];
  return unions.length < 2
    ? undefined
    : questionFor(createLifeEvents(tree.facts), personId, unions, new Set());
}

/**
 * Garde la réponse : chaque union de la question reçoit `value` du côté de la personne
 * interrogée. Répondre de nouveau remplace la réponse (« reste modifiable »). Renvoie de
 * nouvelles unions ; celles qui ne changent pas sont les mêmes objets.
 */
export function answerSimultaneity<U extends Pick<Union, 'id' | 'spouses'>>(
  unions: readonly U[],
  question: SimultaneityQuestion,
  value: UnionSimultaneity,
): U[] {
  const targets = new Set(question.unionIds);
  return unions.map((union) => {
    if (!targets.has(union.id)) return union;
    const [first, second] = union.spouses;
    const answer = (spouse: typeof first) =>
      spouse.personId === question.personId ? { ...spouse, simultaneity: value } : spouse;
    return { ...union, spouses: [answer(first), answer(second)] };
  });
}
