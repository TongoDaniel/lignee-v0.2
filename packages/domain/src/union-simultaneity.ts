// Unions simultanées ou successives (PRD, UNI-08 ; TRD, table `unions`, « simultanéité déduite des
// dates, saisie sinon » ; cas limite CL-POL-05). Règles de déduction et place de la réponse :
// ADR 0012 (proposée).
//
// La question porte sur une paire d'unions qui ont un conjoint en commun : leurs durées se
// chevauchent-elles ? C'est un fait sur les deux unions, le même pour chacun des conjoints ; la
// réponse est donc gardée par paire (`SimultaneityAnswer`), jamais par union ni par conjoint.
// Deux unions sont :
// - successives, si les dates montrent que l'une a certainement fini quand l'autre commence ;
// - simultanées, si elles montrent que chacune a certainement commencé avant la fin de l'autre ;
// - sinon, la réponse gardée pour la paire, si elle existe ;
// - sinon, inconnues : Lignée pose une seule question pour la personne (toutes ses paires
//   inconnues), et chaque paire reçoit sa valeur.
// Les dates priment sur la réponse gardée. Une union sans date de fin n'est pas présumée en
// cours : l'absence de fin ne dit rien.
import { createLifeEvents, toleratedSpan, type CoherenceTree, type LifeEvents } from './coherence';
import { compareCalendarDays, type CalendarDay } from './fuzzy-date';
import { createId, type Id } from './ids';
import type { SimultaneityAnswer, Union, UnionSimultaneity } from './union';

/** Ce que lit la déduction : les unions, les faits (décès des conjoints) et les réponses. */
export interface SimultaneityTree {
  readonly unions: readonly Pick<Union, 'id' | 'spouses' | 'start' | 'end'>[];
  readonly facts: CoherenceTree['facts'];
  readonly simultaneityAnswers: readonly Pick<SimultaneityAnswer, 'unionIds' | 'simultaneity'>[];
}

type UnionDates = Pick<Union, 'id' | 'spouses' | 'start' | 'end'>;

/** D'où vient la réponse : des dates, de la réponse gardée, ou de nulle part (question). */
export type SimultaneityResolution =
  | { readonly source: 'dates' | 'answer'; readonly value: UnionSimultaneity }
  | { readonly source: 'unknown' };

/** Une paire d'unions, plus petit identifiant d'abord (la forme gardée). */
export type UnionPair = readonly [Id, Id];

/** Paire rangée de deux unions. */
export function unionPair(a: Id, b: Id): UnionPair {
  return a < b ? [a, b] : [b, a];
}

/**
 * La question unique posée pour une personne : ses unions en cause et chaque paire dont la place
 * reste inconnue. L'écran pose une seule question ; la réponse donne une valeur à chaque paire
 * (`uniformPairAnswers`, `pairAnswersFromHouseholds`, ou paire par paire).
 */
export interface SimultaneityQuestion {
  readonly personId: Id;
  /** Unions de cette personne en cause, dans l'ordre de l'arbre. */
  readonly unionIds: readonly Id[];
  /** Paires inconnues, rangées, dans l'ordre de l'arbre. */
  readonly pairs: readonly UnionPair[];
}

/** Valeur donnée à une paire. */
export interface PairAnswer {
  readonly unionIds: UnionPair;
  readonly simultaneity: UnionSimultaneity;
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
 * Bornes d'une union : début et fin dits (avec la marge des dates approximatives, ADR 0011), la
 * fin au plus tard à la mort du premier conjoint qui meurt, le début avant la fin.
 */
function unionBounds(events: LifeEvents, union: UnionDates): UnionBounds {
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

function fromDates(
  events: LifeEvents,
  a: UnionDates,
  b: UnionDates,
): UnionSimultaneity | undefined {
  const first = unionBounds(events, a);
  const second = unionBounds(events, b);
  if (endsBefore(first, second) || endsBefore(second, first)) return 'successive';
  if (startsBeforeEndOf(first, second) && startsBeforeEndOf(second, first)) return 'simultaneous';
  return undefined;
}

/** Ce que les dates seules disent de deux unions ; `undefined` si elles ne suffisent pas. */
export function simultaneityFromDates(
  tree: Pick<SimultaneityTree, 'facts'>,
  a: UnionDates,
  b: UnionDates,
): UnionSimultaneity | undefined {
  return fromDates(createLifeEvents(tree.facts), a, b);
}

interface Lookup {
  readonly events: LifeEvents;
  readonly answers: ReadonlyMap<string, UnionSimultaneity>;
}

const lookupOf = (tree: Pick<SimultaneityTree, 'facts' | 'simultaneityAnswers'>): Lookup => ({
  events: createLifeEvents(tree.facts),
  answers: new Map(
    tree.simultaneityAnswers.map((answer) => [
      unionPair(...answer.unionIds).join('|'),
      answer.simultaneity,
    ]),
  ),
});

function resolve(lookup: Lookup, a: UnionDates, b: UnionDates): SimultaneityResolution {
  const deduced = fromDates(lookup.events, a, b);
  if (deduced !== undefined) return { source: 'dates', value: deduced };
  const answer = lookup.answers.get(unionPair(a.id, b.id).join('|'));
  return answer === undefined ? { source: 'unknown' } : { source: 'answer', value: answer };
}

/**
 * Deux unions (d'une même personne) : simultanées ou successives, déduit des dates d'abord,
 * sinon de la réponse gardée pour cette paire ; `unknown` quand il faut poser la question.
 * L'ordre des deux unions est indifférent.
 */
export function resolveSimultaneity(
  tree: SimultaneityTree,
  a: UnionDates,
  b: UnionDates,
): SimultaneityResolution {
  return resolve(lookupOf(tree), a, b);
}

/**
 * La même déduction que `resolveSimultaneity`, pour plusieurs paires d'un même arbre : les faits
 * et les réponses ne sont lus qu'une fois (moteur de parenté, T-021 : co-épouse, conjoint d'un
 * parent). L'arbre doit être celui du lecteur, déjà filtré (ADR 0012, point 3).
 */
export function simultaneityResolver(
  tree: Pick<SimultaneityTree, 'facts' | 'simultaneityAnswers'>,
): (a: UnionDates, b: UnionDates) => SimultaneityResolution {
  const lookup = lookupOf(tree);
  return (a, b) => resolve(lookup, a, b);
}

/** Unions de chaque personne, dans l'ordre de l'arbre. */
function unionsByPerson(tree: SimultaneityTree) {
  const byPerson = new Map<Id, UnionDates[]>();
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
  lookup: Lookup,
  personId: Id,
  unions: readonly UnionDates[],
  covered: Set<string>,
): SimultaneityQuestion | undefined {
  const involved = new Set<Id>();
  const pairs: UnionPair[] = [];
  for (let i = 0; i < unions.length; i += 1) {
    for (let j = i + 1; j < unions.length; j += 1) {
      const a = unions[i] as UnionDates;
      const b = unions[j] as UnionDates;
      if (resolve(lookup, a, b).source !== 'unknown') continue;
      const pair = unionPair(a.id, b.id);
      const key = pair.join('|');
      // Une paire qui relie deux fois les mêmes conjoints n'est demandée qu'une fois.
      if (covered.has(key)) continue;
      covered.add(key);
      involved.add(a.id);
      involved.add(b.id);
      pairs.push(pair);
    }
  }
  if (pairs.length === 0) return undefined;
  return {
    personId,
    unionIds: unions.map((union) => union.id).filter((id) => involved.has(id)),
    pairs,
  };
}

/**
 * Questions à poser : au plus une par personne, pour ses paires d'unions dont la place reste
 * inconnue (CL-POL-05 : « une seule question »). Une paire n'est demandée qu'une fois, même si
 * ses deux unions relient les mêmes deux conjoints.
 */
export function simultaneityQuestions(tree: SimultaneityTree): SimultaneityQuestion[] {
  const covered = new Set<string>();
  const questions: SimultaneityQuestion[] = [];
  const lookup = lookupOf(tree);
  for (const [personId, unions] of unionsByPerson(tree)) {
    if (unions.length < 2) continue;
    const question = questionFor(lookup, personId, unions, covered);
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
  return unions.length < 2 ? undefined : questionFor(lookupOf(tree), personId, unions, new Set());
}

/** La même valeur pour chaque paire de la question (« toutes en même temps »). */
export function uniformPairAnswers(
  question: Pick<SimultaneityQuestion, 'pairs'>,
  simultaneity: UnionSimultaneity,
): PairAnswer[] {
  return question.pairs.map((unionIds) => ({ unionIds, simultaneity }));
}

/**
 * Réponse en foyers successifs (la saisie la plus simple) : chaque groupe réunit des unions
 * simultanées, et les groupes se succèdent. « Deux épouses en même temps, puis une troisième
 * après leur mort » : `[[u1, u2], [u3]]`. Une union de la question absente des groupes, ou
 * présente deux fois, est une erreur. Un chevauchement en chaîne (u1 et u2 ensemble, u2 et u3
 * ensemble, u1 avant u3) ne se dit pas en foyers : on répond alors paire par paire.
 */
export function pairAnswersFromHouseholds(
  question: Pick<SimultaneityQuestion, 'unionIds' | 'pairs'>,
  households: readonly (readonly Id[])[],
): PairAnswer[] {
  const group = new Map<Id, number>();
  households.forEach((members, index) => {
    for (const id of members) {
      if (group.has(id)) throw new RangeError(`Union ${id} is in two households`);
      group.set(id, index);
    }
  });
  for (const id of question.unionIds) {
    if (!group.has(id)) throw new RangeError(`Union ${id} is in no household`);
  }
  return question.pairs.map((unionIds) => ({
    unionIds,
    simultaneity: group.get(unionIds[0]) === group.get(unionIds[1]) ? 'simultaneous' : 'successive',
  }));
}

/**
 * Garde les réponses : chaque paire reçoit sa valeur ; une paire déjà répondue garde son objet
 * (même identifiant) avec la nouvelle valeur (« reste modifiable »), une paire nouvelle crée une
 * réponse. Renvoie la nouvelle liste ; les réponses inchangées sont les mêmes objets.
 */
export function answerSimultaneity(
  answers: readonly SimultaneityAnswer[],
  pairAnswers: readonly PairAnswer[],
  context: { readonly treeId: Id; readonly nextId?: () => Id },
): SimultaneityAnswer[] {
  const nextId = context.nextId ?? createId;
  const given = new Map<string, PairAnswer>();
  for (const pair of pairAnswers) {
    const unionIds = unionPair(...pair.unionIds);
    if (unionIds[0] === unionIds[1]) throw new RangeError('A pair holds two different unions');
    given.set(unionIds.join('|'), { unionIds, simultaneity: pair.simultaneity });
  }
  const result = answers.map((answer) => {
    const key = unionPair(...answer.unionIds).join('|');
    const update = given.get(key);
    if (update === undefined) return answer;
    given.delete(key);
    return update.simultaneity === answer.simultaneity
      ? answer
      : { ...answer, simultaneity: update.simultaneity };
  });
  for (const { unionIds, simultaneity } of given.values()) {
    result.push({
      id: nextId(),
      treeId: context.treeId,
      unionIds: [unionIds[0], unionIds[1]],
      simultaneity,
    });
  }
  return result;
}
