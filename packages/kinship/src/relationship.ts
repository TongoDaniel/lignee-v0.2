// Structure d'un lien de parenté, sans aucun mot (TRD, « Moteur de parenté », question 1). Les
// mots (FR, EN : T-026, T-027) se calculent à partir de cette structure : générations de chaque
// côté, ancêtres communs, « demi », types de filiation traversés, certitude, unions traversées.
// La fratrie détaillée (T-020), l'alliance nommée (T-021) et le tri des chemins multiples (T-022)
// lisent cette structure, et le graphe pour le genre, la nature (à compléter) et les dates.
import type { Certainty, FiliationType, Id } from '@lignee/domain';

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
