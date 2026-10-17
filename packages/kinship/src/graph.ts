// Graphe de parenté (TRD, « Moteur de parenté ») : personnes, unions et filiations, tels que le
// lecteur a le droit de les voir. Le graphe est construit à partir d'objets déjà filtrés par
// packages/domain : il ne contient rien de masqué et ne peut donc rien en révéler (PAR-09).
//
// Le graphe ne garde que la structure (ADR 0010) : ni notes, ni lieux, ni sources, ni statut de
// reconnaissance. Défense en profondeur, pour qu'un objet masqué ne se devine pas :
// - une union ou une filiation qui cite une personne absente est ignorée, jamais traversée ;
// - les rangs d'union sont renumérotés parmi les unions présentes (1, 2, 3…) : un rang 3 sans
//   rang 2 trahirait un foyer masqué ;
// - l'union d'origine d'une filiation est retirée si cette union est absente ;
// - un parent candidat n'est gardé que si une union présente le relie à un parent présent de
//   l'enfant (« mère parmi ses épouses » révélerait sinon une union masquée).
//
// Le graphe est immuable. Un changement dans l'arbre donne un nouveau graphe ; les ensembles
// d'ancêtres sont mis en cache dans chaque graphe (le recalcul partiel est T-028).
import type {
  Certainty,
  Filiation,
  FiliationType,
  Id,
  ParentCandidate,
  Person,
  Union,
} from '@lignee/domain';

/** Une personne, réduite à ce dont le calcul a besoin. */
export type KinshipPerson = Pick<Person, 'id' | 'nature' | 'gender'>;

/**
 * Une union, réduite à sa structure : conjoints et rangs (renumérotés dans le graphe), type et
 * dates. La simultanéité n'est pas dans le graphe : elle se garde par paire d'unions
 * (`SimultaneityAnswer`, ADR 0012) et T-021 la lit avec `resolveSimultaneity` de
 * @lignee/domain, sur l'arbre déjà filtré du lecteur (une réponse n'y figure que si ses deux
 * unions sont visibles).
 */
export type KinshipUnion = Pick<Union, 'id' | 'spouses' | 'type' | 'start' | 'end' | 'endReason'>;

/** Une filiation, réduite à sa structure. */
export type KinshipFiliation = Pick<
  Filiation,
  'id' | 'parentId' | 'childId' | 'type' | 'certainty' | 'originUnionId'
>;

export type KinshipParentCandidate = Pick<ParentCandidate, 'childId' | 'candidateId'>;

/** Ce que le moteur reçoit : les objets visibles du lecteur, rien d'autre. */
export interface KinshipGraphInput {
  people: readonly KinshipPerson[];
  unions: readonly KinshipUnion[];
  filiations: readonly KinshipFiliation[];
  /** Mères ou pères possibles d'un enfant (UNI-11) ; jamais traversés, consultables (T-020). */
  parentCandidates?: readonly KinshipParentCandidate[];
}

/** Tous les types de filiation, dans l'ordre du modèle (UNI-09). */
export const FILIATION_TYPES: readonly FiliationType[] = [
  'birth',
  'adoptive',
  'raised',
  'fostered',
  'guardian',
  'donor',
  'surrogacy',
];

/** Rang de certitude : plus petit = plus sûr. */
export const CERTAINTY_ORDER: Readonly<Record<Certainty, number>> = {
  certain: 0,
  probable: 1,
  hypothetical: 2,
};

/** Certitude la plus faible de deux (PAR-08). */
export function weakestCertainty(a: Certainty, b: Certainty): Certainty {
  return CERTAINTY_ORDER[a] >= CERTAINTY_ORDER[b] ? a : b;
}

/** Masque binaire d'un ensemble de types de filiation (un bit par type de `FILIATION_TYPES`). */
export type FiliationTypeMask = number;

export const ALL_FILIATION_TYPES_MASK: FiliationTypeMask = (1 << FILIATION_TYPES.length) - 1;

export function filiationTypeMask(types: readonly FiliationType[]): FiliationTypeMask {
  let mask = 0;
  for (const type of types) mask |= 1 << FILIATION_TYPES.indexOf(type);
  return mask;
}

/** Une filiation du graphe, entre deux personnes présentes (indices internes). */
export interface FiliationEdge {
  readonly filiation: KinshipFiliation;
  readonly parent: number;
  readonly child: number;
  /** Bit du type, pour les masques. */
  readonly typeBit: number;
}

/** Une union entre deux personnes, avec les rangs renumérotés de chacune. */
export interface UnionRef {
  readonly union: KinshipUnion;
  readonly selfRank: number;
  readonly spouseRank: number;
}

/**
 * Les unions entre deux personnes, vues depuis l'une (indices internes). Deux personnes mariées
 * deux fois (divorce puis remariage) n'ont qu'un passage, qui porte les deux unions : un chemin
 * ne se dédouble pas pour autant.
 */
export interface UnionPairEdge {
  readonly self: number;
  readonly spouse: number;
  /** Triées par identifiant d'union. */
  readonly unions: readonly UnionRef[];
}

/** Un ancêtre et la génération la plus proche à laquelle on l'atteint (1 = parent). */
export interface AncestorEntry {
  personId: Id;
  generations: number;
}

/**
 * Graphe de parenté immuable. Les champs indexés (`parentEdges`, `childEdges`, `unionEdges`,
 * `indexOf`, `ids`) servent au calcul des liens dans ce paquet ; l'extérieur passe par les
 * méthodes, qui parlent en identifiants et en objets réduits du modèle.
 */
export class KinshipGraph {
  /** Identifiant de chaque personne, par indice interne. */
  readonly ids: readonly Id[];
  readonly parentEdges: readonly (readonly FiliationEdge[])[];
  readonly childEdges: readonly (readonly FiliationEdge[])[];
  readonly unionEdges: readonly (readonly UnionPairEdge[])[];

  private readonly index = new Map<Id, number>();
  private readonly peopleById = new Map<Id, KinshipPerson>();
  private readonly unionsById = new Map<Id, KinshipUnion>();
  private readonly filiationsById = new Map<Id, KinshipFiliation>();
  private readonly unionsByPerson = new Map<Id, KinshipUnion[]>();
  private readonly candidates = new Map<Id, Id[]>();
  private readonly ancestorCache = new Map<string, ReadonlyMap<number, number>>();

  constructor(input: KinshipGraphInput) {
    const ids: Id[] = [];
    for (const person of input.people) {
      if (this.index.has(person.id)) throw new Error(`Duplicate person id ${person.id}`);
      this.index.set(person.id, ids.length);
      this.peopleById.set(person.id, {
        id: person.id,
        nature: person.nature,
        gender: person.gender,
      });
      ids.push(person.id);
    }
    this.ids = ids;

    // Unions entre personnes présentes, puis rangs renumérotés par personne : rang saisi, puis
    // identifiant, donnent l'ordre ; le rang exposé est la place dans cet ordre.
    const kept: KinshipUnion[] = [];
    const keptIds = new Set<Id>();
    for (const union of input.unions) {
      const [first, second] = union.spouses;
      const a = this.index.get(first.personId);
      const b = this.index.get(second.personId);
      if (a === undefined || b === undefined || a === b || keptIds.has(union.id)) continue;
      keptIds.add(union.id);
      kept.push(union);
    }
    const byPerson = new Map<Id, KinshipUnion[]>();
    for (const union of kept) {
      for (const spouse of union.spouses) {
        const list = byPerson.get(spouse.personId) ?? [];
        list.push(union);
        byPerson.set(spouse.personId, list);
      }
    }
    const projectedRank = new Map<string, number>();
    for (const [personId, list] of byPerson) {
      const rankOf = (union: KinshipUnion) =>
        union.spouses.find((spouse) => spouse.personId === personId)?.rank ?? 0;
      list.sort((x, y) => rankOf(x) - rankOf(y) || compareIds(x.id, y.id));
      list.forEach((union, position) => projectedRank.set(`${union.id}:${personId}`, position + 1));
    }
    const rankIn = (union: KinshipUnion, personId: Id) =>
      projectedRank.get(`${union.id}:${personId}`) ?? 1;
    for (const union of kept) {
      const [first, second] = union.spouses;
      this.unionsById.set(union.id, {
        id: union.id,
        spouses: [
          { personId: first.personId, rank: rankIn(union, first.personId) },
          { personId: second.personId, rank: rankIn(union, second.personId) },
        ],
        type: union.type,
        ...(union.start === undefined ? {} : { start: union.start }),
        ...(union.end === undefined ? {} : { end: union.end }),
        ...(union.endReason === undefined ? {} : { endReason: union.endReason }),
      });
    }
    for (const [personId, list] of byPerson) {
      const projected: KinshipUnion[] = [];
      for (const union of list) {
        const found = this.unionsById.get(union.id);
        if (found !== undefined) projected.push(found);
      }
      this.unionsByPerson.set(personId, projected);
    }

    const pairs = new Map<string, { self: number; spouse: number; unions: UnionRef[] }>();
    for (const union of this.unionsById.values()) {
      const [first, second] = union.spouses;
      const a = this.index.get(first.personId);
      const b = this.index.get(second.personId);
      if (a === undefined || b === undefined) continue;
      const sides: [number, number, number, number][] = [
        [a, b, first.rank, second.rank],
        [b, a, second.rank, first.rank],
      ];
      for (const [self, spouse, selfRank, spouseRank] of sides) {
        const key = `${String(self)}:${String(spouse)}`;
        const pair = pairs.get(key) ?? { self, spouse, unions: [] };
        pair.unions.push({ union, selfRank, spouseRank });
        pairs.set(key, pair);
      }
    }
    const unionEdges: UnionPairEdge[][] = ids.map(() => []);
    for (const pair of pairs.values()) {
      pair.unions.sort((x, y) => compareIds(x.union.id, y.union.id));
      unionEdges[pair.self]?.push(pair);
    }
    for (const list of unionEdges) {
      list.sort((x, y) => compareIds(this.idAt(x.spouse), this.idAt(y.spouse)));
    }
    this.unionEdges = unionEdges;

    const parentEdges: FiliationEdge[][] = ids.map(() => []);
    const childEdges: FiliationEdge[][] = ids.map(() => []);
    for (const filiation of input.filiations) {
      const parent = this.index.get(filiation.parentId);
      const child = this.index.get(filiation.childId);
      if (parent === undefined || child === undefined || parent === child) continue;
      if (this.filiationsById.has(filiation.id)) continue;
      const origin = filiation.originUnionId;
      const projected: KinshipFiliation = {
        id: filiation.id,
        parentId: filiation.parentId,
        childId: filiation.childId,
        type: filiation.type,
        certainty: filiation.certainty,
        ...(origin !== undefined && this.unionsById.has(origin) ? { originUnionId: origin } : {}),
      };
      this.filiationsById.set(filiation.id, projected);
      const edge: FiliationEdge = {
        filiation: projected,
        parent,
        child,
        typeBit: 1 << FILIATION_TYPES.indexOf(filiation.type),
      };
      parentEdges[child]?.push(edge);
      childEdges[parent]?.push(edge);
    }
    // Ordre stable, indépendant de l'ordre d'arrivée des objets : le résultat d'un calcul ne
    // dépend que du contenu du graphe.
    const byFiliationId = (x: FiliationEdge, y: FiliationEdge) =>
      compareIds(x.filiation.id, y.filiation.id);
    for (const list of parentEdges) list.sort(byFiliationId);
    for (const list of childEdges) list.sort(byFiliationId);
    this.parentEdges = parentEdges;
    this.childEdges = childEdges;

    // Parent candidat : présent, et relié par une union présente à un parent présent de l'enfant.
    for (const candidate of input.parentCandidates ?? []) {
      const child = this.index.get(candidate.childId);
      const target = this.index.get(candidate.candidateId);
      if (child === undefined || target === undefined) continue;
      const linked = (parentEdges[child] ?? []).some((edge) =>
        (unionEdges[edge.parent] ?? []).some((pair) => pair.spouse === target),
      );
      if (!linked) continue;
      const list = this.candidates.get(candidate.childId) ?? [];
      if (!list.includes(candidate.candidateId)) list.push(candidate.candidateId);
      this.candidates.set(candidate.childId, list);
    }
    for (const list of this.candidates.values()) list.sort(compareIds);
  }

  /** Nombre de personnes. */
  get size(): number {
    return this.ids.length;
  }

  /** Vrai si la personne est dans le graphe (donc visible du lecteur). */
  has(personId: Id): boolean {
    return this.index.has(personId);
  }

  /** Indice interne d'une personne. */
  indexOf(personId: Id): number | undefined {
    return this.index.get(personId);
  }

  person(personId: Id): KinshipPerson | undefined {
    return this.peopleById.get(personId);
  }

  /** Une union, avec les rangs renumérotés parmi les unions présentes de chaque conjoint. */
  union(unionId: Id): KinshipUnion | undefined {
    return this.unionsById.get(unionId);
  }

  filiation(filiationId: Id): KinshipFiliation | undefined {
    return this.filiationsById.get(filiationId);
  }

  /** Filiations vers les parents d'une personne (tous types), triées par identifiant. */
  parentsOf(personId: Id): readonly KinshipFiliation[] {
    const index = this.index.get(personId);
    return index === undefined ? [] : (this.parentEdges[index] ?? []).map((edge) => edge.filiation);
  }

  /** Filiations vers les enfants d'une personne (tous types), triées par identifiant. */
  childrenOf(personId: Id): readonly KinshipFiliation[] {
    const index = this.index.get(personId);
    return index === undefined ? [] : (this.childEdges[index] ?? []).map((edge) => edge.filiation);
  }

  /** Unions d'une personne, dans l'ordre de ses rangs (1, 2, 3…). */
  unionsOf(personId: Id): readonly KinshipUnion[] {
    return this.unionsByPerson.get(personId) ?? [];
  }

  /** Parents candidats d'un enfant (« mère parmi ses épouses », UNI-11), triés. */
  parentCandidatesOf(childId: Id): readonly Id[] {
    return this.candidates.get(childId) ?? [];
  }

  /** Vrai si `child` est enfant de `parent` par une filiation d'un type du masque. */
  isChildOf(child: number, parent: number, mask: FiliationTypeMask): boolean {
    for (const edge of this.parentEdges[child] ?? []) {
      if (edge.parent === parent && (edge.typeBit & mask) !== 0) return true;
    }
    return false;
  }

  /**
   * Ancêtres (indices internes) et génération la plus proche, la personne exclue ; mis en cache
   * par personne et par masque de types. Le parcours s'arrête toujours, même sur un cycle.
   */
  ancestorGenerations(start: number, mask: FiliationTypeMask): ReadonlyMap<number, number> {
    const key = `${String(start)}:${String(mask)}`;
    const cached = this.ancestorCache.get(key);
    if (cached !== undefined) return cached;
    const generations = new Map<number, number>([[start, 0]]);
    let frontier = [start];
    let depth = 0;
    while (frontier.length > 0) {
      depth += 1;
      const next: number[] = [];
      for (const node of frontier) {
        for (const edge of this.parentEdges[node] ?? []) {
          if ((edge.typeBit & mask) === 0 || generations.has(edge.parent)) continue;
          generations.set(edge.parent, depth);
          next.push(edge.parent);
        }
      }
      frontier = next;
    }
    generations.delete(start);
    this.ancestorCache.set(key, generations);
    return generations;
  }

  /**
   * Ancêtres d'une personne, chacun une seule fois (implexe, ARB-06), avec la génération la plus
   * proche ; triés par génération puis par identifiant. La personne elle-même n'y figure jamais,
   * même si des données corrompues formaient un cycle.
   */
  ancestors(
    personId: Id,
    types: readonly FiliationType[] = FILIATION_TYPES,
  ): readonly AncestorEntry[] {
    const start = this.index.get(personId);
    if (start === undefined) return [];
    return [...this.ancestorGenerations(start, filiationTypeMask(types))]
      .map(([node, generations]) => ({ personId: this.idAt(node), generations }))
      .sort((x, y) => x.generations - y.generations || compareIds(x.personId, y.personId));
  }

  /** Identifiant d'un indice interne. */
  idAt(index: number): Id {
    const id = this.ids[index];
    if (id === undefined) throw new RangeError(`No person at index ${String(index)}`);
    return id;
  }
}

/** Construit le graphe de parenté à partir des objets visibles du lecteur. */
export function createKinshipGraph(input: KinshipGraphInput): KinshipGraph {
  return new KinshipGraph(input);
}

/** Comparaison d'identifiants en ordre de code (collation « C »), stable sur toute plateforme. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
