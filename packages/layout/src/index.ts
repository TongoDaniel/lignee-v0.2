// Point d'entrée de @lignee/layout : disposition de l'arbre (TRD, « Disposition de l'arbre »).
// T-008 : générations et unités familiales (étapes 1 et 2). T-012 : ordre, placement et repli
// (étapes 3 à 5). T-019 : implexe et liens hors des foyers (étape 6), vue « descendance ».
// Fonctions pures, sans React, Skia ni Node : elles tournent sur le téléphone comme sur le serveur.
export { computeGenerations } from './generations';
export { buildTreeStructure, parentsFoyerKey } from './structure';
export * from './types';
export * from './layout-types';
export { orderUnions, rankOf, unionsRelation, unionStatus } from './union-order';
export { UNFOLDED_GENERATIONS, unspecifiedKey } from './folding';
export { HALF_ROW } from './blocks';
export { createSiblingSorter, type SiblingSorter } from './sibling-order';
export {
  createTreeLayoutCache,
  layoutPrepared,
  layoutTree,
  prepareTree,
  setFolded,
  toggleFamily,
  type LayoutRecompute,
  type PreparedTree,
  type TreeLayoutCache,
} from './tree-layout';
export { MAX_LINE_CROSSINGS, MAX_LINE_ROW_SPAN } from './links';
export {
  descendantsGraph,
  findDescendants,
  layoutDescendants,
  prepareDescendants,
  type DescendantSet,
} from './descendants';
