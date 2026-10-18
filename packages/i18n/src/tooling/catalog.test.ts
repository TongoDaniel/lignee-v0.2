import { describe, expect, it } from 'vitest';

import { flattenMessages, literalTexts, signatureOf } from './catalog';
import { renderMessageParams } from './types';

describe('flattenMessages', () => {
  it('turns nested objects into dotted keys', () => {
    const flat = flattenMessages({ actions: { confirm: 'Valider' }, app: { name: 'Lignée' } }, 'x');
    expect([...flat]).toEqual([
      ['actions.confirm', 'Valider'],
      ['app.name', 'Lignée'],
    ]);
  });

  it('rejects French or badly shaped keys and non-text leaves', () => {
    expect(() => flattenMessages({ Valider: 'Valider' }, 'x')).toThrow(/clé « Valider »/);
    expect(() => flattenMessages({ yes_add: 'Oui, ajouter' }, 'x')).toThrow(/clé/);
    expect(() => flattenMessages({ count: 3 }, 'x')).toThrow(/texte ou un objet/);
    expect(() => flattenMessages({ list: ['a'] }, 'x')).toThrow(/texte ou un objet/);
  });
});

describe('signatureOf', () => {
  it('finds parameters and their kind, including inside plural branches', () => {
    expect(signatureOf('Bonjour', 'k')).toEqual({});
    expect(signatureOf('{name} a rejoint l’arbre.', 'k')).toEqual({ name: 'text' });
    expect(
      signatureOf('{count, plural, one {# fiche de {owner}} other {# fiches de {owner}}}', 'k'),
    ).toEqual({ count: 'number', owner: 'text' });
    expect(signatureOf('{side, select, father {paternel} other {maternel}}', 'k')).toEqual({
      side: 'text',
    });
    expect(signatureOf('Le {when, date, long} à {when, time, short}', 'k')).toEqual({
      when: 'date',
    });
    expect(signatureOf('{n, number} et {n}', 'k')).toEqual({ n: 'number' });
  });

  it('does not mistake plural branch text for a parameter', () => {
    expect(signatureOf('{count, plural, one {enfant} other {enfants}}', 'k')).toEqual({
      count: 'number',
    });
  });

  it('rejects broken syntax, tags, reserved and conflicting parameters', () => {
    expect(() => signatureOf('{count, plural, one {#}}', 'k')).toThrow(/ICU invalide/);
    expect(() => signatureOf('Bonjour {name', 'k')).toThrow(/ICU invalide/);
    expect(() => signatureOf('<b>Bonjour</b>', 'k')).toThrow(/balise/);
    expect(() => signatureOf('{context}', 'k')).toThrow(/réservé/);
    expect(() => signatureOf('{first-name}', 'k')).toThrow(/invalide/);
    expect(() => signatureOf('{d, date} {d, number}', 'k')).toThrow(/à la fois/);
  });
});

describe('literalTexts', () => {
  it('returns only the human text, not the ICU syntax', () => {
    expect(
      literalTexts('{count, plural, one {# personne} other {# personnes}} : {name}', 'k'),
    ).toEqual([' personne', ' personnes', ' : ']);
  });
});

describe('renderMessageParams', () => {
  it('writes one sorted entry per key, null without parameters', () => {
    const catalog = new Map([
      ['common:tree.personJoined', '{name} a rejoint l’arbre.'],
      ['common:actions.confirm', 'Valider'],
      ['common:people.count', '{count, plural, one {# personne} other {# personnes}} le {d, date}'],
    ]);
    expect(renderMessageParams(catalog)).toContain(
      [
        "  'common:actions.confirm': null;",
        "  'common:people.count': { readonly count: number; readonly d: Date | number };",
        "  'common:tree.personJoined': { readonly name: string | number };",
      ].join('\n'),
    );
  });
});
