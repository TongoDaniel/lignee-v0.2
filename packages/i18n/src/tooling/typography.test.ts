import { describe, expect, it } from 'vitest';

import { commonTypographyIssues, frenchSpacingIssues, tutoiementIssues } from './typography';

const NNBSP = String.fromCodePoint(0x202f);
const NBSP = String.fromCodePoint(0x00a0);

describe('frenchSpacingIssues', () => {
  it('accepts a narrow or regular non-breaking space before ; : ! ? » and after «', () => {
    expect(frenchSpacingIssues(`Activer le calque${NNBSP}?`)).toEqual([]);
    expect(frenchSpacingIssues(`Profession${NBSP}: pêcheur`)).toEqual([]);
    expect(frenchSpacingIssues(`«${NNBSP}Oui${NNBSP}»`)).toEqual([]);
  });

  it('rejects a breaking space or no space at all, with a clear message', () => {
    expect(frenchSpacingIssues('Activer le calque ?')).toEqual([
      'espace insécable (U+202F ou U+00A0) attendue avant « ? »',
    ]);
    expect(frenchSpacingIssues('Profession: pêcheur')).toHaveLength(1);
    expect(frenchSpacingIssues('?')).toHaveLength(1);
    expect(frenchSpacingIssues('« Oui »')).toEqual([
      'espace insécable (U+202F ou U+00A0) attendue avant « » »',
      'espace insécable (U+202F ou U+00A0) attendue après « « »',
    ]);
  });

  it('leaves web addresses and times alone', () => {
    expect(
      frenchSpacingIssues('Voir https://lignee.example/aide?page=2 pour en savoir plus.'),
    ).toEqual([]);
    expect(frenchSpacingIssues('Écrivez à mailto:aide@lignee.example')).toEqual([]);
    expect(frenchSpacingIssues('Rendez-vous à 14:05.')).toEqual([]);
  });
});

describe('tutoiementIssues', () => {
  it('finds the familiar forms', () => {
    expect(tutoiementIssues('Ajoute tes parents')).toHaveLength(1);
    expect(tutoiementIssues('Tu peux inviter ta sœur et ton frère')).toHaveLength(3);
    expect(tutoiementIssues('Je te montre, à toi')).toHaveLength(2);
    expect(tutoiementIssues('On t’attend')).toHaveLength(1);
  });

  it('accepts polite French and words that merely contain those letters', () => {
    expect(tutoiementIssues('Ajoutez vos parents en touchant les cercles.')).toEqual([]);
    expect(tutoiementIssues('Votre tante, la tutelle, une tête, cette fête, l’été')).toEqual([]);
  });
});

describe('commonTypographyIssues', () => {
  it('rejects emoji, straight apostrophes and quotes, three dots, repeated exclamation marks', () => {
    expect(commonTypographyIssues('I don’t know')).toEqual([]);
    expect(commonTypographyIssues("I don't know")).toHaveLength(1);
    expect(commonTypographyIssues('Say "yes"')).toHaveLength(1);
    expect(commonTypographyIssues('Loading...')).toHaveLength(1);
    expect(commonTypographyIssues('Done!!')).toHaveLength(1);
    expect(commonTypographyIssues(`Lignée ${String.fromCodePoint(0x1f333)}`)).toHaveLength(1);
  });
});
