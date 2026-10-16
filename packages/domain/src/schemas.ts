// Liste des schémas du modèle, pour l'API (OpenAPI) et pour les contrôles qui les inspectent
// tous (CON-13). Tout nouveau schéma d'objet stocké s'ajoute ici.
import type { z } from 'zod';

import { factSchema, multipleBirthSchema, titleRoleSchema } from './fact';
import { filiationSchema, parentCandidateSchema } from './filiation';
import { fuzzyDateSchema } from './fuzzy-date';
import { nameSchema, personRecordSchema, personSchema } from './person';
import { placeSchema, toPlaceSchema, usageNameSchema } from './place';
import { treeSchema } from './tree';
import { unionSchema } from './union';
import { visibilityRuleSchema } from './visibility';

export const modelSchemas = {
  Tree: treeSchema,
  Person: personSchema,
  Name: nameSchema,
  PersonRecord: personRecordSchema,
  Union: unionSchema,
  Filiation: filiationSchema,
  ParentCandidate: parentCandidateSchema,
  Fact: factSchema,
  TitleRole: titleRoleSchema,
  MultipleBirth: multipleBirthSchema,
  Place: placeSchema,
  ToPlace: toPlaceSchema,
  UsageName: usageNameSchema,
  VisibilityRule: visibilityRuleSchema,
  FuzzyDate: fuzzyDateSchema,
} as const satisfies Record<string, z.ZodType>;
