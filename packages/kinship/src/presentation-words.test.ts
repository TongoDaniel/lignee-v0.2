// Contrôle des scénarios de lien (test-support/presentation-words.ts) : une alliance par un parent
// non biologique ne passe jamais pour l'alliance par le parent de naissance (PAR-06). Arbres
// inventés.
import { describe, expect, it } from 'vitest';

import { presentRelationships } from './presentation';
import { fixture } from './test-support/fixtures';
import {
  presentedMeaningOfWords,
  presentedMeaningsOfResult,
} from './test-support/presentation-words';

function meanings(type: 'naissance' | 'adoptive') {
  const f = fixture({
    personnes: ['m/F', 'x/M', 'c/M'],
    unions: [{ conjoints: ['m', 'x'] }],
    filiations: [{ parents: ['m'], enfant: 'c', type }],
  });
  return presentedMeaningsOfResult(f.graph, presentRelationships(f.graph, f.id('c'), f.id('x')));
}

describe('mots attendus d’une alliance : le type des filiations compte (PAR-06)', () => {
  const husbandOfMother = presentedMeaningOfWords('mari de votre mère', "your mother's husband");

  it('« mari de votre mère » : par la mère de naissance', () => {
    const [first, ...others] = meanings('naissance');
    expect(others).toEqual([]);
    expect(first).toMatchObject(husbandOfMother);
  });

  it('par une mère adoptive, ce n’est pas « mari de votre mère »', () => {
    const [first, ...others] = meanings('adoptive');
    expect(others).toEqual([]);
    expect(first).toMatchObject({ category: 'alliance', nonBirthTypes: ['adoptive'] });
    expect(first).not.toMatchObject(husbandOfMother);
  });
});
