// Entrée et sortie des étapes 1 et 2 de la disposition (TRD, « Disposition de l'arbre ») :
// générations, puis unités familiales. Structure sans coordonnées : l'ordre fin, le placement et
// le repli (étapes 3 à 5) sont T-012, le dessin T-017.
import type {
  Filiation,
  Id,
  MultipleBirth,
  ParentCandidate,
  Person,
  SimultaneityTree,
  Union,
} from '@lignee/domain';

/** Ce que la disposition lit d'une personne. */
export type LayoutPerson = Pick<Person, 'id' | 'gender'>;

/** Ce que la disposition lit d'une union : conjoints et rangs, dates, motif de fin. */
export type LayoutUnion = Pick<Union, 'id' | 'spouses' | 'start' | 'end' | 'endReason'>;

/** Ce que la disposition lit d'un fait : les décès, qui terminent une union (ADR 0012). */
export type LayoutFact = SimultaneityTree['facts'][number];

/** Réponse gardée pour une paire d'unions : simultanées ou successives (UNI-08, ADR 0012). */
export type LayoutSimultaneityAnswer = SimultaneityTree['simultaneityAnswers'][number];

/** Ce que la disposition lit d'une filiation. */
export type LayoutFiliation = Pick<
  Filiation,
  'id' | 'parentId' | 'childId' | 'type' | 'originUnionId'
>;

/** Ce que la disposition lit d'une naissance multiple : l'ordre des enfants (T-012). */
export type LayoutMultipleBirth = Pick<MultipleBirth, 'members'>;

/** Ce que la disposition lit d'un parent candidat (UNI-11). */
export type LayoutParentCandidate = Pick<ParentCandidate, 'childId' | 'candidateId'>;

/**
 * Graphe reçu, déjà limité à ce que le lecteur peut voir (packages/domain) : la disposition ne
 * peut rien montrer de masqué. Un objet qui cite une personne absente du graphe est ignoré.
 * `TreeData` (packages/domain) convient tel quel.
 */
export interface LayoutGraph {
  readonly people: readonly LayoutPerson[];
  readonly unions: readonly LayoutUnion[];
  readonly filiations: readonly LayoutFiliation[];
  readonly parentCandidates?: readonly LayoutParentCandidate[];
  /**
   * Faits visibles : les décès disent si deux unions sont simultanées, les naissances ordonnent
   * les frères et sœurs (T-012).
   */
  readonly facts?: readonly LayoutFact[];
  /** Réponses de simultanéité, par paire d'unions. */
  readonly simultaneityAnswers?: readonly LayoutSimultaneityAnswer[];
  /** Naissances multiples visibles : l'ordre des jumeaux nés le même jour (T-012). */
  readonly multipleBirths?: readonly LayoutMultipleBirth[];
}

/**
 * Étape 1 : la rangée de chaque personne reliée à la personne centrale (0), les ascendants
 * au-dessus (négatif), les descendants en dessous (positif).
 */
export interface Generations {
  readonly centerId: Id;
  /** Rangée de chaque personne atteinte. */
  readonly rowOf: ReadonlyMap<Id, number>;
  /** Nombre de liens (filiation ou union) du plus court chemin depuis la personne centrale. */
  readonly distanceOf: ReadonlyMap<Id, number>;
  /** Personnes de chaque rangée, dans l'ordre du parcours. */
  readonly rows: ReadonlyMap<number, readonly Id[]>;
  /** Personnes du graphe sans aucun chemin vers la personne centrale : rien à dessiner. */
  readonly unreachable: readonly Id[];
}

/** Union en cours, ou terminée (date de fin ou motif de fin saisi). */
export type UnionStatus = 'ongoing' | 'ended';

/**
 * Forme d'une unité familiale (TRD, étape 2), d'après les foyers qu'elle porte :
 * - `single` : personne sans union, seulement une colonne « parent non précisé » ;
 * - `couple` : une seule union, côte à côte ;
 * - `successive` : plusieurs unions, aucune en même temps qu'une autre (ARB-04) ;
 * - `simultaneous` : au moins deux unions en même temps ; la personne sur sa rangée, ses
 *   conjoints sur une demi-rangée, chacun en tête de la colonne de ses enfants (ARB-03).
 */
export type FamilyUnitKind = 'single' | 'couple' | 'successive' | 'simultaneous';

/** Un foyer : deux parents et leurs enfants. */
export interface Foyer {
  /** L'identifiant de l'union, ou `parents:<a>:<b>` pour deux parents sans union enregistrée. */
  readonly key: string;
  readonly unionId: Id | undefined;
  /** La personne au centre de l'unité qui porte ce foyer. */
  readonly hubId: Id;
  /** Son conjoint, en tête de la colonne des enfants. */
  readonly partnerId: Id;
  /** Rang de l'union pour chacun (UNI-07) ; absent sans union. */
  readonly hubRank: number | undefined;
  readonly partnerRank: number | undefined;
  /** Absent sans union. */
  readonly status: UnionStatus | undefined;
  /** Enfants rangés dans ce foyer, dans l'ordre d'arrivée (l'ordre des frères et sœurs est T-012). */
  readonly children: readonly Id[];
  /** Le foyer mène à la personne centrale : elle en est un parent ou un descendant. */
  readonly leadsToCenter: boolean;
}

/**
 * Parent manquant d'une colonne « parent non précisé » (ARB-05) : mère, père, ou parent quand
 * rien ne permet de le dire (ADR 0013).
 */
export type MissingParent = 'mother' | 'father' | 'parent';

/** Un enfant rattaché à un seul parent connu, et les candidats proposés pour l'autre (UNI-11). */
export interface UnspecifiedChild {
  readonly childId: Id;
  readonly missing: MissingParent;
  readonly candidateIds: readonly Id[];
}

/** Colonne « mère non précisée », « père non précisé » ou « parent non précisé », sous le parent connu. */
export interface UnspecifiedColumn {
  readonly parentId: Id;
  /** Commun à tous les enfants de la colonne, sinon `parent`. */
  readonly missing: MissingParent;
  readonly children: readonly UnspecifiedChild[];
  /** Candidats de tous les enfants, sans doublon : conjoints dans l'ordre des foyers, puis les autres. */
  readonly candidateIds: readonly Id[];
  readonly leadsToCenter: boolean;
}

/** Une unité familiale : une personne et ses foyers, dans l'ordre (ARB-03, ARB-04, UNI-07). */
export interface FamilyUnit {
  readonly hubId: Id;
  readonly row: number;
  readonly kind: FamilyUnitKind;
  /** Foyers portés par cette unité, dans l'ordre des rangs et des dates. */
  readonly foyers: readonly Foyer[];
  /** Unions de cette personne portées par l'unité de l'autre conjoint (chaque foyer une seule fois). */
  readonly foyersElsewhere: readonly string[];
  readonly unspecified: UnspecifiedColumn | undefined;
  /**
   * Vrai si, parmi toutes les unions de cette personne (portées ici ou ailleurs), une paire n'est
   * dite simultanée ou successive ni par les dates ni par une réponse : la question d'UNI-08 reste
   * à poser. La forme (`kind`) ne dépend, elle, que des foyers portés ici (ADR 0013).
   */
  readonly simultaneityPending: boolean;
}

/** Où un enfant est rangé : dans un foyer, ou dans la colonne « non précisé » d'un parent. */
export type ChildPlacement =
  | { readonly kind: 'foyer'; readonly foyerKey: string; readonly filiationIds: readonly Id[] }
  | {
      readonly kind: 'unspecified';
      readonly parentId: Id;
      readonly filiationIds: readonly Id[];
    };

/**
 * Lien à dessiner en plus de la structure :
 * - `long` : filiation qui range l'enfant (ou union d'un foyer) dont les deux personnes ne sont
 *   pas sur des rangées voisines (implexe, union entre générations) : un trait long (étape 1) ;
 * - `secondary` : filiation qui ne range pas l'enfant (lien adoptif à côté du lien de naissance,
 *   « a élevé », parent d'un autre foyer…), avec son écart de rangées.
 */
export interface CrossLink {
  readonly kind: 'filiation' | 'union';
  readonly role: 'long' | 'secondary';
  readonly id: Id;
  /** Parent, ou conjoint au centre de l'unité. */
  readonly fromId: Id;
  /** Enfant, ou conjoint. */
  readonly toId: Id;
  /** Rangée de `toId` moins rangée de `fromId`. */
  readonly rowSpan: number;
}

/** Résultat des étapes 1 et 2, réutilisé par l'ordre et le placement (T-012) et le dessin (T-017). */
export interface TreeStructure extends Generations {
  /** Unités, par rangée puis dans l'ordre du parcours. */
  readonly units: readonly FamilyUnit[];
  readonly unitOf: ReadonlyMap<Id, FamilyUnit>;
  readonly foyerOf: ReadonlyMap<string, Foyer>;
  /** Place de chaque enfant atteint qui a au moins un parent dans le graphe. */
  readonly placementOf: ReadonlyMap<Id, ChildPlacement>;
  readonly crossLinks: readonly CrossLink[];
  /** Personnes dessinées dont la question d'UNI-08 reste ouverte, par rangée (ADR 0013). */
  readonly simultaneityPending: readonly Id[];
}
