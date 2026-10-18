// Résultat des étapes 3 à 5 de la disposition (TRD, « Disposition de l'arbre ») : ordre, placement
// et repli. Coordonnées abstraites, en unités de grille : une unité en largeur par fiche (espace
// compris), une unité en hauteur par rangée. Les tailles réelles viennent des tokens de la charte
// au dessin (T-017). Règles retenues : ADR 0016.
import type { Id } from '@lignee/domain';

import type { TreeStructure } from './types';

/** Un point de la grille : `x` en fiches, `y` en rangées (une demi-rangée vaut 0,5). */
export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Une personne dessinée. Ascendants au-dessus (`y` négatif), descendants en dessous ; les
 * conjoints d'une personne aux unions simultanées sont sur la demi-rangée (`y` = rangée + 0,5).
 */
export interface PlacedPerson {
  readonly personId: Id;
  /** Rangée de l'étape 1 (0 pour la personne centrale). */
  readonly row: number;
  /** Centre de la fiche. */
  readonly x: number;
  readonly y: number;
  /** Indice du groupe de conjoints (`TreeLayout.blocks`) qui la contient. */
  readonly block: number;
  /**
   * Famille d'origine repliée : le trait vers ses parents n'est pas dessiné, et cette clé la
   * déplie (branche repliée au-delà de 3 générations, ou parents d'un conjoint venu d'ailleurs).
   */
  readonly foldedParentsKey: string | undefined;
}

/** Un foyer, ou la colonne « parent non précisé » d'un parent (clé `unspecifiedKey`). */
export type FamilyKind = 'foyer' | 'unspecified';

/** Une famille vue par la disposition : ses parents dessinés, et ses enfants ou leur compteur. */
export interface PlacedFamily {
  /** Clé du foyer (`Foyer.key`), ou `unspecified:<parentId>` pour une colonne. */
  readonly key: string;
  readonly kind: FamilyKind;
  /** Au centre de l'unité, puis le conjoint ; le seul parent connu pour une colonne. */
  readonly parentIds: readonly Id[];
  /** Repliée : ses enfants ne sont pas dessinés, seul leur nombre l'est. */
  readonly folded: boolean;
  /** État par défaut, avant les choix du lecteur (ADR 0016). */
  readonly foldedByDefault: boolean;
  /**
   * Nombre d'enfants de la famille présents dans le graphe reçu : un enfant masqué pour le
   * lecteur n'y est pas et n'est jamais compté (CL-SEC-03).
   */
  readonly childCount: number;
  /** Enfants dessinés sous la famille, dans l'ordre des frères et sœurs (vide si repliée). */
  readonly shownChildren: readonly Id[];
  /**
   * Point d'où partent les traits vers les enfants, et où se dessine le compteur d'une famille
   * repliée ; absent si ses parents ne sont pas dessinés.
   */
  readonly anchor: GridPoint | undefined;
  /** Colonne seulement : place de la mention « mère non précisée » (ou père, ou parent). */
  readonly header: GridPoint | undefined;
}

/**
 * Groupe de conjoints d'une rangée (unités de l'étape 2 reliées par leurs unions) : il n'est
 * jamais coupé. `left` et `right` bornent le centre de ses fiches.
 */
export interface PlacedBlock {
  readonly row: number;
  readonly personIds: readonly Id[];
  readonly left: number;
  readonly right: number;
  /** Famille dont ce groupe est un enfant, à la rangée du dessus : ses frères et sœurs l'entourent. */
  readonly familyKey: string | undefined;
}

/** Croisements de traits parent-enfant entre rangées voisines, avant et après l'étape 3. */
export interface CrossingCount {
  /** Ordre de découverte depuis la personne centrale, avant la méthode des barycentres. */
  readonly initial: number;
  readonly final: number;
}

/** Résultat des étapes 1 à 5. */
export interface TreeLayout {
  readonly centerId: Id;
  /** Étapes 1 et 2, réutilisées telles quelles. */
  readonly structure: TreeStructure;
  /** Personnes dessinées. */
  readonly people: ReadonlyMap<Id, PlacedPerson>;
  /** Personnes dessinées de chaque rangée, de gauche à droite (demi-rangée comprise). */
  readonly rows: ReadonlyMap<number, readonly Id[]>;
  /** Familles dont au moins un membre est dessiné. */
  readonly families: ReadonlyMap<string, PlacedFamily>;
  readonly blocks: readonly PlacedBlock[];
  readonly bounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
  readonly crossings: CrossingCount;
  /** Choix du lecteur appliqués : clé de famille, repliée ou non. */
  readonly folds: ReadonlyMap<string, boolean>;
}

/** Choix du lecteur : pour une clé de famille, `true` replie, `false` déplie. */
export type FoldChoices = ReadonlyMap<string, boolean>;

export interface LayoutOptions {
  /** Choix du lecteur ; les autres familles gardent leur état par défaut. */
  readonly folds?: FoldChoices;
}
