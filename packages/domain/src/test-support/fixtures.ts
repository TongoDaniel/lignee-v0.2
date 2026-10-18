// Fabriques d'objets du modèle pour les tests : identifiants déterministes, noms générés.
import { fuzzyDateFromText } from '../fuzzy-date';
import { createUuidV7Generator, type Id } from '../ids';
import type { NameInput } from '../person';
import { scenarioNameTypes, type ScenarioName } from './scenario';

/** Générateur d'identifiants reproductible (horloge et aléa fixes). */
export function deterministicIds(start = 1_790_000_000_000): () => Id {
  let tick = start;
  let seed = 7;
  return createUuidV7Generator({
    now: () => (tick += 1),
    fillRandom: (bytes) => {
      for (let index = 0; index < bytes.length; index += 1) {
        seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
        bytes[index] = seed % 256;
      }
      return bytes;
    },
  });
}

/** Contexte d'un arbre de test : identifiants de l'arbre, de l'auteur, et des personnes. */
export function testTree() {
  const nextId = deterministicIds();
  const treeId = nextId();
  const authorAccountId = nextId();
  const people = new Map<string, Id>();
  const personId = (key: string): Id => {
    let id = people.get(key);
    if (id === undefined) {
      id = nextId();
      people.set(key, id);
    }
    return id;
  };
  return { nextId, treeId, authorAccountId, personId };
}
export type TestTree = ReturnType<typeof testTree>;

/** Convertit un nom de scénario en entrée du schéma `nameSchema`. */
export function nameFromScenario(tree: TestTree, name: ScenarioName): NameInput {
  return {
    id: tree.nextId(),
    treeId: tree.treeId,
    personId: tree.personId(name.personne),
    type: scenarioNameTypes[name.type],
    authorAccountId: tree.authorAccountId,
    ...(name.prenoms === undefined ? {} : { givenNames: name.prenoms }),
    ...(name.nom === undefined ? {} : { surname: name.nom }),
    ...(name.forme === undefined ? {} : { displayForm: name.forme }),
    ...(name.debut === undefined ? {} : { start: fuzzyDateFromText(name.debut) }),
    ...(name.fin === undefined ? {} : { end: fuzzyDateFromText(name.fin) }),
  };
}
