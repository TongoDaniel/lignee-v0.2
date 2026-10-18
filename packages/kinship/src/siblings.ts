// Fratrie calculée, jamais saisie (PRD, UNI-13 et PAR-03 ; TRD, « Moteur de parenté »,
// question 1) : frère, demi-frère par le père ou par la mère, « frère ou demi-frère » tant qu'un
// parent n'est pas précisé, enfant du conjoint d'un parent. Structure sans mots : les mots
// français et anglais sont T-026 et T-027, l'alliance nommée T-021, les liens non biologiques et
// la certitude affichée T-022 (`presentation.ts`). Règles : ADR 0017.
//
// Le calcul lit les parents de A et de B dans le graphe du lecteur, déjà filtré : un parent
// masqué est un parent jamais saisi, et ne laisse aucun indice (PAR-09).
import type { Certainty, FiliationType, Gender, Id } from '@lignee/domain';

import {
  FILIATION_TYPES,
  compareIds,
  weakestCertainty,
  type KinshipFiliation,
  type KinshipGraph,
} from './graph';
import type { FiliationLink } from './relationship';

/**
 * Côté d'un parent pour un enfant : `father` (homme), `mother` (femme), `parent` quand le mot
 * genré ne convient pas (genre autre ou non renseigné) ou ne dirait pas lequel (deux mères ou
 * deux pères, CL-FAM-08).
 */
export type ParentSide = 'father' | 'mother' | 'parent';

/**
 * Partage entre deux enfants :
 * - `full` : au moins deux parents communs (frère, sœur) ;
 * - `half` : un seul parent commun, et leurs autres parents sont sûrement deux personnes
 *   différentes : deux personnes connues, ou une place à compléter dite distincte de l'autre
 *   (`distinctFrom`) (demi-frère, même père ou même mère) ;
 * - `full_or_half` : un seul parent commun, et l'autre parent pourrait être le même : non précisé
 *   d'un côté (avec ou sans candidats, UNI-11), ou une place à compléter que rien ne dit distincte
 *   de l'autre parent, jamais supposée identique ni différente (TRD) : « frère ou demi-frère ».
 */
export type SiblingSharing = 'full' | 'half' | 'full_or_half';

/**
 * Base de la fratrie : `birth`, des parents communs par la naissance des deux côtés ; `other`,
 * aucun parent commun par la naissance, mais des parents communs par un autre type (adoption,
 * « a élevé », confiage…) : signalée, jamais confondue avec la naissance (PAR-06, T-022).
 */
export type SiblingBasis = 'birth' | 'other';

/** L'autre parent de naissance d'un enfant, quand un seul parent est commun. */
export type OtherParentState =
  | { status: 'known'; personId: Id }
  | { status: 'placeholder'; personId: Id }
  /** Pas d'autre parent de naissance dans le graphe ; les candidats éventuels (UNI-11). */
  | { status: 'unspecified'; candidateIds: Id[] };

/** Un parent commun, et la filiation qui le relie à chacun des deux enfants. */
export interface SharedParent {
  personId: Id;
  fromLink: FiliationLink;
  toLink: FiliationLink;
}

/** Fratrie par des parents communs. */
export interface SiblingLink {
  kind: 'sibling';
  fromId: Id;
  toId: Id;
  /** Genres des deux personnes, pour l'accord (« frère », « demi-sœur »). */
  fromGender: Gender;
  toGender: Gender;
  basis: SiblingBasis;
  sharing: SiblingSharing;
  /** Parents communs sur la base retenue, triés par identifiant. */
  sharedParents: SharedParent[];
  /**
   * Côté du parent commun, le même vu des deux enfants (`half` et `full_or_half`) : « même père »,
   * « même mère », ou « même parent » s'il ne convient à l'un des deux.
   */
  side?: ParentSide;
  /**
   * Autre parent de chacun (`half` et `full_or_half`) : de naissance pour une fratrie de
   * naissance, du même type que le lien au parent commun sinon (adoptif…).
   */
  fromOtherParent?: OtherParentState;
  toOtherParent?: OtherParentState;
  /**
   * Autres parents communs, par un type qui n'est pas celui de la base (« a élevé » l'un et mis
   * l'autre au monde…) : pour T-022, triés par identifiant.
   */
  alsoShared: SharedParent[];
  /** Certitude la plus faible des filiations vers les parents communs (PAR-08). */
  certainty: Certainty;
  /** Types de ces filiations, sans doublon, dans l'ordre du modèle (PAR-06). */
  filiationTypes: FiliationType[];
}

/** Un passage de A vers l'enfant du conjoint de son parent. */
export interface StepSiblingVia {
  /** Parent de A, et son côté pour A. */
  fromParentId: Id;
  fromLink: FiliationLink;
  fromSide: ParentSide;
  /** Conjoint de ce parent, parent de B, et son côté pour B. */
  toParentId: Id;
  toLink: FiliationLink;
  toSide: ParentSide;
  /** Unions entre les deux parents, triées par identifiant (T-021 choisit laquelle nommer). */
  unionIds: Id[];
}

/**
 * Enfant du conjoint d'un parent (famille recomposée, polygamie) : aucun parent commun, jamais
 * « demi-frère » (CL-FAM-01). Un lien par alliance, exposé pour T-021 (« fils de l'épouse de
 * votre père »).
 */
export interface StepSiblingLink {
  kind: 'step_sibling';
  fromId: Id;
  toId: Id;
  fromGender: Gender;
  toGender: Gender;
  /** Passages, triés par parent de A puis par parent de B. */
  via: StepSiblingVia[];
  certainty: Certainty;
  filiationTypes: FiliationType[];
}

export type SiblingResult = SiblingLink | StepSiblingLink;

/** Types de filiation qui donnent un rôle de parent pour le côté (père, mère) : ADR 0017. */
const PARENT_ROLE_TYPES: ReadonlySet<FiliationType> = new Set(['birth', 'adoptive']);

function linkOf(filiation: KinshipFiliation): FiliationLink {
  return {
    filiationId: filiation.id,
    parentId: filiation.parentId,
    childId: filiation.childId,
    type: filiation.type,
    certainty: filiation.certainty,
  };
}

/**
 * Filiation préférée d'un enfant vers un parent, s'il y en a plusieurs (naissance et « a
 * élevé ») : la naissance d'abord, puis l'ordre du modèle, puis l'identifiant.
 */
function preferred(filiations: readonly KinshipFiliation[]): KinshipFiliation | undefined {
  let best: KinshipFiliation | undefined;
  for (const filiation of filiations) {
    if (
      best === undefined ||
      FILIATION_TYPES.indexOf(filiation.type) < FILIATION_TYPES.indexOf(best.type) ||
      (filiation.type === best.type && compareIds(filiation.id, best.id) < 0)
    ) {
      best = filiation;
    }
  }
  return best;
}

/** Filiations d'un enfant groupées par parent (tous types). */
function parentLinks(graph: KinshipGraph, childId: Id): Map<Id, KinshipFiliation[]> {
  const byParent = new Map<Id, KinshipFiliation[]>();
  for (const filiation of graph.parentsOf(childId)) {
    const list = byParent.get(filiation.parentId) ?? [];
    list.push(filiation);
    byParent.set(filiation.parentId, list);
  }
  return byParent;
}

function parentIdsOfType(
  links: ReadonlyMap<Id, readonly KinshipFiliation[]>,
  type: FiliationType,
): Set<Id> {
  const ids = new Set<Id>();
  for (const [parentId, list] of links) {
    if (list.some((filiation) => filiation.type === type)) ids.add(parentId);
  }
  return ids;
}

function birthParentIds(links: ReadonlyMap<Id, readonly KinshipFiliation[]>): Set<Id> {
  const ids = new Set<Id>();
  for (const [parentId, list] of links) {
    if (list.some((filiation) => filiation.type === 'birth')) ids.add(parentId);
  }
  return ids;
}

/**
 * Côté d'un parent pour un enfant (CL-FAM-08) : père, mère, ou « parent » si son genre est autre
 * ou non renseigné, ou si l'enfant a un autre parent de naissance ou adoptif du même genre (deux
 * mères : « mère » ne dirait pas laquelle). `undefined` si ce n'est pas un parent de l'enfant
 * dans le graphe.
 */
export function parentSide(graph: KinshipGraph, childId: Id, parentId: Id): ParentSide | undefined {
  const links = graph.parentsOf(childId);
  if (!links.some((filiation) => filiation.parentId === parentId)) return undefined;
  const gender = graph.person(parentId)?.gender;
  if (gender !== 'male' && gender !== 'female') return 'parent';
  const twin = links.some(
    (filiation) =>
      filiation.parentId !== parentId &&
      PARENT_ROLE_TYPES.has(filiation.type) &&
      graph.person(filiation.parentId)?.gender === gender,
  );
  if (twin) return 'parent';
  return gender === 'male' ? 'father' : 'mother';
}

function sameSide(a: ParentSide | undefined, b: ParentSide | undefined): ParentSide {
  return a !== undefined && a === b ? a : 'parent';
}

/**
 * L'autre parent d'un enfant, parmi `parents` (ses parents du type de son lien au parent commun),
 * hors du parent commun. Les candidats (« mère parmi ses épouses », UNI-11) ne valent que pour la
 * naissance.
 */
function otherParentState(
  graph: KinshipGraph,
  childId: Id,
  parents: ReadonlySet<Id>,
  common: Id,
  withCandidates: boolean,
): OtherParentState {
  const others = [...parents].filter((id) => id !== common).sort(compareIds);
  if (others.length === 0) {
    return {
      status: 'unspecified',
      candidateIds: withCandidates
        ? graph.parentCandidatesOf(childId).filter((id) => id !== common)
        : [],
    };
  }
  const placeholder = others.find((id) => graph.person(id)?.nature === 'placeholder');
  if (placeholder !== undefined) return { status: 'placeholder', personId: placeholder };
  return { status: 'known', personId: others[0] ?? common };
}

/**
 * Deux autres parents différents font des demi-frères si l'on sait qu'ils sont deux personnes :
 * deux personnes connues, ou une place à compléter dite explicitement distincte de l'autre parent
 * (`distinctFrom` : « mon frère de même père », CL-VOI-08). Sinon, une place à compléter peut se
 * révéler être l'autre parent (fusion, UNI-03) : « frère ou demi-frère », sans rien supposer
 * (« un arbre juste avant un arbre complet », PRD). Un parent non précisé, avec ou sans
 * candidats, laisse aussi « frère ou demi-frère » (ADR 0017).
 */
function sharingWithOne(
  graph: KinshipGraph,
  from: OtherParentState,
  to: OtherParentState,
): SiblingSharing {
  if (from.status === 'unspecified' || to.status === 'unspecified') return 'full_or_half';
  if (from.status === 'known' && to.status === 'known') return 'half';
  return declaredDistinct(graph, from.personId, to.personId) ? 'half' : 'full_or_half';
}

/** Vrai si l'une des deux personnes est une place à compléter dite distincte de l'autre. */
function declaredDistinct(graph: KinshipGraph, a: Id, b: Id): boolean {
  return (
    (graph.person(a)?.distinctFrom?.includes(b) ?? false) ||
    (graph.person(b)?.distinctFrom?.includes(a) ?? false)
  );
}

function typesOf(links: readonly FiliationLink[]): FiliationType[] {
  const present = new Set(links.map((link) => link.type));
  return FILIATION_TYPES.filter((type) => present.has(type));
}

function certaintyOf(links: readonly FiliationLink[]): Certainty {
  return links.reduce<Certainty>(
    (weakest, link) => weakestCertainty(weakest, link.certainty),
    'certain',
  );
}

function sharedParent(
  personId: Id,
  from: readonly KinshipFiliation[],
  to: readonly KinshipFiliation[],
): SharedParent | undefined {
  const fromBest = preferred(from);
  const toBest = preferred(to);
  if (fromBest === undefined || toBest === undefined) return undefined;
  return { personId, fromLink: linkOf(fromBest), toLink: linkOf(toBest) };
}

function siblingByParents(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  fromLinks: ReadonlyMap<Id, readonly KinshipFiliation[]>,
  toLinks: ReadonlyMap<Id, readonly KinshipFiliation[]>,
): SiblingLink | undefined {
  const fromBirth = birthParentIds(fromLinks);
  const toBirth = birthParentIds(toLinks);
  const birthOnly = (list: readonly KinshipFiliation[] | undefined) =>
    (list ?? []).filter((filiation) => filiation.type === 'birth');

  const birthShared: SharedParent[] = [];
  for (const parentId of [...fromBirth].sort(compareIds)) {
    if (!toBirth.has(parentId)) continue;
    const shared = sharedParent(
      parentId,
      birthOnly(fromLinks.get(parentId)),
      birthOnly(toLinks.get(parentId)),
    );
    if (shared !== undefined) birthShared.push(shared);
  }
  const anyShared: SharedParent[] = [];
  for (const parentId of [...fromLinks.keys()].sort(compareIds)) {
    const to = toLinks.get(parentId);
    if (to === undefined) continue;
    const shared = sharedParent(parentId, fromLinks.get(parentId) ?? [], to);
    if (shared !== undefined) anyShared.push(shared);
  }
  if (anyShared.length === 0) return undefined;

  const basis: SiblingBasis = birthShared.length > 0 ? 'birth' : 'other';
  const sharedParents = basis === 'birth' ? birthShared : anyShared;
  const inBasis = new Set(sharedParents.map((shared) => shared.personId));
  const alsoShared = anyShared.filter((shared) => !inBasis.has(shared.personId));
  const links = sharedParents.flatMap((shared) => [shared.fromLink, shared.toLink]);
  const fromPerson = graph.person(aId);
  const toPerson = graph.person(bId);
  const base = {
    kind: 'sibling' as const,
    fromId: aId,
    toId: bId,
    fromGender: fromPerson?.gender ?? 'unspecified',
    toGender: toPerson?.gender ?? 'unspecified',
    basis,
    sharedParents,
    alsoShared,
    certainty: certaintyOf(links),
    filiationTypes: typesOf(links),
  };
  const [only] = sharedParents;
  if (sharedParents.length >= 2 || only === undefined) return { ...base, sharing: 'full' };

  const side = sameSide(
    parentSide(graph, aId, only.personId),
    parentSide(graph, bId, only.personId),
  );
  // L'autre parent de chacun, parmi ses parents du même type que son lien au parent commun : de
  // naissance pour une fratrie de naissance ; adoptifs pour deux enfants adoptés par la même
  // personne (adoptés par Anne seule : rien ne dit qu'ils n'ont pas le même autre parent).
  const fromParents =
    basis === 'birth' ? fromBirth : parentIdsOfType(fromLinks, only.fromLink.type);
  const toParents = basis === 'birth' ? toBirth : parentIdsOfType(toLinks, only.toLink.type);
  const withCandidates = basis === 'birth';
  const fromOtherParent = otherParentState(graph, aId, fromParents, only.personId, withCandidates);
  const toOtherParent = otherParentState(graph, bId, toParents, only.personId, withCandidates);
  return {
    ...base,
    sharing: sharingWithOne(graph, fromOtherParent, toOtherParent),
    side,
    fromOtherParent,
    toOtherParent,
  };
}

function stepSibling(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  fromLinks: ReadonlyMap<Id, readonly KinshipFiliation[]>,
  toLinks: ReadonlyMap<Id, readonly KinshipFiliation[]>,
): StepSiblingLink | undefined {
  // Ligne directe (l'un parent de l'autre) : pas une fratrie.
  if (fromLinks.has(bId) || toLinks.has(aId)) return undefined;
  const via: StepSiblingVia[] = [];
  for (const parentId of [...fromLinks.keys()].sort(compareIds)) {
    const byspouse = new Map<Id, Id[]>();
    for (const union of graph.unionsOf(parentId)) {
      const spouse = union.spouses.find((s) => s.personId !== parentId)?.personId;
      if (spouse === undefined || !toLinks.has(spouse)) continue;
      const list = byspouse.get(spouse) ?? [];
      list.push(union.id);
      byspouse.set(spouse, list);
    }
    for (const spouseId of [...byspouse.keys()].sort(compareIds)) {
      const fromBest = preferred(fromLinks.get(parentId) ?? []);
      const toBest = preferred(toLinks.get(spouseId) ?? []);
      if (fromBest === undefined || toBest === undefined) continue;
      via.push({
        fromParentId: parentId,
        fromLink: linkOf(fromBest),
        fromSide: parentSide(graph, aId, parentId) ?? 'parent',
        toParentId: spouseId,
        toLink: linkOf(toBest),
        toSide: parentSide(graph, bId, spouseId) ?? 'parent',
        unionIds: (byspouse.get(spouseId) ?? []).sort(compareIds),
      });
    }
  }
  if (via.length === 0) return undefined;
  const links = via.flatMap((entry) => [entry.fromLink, entry.toLink]);
  return {
    kind: 'step_sibling',
    fromId: aId,
    toId: bId,
    fromGender: graph.person(aId)?.gender ?? 'unspecified',
    toGender: graph.person(bId)?.gender ?? 'unspecified',
    via,
    certainty: certaintyOf(links),
    filiationTypes: typesOf(links),
  };
}

/**
 * Lien de fratrie de A vers B, ou `undefined` : même personne, personne absente du graphe du
 * lecteur, ou ni parent commun ni enfant du conjoint d'un parent. Un parent commun, de quelque
 * type que ce soit, fait une fratrie (`sibling`) ; sinon, l'enfant du conjoint d'un parent est
 * `step_sibling`. Le lien de B vers A est exactement `invertSiblingLink` du lien de A vers B.
 */
export function siblingLink(graph: KinshipGraph, aId: Id, bId: Id): SiblingResult | undefined {
  if (aId === bId || !graph.has(aId) || !graph.has(bId)) return undefined;
  const fromLinks = parentLinks(graph, aId);
  const toLinks = parentLinks(graph, bId);
  return (
    siblingByParents(graph, aId, bId, fromLinks, toLinks) ??
    stepSibling(graph, aId, bId, fromLinks, toLinks)
  );
}

/**
 * Toute la fratrie de A (frères, demi-frères, « frère ou demi-frère », enfants du conjoint d'un
 * parent), triée par identifiant de B. Recalculée à chaque graphe : changer un parent met à jour
 * tous les liens (UNI-13).
 */
export function siblingsOf(graph: KinshipGraph, aId: Id): SiblingResult[] {
  if (!graph.has(aId)) return [];
  const candidates = new Set<Id>();
  for (const parent of graph.parentsOf(aId)) {
    for (const child of graph.childrenOf(parent.parentId)) candidates.add(child.childId);
    for (const union of graph.unionsOf(parent.parentId)) {
      for (const spouse of union.spouses) {
        if (spouse.personId === parent.parentId) continue;
        for (const child of graph.childrenOf(spouse.personId)) candidates.add(child.childId);
      }
    }
  }
  candidates.delete(aId);
  const links: SiblingResult[] = [];
  for (const bId of [...candidates].sort(compareIds)) {
    const link = siblingLink(graph, aId, bId);
    if (link !== undefined) links.push(link);
  }
  return links;
}

function invertShared(shared: SharedParent): SharedParent {
  return { personId: shared.personId, fromLink: shared.toLink, toLink: shared.fromLink };
}

/** Le même lien, lu de B vers A. */
export function invertSiblingLink(link: SiblingResult): SiblingResult {
  if (link.kind === 'step_sibling') {
    return {
      ...link,
      fromId: link.toId,
      toId: link.fromId,
      fromGender: link.toGender,
      toGender: link.fromGender,
      via: link.via
        .map((entry) => ({
          fromParentId: entry.toParentId,
          fromLink: entry.toLink,
          fromSide: entry.toSide,
          toParentId: entry.fromParentId,
          toLink: entry.fromLink,
          toSide: entry.fromSide,
          unionIds: entry.unionIds,
        }))
        .sort(
          (x, y) =>
            compareIds(x.fromParentId, y.fromParentId) || compareIds(x.toParentId, y.toParentId),
        ),
    };
  }
  const { fromOtherParent, toOtherParent, ...rest } = link;
  return {
    ...rest,
    fromId: link.toId,
    toId: link.fromId,
    fromGender: link.toGender,
    toGender: link.fromGender,
    sharedParents: link.sharedParents.map(invertShared),
    alsoShared: link.alsoShared.map(invertShared),
    ...(toOtherParent === undefined ? {} : { fromOtherParent: toOtherParent }),
    ...(fromOtherParent === undefined ? {} : { toOtherParent: fromOtherParent }),
  };
}
