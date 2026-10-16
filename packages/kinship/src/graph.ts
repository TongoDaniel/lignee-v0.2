// Graphe de parenté (TRD, « Moteur de parenté ») : personnes, unions et filiations, tels que le
// lecteur a le droit de les voir. Le graphe est construit à partir d'objets déjà filtrés par
// packages/domain : il ne contient rien de masqué et ne peut donc rien en révéler (PAR-09).
//
// Défense en profondeur : une union ou une filiation qui cite une personne absente du graphe est
// ignorée, jamais traversée. Un objet masqué oublié par le filtre ne crée donc aucun chemin.
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

/** Ce que le moteur reçoit : les objets visibles du lecteur, rien d'autre. */
export interface KinshipGraphInput {
  people: readonly Person[];
  unions: readonly Union[];
  filiations: readonly Filiation[];
  /** Mères ou pères possibles d'un enfant (UNI-11) ; jamais traversés, consultables (T-020). */
  parentCandidates?: readonly ParentCandidate[];
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
  readonly filiation: Filiation;
  readonly parent: number;
  readonly child: number;
  /** Bit du type, pour les masques. */
  readonly typeBit: number;
}

/** Une union du graphe vue depuis l'un des conjoints (indices internes). */
export interface UnionEdge {
  readonly union: Union;
  readonly self: number;
  readonly spouse: number;
  readonly selfRank: number;
  readonly spouseRank: number;
}

/** Un ancêtre et la génération la plus proche à laquelle on l'atteint (1 = parent). */
export interface AncestorEntry {
  personId: Id;
  generations: number;
}

/**
 * Graphe de parenté immuable. Les champs indexés (`parentEdges`, `childEdges`, `unionEdges`,
 * `indexOf`, `ids`) servent au calcul des liens dans ce paquet ; l'extérieur passe par les
 * méthodes, qui parlent en identifiants et en objets du modèle.
 */
export class KinshipGraph {
  /** Identifiant de chaque personne, par indice interne. */
  readonly ids: readonly Id[];
  readonly parentEdges: readonly (readonly FiliationEdge[])[];
  readonly childEdges: readonly (readonly FiliationEdge[])[];
  readonly unionEdges: readonly (readonly UnionEdge[])[];

  private readonly index = new Map<Id, number>();
  private readonly peopleById = new Map<Id, Person>();
  private readonly unionsById = new Map<Id, Union>();
  private readonly filiationsById = new Map<Id, Filiation>();
  private readonly candidates = new Map<Id, Id[]>();
  private readonly ancestorCache = new Map<string, readonly AncestorEntry[]>();

  constructor(input: KinshipGraphInput) {
    const ids: Id[] = [];
    for (const person of input.people) {
      if (this.index.has(person.id)) throw new Error(`Duplicate person id ${person.id}`);
      this.index.set(person.id, ids.length);
      this.peopleById.set(person.id, person);
      ids.push(person.id);
    }
    this.ids = ids;

    const parentEdges: FiliationEdge[][] = ids.map(() => []);
    const childEdges: FiliationEdge[][] = ids.map(() => []);
    for (const filiation of input.filiations) {
      const parent = this.index.get(filiation.parentId);
      const child = this.index.get(filiation.childId);
      if (parent === undefined || child === undefined || parent === child) continue;
      if (this.filiationsById.has(filiation.id)) continue;
      this.filiationsById.set(filiation.id, filiation);
      const edge: FiliationEdge = {
        filiation,
        parent,
        child,
        typeBit: 1 << FILIATION_TYPES.indexOf(filiation.type),
      };
      parentEdges[child]?.push(edge);
      childEdges[parent]?.push(edge);
    }

    const unionEdges: UnionEdge[][] = ids.map(() => []);
    for (const union of input.unions) {
      const [first, second] = union.spouses;
      const a = this.index.get(first.personId);
      const b = this.index.get(second.personId);
      if (a === undefined || b === undefined || a === b) continue;
      if (this.unionsById.has(union.id)) continue;
      this.unionsById.set(union.id, union);
      unionEdges[a]?.push({
        union,
        self: a,
        spouse: b,
        selfRank: first.rank,
        spouseRank: second.rank,
      });
      unionEdges[b]?.push({
        union,
        self: b,
        spouse: a,
        selfRank: second.rank,
        spouseRank: first.rank,
      });
    }

    for (const candidate of input.parentCandidates ?? []) {
      if (!this.index.has(candidate.childId) || !this.index.has(candidate.candidateId)) continue;
      const list = this.candidates.get(candidate.childId) ?? [];
      if (!list.includes(candidate.candidateId)) list.push(candidate.candidateId);
      this.candidates.set(candidate.childId, list);
    }

    // Ordre stable, indépendant de l'ordre d'arrivée des objets : le résultat d'un calcul ne
    // dépend que du contenu du graphe.
    const byFiliationId = (x: FiliationEdge, y: FiliationEdge) =>
      compareIds(x.filiation.id, y.filiation.id);
    for (const list of parentEdges) list.sort(byFiliationId);
    for (const list of childEdges) list.sort(byFiliationId);
    for (const list of unionEdges) list.sort((x, y) => compareIds(x.union.id, y.union.id));

    this.parentEdges = parentEdges;
    this.childEdges = childEdges;
    this.unionEdges = unionEdges;
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

  person(personId: Id): Person | undefined {
    return this.peopleById.get(personId);
  }

  union(unionId: Id): Union | undefined {
    return this.unionsById.get(unionId);
  }

  filiation(filiationId: Id): Filiation | undefined {
    return this.filiationsById.get(filiationId);
  }

  /** Filiations vers les parents d'une personne (tous types), triées par identifiant. */
  parentsOf(personId: Id): readonly Filiation[] {
    const index = this.index.get(personId);
    return index === undefined ? [] : (this.parentEdges[index] ?? []).map((edge) => edge.filiation);
  }

  /** Filiations vers les enfants d'une personne (tous types), triées par identifiant. */
  childrenOf(personId: Id): readonly Filiation[] {
    const index = this.index.get(personId);
    return index === undefined ? [] : (this.childEdges[index] ?? []).map((edge) => edge.filiation);
  }

  /** Unions d'une personne, triées par identifiant. */
  unionsOf(personId: Id): readonly Union[] {
    const index = this.index.get(personId);
    return index === undefined ? [] : (this.unionEdges[index] ?? []).map((edge) => edge.union);
  }

  /** Parents candidats d'un enfant (« mère parmi ses épouses », UNI-11). */
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
   * Ancêtres d'une personne, chacun une seule fois (implexe, ARB-06), avec la génération la plus
   * proche ; triés par génération puis par identifiant. La personne elle-même n'y figure jamais,
   * même si des données corrompues formaient un cycle (le parcours s'arrête toujours). Mis en
   * cache par personne et par ensemble de types de filiation suivis.
   */
  ancestors(
    personId: Id,
    types: readonly FiliationType[] = FILIATION_TYPES,
  ): readonly AncestorEntry[] {
    const start = this.index.get(personId);
    if (start === undefined) return [];
    const mask = filiationTypeMask(types);
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
    const entries = [...generations]
      .map(([node, generation]) => ({ personId: this.idAt(node), generations: generation }))
      .sort((x, y) => x.generations - y.generations || compareIds(x.personId, y.personId));
    this.ancestorCache.set(key, entries);
    return entries;
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
