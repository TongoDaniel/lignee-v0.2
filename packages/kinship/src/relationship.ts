// Structure d'un lien de parenté, sans aucun mot (TRD, « Moteur de parenté », question 1). Les
// mots (FR, EN : T-026, T-027) se calculent à partir de cette structure : générations de chaque
// côté, ancêtres communs, « demi », types de filiation traversés, certitude, unions traversées.
// La fratrie détaillée (T-020), l'alliance nommée (T-021) et le tri des chemins multiples (T-022)
// lisent cette structure, et le graphe pour le genre, la nature (à compléter) et les dates.
// Chaque chemin par alliance porte son lien nommé structurellement (`AllianceLink`, T-021).
import type {
  Certainty,
  FiliationType,
  Id,
  SimultaneityResolution,
  UnionEndReason,
  UnionType,
} from '@lignee/domain';

/** Une filiation traversée par un chemin. */
export interface FiliationLink {
  filiationId: Id;
  parentId: Id;
  childId: Id;
  type: FiliationType;
  certainty: Certainty;
}

/**
 * Un ancêtre commun au sommet d'un segment de sang, et les filiations par lesquelles chaque côté
 * l'atteint. `fromSide` est absente quand le début du segment est l'ancêtre lui-même (ligne
 * directe, il descend vers la fin) ; `toSide` est absente quand la fin du segment est l'ancêtre.
 */
export interface CommonAncestor {
  personId: Id;
  fromSide?: FiliationLink;
  toSide?: FiliationLink;
}

/**
 * Partage au sommet d'un segment de sang :
 * - `same_person` : le segment ne bouge pas (début = fin), dans un lien par alliance ;
 * - `direct_line` : l'un est ancêtre de l'autre (parent, grand-parent, enfant…) ;
 * - `full` : au moins deux ancêtres communs au sommet, atteints de chaque côté par des filiations
 *   de mêmes types (deux parents communs : frères ; deux grands-parents communs : cousins
 *   germains) ;
 * - `half` : un seul ancêtre commun au sommet (demi-frères, même père ou même mère).
 *
 * Deux personnes à compléter différentes ne sont jamais confondues : chacune est un ancêtre à
 * part. `half` avec une place à compléter ou un parent non précisé de l'un des côtés, c'est
 * « frère ou demi-frère » : T-020 le lit dans le graphe (nature, parents candidats).
 */
export type Sharing = 'same_person' | 'direct_line' | 'full' | 'half';

/**
 * Un segment de sang : de `fromId`, on monte `generationsUp` générations jusqu'aux ancêtres
 * communs, puis on descend `generationsDown` générations jusqu'à `toId`. 1 et 1 : fratrie ; 2 et
 * 1 : oncle et neveu ; 2 et 2 : cousins germains ; 3 et 3 : cousins issus de germains ; 3 et 2 :
 * « à la mode de Bretagne » (TRD).
 *
 * `ascent` : filiations de `fromId` vers le haut, dans l'ordre du chemin, sans celles qui
 * atteignent le sommet (elles sont dans `commonAncestors`) ; `descent` : filiations de sous le
 * sommet jusqu'à `toId`, dans l'ordre du chemin. Les personnes du chemin, de `fromId` à `toId`,
 * sont : `fromId`, les parents de `ascent`, les ancêtres communs, les enfants de `descent`.
 */
export interface BloodSegment {
  kind: 'blood';
  fromId: Id;
  toId: Id;
  generationsUp: number;
  generationsDown: number;
  ascent: FiliationLink[];
  /** Triés par identifiant ; au moins un. */
  commonAncestors: CommonAncestor[];
  descent: FiliationLink[];
  sharing: Sharing;
}

/** Une union entre les deux conjoints d'un passage, avec le rang de chacun (UNI-07). */
export interface UnionRank {
  unionId: Id;
  /**
   * Rangs renumérotés parmi les unions de chaque conjoint présentes dans le graphe du lecteur
   * (1, 2, 3…) : un foyer masqué ne laisse pas de trou (ADR 0010).
   */
  fromRank: number;
  toRank: number;
}

/**
 * Passage d'une personne `fromId` à son conjoint `toId`. Deux personnes unies deux fois
 * (divorce puis remariage) n'ont qu'un passage, qui porte les deux unions (`unions`, triées par
 * identifiant) : le chemin n'est pas dédoublé. T-021 et T-022 choisissent l'union à nommer
 * (simultanéité, dates) dans le graphe.
 */
export interface UnionLink {
  kind: 'union';
  fromId: Id;
  toId: Id;
  unions: UnionRank[];
}

export type Segment = BloodSegment | UnionLink;

/**
 * Nature d'un lien par alliance, lue dans la forme du chemin (générations de chaque segment de
 * sang) et, pour la co-épouse, dans la simultanéité des unions (ADR 0019). B est, pour A :
 * - `spouse` : son conjoint ;
 * - `parent_of_spouse` : un parent de son conjoint (inverse : `spouse_of_child`) ;
 * - `spouse_of_parent` : le conjoint d'un de ses parents qui n'est pas son autre parent
 *   (« épouse de votre père », jamais « belle-mère », PAR-04 ; inverse : `child_of_spouse`) ;
 * - `child_of_spouse` : un enfant de son conjoint qui n'est pas le sien ;
 * - `spouse_of_child` : le conjoint d'un de ses enfants (gendre, bru, PAR-02) ;
 * - `sibling_of_spouse` : un frère ou une sœur de son conjoint (inverse : `spouse_of_sibling`) ;
 * - `spouse_of_sibling` : le conjoint d'un frère ou d'une sœur ;
 * - `step_sibling` : un enfant du conjoint d'un de ses parents, sans parent commun sur ce chemin
 *   (« fils de l'épouse de votre père », jamais « demi-frère », CL-FAM-01) ;
 * - `co_spouse` : un autre conjoint de son conjoint, une paire de leurs unions avec lui étant
 *   établie simultanée (dates ou réponse gardée, ADR 0012) : « co-épouse » ;
 * - `spouse_of_spouse` : un autre conjoint de son conjoint, sans simultanéité établie (unions
 *   successives, ou rien ne le dit) : « autre épouse de votre mari », sans rien supposer ;
 * - `spouse_of_sibling_of_spouse` : le conjoint d'un frère ou d'une sœur de son conjoint ;
 * - `other` : toute autre forme dans les limites de l'ADR 0010 (conjoint d'un oncle, grand-parent
 *   du conjoint…), nommée d'après ses segments (T-026, T-027).
 */
export type AllianceKind =
  | 'spouse'
  | 'parent_of_spouse'
  | 'spouse_of_parent'
  | 'child_of_spouse'
  | 'spouse_of_child'
  | 'sibling_of_spouse'
  | 'spouse_of_sibling'
  | 'step_sibling'
  | 'co_spouse'
  | 'spouse_of_spouse'
  | 'spouse_of_sibling_of_spouse'
  | 'other';

/** Nature du même lien lu de B vers A. */
export const INVERSE_ALLIANCE_KIND: Readonly<Record<AllianceKind, AllianceKind>> = {
  spouse: 'spouse',
  parent_of_spouse: 'spouse_of_child',
  spouse_of_child: 'parent_of_spouse',
  spouse_of_parent: 'child_of_spouse',
  child_of_spouse: 'spouse_of_parent',
  sibling_of_spouse: 'spouse_of_sibling',
  spouse_of_sibling: 'sibling_of_spouse',
  step_sibling: 'step_sibling',
  co_spouse: 'co_spouse',
  spouse_of_spouse: 'spouse_of_spouse',
  spouse_of_sibling_of_spouse: 'spouse_of_sibling_of_spouse',
  other: 'other',
};

/**
 * Fin d'une union, dans le graphe du lecteur : `ended`, avec le motif saisi (décès, divorce,
 * séparation, non renseigné), `unspecified` pour une date de fin sans motif, `death` pour le
 * décès connu d'un conjoint ; sinon `no_end_known`. Une union sans fin n'est pas présumée en
 * cours (ADR 0012, point 5) : « épouse » se dit, rien de plus ne s'affirme.
 */
export type UnionEnding = { status: 'no_end_known' } | { status: 'ended'; reason: UnionEndReason };

/** Une union traversée, son type et sa fin. */
export interface AllianceUnion {
  unionId: Id;
  type: UnionType;
  ending: UnionEnding;
}

/**
 * Résumé de la simultanéité de plusieurs paires d'unions : `simultaneous` si une paire au moins
 * est établie simultanée (dates ou réponse) ; `successive` si toutes sont établies successives ;
 * sinon `unknown`, jamais supposé.
 */
export type TimingSummary = 'simultaneous' | 'successive' | 'unknown';

/** Une union du parent avec un autre parent de l'enfant, face à l'union traversée. */
export interface OtherParentUnion {
  otherParentId: Id;
  /** Union du parent avec cet autre parent. */
  unionId: Id;
  /** Union traversée par le chemin (le parent et son conjoint). */
  crossedUnionId: Id;
  /** `resolveSimultaneity` de @lignee/domain, sur l'arbre filtré du lecteur. */
  timing: SimultaneityResolution;
}

/**
 * Quand le chemin passe l'union d'un parent en venant de son enfant (ou en allant vers lui) :
 * cette union est-elle simultanée avec celle du parent et de l'autre parent de l'enfant
 * (co-épouse de la mère), ou successive (seconde épouse après un divorce, un veuvage) ? `none` :
 * le parent n'a aucune union visible avec un autre parent de l'enfant. Unions triées par autre
 * parent, union, union traversée : la même liste dans les deux sens.
 */
export interface ChildSide {
  childId: Id;
  parentId: Id;
  timing: TimingSummary | 'none';
  unions: OtherParentUnion[];
}

/**
 * Passage d'une union dans un lien par alliance : les mêmes conjoints que le `UnionLink`, l'état
 * de chacune de leurs unions (même ordre), et le côté enfant de chaque conjoint s'il y en a un
 * (`fromChild` : on arrive à `fromId` en montant depuis son enfant ; `toChild` : on descend de
 * `toId` vers son enfant).
 */
export interface AllianceCrossing {
  fromId: Id;
  toId: Id;
  unions: AllianceUnion[];
  fromChild?: ChildSide;
  toChild?: ChildSide;
}

/** Deux conjoints d'une même personne : simultanéité de leurs unions avec elle. */
export interface SharedSpouse {
  spouseId: Id;
  timing: TimingSummary;
  /** Paires (une union de chaque côté), chacune rangée par identifiant, triées. */
  pairs: { unionIds: [Id, Id]; timing: SimultaneityResolution }[];
}

/**
 * Lien par alliance, sans mots (T-021, ADR 0019) : nature du lien, passages des unions avec leur
 * état, simultanéité quand elle compte. Ne contient que des objets du graphe du lecteur : une
 * union masquée n'y figure jamais, ni comme passage, ni comme union comparée.
 */
export interface AllianceLink {
  kind: AllianceKind;
  /** Un ou deux passages, dans l'ordre du chemin. */
  crossings: AllianceCrossing[];
  /** Présent quand les deux unions du chemin ont un conjoint commun (A, union, M, union, B). */
  sharedSpouse?: SharedSpouse;
}

/** Le même lien par alliance, lu de B vers A. */
export function invertAlliance(link: AllianceLink): AllianceLink {
  return {
    kind: INVERSE_ALLIANCE_KIND[link.kind],
    crossings: [...link.crossings].reverse().map((crossing) => ({
      fromId: crossing.toId,
      toId: crossing.fromId,
      unions: crossing.unions,
      ...(crossing.toChild === undefined ? {} : { fromChild: crossing.toChild }),
      ...(crossing.fromChild === undefined ? {} : { toChild: crossing.fromChild }),
    })),
    ...(link.sharedSpouse === undefined ? {} : { sharedSpouse: link.sharedSpouse }),
  };
}

/**
 * Un chemin de A vers B.
 * - `blood` : un seul segment de sang.
 * - `alliance` : segments de sang (éventuellement `same_person`) séparés par une ou deux unions :
 *   conjoint (A, union, B) ; parent du conjoint (union, puis sang) ; conjoint d'un parent (sang,
 *   puis union) ; co-épouse (A, union, mari, union, B) ; enfant du conjoint d'un parent (sang,
 *   union, sang). Règles et limites : ADR 0010.
 */
export interface Relationship {
  kind: 'blood' | 'alliance';
  /** Commence et finit par un segment de sang ; alterne sang et union. */
  segments: Segment[];
  /** Somme des générations des segments de sang (degré civil pour un lien de sang). */
  degree: number;
  /** Nombre de passages par une union (0 pour le sang). */
  unionCount: number;
  /** Certitude la plus faible de toutes les filiations du chemin (PAR-08). */
  certainty: Certainty;
  /** Types des filiations traversées, sans doublon, dans l'ordre du modèle (PAR-06). */
  filiationTypes: FiliationType[];
  /** Unions traversées, dans l'ordre des passages (par identifiant dans un même passage). */
  unionIds: Id[];
  /** Toutes les personnes du chemin, A et B compris, triées par identifiant (surlignage, T-029). */
  personIds: Id[];
  /** Lien par alliance nommé structurellement (T-021) ; présent si et seulement si `alliance`. */
  alliance?: AllianceLink;
}

/**
 * Réponse à « quel lien entre A et B ? ».
 * - `same_person` : A et B sont la même personne.
 * - `none` : aucun chemin visible, ou A ou B absent du graphe du lecteur. Les deux cas ne sont
 *   pas distingués : « Lien non disponible », sans autre indice (PAR-09, CL-SEC-02).
 * - `incomplete` : aucun chemin trouvé avant qu'une limite de calcul soit atteinte ; un chemin
 *   peut exister. Jamais confondu avec `none`.
 * - `related` : les chemins trouvés, du plus proche au plus lointain, le sang avant l'alliance.
 *   `truncated` : une limite de calcul a été atteinte, des chemins plus lointains peuvent
 *   manquer.
 *
 * Les limites ne dépendent que du graphe : `incomplete` et `truncated` ne disent rien d'un objet
 * masqué.
 */
export type KinshipResult =
  | { status: 'same_person' }
  | { status: 'none' }
  | { status: 'incomplete'; truncated: true }
  | { status: 'related'; relationships: Relationship[]; truncated: boolean };

function invertSegment(segment: Segment): Segment {
  if (segment.kind === 'union') {
    return {
      kind: 'union',
      fromId: segment.toId,
      toId: segment.fromId,
      unions: segment.unions.map((union) => ({
        unionId: union.unionId,
        fromRank: union.toRank,
        toRank: union.fromRank,
      })),
    };
  }
  return {
    kind: 'blood',
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
    sharing: segment.sharing,
  };
}

/**
 * Le même chemin, lu de B vers A. Propriété du TRD : le lien de B vers A est l'inverse de celui
 * de A vers B (`findRelationships(g, b, a)` donne exactement les inverses, dans le même ordre).
 */
export function invertRelationship(relationship: Relationship): Relationship {
  const segments = [...relationship.segments].reverse().map(invertSegment);
  return {
    ...relationship,
    ...(relationship.alliance === undefined
      ? {}
      : { alliance: invertAlliance(relationship.alliance) }),
    segments,
    unionIds: segments.flatMap((segment) =>
      segment.kind === 'union' ? segment.unions.map((union) => union.unionId) : [],
    ),
  };
}

/** Clé d'un chemin, identique pour le chemin et son inverse (tri stable dans les deux sens). */
export function relationshipKey(relationship: Relationship): string {
  const forward = JSON.stringify(relationship.segments);
  const backward = JSON.stringify(invertRelationship(relationship).segments);
  return forward < backward ? forward : backward;
}
