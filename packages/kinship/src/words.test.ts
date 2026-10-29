// Mots d'un lien (T-026, plan V1 ; ADR 0031) : la fonction qui assemble un lien présenté en texte,
// sur de petits arbres inventés, puis des propriétés sur des arbres générés (polygamie, lévirat,
// sororat, implexe, liens non biologiques, certitudes tirées au hasard) :
// - chaque message est rendu en entier, en français et en anglais (aucune accolade, aucun « # ») ;
// - l'épouse d'un parent n'est jamais « belle-mère », son mari jamais « beau-père » (PAR-04) ;
// - un lien non biologique n'est jamais dit avec les seuls mots de la naissance (PAR-06) ;
// - la certitude est dite : « Peut-être » pour un lien probable, « Hypothèse » pour un lien
//   hypothétique, rien pour un lien certain (PAR-08, UNI-10) ;
// - une personne visée de genre autre ou non renseigné n'est jamais dite par un nom genré.
import type { Gender, Id } from '@lignee/domain';
import type { GeneratedTree } from '@lignee/domain/test-support';
import { createTranslator } from '@lignee/i18n';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createAllianceContext } from './alliance';
import { createKinshipGraph } from './graph';
import { presentRelationships, type PresentationResult } from './presentation';
import { fixture, type Fixture } from './test-support/fixtures';
import { populatedTreeArbitrary } from './test-support/populated-trees';
import { alsoText, describeLink, describeResult, type LinkWords } from './words';

const fr = createTranslator({ language: 'fr' });
const en = createTranslator({ language: 'en' });
const RUNS = 150;
const TIMEOUT = 120_000;

/** Les mots de A vers B, en français, avec les noms des clés (« ben » → « Ben »). */
function wordsOf(f: Fixture, a: string, b: string, language = fr): LinkWords[] {
  const nameOf = (id: Id) => {
    const key = f.keyOf(id);
    return key === undefined ? undefined : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  };
  const result = presentRelationships(f.graph, f.id(a), f.id(b), {
    allianceContext: createAllianceContext(f.data),
  });
  const words = describeResult(result, { graph: f.graph, t: language.t, nameOf });
  return words.status === 'related'
    ? words.links.map(({ short, explained }) => ({ short, explained }))
    : [];
}

const short = (f: Fixture, a: string, b: string) => wordsOf(f, a, b).map((words) => words.short);

describe('T-026 — fratrie (PAR-03, ADR 0017)', () => {
  const f = fixture({
    personnes: ['ibra/M', 'mariam/F', 'aissa/F', 'ous/M', 'soul/M', 'hadja/F', 'kim/A'],
    unions: [{ conjoints: ['ibra', 'mariam'] }, { conjoints: ['ibra', 'aissa'] }],
    filiations: [
      { parents: ['ibra', 'mariam'], enfant: 'ous' },
      { parents: ['ibra', 'mariam'], enfant: 'soul' },
      { parents: ['ibra', 'aissa'], enfant: 'hadja' },
      { parents: ['ibra', 'aissa'], enfant: 'kim' },
    ],
  });

  it('frère, demi-sœur même père ; la forme expliquée nomme l’autre parent (TRD)', () => {
    expect(wordsOf(f, 'ous', 'soul')).toEqual([
      { short: 'frère', explained: 'fils de votre père et de votre mère' },
    ]);
    expect(wordsOf(f, 'ous', 'hadja')).toEqual([
      { short: 'demi-sœur, même père', explained: 'fille de votre père et d’Aissa' },
    ]);
  });

  it('genre « autre » : forme neutre, sans nom genré ni point médian (ADR 0031)', () => {
    expect(wordsOf(f, 'ous', 'kim')).toEqual([
      {
        short: 'personne de votre demi-fratrie, même père',
        explained: 'enfant de votre père et d’Aissa',
      },
    ]);
    expect(short(f, 'hadja', 'kim')).toEqual(['personne de votre fratrie']);
  });
});

describe('T-026 — alliance (PAR-04, ADR 0020)', () => {
  const f = fixture({
    personnes: ['moussa/M', 'mariam/F', 'fatou/F', 'aicha/F', 'paul/M', 'rose/F'],
    unions: [
      { conjoints: ['moussa', 'mariam'] },
      { conjoints: ['moussa', 'fatou'] },
      { conjoints: ['aicha', 'paul'] },
    ],
    filiations: [
      { parents: ['moussa', 'mariam'], enfant: 'aicha' },
      { parents: ['rose'], enfant: 'paul' },
    ],
    simultaneites: [
      {
        unions: [
          ['moussa', 'mariam'],
          ['moussa', 'fatou'],
        ],
        reponse: 'simultanees',
      },
    ],
  });

  it('l’épouse du père : « épouse de votre père », jamais « belle-mère »', () => {
    expect(wordsOf(f, 'aicha', 'fatou')).toEqual([
      {
        short: 'épouse de votre père',
        explained: 'épouse de votre père, Moussa, en même temps que votre mère',
      },
    ]);
  });

  it('la mère du conjoint : « belle-mère », expliqué « mère de votre mari »', () => {
    expect(wordsOf(f, 'aicha', 'rose')).toEqual([
      { short: 'belle-mère', explained: 'mère de votre mari, Paul' },
    ]);
  });

  it('co-épouse seulement si la simultanéité est établie', () => {
    expect(short(f, 'mariam', 'fatou')).toEqual(['co-épouse']);
    const unknown = fixture({
      personnes: ['moussa/M', 'mariam/F', 'fatou/F'],
      unions: [{ conjoints: ['moussa', 'mariam'] }, { conjoints: ['moussa', 'fatou'] }],
    });
    expect(wordsOf(unknown, 'mariam', 'fatou')).toEqual([
      {
        short: 'autre épouse de votre mari',
        explained:
          'autre épouse de votre mari, Moussa\u202f; on ne sait pas encore si c’était en même temps que vous',
      },
    ]);
  });
});

describe('T-026 — lévirat : deux liens, le plus proche d’abord (PAR-05, UNI-21)', () => {
  it('demi-frère par la mère, et aussi cousin germain par le père', () => {
    const f = fixture({
      personnes: ['gp/M', 'gm/F', 'andre/M', 'benoit/M', 'wanda/F', 'w1/F', 'w2/M'],
      unions: [
        { conjoints: ['gp', 'gm'] },
        { conjoints: ['andre', 'wanda'] },
        { conjoints: ['benoit', 'wanda'] },
      ],
      filiations: [
        { parents: ['gp', 'gm'], enfant: 'andre' },
        { parents: ['gp', 'gm'], enfant: 'benoit' },
        { parents: ['andre', 'wanda'], enfant: 'w1' },
        { parents: ['benoit', 'wanda'], enfant: 'w2' },
      ],
    });
    const [main, also] = wordsOf(f, 'w2', 'w1');
    expect(main?.short).toBe('demi-sœur, même mère');
    expect(also?.short).toBe('cousine germaine par votre père');
    expect(also?.explained).toBe('fille d’Andre, frère de votre père');
    if (also === undefined) throw new Error('Expected a second link');
    expect(alsoText(also, { graph: f.graph, t: fr.t })).toBe(
      'aussi\u202f: cousine germaine par votre père',
    );
  });
});

describe('T-026 — degré civil et générations décalées (PAR-02)', () => {
  // Deux lignées de cinq générations sous un couple : cousins à tous les écarts.
  const f = fixture({
    personnes: [
      'top1/M',
      'top2/F',
      'a1/M',
      'a2/M',
      'a3/M',
      'a4/M',
      'a5/M',
      'b1/F',
      'b2/F',
      'b3/F',
      'b4/F',
      'b5/F',
    ],
    unions: [{ conjoints: ['top1', 'top2'] }],
    filiations: [
      { parents: ['top1', 'top2'], enfant: 'a1' },
      { parents: ['top1', 'top2'], enfant: 'b1' },
      { parents: ['a1'], enfant: 'a2' },
      { parents: ['a2'], enfant: 'a3' },
      { parents: ['a3'], enfant: 'a4' },
      { parents: ['a4'], enfant: 'a5' },
      { parents: ['b1'], enfant: 'b2' },
      { parents: ['b2'], enfant: 'b3' },
      { parents: ['b3'], enfant: 'b4' },
      { parents: ['b4'], enfant: 'b5' },
    ],
  });

  it.each([
    ['a2', 'b1', 'tante par votre père'],
    ['a3', 'b1', 'grand-tante par votre père'],
    ['a4', 'b1', 'arrière-grand-tante par votre père'],
    ['a5', 'b1', 'cousine au 6e degré par votre père'],
    ['a1', 'b2', 'nièce'],
    ['a1', 'b3', 'petite-nièce'],
    ['a1', 'b4', 'arrière-petite-nièce'],
    ['a2', 'b2', 'cousine germaine par votre père'],
    ['a3', 'b2', 'tante à la mode de Bretagne par votre père'],
    ['a2', 'b3', 'nièce à la mode de Bretagne par votre père'],
    ['a3', 'b3', 'cousine issue de germain par votre père'],
    ['a4', 'b4', 'cousine au 8e degré par votre père'],
    ['a5', 'b5', 'cousine au 10e degré par votre père'],
    ['a5', 'b3', 'cousine au 8e degré par votre père'],
    ['a5', 'top2', 'ancêtre à la 5e génération par votre père'],
    ['top1', 'a5', 'descendant à la 5e génération'],
  ])('%s → %s : %s', (a, b, expected) => {
    expect(short(f, a, b)).toEqual([expected]);
  });
});

describe('T-026 — liens non biologiques et certitude (PAR-06, PAR-08)', () => {
  it('adoption, « a élevé », confiage : jamais les mots de la naissance', () => {
    const f = fixture({
      personnes: ['kie/M', 'zoe/F', 'leo/M', 'ana/F'],
      filiations: [
        { parents: ['kie'], enfant: 'zoe', type: 'adoptive' },
        { parents: ['kie'], enfant: 'leo', type: 'a_eleve' },
        { parents: ['kie'], enfant: 'ana', type: 'confie' },
      ],
    });
    expect(short(f, 'zoe', 'kie')).toEqual(['père adoptif']);
    expect(short(f, 'kie', 'zoe')).toEqual(['fille adoptive']);
    expect(short(f, 'leo', 'kie')).toEqual(['personne qui vous a élevé']);
    expect(short(f, 'kie', 'leo')).toEqual(['enfant que vous avez élevé']);
    expect(short(f, 'ana', 'kie')).toEqual(['personne à qui vous êtes confiée']);
    expect(short(f, 'zoe', 'leo')).toEqual(['enfant élevé par votre père adoptif']);
  });

  it('« Peut-être votre frère », « Hypothèse : votre grand-mère »', () => {
    const f = fixture({
      personnes: ['gm/F', 'p/M', 'm/F', 'a/M', 'b/M'],
      unions: [{ conjoints: ['p', 'm'] }],
      filiations: [
        { parents: ['gm'], enfant: 'p', certitude: 'hypothetique' },
        { parents: ['p', 'm'], enfant: 'a' },
        { parents: ['p', 'm'], enfant: 'b', certitude: 'probable' },
      ],
    });
    expect(wordsOf(f, 'a', 'b')).toEqual([
      {
        short: 'Peut-être votre frère',
        explained: 'fils de votre père et de votre mère (lien probable, à confirmer)',
      },
    ]);
    expect(short(f, 'a', 'gm')).toEqual(['Hypothèse\u202f: votre grand-mère par votre père']);
  });
});

describe('T-026 — réponses sans lien', () => {
  const f = fixture({ personnes: ['a/M', 'b/F'] });
  const words = (result: PresentationResult) => describeResult(result, { graph: f.graph, t: fr.t });

  it('« Lien non disponible », sans autre indice (PAR-09, CL-SEC-02)', () => {
    expect(words({ status: 'none' })).toEqual({ status: 'none', text: 'Lien non disponible' });
    expect(words({ status: 'incomplete', truncated: true })).toEqual({
      status: 'incomplete',
      text: 'Lien non trouvé',
    });
    expect(words({ status: 'same_person' })).toEqual({
      status: 'same_person',
      text: 'Même personne',
    });
  });
});

// ----- Propriétés sur des arbres générés -----

const CERTAINTIES = ['certain', 'probable', 'hypothetical'] as const;

const trees = fc
  .tuple(
    populatedTreeArbitrary({ minSize: 2, maxSize: 70 }),
    fc.array(fc.constantFrom(...CERTAINTIES), { minLength: 1, maxLength: 20 }),
  )
  .map(([tree, certainties]): GeneratedTree => ({
    ...tree,
    filiations: tree.filiations.map((filiation, index) => ({
      ...filiation,
      certainty: certainties[index % certainties.length] ?? filiation.certainty,
    })),
  }));

const pairPicks = fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 8 });

/** Noms genrés qui ne doivent jamais désigner une personne de genre neutre. */
const GENDERED_HEAD =
  /^(frère|sœur|demi-frère|demi-sœur|oncle|tante|grand-oncle|grand-tante|cousin|cousine|neveu|nièce|fils|fille|père|mère|grand-père|grand-mère|petit-fils|petite-fille|mari|épouse|beau-|belle-|gendre|bru|co-épouse|co-époux|tuteur|tutrice|donneur|donneuse)\b/u;
const NON_BIRTH = /adopt|élev|confi|tutelle|tuteur|tutrice|pupille|don|port/u;

interface Checked {
  link: ReturnType<typeof presentRelationships>;
  frWords: ReturnType<typeof describeResult>;
  enWords: ReturnType<typeof describeResult>;
  gender: Gender | undefined;
}

function play(tree: GeneratedTree, picks: readonly (readonly [number, number])[]): Checked[] {
  const graph = createKinshipGraph(tree);
  const allianceContext = createAllianceContext(tree);
  const ids = tree.people.map((person) => person.id);
  return picks.flatMap(([i, j]) => {
    const a = ids[i % ids.length];
    const b = ids[j % ids.length];
    if (a === undefined || b === undefined) return [];
    const link = presentRelationships(graph, a, b, { allianceContext });
    return [
      {
        link,
        frWords: describeResult(link, { graph, t: fr.t, nameOf: () => 'Awa' }),
        enWords: describeResult(link, { graph, t: en.t, nameOf: () => 'Awa' }),
        gender: graph.person(b)?.gender,
      },
    ];
  });
}

function texts(words: ReturnType<typeof describeResult>): string[] {
  return words.status === 'related'
    ? words.links.flatMap((link) => [link.short, link.explained])
    : [words.text];
}

describe('T-026 — propriétés des mots sur des arbres générés', () => {
  it(
    'chaque message est rendu en entier, en français et en anglais',
    () => {
      let related = 0;
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          for (const { frWords, enWords } of play(tree, picks)) {
            if (frWords.status === 'related') related += 1;
            for (const text of [...texts(frWords), ...texts(enWords)]) {
              expect(text).not.toMatch(/[{}#]|undefined|kinship:/u);
              expect(text.trim()).toBe(text);
              expect(text).not.toBe('');
              expect(text).not.toMatch(/ {2}/u);
            }
          }
        }),
        { numRuns: RUNS },
      );
      expect(related).toBeGreaterThan(50);
    },
    TIMEOUT,
  );

  it(
    'PAR-04 : jamais « belle-mère » ni « beau-père » pour le conjoint d’un parent',
    () => {
      let seen = 0;
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          for (const { link, frWords } of play(tree, picks)) {
            if (link.status !== 'related' || frWords.status !== 'related') continue;
            link.links.forEach((presented, index) => {
              if (presented.alliance?.kind !== 'spouse_of_parent') return;
              seen += 1;
              const words = frWords.links[index];
              expect(`${words?.short ?? ''} ${words?.explained ?? ''}`).not.toMatch(
                /belle-mère|beau-père/u,
              );
            });
          }
        }),
        { numRuns: RUNS },
      );
      expect(seen).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'PAR-06, PAR-08 : le non biologique et la certitude sont toujours dits',
    () => {
      let nonBirth = 0;
      let uncertain = 0;
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          for (const { link, frWords } of play(tree, picks)) {
            if (link.status !== 'related' || frWords.status !== 'related') continue;
            link.links.forEach((presented, index) => {
              const words = frWords.links[index];
              if (words === undefined) throw new Error('One words entry per link');
              if (presented.basis === 'other') {
                nonBirth += 1;
                expect(words.short, words.explained).toMatch(NON_BIRTH);
              }
              const probable = words.short.startsWith('Peut-être ');
              const hypothetical = words.short.startsWith('Hypothèse\u202f: ');
              expect(probable).toBe(presented.certainty === 'probable');
              expect(hypothetical).toBe(presented.certainty === 'hypothetical');
              if (presented.certainty !== 'certain') uncertain += 1;
            });
          }
        }),
        { numRuns: RUNS },
      );
      expect(nonBirth).toBeGreaterThan(0);
      expect(uncertain).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'genre autre ou non renseigné : jamais un nom genré pour la personne visée',
    () => {
      let neutral = 0;
      fc.assert(
        fc.property(trees, pairPicks, (tree, picks) => {
          for (const { frWords, gender } of play(tree, picks)) {
            if (frWords.status !== 'related' || gender === 'male' || gender === 'female') continue;
            for (const words of frWords.links) {
              neutral += 1;
              const bare = words.short
                .replace(/^(Peut-être |Hypothèse\u202f: )/u, '')
                .replace(/^(votre |une |la |le |l’)/u, '');
              expect(bare).not.toMatch(GENDERED_HEAD);
            }
          }
        }),
        { numRuns: RUNS },
      );
      expect(neutral).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it('la forme courte et la forme expliquée viennent du même lien (même fonction pure)', () => {
    const f = fixture({
      personnes: ['p/M', 'm/F', 'a/F', 'b/M'],
      unions: [{ conjoints: ['p', 'm'] }],
      filiations: [
        { parents: ['p', 'm'], enfant: 'a' },
        { parents: ['p', 'm'], enfant: 'b' },
      ],
    });
    const result = presentRelationships(f.graph, f.id('a'), f.id('b'));
    if (result.status !== 'related') throw new Error('Expected a link');
    const [link] = result.links;
    if (link === undefined) throw new Error('Expected a link');
    const context = { graph: f.graph, t: fr.t };
    expect(describeLink(link, context)).toEqual(describeLink(link, context));
    expect(describeLink(link, context)).toEqual({
      short: 'frère',
      explained: 'fils de votre père et de votre mère',
    });
  });
});
