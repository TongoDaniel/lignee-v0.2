// « Présumée vivante » (PRD, UNI-16 ; TRD, table `personnes` : « calculée : née il y a moins de
// 100 ans et sans décès »). Le résultat protège la visibilité (T-052) : dans le doute, une
// personne est présumée vivante. Cas que le cahier ne tranche pas : ADR 0011 (proposée), à
// relire par gardien-confidentialite.
//
// Fonction pure : le jour de référence est un paramètre, aucune horloge n'est lue ici. La même
// règle s'applique aux fiches saisies, dictées ou importées (V2).
import { z } from 'zod';

import { createLifeEvents, type CoherenceTree, type LifeEvents } from './coherence';
import { addMonthsToDay, compareCalendarDays, type CalendarDay } from './fuzzy-date';
import type { Id } from './ids';
import type { Person } from './person';

/** Âge, en années, à partir duquel une personne sans décès n'est plus présumée vivante. */
export const PRESUMED_LIVING_YEARS = 100;

/** Pourquoi une personne est, ou n'est pas, présumée vivante. */
export const vitalReasonSchema = z.enum([
  /** Statut saisi « vivante ». */
  'declared_living',
  /** Statut saisi « décédée ». */
  'declared_deceased',
  /** Un décès est enregistré (fait de décès ou cause de décès), daté ou non. */
  'death_recorded',
  /** Née il y a moins de 100 ans, ou peut-être : présumée vivante. */
  'born_less_than_100_years_ago',
  /** Née certainement il y a 100 ans ou plus : n'est plus présumée vivante. */
  'born_100_years_ago_or_more',
  /** Naissance inconnue, en texte libre ou ouverte vers l'avenir (« après 1950 ») : présumée vivante. */
  'birth_unknown',
]);
export type VitalReason = z.infer<typeof vitalReasonSchema>;

export interface VitalAssessment {
  readonly presumedLiving: boolean;
  readonly reason: VitalReason;
}

/** Ce que lit le calcul : les personnes et leurs faits. */
export type VitalTree = Pick<CoherenceTree, 'people' | 'facts'>;

function assess(
  entry: Pick<Person, 'id' | 'vitalStatus'>,
  events: LifeEvents,
  deaths: ReadonlySet<Id>,
  today: CalendarDay,
): VitalAssessment {
  if (entry.vitalStatus === 'living') return { presumedLiving: true, reason: 'declared_living' };
  if (entry.vitalStatus === 'deceased') {
    return { presumedLiving: false, reason: 'declared_deceased' };
  }
  if (deaths.has(entry.id)) return { presumedLiving: false, reason: 'death_recorded' };
  const latest = events.birth(entry.id)?.latest;
  if (latest === undefined) return { presumedLiving: true, reason: 'birth_unknown' };
  // Née il y a moins de 100 ans si son dernier jour de naissance possible, plus 100 ans, est
  // encore à venir.
  const hundredth = addMonthsToDay(latest, 12 * PRESUMED_LIVING_YEARS);
  return compareCalendarDays(hundredth, today) > 0
    ? { presumedLiving: true, reason: 'born_less_than_100_years_ago' }
    : { presumedLiving: false, reason: 'born_100_years_ago_or_more' };
}

function recordedDeaths(facts: CoherenceTree['facts']): Set<Id> {
  const deaths = new Set<Id>();
  for (const fact of facts) {
    if (fact.subject.kind === 'person' && (fact.type === 'death' || fact.type === 'death_cause')) {
      deaths.add(fact.subject.personId);
    }
  }
  return deaths;
}

/**
 * Présumée vivante ou non, avec la raison, au jour `today`. Ordre : statut saisi (vivante, puis
 * décédée), décès enregistré, puis naissance : présumée vivante sauf si elle est certainement née
 * il y a 100 ans ou plus (marge des dates approximatives comprise, ADR 0011).
 */
export function assessVitalStatus(
  tree: VitalTree,
  personId: Id,
  today: CalendarDay,
): VitalAssessment {
  const entry = tree.people.find((candidate) => candidate.id === personId);
  if (entry === undefined) throw new RangeError(`Unknown person ${personId}`);
  return assess(entry, createLifeEvents(tree.facts), recordedDeaths(tree.facts), today);
}

/** `assessVitalStatus(…).presumedLiving`. */
export function isPresumedLiving(tree: VitalTree, personId: Id, today: CalendarDay): boolean {
  return assessVitalStatus(tree, personId, today).presumedLiving;
}

/** Le calcul pour toutes les personnes de l'arbre, en une passe. */
export function assessVitalStatuses(
  tree: VitalTree,
  today: CalendarDay,
): ReadonlyMap<Id, VitalAssessment> {
  const events = createLifeEvents(tree.facts);
  const deaths = recordedDeaths(tree.facts);
  return new Map(tree.people.map((entry) => [entry.id, assess(entry, events, deaths, today)]));
}
