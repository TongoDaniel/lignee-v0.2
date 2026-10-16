// « Quel lien entre A et B ? » (TRD, « Moteur de parenté », question 1), partie structurelle.
//
// Sang : un chemin de sang monte de A par des filiations jusqu'à un ancêtre commun, puis descend
// jusqu'à B, sans passer deux fois par la même personne. Cette condition suffit à ne garder que
// les ancêtres communs les plus proches de chaque chemin : les grands-parents de deux frères ne
// sont atteints qu'en repassant par leur parent commun. Les chemins qui ne diffèrent que par
// l'ancêtre au sommet, atteint par des filiations de mêmes types, sont réunis : deux parents
// communs font des frères (`full`), un seul des demi-frères (`half`).
//
// Alliance : segments de sang, éventuellement vides, reliés par une ou deux unions (conjoint,
// parents du conjoint, conjoint d'un parent, co-épouse, enfant du conjoint d'un parent…), dans
// des limites de degré, et sans chemin redondant avec le sang (le conjoint d'un parent qui est
// aussi l'autre parent de l'enfant est son parent, pas « l'épouse de votre père »). ADR 0010.
//
// Tous les chemins sont gardés, du plus proche au plus lointain, le sang avant l'alliance, avec
// la certitude la plus faible du chemin. Aucun mot ici : T-026 et T-027.
import type { Certainty, FiliationType, Id } from '@lignee/domain';

import {
  CERTAINTY_ORDER,
  FILIATION_TYPES,
  compareIds,
  filiationTypeMask,
  weakestCertainty,
  type FiliationEdge,
  type FiliationTypeMask,
  type KinshipGraph,
  type UnionEdge,
} from './graph';
import {
  relationshipKey,
  type BloodSegment,
  type CommonAncestor,
  type FiliationLink,
  type KinshipResult,
  type Relationship,
  type Segment,
  type Sharing,
} from './relationship';

export interface KinshipOptions {
  /** Types de filiation suivis (par défaut tous ; les seuls liens de naissance pour la santé). */
  filiationTypes?: readonly FiliationType[];
  /** Unions traversées au plus (0 : sang seulement). Par défaut 2 (co-épouse). */
  maxUnions?: 0 | 1 | 2;
  /** Degré de sang total au plus d'un chemin par une union. Par défaut 4 (ADR 0010). */
  maxAllianceDegree?: number;
  /** Degré de sang total au plus d'un chemin par deux unions. Par défaut 2 (ADR 0010). */
  maxTwoUnionAllianceDegree?: number;
  /** Chemins rendus au plus, les plus proches. Par défaut 32. */
  maxRelationships?: number;
  /** Chaînes explorées au plus depuis une personne (garde-fou). Par défaut 4 096. */
  maxChains?: number;
}

const DEFAULTS = {
  maxUnions: 2,
  maxAllianceDegree: 4,
  maxTwoUnionAllianceDegree: 2,
  maxRelationships: 32,
  maxChains: 4096,
} as const;

interface ResolvedOptions {
  mask: FiliationTypeMask;
  maxUnions: number;
  maxAllianceDegree: number;
  maxTwoUnionAllianceDegree: number;
  maxRelationships: number;
  maxChains: number;
}

function resolve(options: KinshipOptions): ResolvedOptions {
  return {
    mask: filiationTypeMask(options.filiationTypes ?? FILIATION_TYPES),
    maxUnions: options.maxUnions ?? DEFAULTS.maxUnions,
    maxAllianceDegree: options.maxAllianceDegree ?? DEFAULTS.maxAllianceDegree,
    maxTwoUnionAllianceDegree:
      options.maxTwoUnionAllianceDegree ?? DEFAULTS.maxTwoUnionAllianceDegree,
    maxRelationships: options.maxRelationships ?? DEFAULTS.maxRelationships,
    maxChains: options.maxChains ?? DEFAULTS.maxChains,
  };
}

// ---------------------------------------------------------------------------------------------
// Chaînes : montées depuis une personne, descentes depuis un ancêtre (listes chaînées).

interface Chain {
  node: number;
  /** Filiation qui mène ici depuis la chaîne précédente. */
  edge: FiliationEdge | undefined;
  prev: Chain | undefined;
  depth: number;
}

function onChain(chain: Chain | undefined, node: number): boolean {
  for (let link = chain; link !== undefined; link = link.prev) if (link.node === node) return true;
  return false;
}

/** Filiations d'une chaîne, de sa racine vers son bout. */
function chainEdges(chain: Chain): FiliationEdge[] {
  const edges: FiliationEdge[] = [];
  for (let link: Chain | undefined = chain; link?.edge !== undefined; link = link.prev) {
    edges.push(link.edge);
  }
  return edges.reverse();
}

interface Budget {
  remaining: number;
  truncated: boolean;
}

/**
 * Chaînes montantes depuis `start` (elle comprise, profondeur 0), en largeur : les plus courtes
 * d'abord, de sorte qu'une limite atteinte n'écarte que les plus lointaines.
 */
function upChains(
  graph: KinshipGraph,
  start: number,
  mask: FiliationTypeMask,
  maxDepth: number,
  budget: Budget,
): Chain[] {
  const chains: Chain[] = [{ node: start, edge: undefined, prev: undefined, depth: 0 }];
  for (let index = 0; index < chains.length; index += 1) {
    const chain = chains[index];
    if (chain === undefined || chain.depth >= maxDepth) continue;
    for (const edge of graph.parentEdges[chain.node] ?? []) {
      if ((edge.typeBit & mask) === 0 || onChain(chain, edge.parent)) continue;
      if (budget.remaining <= 0) {
        budget.truncated = true;
        return chains;
      }
      budget.remaining -= 1;
      chains.push({ node: edge.parent, edge, prev: chain, depth: chain.depth + 1 });
    }
  }
  return chains;
}

/** Un segment de sang brut : montée jusqu'au sommet, puis descente (indices internes). */
interface RawBlood {
  kind: 'blood';
  start: number;
  end: number;
  /** De `start` vers le sommet, filiation du sommet comprise. */
  up: FiliationEdge[];
  /** Du sommet vers `end`, filiation du sommet comprise. */
  down: FiliationEdge[];
  apex: number;
}

interface RawUnion {
  kind: 'union';
  edge: UnionEdge;
}

type RawSegment = RawBlood | RawUnion;

function rawBlood(start: number, up: FiliationEdge[], down: FiliationEdge[]): RawBlood {
  const apex = up.at(-1)?.parent ?? start;
  const end = down.at(-1)?.child ?? apex;
  return { kind: 'blood', start, end, up, down, apex };
}

function invertRaw(segment: RawBlood): RawBlood {
  return rawBlood(segment.end, [...segment.down].reverse(), [...segment.up].reverse());
}

function degreeOf(segment: RawBlood): number {
  return segment.up.length + segment.down.length;
}

/** Personnes d'un segment brut, dans l'ordre du chemin. */
function rawNodes(segment: RawBlood): number[] {
  return [
    segment.start,
    ...segment.up.map((edge) => edge.parent),
    ...segment.down.map((edge) => edge.child),
  ];
}

/**
 * Chemins de sang de `start` vers toute personne, de degré au plus `maxDegree` (montée puis
 * descente, sans repasser par une personne), `start` lui-même compris (degré 0).
 */
function nearWalks(
  graph: KinshipGraph,
  start: number,
  mask: FiliationTypeMask,
  maxDegree: number,
  budget: Budget,
): RawBlood[] {
  const walks: RawBlood[] = [];
  for (const up of upChains(graph, start, mask, maxDegree, budget)) {
    const upEdges = chainEdges(up);
    walks.push(rawBlood(start, upEdges, []));
    if (up.depth === 0 && maxDegree === 0) continue;
    // Descente en profondeur depuis le sommet, sans repasser par la montée.
    const stack: Chain[] = [{ node: up.node, edge: undefined, prev: undefined, depth: 0 }];
    while (stack.length > 0) {
      const down = stack.pop();
      if (down === undefined || up.depth + down.depth >= maxDegree) continue;
      for (const edge of graph.childEdges[down.node] ?? []) {
        if ((edge.typeBit & mask) === 0) continue;
        // Descendre vers l'enfant d'où l'on vient (ou vers une personne déjà sur le chemin)
        // n'est pas un chemin simple.
        if (onChain(up, edge.child) || onChain(down, edge.child)) continue;
        if (budget.remaining <= 0) {
          budget.truncated = true;
          return walks;
        }
        budget.remaining -= 1;
        const next: Chain = { node: edge.child, edge, prev: down, depth: down.depth + 1 };
        walks.push(rawBlood(start, upEdges, chainEdges(next)));
        stack.push(next);
      }
    }
  }
  return walks;
}

/** Tous les chemins de sang de A vers B (A ≠ B). */
function bloodPaths(
  graph: KinshipGraph,
  a: number,
  b: number,
  options: ResolvedOptions,
  budget: Budget,
): RawBlood[] {
  const fromA = upChains(graph, a, options.mask, Number.POSITIVE_INFINITY, budget);
  const fromB = upChains(graph, b, options.mask, Number.POSITIVE_INFINITY, budget);
  const byApex = new Map<number, Chain[]>();
  for (const chain of fromB) {
    const list = byApex.get(chain.node);
    if (list === undefined) byApex.set(chain.node, [chain]);
    else list.push(chain);
  }
  const paths: RawBlood[] = [];
  for (const chainA of fromA) {
    const candidates = byApex.get(chainA.node);
    if (candidates === undefined) continue;
    for (const chainB of candidates) {
      // Les deux côtés ne se rejoignent qu'au sommet.
      let disjoint = true;
      for (let link = chainB.prev; link !== undefined && disjoint; link = link.prev) {
        if (onChain(chainA.prev, link.node)) disjoint = false;
      }
      if (!disjoint) continue;
      paths.push(rawBlood(a, chainEdges(chainA), chainEdges(chainB).reverse()));
    }
  }
  return paths;
}

/**
 * Passage d'une union X–Y entre deux segments, sans redondance avec le sang : si l'on arrive à X
 * en montant depuis son enfant, cet enfant ne doit pas être aussi enfant de Y (sinon Y est son
 * autre parent, et le chemin n'est que « parent ») ; de même pour l'enfant de Y où l'on descend
 * ensuite (ADR 0010).
 */
function crossingIsUseful(
  graph: KinshipGraph,
  left: RawBlood,
  union: UnionEdge,
  right: RawBlood,
  mask: FiliationTypeMask,
): boolean {
  const before = left.down.length === 0 ? left.up.at(-1)?.child : undefined;
  if (before !== undefined && graph.isChildOf(before, union.spouse, mask)) return false;
  const after = right.up.length === 0 ? right.down[0]?.child : undefined;
  if (after !== undefined && graph.isChildOf(after, union.self, mask)) return false;
  return true;
}

function isSimple(segments: readonly RawSegment[]): boolean {
  const seen = new Set<number>();
  for (const segment of segments) {
    if (segment.kind === 'union') continue;
    for (const node of rawNodes(segment)) {
      if (seen.has(node)) return false;
      seen.add(node);
    }
  }
  return true;
}

function indexByEnd(walks: readonly RawBlood[]): Map<number, RawBlood[]> {
  const byEnd = new Map<number, RawBlood[]>();
  for (const walk of walks) {
    const list = byEnd.get(walk.end);
    if (list === undefined) byEnd.set(walk.end, [walk]);
    else list.push(walk);
  }
  return byEnd;
}

/** Chemins par une ou deux unions de A vers B. */
function alliancePaths(
  graph: KinshipGraph,
  a: number,
  b: number,
  options: ResolvedOptions,
  budget: Budget,
): RawSegment[][] {
  const { mask, maxUnions } = options;
  if (maxUnions < 1) return [];
  const one = options.maxAllianceDegree;
  const two = maxUnions >= 2 ? options.maxTwoUnionAllianceDegree : -1;
  const reach = Math.max(one, two);
  const fromA = nearWalks(graph, a, mask, reach, budget);
  const fromB = indexByEnd(nearWalks(graph, b, mask, reach, budget));
  const paths: RawSegment[][] = [];

  const middleCache = new Map<string, RawBlood[]>();
  const middle = (node: number, degree: number) => {
    const key = `${String(node)}:${String(degree)}`;
    let walks = middleCache.get(key);
    if (walks === undefined) {
      walks = nearWalks(graph, node, mask, degree, budget);
      middleCache.set(key, walks);
    }
    return walks;
  };

  for (const left of fromA) {
    const leftDegree = degreeOf(left);
    for (const first of graph.unionEdges[left.end] ?? []) {
      // Une union : sang, union, sang.
      if (leftDegree <= one) {
        for (const walk of fromB.get(first.spouse) ?? []) {
          if (leftDegree + degreeOf(walk) > one) continue;
          const right = invertRaw(walk);
          if (!crossingIsUseful(graph, left, first, right, mask)) continue;
          const segments: RawSegment[] = [left, { kind: 'union', edge: first }, right];
          if (isSimple(segments)) paths.push(segments);
        }
      }
      // Deux unions : sang, union, sang, union, sang.
      if (leftDegree > two) continue;
      for (const center of middle(first.spouse, two - leftDegree)) {
        const centerDegree = leftDegree + degreeOf(center);
        if (!crossingIsUseful(graph, left, first, center, mask)) continue;
        for (const second of graph.unionEdges[center.end] ?? []) {
          if (second.union.id === first.union.id) continue;
          for (const walk of fromB.get(second.spouse) ?? []) {
            if (centerDegree + degreeOf(walk) > two) continue;
            const right = invertRaw(walk);
            if (!crossingIsUseful(graph, center, second, right, mask)) continue;
            const segments: RawSegment[] = [
              left,
              { kind: 'union', edge: first },
              center,
              { kind: 'union', edge: second },
              right,
            ];
            if (isSimple(segments)) paths.push(segments);
          }
        }
      }
    }
  }
  return paths;
}

// ---------------------------------------------------------------------------------------------
// Regroupement au sommet (frères : deux parents communs) et mise en forme publique.

interface GroupedApex {
  node: number;
  up: FiliationEdge | undefined;
  down: FiliationEdge | undefined;
}

interface GroupedBlood {
  kind: 'blood';
  start: number;
  end: number;
  ascent: FiliationEdge[];
  apexes: GroupedApex[];
  descent: FiliationEdge[];
}

type GroupedSegment = GroupedBlood | RawUnion;

function toGrouped(segment: RawSegment): GroupedSegment {
  if (segment.kind === 'union') return segment;
  return {
    kind: 'blood',
    start: segment.start,
    end: segment.end,
    ascent: segment.up.slice(0, -1),
    apexes: [{ node: segment.apex, up: segment.up.at(-1), down: segment.down[0] }],
    descent: segment.down.slice(1),
  };
}

function isCollateral(segment: GroupedBlood): boolean {
  return segment.apexes.every((apex) => apex.up !== undefined && apex.down !== undefined);
}

function edgeIds(edges: readonly FiliationEdge[]): string {
  return edges.map((edge) => edge.filiation.id).join(',');
}

/** Clé d'un chemin ; pour le segment `loose`, les sommets ne comptent que par leurs types. */
function groupKey(segments: readonly GroupedSegment[], loose: number): string {
  return segments
    .map((segment, index) => {
      if (segment.kind === 'union')
        return `U${segment.edge.union.id}>${String(segment.edge.spouse)}`;
      const apexes =
        index === loose
          ? segment.apexes
              .map((apex) => `${apex.up?.filiation.type ?? ''}/${apex.down?.filiation.type ?? ''}`)
              .sort()
          : segment.apexes.map(
              (apex) =>
                `${String(apex.node)}:${apex.up?.filiation.id ?? ''}:${apex.down?.filiation.id ?? ''}`,
            );
      return `B${String(segment.start)}|${edgeIds(segment.ascent)}|${apexes.join(';')}|${edgeIds(segment.descent)}`;
    })
    .join(' ');
}

/** Réunit les chemins qui ne diffèrent que par l'ancêtre au sommet d'un segment collatéral. */
function groupApexes(paths: readonly GroupedSegment[][], graph: KinshipGraph): GroupedSegment[][] {
  let current = [...paths];
  const length = Math.max(0, ...paths.map((path) => path.length));
  for (let index = 0; index < length; index += 1) {
    const groups = new Map<string, GroupedSegment[]>();
    const order: string[] = [];
    for (const path of current) {
      const segment = path[index];
      const key =
        segment?.kind === 'blood' && isCollateral(segment)
          ? `${String(path.length)}#${groupKey(path, index)}`
          : `${String(path.length)}#${groupKey(path, -1)}`;
      const existing = groups.get(key);
      if (existing === undefined) {
        groups.set(
          key,
          path.map((s) => (s.kind === 'blood' ? { ...s, apexes: [...s.apexes] } : s)),
        );
        order.push(key);
        continue;
      }
      const target = existing[index];
      if (target?.kind === 'blood' && segment?.kind === 'blood') {
        for (const apex of segment.apexes) {
          if (!target.apexes.some((known) => known.node === apex.node)) target.apexes.push(apex);
        }
        target.apexes.sort((x, y) => compareIds(graph.idAt(x.node), graph.idAt(y.node)));
      }
    }
    current = order.flatMap((key) => {
      const path = groups.get(key);
      return path === undefined ? [] : [path];
    });
  }
  return current;
}

function link(graph: KinshipGraph, edge: FiliationEdge): FiliationLink {
  const { filiation } = edge;
  return {
    filiationId: filiation.id,
    parentId: graph.idAt(edge.parent),
    childId: graph.idAt(edge.child),
    type: filiation.type,
    certainty: filiation.certainty,
  };
}

function toPublic(graph: KinshipGraph, path: readonly GroupedSegment[]): Relationship {
  const segments: Segment[] = [];
  const people = new Set<Id>();
  const types = new Set<FiliationType>();
  const unionIds: Id[] = [];
  let certainty: Certainty = 'certain';
  let degree = 0;
  const visit = (edge: FiliationEdge) => {
    types.add(edge.filiation.type);
    certainty = weakestCertainty(certainty, edge.filiation.certainty);
  };

  for (const segment of path) {
    if (segment.kind === 'union') {
      const { edge } = segment;
      segments.push({
        kind: 'union',
        unionId: edge.union.id,
        fromId: graph.idAt(edge.self),
        toId: graph.idAt(edge.spouse),
        fromRank: edge.selfRank,
        toRank: edge.spouseRank,
      });
      unionIds.push(edge.union.id);
      continue;
    }
    const first = segment.apexes[0];
    const up = segment.ascent.length + (first?.up === undefined ? 0 : 1);
    const down = segment.descent.length + (first?.down === undefined ? 0 : 1);
    degree += up + down;
    for (const edge of [...segment.ascent, ...segment.descent]) visit(edge);
    people.add(graph.idAt(segment.start));
    people.add(graph.idAt(segment.end));
    for (const edge of segment.ascent) people.add(graph.idAt(edge.parent));
    for (const edge of segment.descent) people.add(graph.idAt(edge.child));
    const commonAncestors: CommonAncestor[] = segment.apexes.map((apex) => {
      people.add(graph.idAt(apex.node));
      if (apex.up !== undefined) visit(apex.up);
      if (apex.down !== undefined) {
        visit(apex.down);
        people.add(graph.idAt(apex.down.child));
      }
      return {
        personId: graph.idAt(apex.node),
        ...(apex.up === undefined ? {} : { fromSide: link(graph, apex.up) }),
        ...(apex.down === undefined ? {} : { toSide: link(graph, apex.down) }),
      };
    });
    const sharing: Sharing =
      up === 0 && down === 0
        ? 'same_person'
        : up === 0 || down === 0
          ? 'direct_line'
          : commonAncestors.length >= 2
            ? 'full'
            : 'half';
    const blood: BloodSegment = {
      kind: 'blood',
      fromId: graph.idAt(segment.start),
      toId: graph.idAt(segment.end),
      generationsUp: up,
      generationsDown: down,
      ascent: segment.ascent.map((edge) => link(graph, edge)),
      commonAncestors,
      descent: segment.descent.map((edge) => link(graph, edge)),
      sharing,
    };
    segments.push(blood);
  }

  return {
    kind: unionIds.length === 0 ? 'blood' : 'alliance',
    segments,
    degree,
    unionCount: unionIds.length,
    certainty,
    filiationTypes: FILIATION_TYPES.filter((type) => types.has(type)),
    unionIds,
    personIds: [...people].sort(compareIds),
  };
}

/** Écart entre montée et descente d'un lien de sang (cousins avant « à la mode de Bretagne »). */
function imbalance(relationship: Relationship): number {
  const [segment] = relationship.segments;
  return relationship.kind === 'blood' && segment?.kind === 'blood'
    ? Math.abs(segment.generationsUp - segment.generationsDown)
    : 0;
}

/**
 * Ordre des chemins : le sang avant l'alliance, puis du plus court au plus long, le moins
 * d'unions, le plus équilibré, le plus certain ; à égalité, une clé identique pour un chemin et
 * son inverse, de sorte que B vers A donne les inverses dans le même ordre.
 */
function sortRelationships(relationships: Relationship[]): Relationship[] {
  const keyed = relationships.map((relationship) => ({
    relationship,
    key: relationshipKey(relationship),
  }));
  keyed.sort(
    (x, y) =>
      (x.relationship.kind === 'blood' ? 0 : 1) - (y.relationship.kind === 'blood' ? 0 : 1) ||
      x.relationship.degree +
        x.relationship.unionCount -
        (y.relationship.degree + y.relationship.unionCount) ||
      x.relationship.unionCount - y.relationship.unionCount ||
      imbalance(x.relationship) - imbalance(y.relationship) ||
      CERTAINTY_ORDER[x.relationship.certainty] - CERTAINTY_ORDER[y.relationship.certainty] ||
      compareIds(x.key, y.key),
  );
  return keyed.map(({ relationship }) => relationship);
}

/**
 * Tous les liens de A vers B, dans le graphe du lecteur. Le résultat ne dépend que du contenu du
 * graphe, pas de l'ordre des objets ; celui de B vers A en est exactement l'inverse.
 */
export function findRelationships(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  options: KinshipOptions = {},
): KinshipResult {
  const a = graph.indexOf(aId);
  const b = graph.indexOf(bId);
  if (a === undefined || b === undefined) return { status: 'none' };
  if (a === b) return { status: 'same_person' };

  const resolved = resolve(options);
  const budget: Budget = { remaining: resolved.maxChains, truncated: false };
  const blood = bloodPaths(graph, a, b, resolved, budget).map((path) => [toGrouped(path)]);
  const alliance = alliancePaths(graph, a, b, resolved, budget).map((path) => path.map(toGrouped));
  const grouped = groupApexes([...blood, ...alliance], graph);
  if (grouped.length === 0) return { status: 'none' };

  const sorted = sortRelationships(grouped.map((path) => toPublic(graph, path)));
  const relationships = sorted.slice(0, resolved.maxRelationships);
  return {
    status: 'related',
    relationships,
    truncated: budget.truncated || relationships.length < sorted.length,
  };
}

/** Un ancêtre commun le plus proche, et ses générations les plus proches de chaque côté. */
export interface ClosestCommonAncestor {
  personId: Id;
  generationsFromA: number;
  generationsFromB: number;
}

/**
 * Ancêtres communs les plus proches de A et B : les sommets des chemins de sang, chacun une
 * seule fois (implexe), avec la génération la plus proche de chaque côté. En ligne directe,
 * l'ancêtre est A ou B lui-même (0 génération de son côté). Triés du plus proche au plus
 * lointain, puis par identifiant.
 */
export function closestCommonAncestors(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  options: Pick<KinshipOptions, 'filiationTypes' | 'maxChains'> = {},
): ClosestCommonAncestor[] {
  const a = graph.indexOf(aId);
  const b = graph.indexOf(bId);
  if (a === undefined || b === undefined || a === b) return [];
  const resolved = resolve(options);
  const budget: Budget = { remaining: resolved.maxChains, truncated: false };
  const best = new Map<number, [number, number]>();
  for (const path of bloodPaths(graph, a, b, resolved, budget)) {
    const known = best.get(path.apex);
    best.set(path.apex, [
      Math.min(known?.[0] ?? Number.POSITIVE_INFINITY, path.up.length),
      Math.min(known?.[1] ?? Number.POSITIVE_INFINITY, path.down.length),
    ]);
  }
  return [...best]
    .map(([node, [fromA, fromB]]) => ({
      personId: graph.idAt(node),
      generationsFromA: fromA,
      generationsFromB: fromB,
    }))
    .sort(
      (x, y) =>
        x.generationsFromA + x.generationsFromB - (y.generationsFromA + y.generationsFromB) ||
        compareIds(x.personId, y.personId),
    );
}
