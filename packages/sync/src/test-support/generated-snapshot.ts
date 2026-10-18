// Instantanés d'arbres générés (T-006) pour les tests de la base locale.
import { generateTree, type GeneratedTree } from '@lignee/domain/tree-generator';

import { devReaderSnapshot } from '../dev-seed/projection';
import type { LocalTreeSnapshot } from '../local-db/snapshot';

/** Arbre généré, projeté prudemment pour son premier compte (le propriétaire). */
export function generatedSnapshot(
  seed: number,
  size: number,
): { generated: GeneratedTree; snapshot: LocalTreeSnapshot } {
  const generated = generateTree({ seed, size });
  const reader = generated.accounts[0];
  if (reader === undefined) throw new Error('Generated tree without an account');
  return { generated, snapshot: devReaderSnapshot(generated, reader.accountId) };
}

/** Textes saisis d'un instantané (noms, valeurs de faits, lieux, titres) d'au moins 5 lettres. */
export function enteredTexts(snapshot: LocalTreeSnapshot): string[] {
  const texts = [
    ...snapshot.names.flatMap((name) => [name.givenNames, name.surname, name.displayForm]),
    ...snapshot.facts.map((fact) => fact.value),
    ...snapshot.places.map((place) => place.name),
    ...snapshot.titleRoles.map((title) => title.label),
  ];
  return [...new Set(texts.filter((text): text is string => (text?.length ?? 0) >= 5))];
}
