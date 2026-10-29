// Présentation des liens entre A et B, sans mots (PRD, PAR-05, PAR-06, PAR-08, UNI-10, UNI-21 ;
// TRD, « Moteur de parenté », questions 1 et 2). Une liste ordonnée : le lien principal, puis
// les autres (« aussi : cousin par votre père »), chacun avec sa nature (sang ou alliance), sa
// base (naissance, ou un lien non biologique : adoption, « a élevé », confiage…, jamais confondu
// avec la naissance), la certitude la plus faible du lien affiché et le côté de chacun. Les mots
// (« demi-frère, même mère », « Peut-être votre frère », « fils adoptif ») sont dans words.ts
// (T-026 ; T-027 pour l'anglais).
// Règles : ADR 0021.
//
// Aucun nouveau parcours : la présentation lit les chemins de `findRelationships` (dans leur
// ordre, ADR 0010, point 5) et la fratrie de `siblingLink` (ADR 0017). Les chemins de fratrie
// (une génération de chaque côté) sont réunis en une seule entrée, à la place du premier : la
// fratrie se dit d'un seul mot (« frère », « demi-frère, même père », « frère par adoption »).
//
// Le graphe est celui du lecteur, déjà filtré : une personne, une union ou une filiation masquée
// est comme jamais saisie, et ne laisse aucun indice (PAR-09).
import type { Certainty, FiliationType, Id } from '@lignee/domain';

import { FILIATION_TYPES, compareIds, weakestCertainty } from './graph';
import type { KinshipGraph } from './graph';
import { findRelationshipSteps, type KinshipOptions } from './kinship';
import {
  invertRelationship,
  type AllianceLink,
  type BloodSegment,
  type FiliationLink,
  type Relationship,
} from './relationship';
import {
  invertSiblingLink,
  parentSide,
  siblingLink,
  type ParentSide,
  type SharedParent,
  type SiblingLink,
  type SiblingSharing,
} from './siblings';
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
 * Côté d'un lien pour une personne : le parent par lequel il passe, son côté (père, mère,
 * « parent », CL-FAM-08) et le type de la filiation vers lui. « cousin par votre père » ne se dit
 * que pour `birth` ; par un parent qui vous a élevé, confié ou adopté, les mots disent le type
 * (« cousin par celui qui vous a élevé ») : jamais confondu avec la naissance (PAR-06).
 */
export interface LineSide {
  parentId: Id;
  side: ParentSide;
  type: FiliationType;
}

/**
 * Ce que les mots d'une fratrie peuvent dire (ADR 0021) :
 * - `birth` : fratrie de naissance (« frère », « demi-frère, même père », « frère ou
 *   demi-frère ») ;
 * - `birth_and_adoption` : un seul parent commun par la naissance, aucun autre parent de naissance
 *   de part et d'autre, et au moins un parent commun par l'adoption (co-mère adoptive) : « frère »
 *   qualifié par l'adoption, jamais « frère » tout court ;
 * - `adoption` : aucun parent commun par la naissance, des parents communs par la naissance ou
 *   l'adoption, dont au moins un adoptif : « frère par adoption » ;
 * - `other` : un parent commun par un autre type (« a élevé », confiage, tutelle, donneur,
 *   gestation pour autrui) : jamais « frère » ; les mots disent le lien (« enfant confié à votre
 *   père »).
 */
export type PresentedSiblingKind = 'birth' | 'birth_and_adoption' | 'adoption' | 'other';

/** Fratrie présentée : ce que disent les mots, et le lien de fratrie détaillé (ADR 0017). */
export interface PresentedSibling {
  kind: PresentedSiblingKind;
  /** Partage dit par les mots : celui du lien, ou `full` pour `birth_and_adoption`. */
  sharing: SiblingSharing;
  /** Parents communs par l'adoption comptés dans `full` (`birth_and_adoption`), triés. */
  adoptiveParents: SharedParent[];
  /** Fratrie détaillée : sa base et son partage ne comptent que la naissance (santé, V3). */
  link: SiblingLink;
}

/** Un lien présenté. */
export interface PresentedLink {
  /** `main` pour le premier lien, `also` pour les suivants (« aussi : … », PAR-05). */
  rank: 'main' | 'also';
  /** Sang (filiations seulement) ou alliance (au moins une union). */
  nature: 'blood' | 'alliance';
  /**
   * `birth` si toutes les filiations du lien affiché sont de naissance ; sinon `other`, et
   * `nonBirth` dit lesquelles (PAR-06). Une fratrie de naissance dont les deux enfants ont aussi
   * été élevés par une même personne reste `birth` : « a élevé » n'est pas dans le lien affiché.
   */
  basis: 'birth' | 'other';
  /** Filiations du lien affiché qui ne sont pas de naissance, triées par identifiant. */
  nonBirth: FiliationLink[];
  /** Leurs types, sans doublon, dans l'ordre du modèle. */
  nonBirthTypes: FiliationType[];
  /**
   * Certitude la plus faible des filiations du lien affiché (PAR-08) : `probable` se dit « Peut-
   * être son frère » (UNI-10).
   */
  certainty: Certainty;
  /** Côté du lien pour A : le parent par lequel A monte (absent si A ne monte pas). */
  fromSide?: LineSide;
  /** Côté du lien pour B : le parent par lequel B monte, lu de B vers A (absent sinon). */
  toSide?: LineSide;
  /** Fratrie (sang, une génération de chaque côté). */
  sibling?: PresentedSibling;
  /** Lien par alliance nommé (T-021), celui du chemin. */
  alliance?: AllianceLink;
  /**
   * Chemins présentés : un seul, ou tous les chemins de fratrie réunis (dans l'ordre de
   * `findRelationships`), pour le surlignage (T-029) et les mots.
   */
  relationships: Relationship[];
}

/**
 * Réponse présentée. Mêmes états que `KinshipResult` : `none` (« Lien non disponible », sans
 * autre indice), `incomplete` (une limite de calcul atteinte avant tout chemin), `same_person`.
 */
export type PresentationResult =
  | { status: 'same_person' }
  | { status: 'none' }
  | { status: 'incomplete'; truncated: true }
  | { status: 'related'; links: PresentedLink[]; truncated: boolean };

/**
 * Options : celles de `findRelationships`, sauf les types de filiation suivis (la présentation
 * montre tous les liens ; le degré de santé, sur la seule naissance, appelle le moteur).
 */
export type PresentationOptions = Omit<KinshipOptions, 'filiationTypes'>;

function isSiblingPath(relationship: Relationship): boolean {
  const [segment] = relationship.segments;
  return (
    relationship.kind === 'blood' &&
    segment?.kind === 'blood' &&
    segment.generationsUp === 1 &&
    segment.generationsDown === 1
  );
}

/**
 * Côté par lequel le début d'un segment de sang monte (« cousin par votre père », PAR-05) : le
 * parent de `fromId` par lequel passe le chemin, son côté et le type de la filiation. `undefined`
 * si le segment ne monte pas (descendant) ou s'il monte par deux parents à la fois (frères,
 * `full`).
 */
export function ascentSide(graph: KinshipGraph, segment: BloodSegment): LineSide | undefined {
  if (segment.generationsUp === 0) return undefined;
  const first =
    segment.ascent[0] ??
    (segment.commonAncestors.length === 1 ? segment.commonAncestors[0]?.fromSide : undefined);
  if (first === undefined) return undefined;
  const side = parentSide(graph, segment.fromId, first.parentId);
  return side === undefined ? undefined : { parentId: first.parentId, side, type: first.type };
}

function invertBlood(segment: BloodSegment): BloodSegment {
  return {
    ...segment,
    fromId: segment.toId,
    toId: segment.fromId,
    generationsUp: segment.generationsDown,
    generationsDown: segment.generationsUp,
    ascent: [...segment.descent].reverse(),
    commonAncestors: segment.commonAncestors.map((ancestor) => ({
      personId: ancestor.personId,
      ...(ancestor.toSide === undefined ? {} : { fromSide: ancestor.toSide }),
      ...(ancestor.fromSide === undefined ? {} : { toSide: ancestor.fromSide }),
    })),
    descent: [...segment.ascent].reverse(),
  };
}

/** Toutes les filiations d'un chemin. */
function pathFiliations(relationship: Relationship): FiliationLink[] {
  return relationship.segments.flatMap((segment) =>
    segment.kind === 'union'
      ? []
      : [
          ...segment.ascent,
          ...segment.commonAncestors.flatMap((ancestor) => [
            ...(ancestor.fromSide === undefined ? [] : [ancestor.fromSide]),
            ...(ancestor.toSide === undefined ? [] : [ancestor.toSide]),
          ]),
          ...segment.descent,
        ],
  );
}

/** Base, filiations non biologiques et certitude des filiations d'un lien affiché. */
function basisOf(links: readonly FiliationLink[]) {
  const byId = new Map<Id, FiliationLink>();
  for (const link of links) if (link.type !== 'birth') byId.set(link.filiationId, link);
  const nonBirth = [...byId.values()].sort((x, y) => compareIds(x.filiationId, y.filiationId));
  const types = new Set(nonBirth.map((link) => link.type));
  return {
    basis: nonBirth.length === 0 ? ('birth' as const) : ('other' as const),
    nonBirth,
    nonBirthTypes: FILIATION_TYPES.filter((type) => types.has(type)),
    certainty: links.reduce<Certainty>(
      (weakest, link) => weakestCertainty(weakest, link.certainty),
      'certain',
    ),
  };
}

function presentPath(graph: KinshipGraph, relationship: Relationship): Omit<PresentedLink, 'rank'> {
  const first = relationship.segments[0];
  const last = relationship.segments.at(-1);
  const fromSide = first?.kind === 'blood' ? ascentSide(graph, first) : undefined;
  const toSide = last?.kind === 'blood' ? ascentSide(graph, invertBlood(last)) : undefined;
  return {
    nature: relationship.kind,
    ...basisOf(pathFiliations(relationship)),
    ...(fromSide === undefined ? {} : { fromSide }),
    ...(toSide === undefined ? {} : { toSide }),
    ...(relationship.alliance === undefined ? {} : { alliance: relationship.alliance }),
    relationships: [relationship],
  };
}

const ROLE_TYPES: ReadonlySet<FiliationType> = new Set(['birth', 'adoptive']);

function byRole(shared: SharedParent): boolean {
  return ROLE_TYPES.has(shared.fromLink.type) && ROLE_TYPES.has(shared.toLink.type);
}

/** Ce que les mots d'une fratrie peuvent dire, et les parents comptés (ADR 0021). */
function siblingPresentation(link: SiblingLink): PresentedSibling {
  if (link.basis === 'other') {
    return {
      kind: link.sharedParents.every(byRole) ? 'adoption' : 'other',
      sharing: link.sharing,
      adoptiveParents: [],
      link,
    };
  }
  const adoptiveParents = link.alsoShared.filter(byRole);
  const noOtherBirthParent = [link.fromOtherParent, link.toOtherParent].every(
    (state) => state?.status === 'unspecified' && state.candidateIds.length === 0,
  );
  if (link.sharing === 'full_or_half' && noOtherBirthParent && adoptiveParents.length > 0) {
    return { kind: 'birth_and_adoption', sharing: 'full', adoptiveParents, link };
  }
  return { kind: 'birth', sharing: link.sharing, adoptiveParents: [], link };
}

function presentSibling(
  link: SiblingLink,
  relationships: Relationship[],
): Omit<PresentedLink, 'rank'> {
  const sibling = siblingPresentation(link);
  const counted = [...link.sharedParents, ...sibling.adoptiveParents];
  const filiations = counted.flatMap((shared) => [shared.fromLink, shared.toLink]);
  const [only] = link.sharedParents;
  const sides =
    sibling.sharing === 'full' || link.sharedParents.length !== 1 || only === undefined
      ? {}
      : {
          fromSide: {
            parentId: only.personId,
            side: link.side ?? 'parent',
            type: only.fromLink.type,
          },
          toSide: { parentId: only.personId, side: link.side ?? 'parent', type: only.toLink.type },
        };
  return {
    nature: 'blood',
    ...basisOf(filiations),
    ...sides,
    sibling,
    relationships,
  };
}

/**
 * Les liens de A vers B, présentés : le plus proche d'abord, puis les autres (PAR-05), dans
 * l'ordre de `findRelationships` ; les chemins de fratrie réunis en une entrée, à la place du
 * premier. Le résultat de B vers A est exactement `invertPresentedLink` de chaque lien de A vers
 * B, dans le même ordre (propriété vérifiée sur des arbres générés).
 */
export function presentRelationships(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  options: PresentationOptions = {},
): PresentationResult {
  return drain(presentRelationshipSteps(graph, aId, bId, options, NEVER_PAUSE));
}

/**
 * `presentRelationships` par tranches, pour l'écran « Qui est-ce pour moi ? » (T-029) : même
 * résultat, rendu par une promesse, sans jamais bloquer l'interface plus d'une tranche (TRD,
 * Performance). Rejetée par `KinshipCancelledError` si le signal annule : une autre fiche
 * choisie entre-temps annule la question précédente.
 */
export function presentRelationshipsInSlices(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  options: PresentationOptions & SliceOptions,
): Promise<PresentationResult> {
  return runInSlices((pacer) => presentRelationshipSteps(graph, aId, bId, options, pacer), options);
}

/**
 * `presentRelationships`, en calcul découpable : la recherche des chemins, puis la mise en forme
 * de chaque chemin, avec un point de pause entre deux.
 */
function* presentRelationshipSteps(
  graph: KinshipGraph,
  aId: Id,
  bId: Id,
  options: PresentationOptions,
  pacer: Pacer,
): Steps<PresentationResult> {
  const result = yield* findRelationshipSteps(graph, aId, bId, options, pacer);
  if (result.status !== 'related') return result;
  if (pacer.due(HEAVY)) yield;
  const sibling = siblingLink(graph, aId, bId);
  const siblingPaths = result.relationships.filter(isSiblingPath);
  const entries: Omit<PresentedLink, 'rank'>[] = [];
  let siblingPlaced = false;
  for (const relationship of result.relationships) {
    if (pacer.due(HEAVY)) yield;
    if (sibling?.kind === 'sibling' && isSiblingPath(relationship)) {
      if (!siblingPlaced) entries.push(presentSibling(sibling, siblingPaths));
      siblingPlaced = true;
      continue;
    }
    entries.push(presentPath(graph, relationship));
  }
  return {
    status: 'related',
    links: entries.map((entry, index) => ({ rank: index === 0 ? 'main' : 'also', ...entry })),
    truncated: result.truncated,
  };
}

function invertShared(shared: SharedParent): SharedParent {
  return { personId: shared.personId, fromLink: shared.toLink, toLink: shared.fromLink };
}

/** Le même lien présenté, lu de B vers A. */
export function invertPresentedLink(link: PresentedLink): PresentedLink {
  const { fromSide, toSide, sibling, alliance, relationships, ...rest } = link;
  const inverted = relationships.map(invertRelationship);
  const invertedSibling = sibling === undefined ? undefined : invertSiblingLink(sibling.link);
  return {
    ...rest,
    ...(toSide === undefined ? {} : { fromSide: toSide }),
    ...(fromSide === undefined ? {} : { toSide: fromSide }),
    ...(sibling === undefined || invertedSibling?.kind !== 'sibling'
      ? {}
      : {
          sibling: {
            ...sibling,
            adoptiveParents: sibling.adoptiveParents.map(invertShared),
            link: invertedSibling,
          },
        }),
    ...(alliance === undefined ? {} : { alliance: inverted[0]?.alliance ?? alliance }),
    relationships: inverted,
  };
}
