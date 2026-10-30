// Propriétés des noms dans la recherche (T-034 du plan V1, ADR 0034), sur des textes quelconques,
// des noms générés et des arbres générés (polygamie, lévirat, sororat, implexe, anciens prénoms) :
// normalisation idempotente et insensible à la casse et aux accents, clé phonétique stable,
// Jaro-Winkler symétrique, chaque nom affichable retrouvé, aucun ancien prénom dans les termes.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildSearchTerms,
  jaroWinkler,
  matchQuery,
  nameTokens,
  normalizeNameText,
  phoneticKey,
  queryTerms,
  type SearchableName,
} from '../name-search';
import { formatName } from '../person';
import { treeArbitrary } from '../test-support/arbitraries';
import {
  generateGivenName,
  generateNickname,
  generateSurname,
} from '../test-support/generated-names';
import { createRandom } from '../test-support/random';

/** Nom généré (prénom, nom de famille ou surnom), de consonance camerounaise. */
const generatedNameArbitrary = fc
  .record({
    seed: fc.integer({ min: 0, max: 0x7fffffff }),
    kind: fc.constantFrom('given', 'surname', 'nickname', 'full'),
  })
  .map(({ seed, kind }) => {
    const random = createRandom(seed);
    if (kind === 'given') return generateGivenName(random, 'female');
    if (kind === 'surname') return generateSurname(random);
    if (kind === 'nickname') return generateNickname(random);
    return `${generateGivenName(random, 'male')} ${generateSurname(random)}`;
  });

/** Signes combinants (accents, tons) et voyelles accentuées, ajoutés ou retirés par les variantes. */
const COMBINING = ['̀', '́', '̂', '̃', '̈', '̣', '̌'];

/** Le même nom, la casse et les accents changés lettre par lettre. */
const variantArbitrary = generatedNameArbitrary.chain((original) =>
  fc
    .array(fc.tuple(fc.boolean(), fc.option(fc.constantFrom(...COMBINING), { nil: undefined })), {
      minLength: original.length,
      maxLength: original.length,
    })
    .map((changes) => {
      const plain = original.normalize('NFD').replace(/\p{M}/gu, '');
      // Les noms générés sont en lettres latines simples : un caractère par lettre.
      const variant = plain
        .split('')
        .map((letter, index) => {
          const [upper, mark] = changes[index] ?? [false, undefined];
          const cased = upper ? letter.toUpperCase() : letter.toLowerCase();
          return /\p{L}/u.test(letter) && mark !== undefined ? cased + mark : cased;
        })
        .join('');
      return { original, variant };
    }),
);

// Textes et arbres générés en grand nombre : le délai par défaut de vitest (5 s) est trop court
// sous la charge de la CI.
describe('noms dans la recherche : propriétés', { timeout: 60_000 }, () => {
  it('la normalisation est idempotente, sur tout texte', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (text) => {
        const once = normalizeNameText(text);
        expect(normalizeNameText(once)).toBe(once);
      }),
      { numRuns: 2_000 },
    );
  });

  it('la forme normalisée n’a ni majuscule, ni accent, ni apostrophe, ni trait d’union, ni espace en trop', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 40 }), (text) => {
        const normalized = normalizeNameText(text);
        expect(normalized).not.toMatch(/\p{M}|['’ʼ-]|\s{2}|^\s|\s$/u);
        expect(normalized).toBe(normalized.toLowerCase());
        expect(nameTokens(normalized)).toEqual(nameTokens(text));
      }),
      { numRuns: 2_000 },
    );
  });

  it('la normalisation et la clé ignorent la casse et les accents d’un nom', () => {
    fc.assert(
      fc.property(variantArbitrary, ({ original, variant }) => {
        expect(normalizeNameText(variant)).toBe(normalizeNameText(original));
        expect(nameTokens(variant).map(phoneticKey)).toEqual(nameTokens(original).map(phoneticKey));
      }),
      { numRuns: 2_000 },
    );
  });

  it('la clé est stable, en minuscules latines, et jamais vide', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,16}$/), (token) => {
        const key = phoneticKey(token);
        expect(phoneticKey(token)).toBe(key);
        expect(key).toMatch(/^[a-z]+$/);
      }),
      { numRuns: 5_000 },
    );
  });

  it('Jaro-Winkler est symétrique, entre 0 et 1, et vaut 1 seulement pour deux textes égaux', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-e]{0,8}$/), fc.stringMatching(/^[a-e]{0,8}$/), (a, b) => {
        const similarity = jaroWinkler(a, b);
        expect(jaroWinkler(b, a)).toBe(similarity);
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
        expect(similarity === 1).toBe(a === b);
      }),
      { numRuns: 5_000 },
    );
  });

  it('chaque nom affichable d’un arbre généré retrouve sa personne au niveau exact', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 60 }), (tree) => {
        const index = new Map(buildSearchTerms(tree).map((terms) => [terms.personId, terms]));
        for (const name of tree.names) {
          if (name.type === 'former') continue;
          const terms = index.get(name.personId);
          const match = terms && matchQuery(queryTerms(formatName(name, 'given_first')), terms);
          expect(match?.level, formatName(name, 'given_first')).toBe('exact');
        }
      }),
      { numRuns: 150 },
    );
  });

  it('aucun ancien prénom n’entre dans les termes indexables, dans aucun arbre généré', () => {
    fc.assert(
      fc.property(
        treeArbitrary({ maxSize: 60 }),
        fc.stringMatching(/^[A-Z][a-z]{5,9}$/),
        (tree, marker) => {
          // Un ancien prénom de plus pour chaque personne, avec un mot que nul autre nom ne porte.
          const former = `Zq${marker}`;
          const names: SearchableName[] = [
            ...tree.names,
            ...tree.people.map((person) => ({
              personId: person.id,
              type: 'former' as const,
              givenNames: former,
            })),
          ];
          const allowed = new Map<string, Set<string>>();
          for (const name of tree.names) {
            if (name.type === 'former') continue;
            const set = allowed.get(name.personId) ?? new Set<string>();
            for (const part of [name.givenNames, name.surname, name.displayForm]) {
              const tokens = part === undefined ? [] : nameTokens(part);
              for (const token of tokens) set.add(token);
              set.add(tokens.join(''));
            }
            allowed.set(name.personId, set);
          }
          const formerToken = normalizeNameText(former);
          for (const terms of buildSearchTerms({ people: tree.people, names })) {
            const tokens = terms.terms.map((term) => term.token);
            expect(tokens).not.toContain(formerToken);
            expect(terms.text.split(' ')).not.toContain(formerToken);
            expect(terms.keys.split(' ')).not.toContain(phoneticKey(formerToken));
            // Chaque mot indexé vient d'un nom autorisé de la personne : aucun ancien prénom
            // généré par l'arbre ne s'y glisse non plus.
            const own = allowed.get(terms.personId) ?? new Set<string>();
            for (const token of tokens) expect(own.has(token), token).toBe(true);
            expect(matchQuery(queryTerms(former), terms)).toBeUndefined();
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});
