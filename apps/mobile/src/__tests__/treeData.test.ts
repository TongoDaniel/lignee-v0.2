// Données et textes de l'arbre (T-017) : fiches, libellés lus par les lecteurs d'écran, chemins de
// dessin, contrastes des textes peints par Skia dans les deux thèmes.
import { generateTree } from '@lignee/domain/tree-generator';
import { createTranslator } from '@lignee/i18n';
import { contrastRatio, CONTRAST_TEXT, themes } from '@lignee/ui';
import { devReaderSnapshot } from '@lignee/sync/dev-seed';

import { cardLines, nameForLevel, pathData, plusPath } from '../tree/drawing';
import { lifespan, missingParentText, personLabel, shortName } from '../tree/labels';
import type { PersonCard } from '../tree/personCards';
import { chooseCenter, modelFromSnapshot } from '../tree/treeModel';

function card(overrides: Partial<PersonCard> = {}): PersonCard {
  return {
    id: 'p1',
    placeholder: false,
    firstName: 'Claire',
    fullName: 'Claire Martin',
    birthName: 'Martin',
    deceased: false,
    birthYear: undefined,
    deathYear: undefined,
    ...overrides,
  };
}

describe('fiches construites depuis la copie locale', () => {
  const generated = generateTree({ seed: 11, size: 120 });
  const reader = generated.accounts[0];
  if (reader === undefined) throw new Error('no account');
  const snapshot = devReaderSnapshot(generated, reader.accountId);
  const model = modelFromSnapshot(snapshot);

  it('une fiche par personne, sans ancien nom ni donnée masquée', () => {
    expect(model?.cards.size).toBe(snapshot.people.length);
    const former = new Set(
      snapshot.names.filter((name) => name.type === 'former').map((name) => name.personId),
    );
    for (const personId of former) {
      const card = model?.cards.get(personId);
      const formerNames = snapshot.names.filter(
        (name) => name.personId === personId && name.type === 'former',
      );
      for (const name of formerNames) {
        const text = [name.givenNames, name.displayForm].filter(Boolean).join(' ');
        if (text !== '') expect(card?.fullName.includes(text)).toBe(false);
      }
    }
  });

  it('« Vous » est une personne connue de l’arbre', () => {
    const center = chooseCenter(snapshot);
    expect(center).toBeDefined();
    expect(model?.cards.get(center ?? '')?.placeholder).toBe(false);
  });

  it('les années ne viennent que des faits reçus', () => {
    const years = [...(model?.cards.values() ?? [])].filter((c) => c.birthYear !== undefined);
    expect(years.length).toBeGreaterThan(0);
  });
});

describe('libellés', () => {
  const fr = createTranslator({ language: 'fr' }).t;
  const en = createTranslator({ language: 'en' }).t;

  it('une personne décédée montre ses années, rien d’autre', () => {
    const dead = card({ deceased: true, birthYear: 1931, deathYear: 2019 });
    expect(lifespan(dead, fr)).toBe('1931 – 2019');
    expect(personLabel(dead, { you: false }, fr)).toBe('Claire Martin, 1931 – 2019');
    expect(lifespan(card({ birthYear: 1968 }), fr)).toBeUndefined();
  });

  it('une personne vivante n’a ni années affichées ni mention de décès', () => {
    expect(personLabel(card({ birthYear: 1968 }), { you: false }, fr)).toBe(
      'Claire Martin, année de naissance 1968',
    );
    expect(personLabel(card(), { you: false }, en)).toBe('Claire Martin');
  });

  it('« Vous » et une place à compléter ont leur libellé', () => {
    expect(personLabel(card(), { you: true }, fr)).toBe('Claire Martin, c’est vous');
    expect(shortName(card({ placeholder: true }), fr)).toBe('Personne à compléter');
    expect(personLabel(card({ placeholder: true }), { you: false }, en)).toBe('Person to complete');
  });

  it('aucun libellé ne laisse échapper une clé interne', () => {
    const texts = [
      personLabel(card({ deceased: true, deathYear: 2001 }), { you: false }, fr),
      missingParentText('mother', fr),
      missingParentText('father', en),
      missingParentText('parent', fr),
    ];
    for (const text of texts) expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}|undefined|\{/);
  });
});

describe('dessin', () => {
  it('chemin à angles droits et signe plus', () => {
    expect(
      pathData([
        { x: 0, y: 0 },
        { x: 0, y: 10.456 },
        { x: 5, y: 10.456 },
      ]),
    ).toBe('M0 0 L0 10.46 L5 10.46');
    expect(plusPath(10, 20, 4)).toBe('M6 20 L14 20 M10 16 L10 24');
  });

  it('trois niveaux de détail : rien, le prénom, le nom entier', () => {
    const c = card();
    const texts = { placeholder: 'À compléter', noName: 'Sans nom' };
    expect(nameForLevel(c, 'overview', texts)).toBe('');
    expect(nameForLevel(c, 'standard', texts)).toBe('Claire');
    expect(nameForLevel(c, 'detail', texts)).toBe('Claire Martin');
    expect(nameForLevel(card({ firstName: '', fullName: '' }), 'standard', texts)).toBe('Sans nom');
    expect(nameForLevel(card({ placeholder: true }), 'standard', texts)).toBe('À compléter');
  });

  it('le nom tient sur deux lignes au plus, jamais coupé sans « … »', () => {
    const lines = cardLines({
      name: 'Marie-Antoinette Ngo Biyong Essomba',
      secondary: '1931 – 2019',
      width: 90,
      maxLines: 2,
      measure: (text) => Array.from(text).length * 8,
      level: 'detail',
    });
    expect(lines.name).toHaveLength(2);
    expect(lines.name[1]?.endsWith('…')).toBe(true);
    expect(lines.secondary).toBe('1931 – 2019');
    expect(
      cardLines({
        name: 'Claire',
        secondary: 'x',
        width: 90,
        maxLines: 2,
        measure: () => 1,
        level: 'overview',
      }),
    ).toEqual({ name: [], secondary: undefined });
  });
});

describe('contrastes des textes peints (Jour et Nuit)', () => {
  it.each(['jour', 'nuit'] as const)('thème %s', (scheme) => {
    const colors = themes[scheme];
    expect(contrastRatio(colors.texte, colors.fond)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
    expect(contrastRatio(colors.texteSecondaire, colors.fond)).toBeGreaterThanOrEqual(
      CONTRAST_TEXT,
    );
    // Mention « Voir aussi » et « Parents » : `parente` sur le fond de l'écran.
    expect(contrastRatio(colors.parente, colors.fond)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
    // Pastille « + n » : `texte` sur `parente-douce`.
    expect(contrastRatio(colors.texte, colors.parenteDouce)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
  });
});
