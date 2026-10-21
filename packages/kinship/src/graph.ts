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
// d'ancêtres sont calculés à la demande, personne par personne, et mis en cache dans chaque
// graphe : seules les personnes interrogées après le changement sont recalculées. Jamais de cache
// partagé entre deux graphes : chacun est la vue d'un lecteur (ADR 0026). La construction peut se
// faire par tranches (`createKinshipGraphInSlices`, T-028).
import type {
  Certainty,
  Filiation,
  FiliationType,
  Id,
  ParentCandidate,
  Person,
  Union,
} from '@lignee/domain';

import {
  HEAVY,
  NEVER_PAUSE,
  drain,
  runInSlices,
  type Pacer,
  type SliceOptions,
  type Steps,
} from './slicing';

/**
 * Une personne, réduite à ce dont le calcul a besoin. `distinctFrom` (place à compléter dite
 * distincte de certaines personnes, ADR 0017) ne garde que des personnes présentes : une mention
 * qui viserait une personne masquée ne laisse aucune trace.
 */
export type KinshipPerson = Pick<Person, 'id' | 'nature' | 'gender' | 'distinctFrom'>;

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

/** Tables du graphe, construites une fois (`buildGraphParts`), directement ou par tranches. */
interface GraphParts {
  readonly ids: readonly Id[];
  readonly parentEdges: readonly (readonly FiliationEdge[])[];
  readonly childEdges: readonly (readonly FiliationEdge[])[];
  readonly unionEdges: readonly (readonly UnionPairEdge[])[];
  readonly index: ReadonlyMap<Id, number>;
  readonly peopleById: ReadonlyMap<Id, KinshipPerson>;
  readonly unionsById: ReadonlyMap<Id, KinshipUnion>;
  readonly filiationsById: ReadonlyMap<Id, KinshipFiliation>;
  readonly unionsByPerson: ReadonlyMap<Id, readonly KinshipUnion[]>;
  readonly candidates: ReadonlyMap<Id, readonly Id[]>;
}

/**
 * Tables d'un graphe déjà construites par tranches (`createKinshipGraphInSlices`). Classe à champ
 * privé, non exportée : seul ce module en fabrique.
 */
class PreparedGraph {
  /** Champ privé : rend la classe nominale pour TypeScript. */
  private readonly built: GraphParts;

  constructor(parts: GraphParts) {
    this.built = parts;
  }

  get parts(): GraphParts {
    return this.built;
  }
}

/**
 * Objets traités entre deux points de pause de la construction. Le travail de chaque objet tient
 * dans une fonction ordinaire (`visitRange`) : hors d'un générateur, le moteur JavaScript peut
 * l'optimiser pendant la boucle (sur V8, un générateur parcouru une seule fois ne l'est pas).
 */
const BUILD_CHUNK = 32;

function visitRange<T>(items: readonly T[], start: number, end: number, visit: (item: T) => void) {
  for (let position = start; position < end; position += 1) visit(items[position] as T);
}

/** Visite chaque objet, avec un point de pause tous les `BUILD_CHUNK` objets. */
function* inChunks<T>(items: readonly T[], pacer: Pacer, visit: (item: T) => void): Steps<void> {
  for (let start = 0; start < items.length; start += BUILD_CHUNK) {
    if (pacer.due(HEAVY)) yield;
    visitRange(items, start, Math.min(start + BUILD_CHUNK, items.length), visit);
  }
}

/**
 * Construction des tables du graphe, avec un point de pause tous les 32 objets lus (calcul
 * découpé, `slicing.ts`). Le résultat ne dépend que du contenu de `input`, pas des pauses.
 */
export function* buildGraphParts(input: KinshipGraphInput, pacer: Pacer): Steps<GraphParts> {
  const index = new Map<Id, number>();
  const peopleById = new Map<Id, KinshipPerson>();
  const unionsById = new Map<Id, KinshipUnion>();
  const filiationsById = new Map<Id, KinshipFiliation>();
  const unionsByPerson = new Map<Id, KinshipUnion[]>();
  const candidates = new Map<Id, Id[]>();
  const ids: Id[] = [];
  const idAt = (position: number): Id => {
    const id = ids[position];
    if (id === undefined) throw new RangeError(`No person at index ${String(position)}`);
    return id;
  };
  yield* inChunks(input.people, pacer, (person) => {
    if (index.has(person.id)) throw new Error(`Duplicate person id ${person.id}`);
    index.set(person.id, ids.length);
    peopleById.set(person.id, {
      id: person.id,
      nature: person.nature,
      gender: person.gender,
    });
    ids.push(person.id);
  });
  // Mentions « distincte de » : seulement sur une place à compléter, vers des personnes
  // présentes, triées et sans doublon.
  yield* inChunks(input.people, pacer, (person) => {
    if (person.nature !== 'placeholder' || person.distinctFrom === undefined) return;
    const kept = [...new Set(person.distinctFrom)]
      .filter((id) => id !== person.id && index.has(id))
      .sort(compareIds);
    const projected = peopleById.get(person.id);
    if (projected !== undefined && kept.length > 0) {
      peopleById.set(person.id, { ...projected, distinctFrom: kept });
    }
  });

  // Unions entre personnes présentes, puis rangs renumérotés par personne : rang saisi, puis
  // identifiant, donnent l'ordre ; le rang exposé est la place dans cet ordre.
  const kept: KinshipUnion[] = [];
  const keptIds = new Set<Id>();
  yield* inChunks(input.unions, pacer, (union) => {
    const [first, second] = union.spouses;
    const a = index.get(first.personId);
    const b = index.get(second.personId);
    if (a === undefined || b === undefined || a === b || keptIds.has(union.id)) return;
    keptIds.add(union.id);
    kept.push(union);
  });
  const byPerson = new Map<Id, KinshipUnion[]>();
  yield* inChunks(kept, pacer, (union) => {
    for (const spouse of union.spouses) {
      const list = byPerson.get(spouse.personId) ?? [];
      list.push(union);
      byPerson.set(spouse.personId, list);
    }
  });
  const unionLists = [...byPerson];
  // Rang renuméroté de chaque conjoint, par union (indice du conjoint dans `spouses`) : une clé
  // objet, sans chaîne à fabriquer ni à hacher (T-028).
  const projectedRank = new Map<KinshipUnion, [number, number]>();
  yield* inChunks(unionLists, pacer, ([personId, list]) => {
    const rankOf = (union: KinshipUnion) =>
      union.spouses.find((spouse) => spouse.personId === personId)?.rank ?? 0;
    list.sort((x, y) => rankOf(x) - rankOf(y) || compareIds(x.id, y.id));
    list.forEach((union, position) => {
      const ranks = projectedRank.get(union) ?? [1, 1];
      ranks[union.spouses[0].personId === personId ? 0 : 1] = position + 1;
      projectedRank.set(union, ranks);
    });
  });
  const rankIn = (union: KinshipUnion, spouse: 0 | 1) => projectedRank.get(union)?.[spouse] ?? 1;
  yield* inChunks(kept, pacer, (union) => {
    const [first, second] = union.spouses;
    unionsById.set(union.id, {
      id: union.id,
      spouses: [
        { personId: first.personId, rank: rankIn(union, 0) },
        { personId: second.personId, rank: rankIn(union, 1) },
      ],
      type: union.type,
      ...(union.start === undefined ? {} : { start: union.start }),
      ...(union.end === undefined ? {} : { end: union.end }),
      ...(union.endReason === undefined ? {} : { endReason: union.endReason }),
    });
  });
  yield* inChunks(unionLists, pacer, ([personId, list]) => {
    const projected: KinshipUnion[] = [];
    for (const union of list) {
      const found = unionsById.get(union.id);
      if (found !== undefined) projected.push(found);
    }
    unionsByPerson.set(personId, projected);
  });

  // Clé numérique (personne, conjoint), sans chaîne (T-028).
  const pairs = new Map<number, { self: number; spouse: number; unions: UnionRef[] }>();
  yield* inChunks([...unionsById.values()], pacer, (union) => {
    const [first, second] = union.spouses;
    const a = index.get(first.personId);
    const b = index.get(second.personId);
    if (a === undefined || b === undefined) return;
    const sides: [number, number, number, number][] = [
      [a, b, first.rank, second.rank],
      [b, a, second.rank, first.rank],
    ];
    for (const [self, spouse, selfRank, spouseRank] of sides) {
      const key = self * ids.length + spouse;
      const pair = pairs.get(key) ?? { self, spouse, unions: [] };
      pair.unions.push({ union, selfRank, spouseRank });
      pairs.set(key, pair);
    }
  });
  const unionEdges: UnionPairEdge[][] = ids.map(() => []);
  yield* inChunks([...pairs.values()], pacer, (pair) => {
    pair.unions.sort((x, y) => compareIds(x.union.id, y.union.id));
    unionEdges[pair.self]?.push(pair);
  });
  yield* inChunks(unionEdges, pacer, (list) => {
    list.sort((x, y) => compareIds(idAt(x.spouse), idAt(y.spouse)));
  });

  const parentEdges: FiliationEdge[][] = ids.map(() => []);
  const childEdges: FiliationEdge[][] = ids.map(() => []);
  yield* inChunks(input.filiations, pacer, (filiation) => {
    const parent = index.get(filiation.parentId);
    const child = index.get(filiation.childId);
    if (parent === undefined || child === undefined || parent === child) return;
    if (filiationsById.has(filiation.id)) return;
    const origin = filiation.originUnionId;
    const projected: KinshipFiliation = {
      id: filiation.id,
      parentId: filiation.parentId,
      childId: filiation.childId,
      type: filiation.type,
      certainty: filiation.certainty,
      ...(origin !== undefined && unionsById.has(origin) ? { originUnionId: origin } : {}),
    };
    filiationsById.set(filiation.id, projected);
    const edge: FiliationEdge = {
      filiation: projected,
      parent,
      child,
      typeBit: 1 << FILIATION_TYPES.indexOf(filiation.type),
    };
    parentEdges[child]?.push(edge);
    childEdges[parent]?.push(edge);
  });
  // Ordre stable, indépendant de l'ordre d'arrivée des objets : le résultat d'un calcul ne
  // dépend que du contenu du graphe.
  const byFiliationId = (x: FiliationEdge, y: FiliationEdge) =>
    compareIds(x.filiation.id, y.filiation.id);
  yield* inChunks(parentEdges, pacer, (list) => list.sort(byFiliationId));
  yield* inChunks(childEdges, pacer, (list) => list.sort(byFiliationId));

  // Parent candidat : présent, et relié par une union présente à un parent présent de l'enfant.
  yield* inChunks(input.parentCandidates ?? [], pacer, (candidate) => {
    const child = index.get(candidate.childId);
    const target = index.get(candidate.candidateId);
    if (child === undefined || target === undefined) return;
    const linked = (parentEdges[child] ?? []).some((edge) =>
      (unionEdges[edge.parent] ?? []).some((pair) => pair.spouse === target),
    );
    if (!linked) return;
    const list = candidates.get(candidate.childId) ?? [];
    if (!list.includes(candidate.candidateId)) list.push(candidate.candidateId);
    candidates.set(candidate.childId, list);
  });
  for (const list of candidates.values()) list.sort(compareIds);

  return {
    ids,
    parentEdges,
    childEdges,
    unionEdges,
    index,
    peopleById,
    unionsById,
    filiationsById,
    unionsByPerson,
    candidates,
  };
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

  private readonly index: ReadonlyMap<Id, number>;
  private readonly peopleById: ReadonlyMap<Id, KinshipPerson>;
  private readonly unionsById: ReadonlyMap<Id, KinshipUnion>;
  private readonly filiationsById: ReadonlyMap<Id, KinshipFiliation>;
  private readonly unionsByPerson: ReadonlyMap<Id, readonly KinshipUnion[]>;
  private readonly candidates: ReadonlyMap<Id, readonly Id[]>;
  private readonly ancestorCache = new Map<string, ReadonlyMap<number, number>>();

  /**
   * `source` : les objets visibles du lecteur (graphe construit d'un trait), ou des tables déjà
   * construites par tranches (`createKinshipGraphInSlices`).
   */
  constructor(source: KinshipGraphInput | PreparedGraph) {
    const parts =
      source instanceof PreparedGraph ? source.parts : drain(buildGraphParts(source, NEVER_PAUSE));
    this.ids = parts.ids;
    this.parentEdges = parts.parentEdges;
    this.childEdges = parts.childEdges;
    this.unionEdges = parts.unionEdges;
    this.index = parts.index;
    this.peopleById = parts.peopleById;
    this.unionsById = parts.unionsById;
    this.filiationsById = parts.filiationsById;
    this.unionsByPerson = parts.unionsByPerson;
    this.candidates = parts.candidates;
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
    return drain(this.ancestorGenerationSteps(start, mask, NEVER_PAUSE));
  }

  /**
   * `ancestorGenerations`, avec un point de pause par ancêtre (calcul découpé). Le cache n'est
   * écrit qu'à la fin : un calcul interrompu ou annulé n'y laisse rien de partiel.
   */
  *ancestorGenerationSteps(
    start: number,
    mask: FiliationTypeMask,
    pacer: Pacer,
  ): Steps<ReadonlyMap<number, number>> {
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
        if (pacer.due()) yield;
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

/**
 * Le même graphe que `createKinshipGraph`, construit par tranches (TRD, Performance : jamais plus
 * de 50 ms d'interface bloquée), à l'ouverture de l'arbre. Rejetée par `KinshipCancelledError`
 * si le signal annule. L'arbre ne doit pas changer pendant la construction : le graphe est celui
 * du contenu lu.
 */
export async function createKinshipGraphInSlices(
  input: KinshipGraphInput,
  options: SliceOptions,
): Promise<KinshipGraph> {
  const parts = await runInSlices((pacer) => buildGraphParts(input, pacer), options);
  return new KinshipGraph(new PreparedGraph(parts));
}

/**
 * Vide le cache des ensembles d'ancêtres d'un graphe, pour mesurer une question sur un graphe neuf
 * (tests de budget, T-028). Interne au paquet : `index.ts` ne l'exporte pas.
 */
export function clearAncestorCacheForTest(graph: KinshipGraph): void {
  // Accès voulu au champ privé (la notation entre crochets le permet en TypeScript).
  graph['ancestorCache'].clear();
}

/** Comparaison d'identifiants en ordre de code (collation « C »), stable sur toute plateforme. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
