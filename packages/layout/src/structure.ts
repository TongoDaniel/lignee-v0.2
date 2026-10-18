// Étape 2 de la disposition (TRD) : unités familiales. Une personne qui a plusieurs unions est
// au centre de ses foyers, chaque conjoint en tête de la colonne de ses enfants, dans l'ordre des
// rangs et des dates (ARB-03, ARB-04, UNI-07) ; un enfant dont un parent n'est pas précisé va
// dans la colonne « parent non précisé » du parent connu, avec ses candidats (ARB-05, UNI-11).
// Chaque personne n'est au centre que d'une unité, chaque foyer n'est porté qu'une fois, chaque
// enfant n'est rangé qu'à une place. Règles retenues : ADR 0013.
import type { FiliationType, Id } from '@lignee/domain';

import { generationsFromIndex } from './generations';
import { indexGraph, type GraphIndex } from './graph';
import type {
  ChildPlacement,
  CrossLink,
  FamilyUnit,
  FamilyUnitKind,
  Foyer,
  Generations,
  LayoutFiliation,
  LayoutGraph,
  LayoutUnion,
  MissingParent,
  TreeStructure,
  UnspecifiedChild,
  UnspecifiedColumn,
} from './types';
import { orderUnions, partnerOf, rankOf, unionsRelation, unionStatus } from './union-order';

/**
 * Types de filiation qui rangent un enfant, par ordre de priorité : les parents de naissance,
 * sinon adoptifs, sinon ceux qui l'ont élevé, accueilli ou en ont la tutelle, sinon donneur et
 * gestation pour autrui. Les filiations des autres niveaux restent des liens secondaires.
 */
const PLACEMENT_TIERS: readonly (readonly FiliationType[])[] = [
  ['birth'],
  ['adoptive'],
  ['raised', 'fostered', 'guardian'],
  ['donor', 'surrogacy'],
];

/** Clé d'un foyer de deux parents sans union enregistrée. */
export function parentsFoyerKey(a: Id, b: Id): string {
  return a < b ? `parents:${a}:${b}` : `parents:${b}:${a}`;
}

interface MutableFoyer {
  key: string;
  unionId: Id | undefined;
  hubId: Id;
  partnerId: Id;
  hubRank: number | undefined;
  partnerRank: number | undefined;
  status: Foyer['status'];
  children: Id[];
}

interface Placement {
  kind: 'foyer' | 'unspecified';
  foyerKey: string;
  parentId: Id;
  filiationIds: Id[];
  birthTier: boolean;
}

class StructureBuilder {
  private readonly foyers = new Map<string, MutableFoyer>();
  private readonly placements = new Map<Id, Placement>();
  private readonly unspecifiedOf = new Map<Id, { childId: Id; birthTier: boolean }[]>();

  constructor(
    private readonly index: GraphIndex,
    private readonly generations: Generations,
  ) {}

  private reachable(id: Id): boolean {
    return this.generations.rowOf.has(id);
  }

  private row(id: Id): number {
    return this.generations.rowOf.get(id) ?? 0;
  }

  private unionCount(id: Id): number {
    return this.index.unionsOf.get(id)?.length ?? 0;
  }

  /**
   * Celui des deux qui porte le foyer : le plus d'unions, puis le plus proche de la personne
   * centrale (chemin, puis rangée), puis l'identifiant (aucune règle de genre).
   */
  private hubOf(a: Id, b: Id): Id {
    const score = (id: Id) => [
      -this.unionCount(id),
      this.generations.distanceOf.get(id) ?? Infinity,
      Math.abs(this.row(id)),
    ];
    const left = score(a);
    const right = score(b);
    for (let i = 0; i < left.length; i += 1) {
      const difference = (left[i] ?? 0) - (right[i] ?? 0);
      if (difference !== 0) return difference < 0 ? a : b;
    }
    return a < b ? a : b;
  }

  private addUnionFoyer(union: LayoutUnion) {
    const [a, b] = union.spouses;
    const hubId = this.hubOf(a.personId, b.personId);
    const partnerId = partnerOf(union, hubId);
    this.foyers.set(union.id, {
      key: union.id,
      unionId: union.id,
      hubId,
      partnerId,
      hubRank: rankOf(union, hubId),
      partnerRank: rankOf(union, partnerId),
      status: unionStatus(union, this.isDeceased),
      children: [],
    });
  }

  private parentsFoyer(a: Id, b: Id): MutableFoyer {
    const key = parentsFoyerKey(a, b);
    let foyer = this.foyers.get(key);
    if (foyer === undefined) {
      const hubId = this.hubOf(a, b);
      foyer = {
        key,
        unionId: undefined,
        hubId,
        partnerId: hubId === a ? b : a,
        hubRank: undefined,
        partnerRank: undefined,
        status: undefined,
        children: [],
      };
      this.foyers.set(key, foyer);
    }
    return foyer;
  }

  /** Range un enfant : le foyer de ses deux parents, ou la colonne de son seul parent connu. */
  private place(childId: Id, links: readonly LayoutFiliation[]) {
    let tierLinks: LayoutFiliation[] = [];
    let tierIndex = 0;
    for (const [indexOfTier, tier] of PLACEMENT_TIERS.entries()) {
      tierLinks = links.filter((link) => tier.includes(link.type));
      tierIndex = indexOfTier;
      if (tierLinks.length > 0) break;
    }
    const parents = [...new Set(tierLinks.map((link) => link.parentId))];
    const birthTier = tierIndex === 0;
    const [first, second] = parents;
    if (first === undefined) return;

    if (second === undefined) {
      this.placements.set(childId, {
        kind: 'unspecified',
        foyerKey: '',
        parentId: first,
        filiationIds: tierLinks.map((link) => link.id),
        birthTier,
      });
      const column = this.unspecifiedOf.get(first);
      if (column === undefined) this.unspecifiedOf.set(first, [{ childId, birthTier }]);
      else column.push({ childId, birthTier });
      return;
    }

    // Deux parents ou plus au même niveau : un couple uni de préférence, l'union d'origine
    // saisie si elle est l'une des leurs.
    const origins = new Set(tierLinks.map((link) => link.originUnionId));
    let chosen: { pair: [Id, Id]; foyer: MutableFoyer } | undefined;
    for (let i = 0; i < parents.length && chosen === undefined; i += 1) {
      const a = parents[i] as Id;
      for (let j = i + 1; j < parents.length; j += 1) {
        const b = parents[j] as Id;
        const shared = (this.index.unionsOf.get(a) ?? []).filter(
          (union) => partnerOf(union, a) === b,
        );
        if (shared.length === 0) continue;
        const union =
          shared.find((candidate) => origins.has(candidate.id)) ?? orderUnions(a, shared)[0];
        const foyer = union === undefined ? undefined : this.foyers.get(union.id);
        if (foyer !== undefined) {
          chosen = { pair: [a, b], foyer };
          break;
        }
      }
    }
    chosen ??= { pair: [first, second], foyer: this.parentsFoyer(first, second) };
    chosen.foyer.children.push(childId);
    const pair = new Set(chosen.pair);
    this.placements.set(childId, {
      kind: 'foyer',
      foyerKey: chosen.foyer.key,
      parentId: chosen.foyer.hubId,
      filiationIds: tierLinks.filter((link) => pair.has(link.parentId)).map((link) => link.id),
      birthTier,
    });
  }

  /** Foyers et colonnes qui mènent à la personne centrale. */
  private centerLine(): { foyers: Set<string>; columns: Set<Id> } {
    const foyers = new Set<string>();
    const columns = new Set<Id>();
    const { centerId } = this.generations;
    for (const foyer of this.foyers.values()) {
      if (foyer.hubId === centerId || foyer.partnerId === centerId) foyers.add(foyer.key);
    }
    if (this.unspecifiedOf.has(centerId)) columns.add(centerId);
    const seen = new Set<Id>([centerId]);
    const stack: Id[] = [centerId];
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
      const placement = this.placements.get(id);
      if (placement === undefined) continue;
      const parents: Id[] = [];
      if (placement.kind === 'foyer') {
        foyers.add(placement.foyerKey);
        const foyer = this.foyers.get(placement.foyerKey);
        if (foyer !== undefined) parents.push(foyer.hubId, foyer.partnerId);
      } else {
        columns.add(placement.parentId);
        parents.push(placement.parentId);
      }
      for (const parent of parents) {
        if (!seen.has(parent)) {
          seen.add(parent);
          stack.push(parent);
        }
      }
    }
    return { foyers, columns };
  }

  private missingParent(parentId: Id, candidateIds: readonly Id[], birthTier: boolean) {
    if (!birthTier) return 'parent' satisfies MissingParent;
    const genders = new Set(candidateIds.map((id) => this.index.people.get(id)?.gender));
    if (candidateIds.length > 0) {
      if (genders.size === 1 && genders.has('female')) return 'mother';
      if (genders.size === 1 && genders.has('male')) return 'father';
      return 'parent';
    }
    const gender = this.index.people.get(parentId)?.gender;
    return gender === 'male' ? 'mother' : gender === 'female' ? 'father' : 'parent';
  }

  private column(
    parentId: Id,
    orderedUnions: readonly LayoutUnion[],
    leadsToCenter: boolean,
  ): UnspecifiedColumn | undefined {
    const entries = this.unspecifiedOf.get(parentId);
    if (entries === undefined) return undefined;
    // Candidats : les conjoints dans l'ordre des foyers, puis les autres dans l'ordre reçu.
    const position = new Map<Id, number>();
    orderedUnions.forEach((union, rank) => {
      const partner = partnerOf(union, parentId);
      if (!position.has(partner)) position.set(partner, rank);
    });
    const sortCandidates = (ids: readonly Id[]) =>
      ids
        .map((id, arrival) => ({ id, arrival }))
        .sort(
          (a, b) =>
            (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) ||
            a.arrival - b.arrival,
        )
        .map(({ id }) => id);
    const children: UnspecifiedChild[] = entries.map(({ childId, birthTier }) => {
      const candidateIds = sortCandidates(
        (this.index.candidatesOf.get(childId) ?? []).filter(
          (id) => id !== parentId && this.reachable(id),
        ),
      );
      return {
        childId,
        candidateIds,
        missing: this.missingParent(parentId, candidateIds, birthTier),
      };
    });
    const missing = new Set(children.map((child) => child.missing));
    const [only] = missing;
    return {
      parentId,
      missing: missing.size === 1 && only !== undefined ? only : 'parent',
      children,
      candidateIds: sortCandidates([...new Set(children.flatMap((child) => child.candidateIds))]),
      leadsToCenter,
    };
  }

  /** Vrai si la personne a un fait de décès (daté ou non). */
  private readonly isDeceased = (personId: Id): boolean =>
    (this.index.factsOf.get(personId) ?? []).some((fact) => fact.type === 'death');

  /** Simultanéité de chaque paire de `unions` de `personId` (dates et décès, réponses gardées). */
  private relations(personId: Id, unions: readonly LayoutUnion[]) {
    // Les décès de la personne et de ses conjoints suffisent à la déduction (ADR 0012).
    const involved = new Set([personId, ...unions.map((union) => partnerOf(union, personId))]);
    const tree = {
      unions,
      facts: [...involved].flatMap((id) => this.index.factsOf.get(id) ?? []),
      simultaneityAnswers: [
        ...new Set(unions.flatMap((union) => this.index.answersOf.get(union.id) ?? [])),
      ],
    };
    const result: { simultaneous: boolean; pending: boolean }[] = [];
    for (let i = 0; i < unions.length; i += 1) {
      for (let j = i + 1; j < unions.length; j += 1) {
        result.push(
          unionsRelation(tree, unions[i] as LayoutUnion, unions[j] as LayoutUnion, this.isDeceased),
        );
      }
    }
    return result;
  }

  /**
   * Forme d'une unité, d'après les seuls foyers qu'elle porte (ADR 0013) : une union portée par
   * l'unité d'un autre conjoint n'y est pas dessinée et ne compte pas.
   */
  private unitKind(
    personId: Id,
    ownedUnions: readonly LayoutUnion[],
    ownedParentsFoyers: number,
  ): FamilyUnitKind {
    const total = ownedUnions.length + ownedParentsFoyers;
    if (total === 0) return 'single';
    if (total === 1) return 'couple';
    return this.relations(personId, ownedUnions).some((relation) => relation.simultaneous)
      ? 'simultaneous'
      : 'successive';
  }

  /** Vrai si la question d'UNI-08 de cette personne reste ouverte, sur toutes ses unions. */
  private simultaneityPending(personId: Id): boolean {
    const unions = this.index.unionsOf.get(personId) ?? [];
    return unions.length >= 2 && this.relations(personId, unions).some((r) => r.pending);
  }

  build(): TreeStructure {
    const { index, generations } = this;
    for (const union of index.unions) {
      if (this.reachable(union.spouses[0].personId)) this.addUnionFoyer(union);
    }
    const handled = new Set<Id>();
    for (const filiation of index.filiations) {
      const { childId } = filiation;
      if (handled.has(childId) || !this.reachable(childId)) continue;
      handled.add(childId);
      this.place(childId, index.parentLinksOf.get(childId) ?? []);
    }

    const line = this.centerLine();
    const toFoyer = (foyer: MutableFoyer): Foyer => ({
      ...foyer,
      leadsToCenter: line.foyers.has(foyer.key),
    });
    const foyerOf = new Map<string, Foyer>();
    const ownedBy = new Map<Id, MutableFoyer[]>();
    for (const foyer of this.foyers.values()) {
      const list = ownedBy.get(foyer.hubId);
      if (list === undefined) ownedBy.set(foyer.hubId, [foyer]);
      else list.push(foyer);
    }

    const units: FamilyUnit[] = [];
    const unitOf = new Map<Id, FamilyUnit>();
    const rowNumbers = [...generations.rows.keys()].sort((a, b) => a - b);
    for (const row of rowNumbers) {
      for (const personId of generations.rows.get(row) ?? []) {
        const owned = ownedBy.get(personId) ?? [];
        if (owned.length === 0 && !this.unspecifiedOf.has(personId)) continue;
        const orderedUnions = orderUnions(personId, index.unionsOf.get(personId) ?? []);
        const ownedKeys = new Set(owned.map((foyer) => foyer.key));
        const parentsFoyers = owned.filter((foyer) => foyer.unionId === undefined);
        // Les foyers portés sont ordonnés entre eux seuls (rangs et dates, ADR 0013) : une union
        // portée ailleurs ne déplace pas les places des unions datées.
        const ownedUnions = orderUnions(
          personId,
          (index.unionsOf.get(personId) ?? []).filter((union) => ownedKeys.has(union.id)),
        );
        const foyers = [
          ...ownedUnions.map((union) => this.foyers.get(union.id) as MutableFoyer),
          ...parentsFoyers,
        ].map(toFoyer);
        for (const foyer of foyers) foyerOf.set(foyer.key, foyer);
        const unit: FamilyUnit = {
          hubId: personId,
          row,
          kind: this.unitKind(personId, ownedUnions, parentsFoyers.length),
          simultaneityPending: this.simultaneityPending(personId),
          foyers,
          foyersElsewhere: orderedUnions
            .filter((union) => !ownedKeys.has(union.id))
            .map((union) => union.id),
          unspecified: this.column(personId, orderedUnions, line.columns.has(personId)),
        };
        units.push(unit);
        unitOf.set(personId, unit);
      }
    }

    const placementOf = new Map<Id, ChildPlacement>();
    const used = new Set<Id>();
    for (const [childId, placement] of this.placements) {
      for (const id of placement.filiationIds) used.add(id);
      placementOf.set(
        childId,
        placement.kind === 'foyer'
          ? { kind: 'foyer', foyerKey: placement.foyerKey, filiationIds: placement.filiationIds }
          : {
              kind: 'unspecified',
              parentId: placement.parentId,
              filiationIds: placement.filiationIds,
            },
      );
    }

    const crossLinks: CrossLink[] = [];
    for (const foyer of foyerOf.values()) {
      const rowSpan = this.row(foyer.partnerId) - this.row(foyer.hubId);
      if (foyer.unionId !== undefined && rowSpan !== 0) {
        crossLinks.push({
          kind: 'union',
          role: 'long',
          id: foyer.unionId,
          fromId: foyer.hubId,
          toId: foyer.partnerId,
          rowSpan,
        });
      }
    }
    for (const filiation of index.filiations) {
      if (!this.reachable(filiation.childId)) continue;
      const rowSpan = this.row(filiation.childId) - this.row(filiation.parentId);
      const role = used.has(filiation.id) ? (rowSpan === 1 ? undefined : 'long') : 'secondary';
      if (role === undefined) continue;
      crossLinks.push({
        kind: 'filiation',
        role,
        id: filiation.id,
        fromId: filiation.parentId,
        toId: filiation.childId,
        rowSpan,
      });
    }

    // Toutes les personnes dessinées dont la question d'UNI-08 reste ouverte, qu'elles portent
    // une unité ou non (une épouse dont les deux unions sont portées par ses maris).
    const simultaneityPending = rowNumbers.flatMap((row) =>
      (generations.rows.get(row) ?? []).filter((id) =>
        unitOf.has(id)
          ? unitOf.get(id)?.simultaneityPending === true
          : this.simultaneityPending(id),
      ),
    );

    // Pour le placement (T-012) : simultanéité et ordre des unions de chaque personne, sur toutes
    // ses unions, quel que soit le conjoint qui porte chaque foyer.
    const simultaneousSpouses = new Set<Id>();
    const unionOrderOf = new Map<Id, readonly Id[]>();
    for (const row of rowNumbers) {
      for (const id of generations.rows.get(row) ?? []) {
        const unions = index.unionsOf.get(id) ?? [];
        if (unions.length < 2) continue;
        unionOrderOf.set(
          id,
          orderUnions(id, unions).map((union) => union.id),
        );
        if (this.relations(id, unions).some((relation) => relation.simultaneous)) {
          simultaneousSpouses.add(id);
        }
      }
    }

    return {
      ...generations,
      units,
      unitOf,
      foyerOf,
      placementOf,
      crossLinks,
      simultaneityPending,
      simultaneousSpouses,
      unionOrderOf,
    };
  }
}

/**
 * Étapes 1 et 2 de la disposition : générations depuis `centerId`, puis unités familiales.
 * Fonction pure : le graphe reçu n'est pas modifié ; même graphe, même résultat.
 */
export function buildTreeStructure(graph: LayoutGraph, centerId: Id): TreeStructure {
  const index = indexGraph(graph);
  return new StructureBuilder(index, generationsFromIndex(index, centerId)).build();
}
