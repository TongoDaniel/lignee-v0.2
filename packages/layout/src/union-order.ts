// Ordre des unions d'une personne et simultanéité de deux unions (ARB-03, ARB-04, UNI-07,
// UNI-08). Règles retenues : ADR 0013 ; simultanéité : ADR 0012 (packages/domain).
import {
  fuzzyDateSortKey,
  resolveSimultaneity,
  type Id,
  type SimultaneityTree,
} from '@lignee/domain';

import type { LayoutUnion, UnionStatus } from './types';

/** Personnes dont le décès est connu (un fait `death`, daté ou non). */
export type IsDeceased = (personId: Id) => boolean;

const nobodyDeceased: IsDeceased = () => false;

/**
 * Union terminée si une date de fin ou un motif de fin est saisi, ou si l'un des conjoints a un
 * fait de décès (une union ne survit pas à un conjoint) ; en cours sinon (ADR 0013).
 */
export function unionStatus(
  union: LayoutUnion,
  isDeceased: IsDeceased = nobodyDeceased,
): UnionStatus {
  if (union.end !== undefined || union.endReason !== undefined) return 'ended';
  return union.spouses.some((spouse) => isDeceased(spouse.personId)) ? 'ended' : 'ongoing';
}

/** Rang de l'union pour `personId` (UNI-07 : chaque conjoint a le sien). */
export function rankOf(union: LayoutUnion, personId: Id): number {
  const spouse = union.spouses.find((candidate) => candidate.personId === personId);
  if (spouse === undefined) throw new Error(`${personId} is not a spouse of union ${union.id}`);
  return spouse.rank;
}

/** L'autre conjoint. */
export function partnerOf(union: LayoutUnion, personId: Id): Id {
  const [a, b] = union.spouses;
  return a.personId === personId ? b.personId : a.personId;
}

/** Vrai si le début de l'union a une place dans le tri des dates (ni absent, ni texte libre). */
export function hasDatedStart(union: LayoutUnion): boolean {
  return union.start !== undefined && fuzzyDateSortKey(union.start).startsWith('0:');
}

function compareIds(a: Id, b: Id): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Unions de `personId`, de la plus ancienne à la plus récente (ARB-04), selon son rang (UNI-07)
 * et les dates de début (ADR 0013) :
 * 1. les unions sont rangées par rang de la personne (puis début, puis identifiant) ;
 * 2. les unions datées sont remises dans l'ordre de leur début, aux places occupées par des
 *    unions datées ; les unions sans date gardent la place que leur donne leur rang.
 * Les dates l'emportent donc quand elles existent ; sans date, le rang saisi décide, et le changer
 * réordonne les foyers.
 */
export function orderUnions<U extends LayoutUnion>(personId: Id, unions: readonly U[]): U[] {
  // Clés calculées une fois par appel : le tri en compare chacune plusieurs fois.
  const entries = unions.map((union) => {
    const key = fuzzyDateSortKey(union.start);
    return { union, key, rank: rankOf(union, personId), dated: key.startsWith('0:') };
  });
  type Entry = (typeof entries)[number];
  const byKey = (a: Entry, b: Entry) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const byRank = [...entries].sort(
    (a, b) => a.rank - b.rank || byKey(a, b) || compareIds(a.union.id, b.union.id),
  );
  const dated = byRank
    .filter((entry) => entry.dated)
    .sort((a, b) => byKey(a, b) || a.rank - b.rank || compareIds(a.union.id, b.union.id));
  let next = 0;
  return byRank.map((entry) => {
    if (!entry.dated) return entry.union;
    const replacement = dated[next];
    next += 1;
    if (replacement === undefined) throw new Error('Dated unions out of sync');
    return replacement.union;
  });
}

/** Ce que la simultanéité de deux unions vaut pour la disposition, et d'où elle vient. */
export interface UnionsRelation {
  readonly simultaneous: boolean;
  /** Ni les dates ni une réponse gardée ne le disent : la question d'UNI-08 reste à poser. */
  readonly pending: boolean;
}

/**
 * Deux unions d'une même personne sont-elles simultanées ? La règle est celle de packages/domain
 * (`resolveSimultaneity`, ADR 0012) : les dates (décès des conjoints compris), sinon la réponse
 * gardée pour cette paire d'unions. Tant que la question n'a pas de réponse, la disposition doit
 * quand même dessiner : deux unions toutes deux en cours (`unionStatus` : ni fin, ni motif de
 * fin, ni conjoint décédé) sont montrées simultanées, sinon successives, et la question reste
 * signalée en attente (ADR 0013).
 */
export function unionsRelation(
  tree: SimultaneityTree,
  a: LayoutUnion,
  b: LayoutUnion,
  isDeceased: IsDeceased = nobodyDeceased,
): UnionsRelation {
  const resolution = resolveSimultaneity(tree, a, b);
  if (resolution.source !== 'unknown') {
    return { simultaneous: resolution.value === 'simultaneous', pending: false };
  }
  return {
    simultaneous:
      unionStatus(a, isDeceased) === 'ongoing' && unionStatus(b, isDeceased) === 'ongoing',
    pending: true,
  };
}
