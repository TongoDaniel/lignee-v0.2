// Point d'entrée de @lignee/kinship : graphe de parenté et calcul structurel des liens (TRD,
// « Moteur de parenté », question 1). Paquet pur : ni réseau, ni base, ni Node, ni React.
export {
  ALL_FILIATION_TYPES_MASK,
  CERTAINTY_ORDER,
  FILIATION_TYPES,
  KinshipGraph,
  createKinshipGraph,
  weakestCertainty,
  type AncestorEntry,
  type KinshipGraphInput,
} from './graph';
export {
  closestCommonAncestors,
  findRelationships,
  type ClosestCommonAncestor,
  type KinshipOptions,
} from './kinship';
export {
  invertRelationship,
  relationshipKey,
  type BloodSegment,
  type CommonAncestor,
  type FiliationLink,
  type KinshipResult,
  type Relationship,
  type Segment,
  type Sharing,
  type UnionLink,
} from './relationship';
