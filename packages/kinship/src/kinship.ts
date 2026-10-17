// « Quel lien entre A et B ? » (TRD, « Moteur de parenté », question 1), partie structurelle.
//
// Sang : un chemin de sang monte de A par des filiations jusqu'à un ancêtre commun, puis descend
// jusqu'à B, sans passer deux fois par la même personne. Les grands-parents de deux frères ne
// sont atteints qu'en repassant par leur parent commun : ils ne sont pas au sommet d'un chemin.
// Les chemins qui ne diffèrent que par l'ancêtre au sommet, atteint par des filiations de mêmes
// types, sont réunis : deux parents communs font des frères (`full`), un seul des demi-frères
// (`half`).
//
// Alliance : segments de sang, éventuellement vides, reliés par une ou deux unions (conjoint,
// parents du conjoint, conjoint d'un parent, co-épouse, enfant du conjoint d'un parent…), dans
// des limites de degré, et sans chemin redondant avec le sang (le conjoint d'un parent qui est
// aussi l'autre parent de l'enfant est son parent, pas « l'épouse de votre père »). ADR 0010.
//
// Tous les chemins sont gardés, du plus proche au plus lointain, le sang avant l'alliance, avec
// la certitude la plus faible du chemin. Aucun mot ici : T-026 et T-027.
//
// Calcul borné (ADR 0010, point 7) : chaque côté a son propre budget de chaînes, le sang et
// l'alliance ont des budgets séparés, et les paires sont examinées de la plus proche à la plus
// lointaine. Le calcul se fait toujours dans le même sens (A et B rangés par identifiant), puis
// s'inverse : le lien de B vers A est exactement l'inverse de celui de A vers B, même quand une
// limite est atteinte.
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
  type UnionPairEdge,
} from './graph';
import {
  invertRelationship,
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
  /** Chaînes explorées au plus par côté et par recherche (garde-fou). Par défaut 4 096. */
  maxChains?: number;
  /** Paires de chaînes examinées au plus pour le sang (garde-fou). Par défaut 65 536. */
  maxPathChecks?: number;
}

const DEFAULTS = {
  maxUnions: 2,
  maxAllianceDegree: 4,
  maxTwoUnionAllianceDegree: 2,
  maxRelationships: 32,
  maxChains: 4096,
  maxPathChecks: 65_536,
} as const;

interface ResolvedOptions {
  mask: FiliationTypeMask;
  maxUnions: number;
  maxAllianceDegree: number;
  maxTwoUnionAllianceDegree: number;
  maxRelationships: number;
  maxChains: number;
  maxPathChecks: number;
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
    maxPathChecks: options.maxPathChecks ?? DEFAULTS.maxPathChecks,
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

/** Budget d'une recherche ; `truncated` dit qu'il a été épuisé. */
interface Budget {
  remaining: number;
  truncated: boolean;
}

function budget(amount: number): Budget {
  return { remaining: amount, truncated: false };
}

/**
 * Chaînes montantes depuis `start` (elle comprise, profondeur 0), en largeur : les plus courtes
 * d'abord, de sorte qu'une limite atteinte n'écarte que les plus lointaines. `allowed` : seules
 * ces personnes peuvent être atteintes.
 */
function upChains(
  graph: KinshipGraph,
  start: number,
  mask: FiliationTypeMask,
  maxDepth: number,
  limit: Budget,
  allowed?: ReadonlySet<number>,
): Chain[] {
  const chains: Chain[] = [{ node: start, edge: undefined, prev: undefined, depth: 0 }];
  for (let index = 0; index < chains.length; index += 1) {
    const chain = chains[index];
    if (chain === undefined || chain.depth >= maxDepth) continue;
    for (const edge of graph.parentEdges[chain.node] ?? []) {
      if ((edge.typeBit & mask) === 0 || onChain(chain, edge.parent)) continue;
      if (allowed !== undefined && !allowed.has(edge.parent)) continue;
      if (limit.remaining <= 0) {
        limit.truncated = true;
        return chains;
      }
      limit.remaining -= 1;
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
  edge: UnionPairEdge;
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
  limit: Budget,
): RawBlood[] {
  const walks: RawBlood[] = [];
  for (const up of upChains(graph, start, mask, maxDegree, limit)) {
    const upEdges = chainEdges(up);
    walks.push(rawBlood(start, upEdges, []));
    // Descente en profondeur depuis le sommet, sans repasser par la montée.
    const stack: Chain[] = [{ node: up.node, edge: undefined, prev: undefined, depth: 0 }];
    while (stack.length > 0) {
      const down = stack.pop();
      if (down === undefined || up.depth + down.depth >= maxDegree) continue;
      for (const edge of graph.childEdges[down.node] ?? []) {
        if ((edge.typeBit & mask) === 0) continue;
        if (onChain(up, edge.child) || onChain(down, edge.child)) continue;
        if (limit.remaining <= 0) {
          limit.truncated = true;
          return walks;
        }
        limit.remaining -= 1;
        const next: Chain = { node: edge.child, edge, prev: down, depth: down.depth + 1 };
        walks.push(rawBlood(start, upEdges, chainEdges(next)));
        stack.push(next);
      }
    }
  }
  return walks;
}

/**
 * Personnes utiles pour monter depuis `start` : ses ancêtres (et elle) qui descendent d'un
 * ancêtre commun ou en sont un. Une montée hors de cet ensemble n'atteint aucun sommet possible.
 */
function usefulAncestors(
  graph: KinshipGraph,
  start: number,
  own: ReadonlySet<number>,
  common: readonly number[],
  mask: FiliationTypeMask,
): Set<number> {
  const useful = new Set<number>(common);
  const stack = [...common];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) break;
    for (const edge of graph.childEdges[node] ?? []) {
      if ((edge.typeBit & mask) === 0 || useful.has(edge.child) || !own.has(edge.child)) continue;
      useful.add(edge.child);
      stack.push(edge.child);
    }
  }
  useful.add(start);
  return useful;
}

/** Chaînes rangées par profondeur. */
function byDepth(chains: readonly Chain[]): Chain[][] {
  const levels: Chain[][] = [];
  for (const chain of chains) (levels[chain.depth] ??= []).push(chain);
  return levels;
}

/**
 * Chemins de sang de A vers B (A ≠ B), des plus courts aux plus longs. Les montées sont limitées
 * aux ancêtres qui mènent à un ancêtre commun (ensembles d'ancêtres du graphe, en cache) ; chaque
 * côté a son budget, et les paires de chaînes ont le leur.
 */
function bloodPaths(
  graph: KinshipGraph,
  a: number,
  b: number,
  options: ResolvedOptions,
): { paths: RawBlood[]; truncated: boolean } {
  const { mask } = options;
  const ofA = new Set(graph.ancestorGenerations(a, mask).keys()).add(a);
  const ofB = new Set(graph.ancestorGenerations(b, mask).keys()).add(b);
  const common = [...ofA].filter((node) => ofB.has(node));
  if (common.length === 0) return { paths: [], truncated: false };

  const limitA = budget(options.maxChains);
  const limitB = budget(options.maxChains);
  const usefulA = usefulAncestors(graph, a, ofA, common, mask);
  const usefulB = usefulAncestors(graph, b, ofB, common, mask);
  const levelsA = byDepth(upChains(graph, a, mask, Number.POSITIVE_INFINITY, limitA, usefulA));
  const fromB = new Map<number, Chain[][]>();
  let deepestB = 0;
  for (const chain of upChains(graph, b, mask, Number.POSITIVE_INFINITY, limitB, usefulB)) {
    const levels = fromB.get(chain.node) ?? [];
    (levels[chain.depth] ??= []).push(chain);
    fromB.set(chain.node, levels);
    deepestB = Math.max(deepestB, chain.depth);
  }

  const paths: RawBlood[] = [];
  let checks = options.maxPathChecks;
  let truncated = limitA.truncated || limitB.truncated;
  // Du degré le plus petit au plus grand : une limite atteinte n'écarte que les plus lointains.
  search: for (let total = 1; total <= levelsA.length - 1 + deepestB; total += 1) {
    for (let up = 0; up <= Math.min(total, levelsA.length - 1); up += 1) {
      for (const chainA of levelsA[up] ?? []) {
        const candidates = fromB.get(chainA.node)?.[total - up];
        if (candidates === undefined) continue;
        for (const chainB of candidates) {
          if (checks <= 0) {
            truncated = true;
            break search;
          }
          checks -= 1;
          // Les deux côtés ne se rejoignent qu'au sommet.
          let disjoint = true;
          for (let link = chainB.prev; link !== undefined && disjoint; link = link.prev) {
            if (onChain(chainA.prev, link.node)) disjoint = false;
          }
          if (disjoint) paths.push(rawBlood(a, chainEdges(chainA), chainEdges(chainB).reverse()));
        }
      }
    }
  }
  return { paths, truncated };
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
  union: UnionPairEdge,
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

/** Chemins par une ou deux unions de A vers B ; chaque recherche de segments a son budget. */
function alliancePaths(
  graph: KinshipGraph,
  a: number,
  b: number,
  options: ResolvedOptions,
): { paths: RawSegment[][]; truncated: boolean } {
  const { mask, maxUnions } = options;
  if (maxUnions < 1) return { paths: [], truncated: false };
  const one = options.maxAllianceDegree;
  const two = maxUnions >= 2 ? options.maxTwoUnionAllianceDegree : -1;
  const reach = Math.max(one, two);
  const limits: Budget[] = [];
  const walksFrom = (node: number, degree: number) => {
    const limit = budget(options.maxChains);
    limits.push(limit);
    return nearWalks(graph, node, mask, degree, limit);
  };
  const fromA = walksFrom(a, reach);
  const fromB = indexByEnd(walksFrom(b, reach));
  const paths: RawSegment[][] = [];

  const middleCache = new Map<string, RawBlood[]>();
  const middle = (node: number, degree: number) => {
    const key = `${String(node)}:${String(degree)}`;
    let walks = middleCache.get(key);
    if (walks === undefined) {
      walks = walksFrom(node, degree);
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
  return { paths, truncated: limits.some((limit) => limit.truncated) };
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
      if (segment.kind === 'union') {
        return `U${String(segment.edge.self)}>${String(segment.edge.spouse)}`;
      }
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
      const loose = segment?.kind === 'blood' && isCollateral(segment) ? index : -1;
      const key = `${String(path.length)}#${groupKey(path, loose)}`;
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
  let unionCount = 0;
  const visit = (edge: FiliationEdge) => {
    types.add(edge.filiation.type);
    certainty = weakestCertainty(certainty, edge.filiation.certainty);
  };

  for (const segment of path) {
    if (segment.kind === 'union') {
      const { edge } = segment;
      segments.push({
        kind: 'union',
        fromId: graph.idAt(edge.self),
        toId: graph.idAt(edge.spouse),
        unions: edge.unions.map((ref) => ({
          unionId: ref.union.id,
          fromRank: ref.selfRank,
          toRank: ref.spouseRank,
        })),
      });
      unionCount += 1;
      unionIds.push(...edge.unions.map((ref) => ref.union.id));
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
    kind: unionCount === 0 ? 'blood' : 'alliance',
    segments,
    degree,
    unionCount,
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
 * son inverse.
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

/** Calcul dans le sens canonique (A avant B par identifiant). */
function computeRelationships(
  graph: KinshipGraph,
  a: number,
  b: number,
  options: ResolvedOptions,
): KinshipResult {
  const blood = bloodPaths(graph, a, b, options);
  const alliance = alliancePaths(graph, a, b, options);
  const grouped = groupApexes(
    [
      ...blood.paths.map((path) => [toGrouped(path)]),
      ...alliance.paths.map((p) => p.map(toGrouped)),
    ],
    graph,
  );
  const limited = blood.truncated || alliance.truncated;
  if (grouped.length === 0)
    return limited ? { status: 'incomplete', truncated: true } : { status: 'none' };
  const sorted = sortRelationships(grouped.map((path) => toPublic(graph, path)));
  const relationships = sorted.slice(0, options.maxRelationships);
  return {
    status: 'related',
    relationships,
    truncated: limited || relationships.length < sorted.length,
  };
}

/**
 * Tous les liens de A vers B, dans le graphe du lecteur. Le résultat ne dépend que du contenu du
 * graphe, pas de l'ordre des objets ; celui de B vers A en est exactement l'inverse, dans le
 * même ordre, limites comprises.
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
  if (compareIds(aId, bId) < 0) return computeRelationships(graph, a, b, resolved);
  const result = computeRelationships(graph, b, a, resolved);
  return result.status === 'related'
    ? { ...result, relationships: result.relationships.map(invertRelationship) }
    : result;
}

/** Un ancêtre au sommet d'un chemin de sang, et ses générations les plus proches de chaque côté. */
export interface PathCommonAncestor {
  personId: Id;
  generationsFromA: number;
  generationsFromB: number;
}

/**
 * Ancêtres communs au sommet des chemins de sang entre A et B, chacun une seule fois, avec la
 * génération la plus proche de chaque côté. Ce ne sont pas les ancêtres communs « les plus
 * proches au sens strict » (aucun descendant commun plus proche) : avec l'implexe ou le lévirat,
 * un ancêtre plus lointain est aussi au sommet d'un chemin simple (deux frères dont les parents
 * sont cousins ont aussi leurs arrière-grands-parents communs). Les grands-parents de deux frères
 * n'y sont pas : ils ne sont atteints qu'en repassant par le parent commun. En ligne directe,
 * l'ancêtre est A ou B (0 génération de son côté). Triés du plus proche au plus lointain, puis
 * par identifiant. `truncated` : une limite a été atteinte, la liste peut être incomplète.
 */
export function commonAncestorsOfPaths(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  options: Pick<KinshipOptions, 'filiationTypes' | 'maxChains' | 'maxPathChecks'> = {},
): { ancestors: PathCommonAncestor[]; truncated: boolean } {
  const a = graph.indexOf(aId);
  const b = graph.indexOf(bId);
  if (a === undefined || b === undefined || a === b) return { ancestors: [], truncated: false };
  const swap = compareIds(aId, bId) > 0;
  const { paths, truncated } = bloodPaths(graph, swap ? b : a, swap ? a : b, resolve(options));
  const best = new Map<number, [number, number]>();
  for (const path of paths) {
    const fromA = swap ? path.down.length : path.up.length;
    const fromB = swap ? path.up.length : path.down.length;
    const known = best.get(path.apex);
    best.set(path.apex, [
      Math.min(known?.[0] ?? Number.POSITIVE_INFINITY, fromA),
      Math.min(known?.[1] ?? Number.POSITIVE_INFINITY, fromB),
    ]);
  }
  const ancestors = [...best]
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
  return { ancestors, truncated };
}
