// Point d'entrée de @lignee/layout : disposition de l'arbre (TRD, « Disposition de l'arbre »).
// T-008 : générations et unités familiales (étapes 1 et 2). Fonctions pures, sans React, Skia
// ni Node : elles tournent sur le téléphone comme sur le serveur.
export { computeGenerations } from './generations';
export { buildTreeStructure, parentsFoyerKey } from './structure';
export * from './types';
export { orderUnions, rankOf, unionsRelation, unionStatus } from './union-order';
