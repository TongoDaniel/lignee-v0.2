// Liens par alliance nommés structurellement (TRD, « Moteur de parenté », question 1 : conjoint,
// parents du conjoint, conjoint d'un parent, co-épouse ; PRD, PAR-02 et PAR-04). Règles : ADR 0020.
//
// Le chemin vient de `findRelationships` (ADR 0010) : on ne crée aucun chemin ici, on ne lit que
// sa forme (générations de chaque segment de sang) et les unions qu'il traverse. Rien n'est
// inventé : une co-épouse demande une paire d'unions établie simultanée, par les dates ou par la
// réponse gardée (`resolveSimultaneity` de @lignee/domain, ADR 0012) ; sinon, « autre épouse de
// votre mari », sans rien supposer.
//
// La simultanéité ne vit pas dans le graphe (ADR 0010, points 4 et 6) : elle vient d'un contexte
// construit à partir de l'arbre déjà filtré du lecteur (faits de décès, réponses gardées). Le
// moteur ne compare jamais que des unions présentes dans le graphe : une réponse ou un décès qui
// citerait une union ou une personne masquée n'est jamais lu (défense en profondeur, PAR-09).
// Aucun mot ici : T-026 et T-027.
import {
  simultaneityResolver,
  type Id,
  type Person,
  type SimultaneityResolution,
  type SimultaneityTree,
} from '@lignee/domain';

import { compareIds, type KinshipGraph, type KinshipUnion } from './graph';
import type {
  AllianceCrossing,
  AllianceKind,
  AllianceLink,
  AllianceUnion,
  BloodSegment,
  ChildSide,
  OtherParentUnion,
  Relationship,
  SharedSpouse,
  TimingSummary,
  UnionEnding,
  UnionLink,
} from './relationship';

/** Ce que lit l'alliance, en plus du graphe : l'arbre filtré du lecteur. */
export interface AllianceContextInput {
  /** Faits : les décès terminent les unions et bornent leurs dates (ADR 0012). */
  facts?: SimultaneityTree['facts'];
  /** Réponses gardées « simultanées ou successives », par paire d'unions (ADR 0012). */
  simultaneityAnswers?: SimultaneityTree['simultaneityAnswers'];
  /** Statut vital : un conjoint décédé sans fait de décès daté termine aussi l'union. */
  people?: readonly Pick<Person, 'id' | 'vitalStatus'>[];
}

/**
 * Contexte de l'alliance, construit une fois par arbre (comme le graphe) : faits et réponses ne
 * sont lus qu'une fois. Il doit être construit à partir du **même arbre filtré** que le graphe
 * (ADR 0020, point 6) : le moteur ignore par construction une réponse qui cite une union absente
 * du graphe, ou un décès d'une personne absente, mais pas un fait de décès masqué (visibilité par
 * fait, CON-03, ADR 0008) d'une personne visible, que le filtre doit retirer.
 */
export class AllianceContext {
  private readonly resolver: ReturnType<typeof simultaneityResolver>;
  private readonly deceased: ReadonlySet<Id>;

  constructor(input: AllianceContextInput) {
    const facts = input.facts ?? [];
    this.resolver = simultaneityResolver({
      facts,
      simultaneityAnswers: input.simultaneityAnswers ?? [],
    });
    const deceased = new Set<Id>();
    for (const fact of facts) {
      if (fact.type === 'death' && fact.subject.kind === 'person') {
        deceased.add(fact.subject.personId);
      }
    }
    for (const person of input.people ?? []) {
      if (person.vitalStatus === 'deceased') deceased.add(person.id);
    }
    this.deceased = deceased;
  }

  /** Deux unions présentes : simultanées, successives, ou inconnues (ADR 0012). */
  simultaneity(a: KinshipUnion, b: KinshipUnion): SimultaneityResolution {
    return this.resolver(a, b);
  }

  isDeceased(personId: Id): boolean {
    return this.deceased.has(personId);
  }
}

/** Contexte de l'alliance, à partir de l'arbre filtré du lecteur. */
export function createAllianceContext(input: AllianceContextInput = {}): AllianceContext {
  return new AllianceContext(input);
}

/** Sans contexte : seules les dates des unions comptent ; ni décès, ni réponse. */
export const EMPTY_ALLIANCE_CONTEXT = createAllianceContext();

function endingOf(union: KinshipUnion, context: AllianceContext): UnionEnding {
  if (union.endReason !== undefined) return { status: 'ended', reason: union.endReason };
  if (union.end !== undefined) return { status: 'ended', reason: 'unspecified' };
  // Un conjoint décédé : l'union est finie au plus tard à sa mort, mais pas forcément par elle
  // (un divorce jamais saisi, puis la mort de l'ex) : motif non renseigné, jamais « décès ».
  if (union.spouses.some((spouse) => context.isDeceased(spouse.personId))) {
    return { status: 'ended', reason: 'unspecified' };
  }
  return { status: 'no_end_known' };
}

function summarize(timings: readonly SimultaneityResolution[]): TimingSummary {
  if (timings.some((timing) => timing.source !== 'unknown' && timing.value === 'simultaneous')) {
    return 'simultaneous';
  }
  if (timings.every((timing) => timing.source !== 'unknown' && timing.value === 'successive')) {
    return 'successive';
  }
  return 'unknown';
}

function unionsOf(graph: KinshipGraph, link: UnionLink): KinshipUnion[] {
  return link.unions.flatMap((ref) => {
    const union = graph.union(ref.unionId);
    return union === undefined ? [] : [union];
  });
}

/**
 * Côté enfant d'un passage : `parentId` passe l'union avec `spouseId`, et le chemin y arrive par
 * son enfant `childId` (ou en repart vers lui). On compare chaque union traversée aux unions du
 * parent avec les autres parents de l'enfant (tous types de filiation), présentes dans le graphe.
 */
function childSide(
  graph: KinshipGraph,
  context: AllianceContext,
  childId: Id,
  parentId: Id,
  spouseId: Id,
  crossed: readonly KinshipUnion[],
): ChildSide {
  const others = new Set(
    graph
      .parentsOf(childId)
      .map((filiation) => filiation.parentId)
      .filter((id) => id !== parentId && id !== spouseId),
  );
  const unions: OtherParentUnion[] = [];
  for (const union of graph.unionsOf(parentId)) {
    const other = union.spouses.find((spouse) => spouse.personId !== parentId)?.personId;
    if (other === undefined || !others.has(other)) continue;
    for (const crossedUnion of crossed) {
      unions.push({
        otherParentId: other,
        unionId: union.id,
        crossedUnionId: crossedUnion.id,
        timing: context.simultaneity(union, crossedUnion),
      });
    }
  }
  unions.sort(
    (x, y) =>
      compareIds(x.otherParentId, y.otherParentId) ||
      compareIds(x.unionId, y.unionId) ||
      compareIds(x.crossedUnionId, y.crossedUnionId),
  );
  return {
    childId,
    parentId,
    timing: unions.length === 0 ? 'none' : summarize(unions.map((entry) => entry.timing)),
    unions,
  };
}

/** Enfant par lequel un segment de sang arrive, en montant, à sa fin (`undefined` sinon). */
function childBelowEnd(segment: BloodSegment): Id | undefined {
  if (segment.generationsDown !== 0 || segment.generationsUp === 0) return undefined;
  return segment.commonAncestors[0]?.fromSide?.childId;
}

/** Enfant vers lequel un segment de sang descend depuis son début (`undefined` sinon). */
function childBelowStart(segment: BloodSegment): Id | undefined {
  if (segment.generationsUp !== 0 || segment.generationsDown === 0) return undefined;
  return segment.commonAncestors[0]?.toSide?.childId;
}

function crossingOf(
  graph: KinshipGraph,
  context: AllianceContext,
  left: BloodSegment,
  link: UnionLink,
  right: BloodSegment,
): AllianceCrossing {
  const crossed = unionsOf(graph, link);
  const unions: AllianceUnion[] = crossed.map((union) => ({
    unionId: union.id,
    type: union.type,
    ending: endingOf(union, context),
  }));
  const before = childBelowEnd(left);
  const after = childBelowStart(right);
  return {
    fromId: link.fromId,
    toId: link.toId,
    unions,
    ...(before === undefined
      ? {}
      : { fromChild: childSide(graph, context, before, link.fromId, link.toId, crossed) }),
    ...(after === undefined
      ? {}
      : { toChild: childSide(graph, context, after, link.toId, link.fromId, crossed) }),
  };
}

function sharedSpouseOf(
  graph: KinshipGraph,
  context: AllianceContext,
  first: UnionLink,
  second: UnionLink,
): SharedSpouse {
  const pairs: SharedSpouse['pairs'] = [];
  for (const a of unionsOf(graph, first)) {
    for (const b of unionsOf(graph, second)) {
      const unionIds: [Id, Id] = compareIds(a.id, b.id) < 0 ? [a.id, b.id] : [b.id, a.id];
      pairs.push({ unionIds, timing: context.simultaneity(a, b) });
    }
  }
  pairs.sort(
    (x, y) => compareIds(x.unionIds[0], y.unionIds[0]) || compareIds(x.unionIds[1], y.unionIds[1]),
  );
  return { spouseId: first.toId, timing: summarize(pairs.map((pair) => pair.timing)), pairs };
}

/** Forme d'un segment de sang : générations montées, puis descendues (`1/0` : un parent). */
const shapeOf = (segment: BloodSegment): string =>
  `${String(segment.generationsUp)}/${String(segment.generationsDown)}`;

/** Nature d'un lien par une union, d'après la forme de ses deux segments de sang. */
const ONE_UNION: Readonly<Record<string, AllianceKind>> = {
  '0/0 0/0': 'spouse',
  '0/0 1/0': 'parent_of_spouse',
  '0/0 0/1': 'child_of_spouse',
  '1/0 0/0': 'spouse_of_parent',
  '0/1 0/0': 'spouse_of_child',
  '0/0 1/1': 'sibling_of_spouse',
  '1/1 0/0': 'spouse_of_sibling',
  '1/0 0/1': 'step_sibling',
};

function kindOf(blood: readonly BloodSegment[], shared: SharedSpouse | undefined): AllianceKind {
  const key = blood.map(shapeOf).join(' ');
  if (blood.length === 2) return ONE_UNION[key] ?? 'other';
  if (key === '0/0 0/0 0/0') {
    return shared?.timing === 'simultaneous' ? 'co_spouse' : 'spouse_of_spouse';
  }
  if (key === '0/0 1/1 0/0') return 'spouse_of_sibling_of_spouse';
  return 'other';
}

/**
 * Lien par alliance d'un chemin de `findRelationships`, sans mots ; `undefined` pour un chemin de
 * sang. Le résultat ne dépend que du chemin, du graphe et du contexte, et se lit dans les deux
 * sens : classer le chemin inversé donne exactement `invertAlliance` du lien.
 */
export function classifyAlliance(
  graph: KinshipGraph,
  relationship: Relationship,
  context: AllianceContext = EMPTY_ALLIANCE_CONTEXT,
): AllianceLink | undefined {
  if (relationship.kind !== 'alliance') return undefined;
  const blood: BloodSegment[] = [];
  const links: UnionLink[] = [];
  for (const segment of relationship.segments) {
    if (segment.kind === 'blood') blood.push(segment);
    else links.push(segment);
  }
  if (links.length === 0 || blood.length !== links.length + 1) return undefined;
  const crossings = links.map((link, index) => {
    const left = blood[index];
    const right = blood[index + 1];
    if (left === undefined || right === undefined) throw new Error('Malformed relationship');
    return crossingOf(graph, context, left, link, right);
  });
  const [first, second] = links;
  const center = blood[1];
  const shared =
    links.length === 2 &&
    first !== undefined &&
    second !== undefined &&
    center?.sharing === 'same_person'
      ? sharedSpouseOf(graph, context, first, second)
      : undefined;
  return {
    kind: kindOf(blood, shared),
    crossings,
    ...(shared === undefined ? {} : { sharedSpouse: shared }),
  };
}
