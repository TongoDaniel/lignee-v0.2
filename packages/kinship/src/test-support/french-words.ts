// Mots français calculés par le dictionnaire (T-026 : src/words.ts et les messages `kinship` de
// @lignee/i18n), pour les scénarios de cas limites : la forme courte de chaque lien, le principal
// puis les autres, dans l'ordre. Réservé aux tests.
import type { Id } from '@lignee/domain';
import type { TreeData } from '@lignee/domain/test-support';
import { createTranslator } from '@lignee/i18n';

import { createAllianceContext } from '../alliance';
import { createKinshipGraph } from '../graph';
import { presentRelationships } from '../presentation';
import { describeResult } from '../words';

const { t } = createTranslator({ language: 'fr' });

/**
 * Formes courtes des liens de A vers B dans l'arbre du lecteur (« Lien non disponible » s'il
 * n'y en a pas), sans noms : les scénarios n'en écrivent pas.
 */
export function frenchShortWords(data: TreeData, a: Id, b: Id): string[] {
  const graph = createKinshipGraph(data);
  const result = presentRelationships(graph, a, b, {
    allianceContext: createAllianceContext(data),
  });
  const words = describeResult(result, { graph, t });
  return words.status === 'related' ? words.links.map((link) => link.short) : [words.text];
}
