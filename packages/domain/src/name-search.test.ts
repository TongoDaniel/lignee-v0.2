// Noms dans la recherche (T-034 du plan V1, ADR 0034) : une règle par test, avec ses limites.
// Noms inventés seulement.
import { describe, expect, it } from 'vitest';

import type { Id } from './ids';
import {
  buildSearchTerms,
  isNameParticle,
  jaroWinkler,
  matchQuery,
  nameTokens,
  normalizeNameText,
  personSearchTerms,
  phoneticKey,
  queryTerms,
  type SearchableName,
} from './name-search';
import { deterministicIds } from './test-support/fixtures';

const nextId = deterministicIds();
const ODILE: Id = nextId();
const OTHER: Id = nextId();

function name(
  personId: Id,
  type: SearchableName['type'],
  parts: Partial<Pick<SearchableName, 'givenNames' | 'surname' | 'displayForm'>>,
): SearchableName {
  return { personId, type, ...parts };
}

const key = (text: string) => nameTokens(text).map(phoneticKey).join(' ');

describe('normalizeNameText', () => {
  it.each([
    ['Ngo Biyong', 'ngo biyong'],
    ['  NGO   biyong ', 'ngo biyong'],
    ['Nguyễn Thị Hoa', 'nguyen thi hoa'],
    ['Hélène-Ruth', 'helene ruth'],
    ['Ɛ̀yɔ́ŋ Mbɔ́', 'eyong mbo'],
    ['ƁƊƳ Ǝ', 'bdy e'],
    ["N'Dzanga", 'ndzanga'],
    ['N’Dzanga', 'ndzanga'],
    ['Nꞌdzanga', 'ndzanga'],
    ["d'Almeida", 'd almeida'],
    ["Ngo d'Almeida", 'ngo d almeida'],
    ['Mbatéka (Tonton), Jr.', 'mbateka tonton jr'],
    ['Œuvray Løkke Straße', 'oeuvray lokke strasse'],
    ['Mvondo II', 'mvondo ii'],
    ['Ndoumbè 2', 'ndoumbe 2'],
  ])('« %s » → « %s »', (input, expected) => {
    expect(normalizeNameText(input)).toBe(expected);
  });

  it('garde les lettres d’une autre écriture', () => {
    expect(normalizeNameText('فاطمة  الزهراء')).toBe('فاطمة الزهراء');
  });

  it('rend une chaîne vide pour un texte sans lettre ni chiffre', () => {
    expect(normalizeNameText(" - ' . ")).toBe('');
    expect(nameTokens(" - ' . ")).toEqual([]);
  });
});

describe('particules', () => {
  it.each(['ngo', 'nga', 'mbe', 'de', 'du', 'des', 'd'])('« %s » est une particule', (token) => {
    expect(isNameParticle(token)).toBe(true);
  });

  it('ne prend pas un nom qui commence comme une particule', () => {
    expect(isNameParticle('ngono')).toBe(false);
    expect(isNameParticle('Ngo')).toBe(false); // seulement la forme normalisée
  });
});

describe('phoneticKey', () => {
  it.each([
    // TRD : « ou » et « u », lettres doublées, finales muettes.
    ['Nkoulou', 'Nkulu', 'nkulu'],
    ['Biyong', 'Biyon', 'bion'],
    // « c », « k » et « q »
    ['Camga', 'Kamga', 'kanga'],
    ['Tsafack', 'Tsafak', 'tsafak'],
    ['Quentin', 'Kentin', 'kentin'],
    // « tch » et « ch »
    ['Tchoupo', 'Choupo', 'xupo'],
    ['Tshoupo', 'Shoupo', 'xupo'],
    ['Djoumessi', 'Joumessi', 'jumesi'],
    ['Philomène', 'Filomène', 'filomene'],
    ['Gnamien', 'Nyamien', 'niamien'],
    ['Cécile', 'Sésile', 'sesile'],
    ['Hélène', 'Elène', 'elene'],
    ['Claude', 'Klode', 'klode'],
    ['Claire', 'Klère', 'klere'],
    ['Germain', 'Germin', 'germin'],
    ['Kwam', 'Kouam', 'kuan'],
    ['Essomba', 'Esomba', 'esonba'],
    ['Emmanuel', 'Emanuel', 'emanuel'],
    ['Fotsing', 'Fotsin', 'fotsin'],
    ['Ndam', 'Ndan', 'ndan'],
    ['Thomas', 'Toma', 'toma'],
    ['Ngué', 'Ngue', 'ngue'],
  ])('« %s » et « %s » → « %s »', (a, b, expected) => {
    expect(key(a)).toBe(expected);
    expect(key(b)).toBe(expected);
  });

  it('ne fait qu’un mot à la fois, en minuscules latines', () => {
    expect(phoneticKey('felix')).toBe('feliks');
    expect(phoneticKey('tchoupo')).toMatch(/^[a-z]+$/);
  });

  it('laisse tels quels les chiffres et les autres écritures', () => {
    expect(phoneticKey('2')).toBe('2');
    expect(phoneticKey('فاطمة')).toBe('فاطمة');
  });

  it('ne rend jamais une clé vide', () => {
    expect(phoneticKey('h')).toBe('h');
    expect(phoneticKey('hh')).toBe('hh');
    // Limite : un numéro romain est un mot comme un autre (« II » → « i »).
    expect(phoneticKey('ii')).toBe('i');
  });

  // Limites documentées dans l'ADR 0034 : ces paires restent distinctes ; Jaro-Winkler (T-038)
  // les rapproche quand elles sont proches à l'écrit.
  it.each([
    ['Mengue', 'Mangue'],
    ['Ayissi', 'Aissi'],
    ['Moussa', 'Mouza'],
    ['Nyobè', 'Nyob'],
    ['Ngo', 'Nga'],
  ])('limite : « %s » et « %s » gardent des clés différentes', (a, b) => {
    expect(key(a)).not.toBe(key(b));
  });
});

describe('personSearchTerms', () => {
  it('indexe chaque mot des prénoms, du nom et de la forme d’affichage, et leurs formes accolées', () => {
    const terms = personSearchTerms(ODILE, [
      name(ODILE, 'birth', { givenNames: 'Odile-Marthe', surname: 'Ngo Biyong' }),
      name(ODILE, 'nickname', { displayForm: 'Mama Odi' }),
    ]);
    expect(terms.text).toBe('odile marthe odilemarthe ngo biyong ngobiyong mama odi mamaodi');
    expect(terms.keys).toBe('odile marte odilemarte ngo bion ngobion mama odi mamaodi');
    expect(terms.terms.find((term) => term.token === 'ngo')?.particle).toBe(true);
  });

  it('indexe naissance, usage, surnom, titre et variante, sans doublon', () => {
    const terms = personSearchTerms(ODILE, [
      name(ODILE, 'birth', { givenNames: 'Odile', surname: 'Biyong' }),
      name(ODILE, 'usage', { givenNames: 'Odile', surname: 'Mbarga' }),
      name(ODILE, 'nickname', { displayForm: 'Odi' }),
      name(ODILE, 'title', { displayForm: 'Mafo' }),
      name(ODILE, 'variant', { surname: 'Biyon' }),
    ]);
    expect(terms.text).toBe('odile biyong mbarga odi mafo biyon');
    expect(terms.keys).toBe('odile bion nbarga odi mafo');
  });

  it('n’indexe jamais un ancien prénom, quel qu’en soit l’auteur', () => {
    const terms = personSearchTerms(ODILE, [
      name(ODILE, 'birth', { givenNames: 'Aloma', surname: 'Ndzanga' }),
      name(ODILE, 'former', { givenNames: 'Zéphyrin', surname: 'Ndzanga' }),
      name(ODILE, 'former', { displayForm: 'Zézé' }),
    ]);
    expect(terms.text).toBe('aloma ndzanga');
    expect(JSON.stringify(terms)).not.toMatch(/zephyrin|zeze|zefirin/i);
  });

  it('ignore les noms d’une autre personne', () => {
    const terms = personSearchTerms(ODILE, [
      name(ODILE, 'birth', { givenNames: 'Odile' }),
      name(OTHER, 'birth', { givenNames: 'Ruth' }),
    ]);
    expect(terms.text).toBe('odile');
  });

  it('donne des termes vides à une place à compléter sans nom', () => {
    expect(personSearchTerms(ODILE, [])).toEqual({
      personId: ODILE,
      terms: [],
      text: '',
      keys: '',
    });
  });
});

describe('buildSearchTerms', () => {
  it('rend les termes de chaque personne, dans l’ordre des personnes', () => {
    const terms = buildSearchTerms({
      people: [{ id: OTHER }, { id: ODILE }],
      names: [
        name(ODILE, 'birth', { givenNames: 'Odile' }),
        name(OTHER, 'birth', { givenNames: 'Ruth' }),
        name(OTHER, 'former', { givenNames: 'Zéphyrine' }),
      ],
    });
    expect(terms.map((item) => [item.personId, item.text])).toEqual([
      [OTHER, 'ruth'],
      [ODILE, 'odile'],
    ]);
  });
});

describe('queryTerms et matchQuery', () => {
  const odile = personSearchTerms(ODILE, [
    name(ODILE, 'birth', { givenNames: 'Odile', surname: 'Ngo Biyong' }),
  ]);

  it('ARB-10 : « Ngo Biyong », « ngo biyon » et « Biyong » trouvent la même personne', () => {
    for (const query of ['Ngo Biyong', 'ngo biyon', 'Biyong']) {
      expect(matchQuery(queryTerms(query), odile), query).toBeDefined();
    }
  });

  it('ne retient du mot cherché que le meilleur niveau', () => {
    expect(matchQuery(queryTerms('biyong'), odile)).toEqual({
      level: 'exact',
      missingParticles: false,
    });
    expect(matchQuery(queryTerms('biy'), odile)?.level).toBe('prefix');
    expect(matchQuery(queryTerms('biong'), odile)?.level).toBe('phonetic');
  });

  it('rend le moins bon niveau des mots exigés', () => {
    expect(matchQuery(queryTerms('odile biong'), odile)?.level).toBe('phonetic');
    expect(matchQuery(queryTerms('odi biyong'), odile)?.level).toBe('prefix');
  });

  it('n’exige pas une particule, mais signale qu’elle manque', () => {
    const ernest = personSearchTerms(OTHER, [
      name(OTHER, 'birth', { givenNames: 'Ernest', surname: 'Biyong' }),
    ]);
    expect(matchQuery(queryTerms('Ngo Biyong'), ernest)).toEqual({
      level: 'exact',
      missingParticles: true,
    });
  });

  it('exige les particules d’une requête qui n’a qu’elles', () => {
    const ernest = personSearchTerms(OTHER, [name(OTHER, 'birth', { surname: 'Biyong' })]);
    expect(queryTerms('Ngo').terms[0]?.particle).toBe(false);
    expect(matchQuery(queryTerms('Ngo'), odile)?.level).toBe('exact');
    expect(matchQuery(queryTerms('Ngo'), ernest)).toBeUndefined();
  });

  it('exige chaque mot qui n’est pas une particule', () => {
    expect(matchQuery(queryTerms('Odile Mbarga'), odile)).toBeUndefined();
  });

  it('ne trouve rien pour une requête vide', () => {
    expect(matchQuery(queryTerms(''), odile)).toBeUndefined();
    expect(matchQuery(queryTerms(' - '), odile)).toBeUndefined();
  });

  it('ne trouve personne par un ancien prénom', () => {
    const aloma = personSearchTerms(OTHER, [
      name(OTHER, 'birth', { givenNames: 'Aloma' }),
      name(OTHER, 'former', { givenNames: 'Zéphyrin' }),
    ]);
    expect(matchQuery(queryTerms('Zéphyrin'), aloma)).toBeUndefined();
    expect(matchQuery(queryTerms('Zeph'), aloma)).toBeUndefined();
  });
});

describe('jaroWinkler', () => {
  it.each([
    ['martha', 'marhta', 0.961],
    ['dixon', 'dicksonx', 0.813],
    ['biyong', 'biyogn', 0.967],
    ['nkoulou', 'nkulu', 0.924],
  ])('« %s » et « %s » → %f', (a, b, expected) => {
    expect(jaroWinkler(a, b)).toBeCloseTo(expected, 3);
  });

  it('vaut 1 pour deux textes égaux et 0 sans rien en commun', () => {
    expect(jaroWinkler('biyong', 'biyong')).toBe(1);
    expect(jaroWinkler('', '')).toBe(1);
    expect(jaroWinkler('abc', '')).toBe(0);
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });
});
