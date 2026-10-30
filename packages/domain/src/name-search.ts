// Noms dans la recherche (T-034 du plan V1 ; TRD, Recherche : Index, Clé phonétique, Fautes de
// frappe ; PRD, ARB-10 ; CL-DON-03, CL-DON-04 ; ADR 0034). Fonctions pures, sans dépendance :
// elles tournent sur le téléphone (index FTS5 de T-038) comme sur le serveur (doublons, T-040).
//
// 1. `normalizeNameText` : minuscules, sans accents ni tons, lettres camerounaises ramenées à
//    l'alphabet latin de base (ɛ, ɔ, ŋ…), sans apostrophes ni traits d'union, ponctuation en
//    espaces, espaces réduits.
// 2. `nameTokens` : les mots d'un texte normalisé ; `isNameParticle` : « ngo », « nga », « mbe »,
//    « de », « du », « des », « d » ne sont jamais exigés d'une requête (CL-DON-03).
// 3. `phoneticKey` : une clé par mot, qui rapproche les graphies d'un même son (« Nkoulou » et
//    « Nkulu », « Biyong » et « Biyon », « Tchoupo » et « Choupo »).
// 4. `personSearchTerms`, `buildSearchTerms` : les termes indexables d'une personne, tirés de ses
//    noms autorisés. Jamais d'ancien prénom (`former`), même saisi par le lecteur (ADR 0023,
//    ADR 0034) ; jamais rien d'autre qu'un nom (aucun fait, donc aucune cause de décès).
// 5. `queryTerms`, `matchQuery` : les niveaux exact, début de mot et phonétique d'une requête sur
//    ces termes. `jaroWinkler` : la similarité des fautes de frappe. La requête FTS5, le seuil
//    approché et le classement sont ceux de la recherche (T-038).
//
// Chaque règle et ses limites sont décrites dans l'ADR 0034 et le README du paquet.
import type { Id } from './ids';
import type { Name } from './person';

// ---------------------------------------------------------------------------------------------
// Normalisation

/**
 * Lettres que la décomposition Unicode ne ramène pas à une lettre latine de base : celles de
 * l'alphabet général des langues camerounaises (ɛ, ɔ, ŋ, ə, ɨ, ʉ, ɓ, ɗ, ƴ) et quelques lettres
 * européennes. Les tons et les accents, eux, sont des signes combinants, retirés après NFKD.
 */
const LETTER_FOLDS: Readonly<Record<string, string>> = {
  ɛ: 'e',
  ɔ: 'o',
  ŋ: 'ng',
  ə: 'e',
  ǝ: 'e',
  ɨ: 'i',
  ʉ: 'u',
  ɓ: 'b',
  ɗ: 'd',
  ƴ: 'y',
  ƙ: 'k',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  đ: 'd',
  ł: 'l',
  ı: 'i',
  þ: 'th',
  ð: 'd',
};
const LETTER_FOLD_PATTERN = new RegExp(`[${Object.keys(LETTER_FOLDS).join('')}]`, 'gu');

/** Signes combinants (accents, tons, cédille…), retirés après la décomposition NFKD. */
const COMBINING_MARKS = /\p{M}/gu;
/**
 * Apostrophes et signes qui en tiennent lieu, dont le coup de glotte (ꞌ, ʼ) des orthographes
 * camerounaises. Retirés sans laisser d'espace : « N'Dongo » s'écrit aussi « Ndongo ».
 */
const APOSTROPHES = "'’‘ʼʻꞌ`´";
/** Élision française en tête de mot (« d'Almeida ») : la lettre élidée devient un mot à part. */
const ELISION = new RegExp(`(^|[^\\p{L}\\p{N}])d[${APOSTROPHES}]`, 'gu');
const APOSTROPHE_PATTERN = new RegExp(`[${APOSTROPHES}]`, 'gu');
/** Tout ce qui n'est ni lettre ni chiffre (traits d'union, points, virgules…) sépare les mots. */
const SEPARATORS = /[^\p{L}\p{N}]+/gu;

/**
 * Forme normalisée d'un texte de nom : minuscules, sans accents ni tons, lettres camerounaises
 * ramenées à l'alphabet latin de base, sans apostrophes, chaque trait d'union ou signe de
 * ponctuation remplacé par une espace, espaces réduites. Idempotente. Les écritures non
 * latines (arabe…) gardent leurs lettres, en minuscules quand l'écriture en a.
 *
 * « Ngo Biyong » → « ngo biyong » ; « Nguyễn Thị » → « nguyen thi » ; « Ɛ̀yɔ́ŋ » → « eyong » ;
 * « N'Dzanga » → « ndzanga » ; « d'Almeida » → « d almeida » ; « Hélène-Ruth » → « helene ruth ».
 */
export function normalizeNameText(text: string): string {
  // NFKD avant et après les minuscules : une lettre de compatibilité peut se décomposer en
  // majuscule (« ℌ » → « H »), et une minuscule en lettre et signe (« İ » → « i » et un point).
  return text
    .normalize('NFKD')
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(LETTER_FOLD_PATTERN, (letter) => LETTER_FOLDS[letter] ?? letter)
    .replace(ELISION, '$1d ')
    .replace(APOSTROPHE_PATTERN, '')
    .replace(SEPARATORS, ' ')
    .trim();
}

/** Les mots d'un texte, après normalisation. Un texte sans lettre ni chiffre n'en a aucun. */
export function nameTokens(text: string): string[] {
  const normalized = normalizeNameText(text);
  return normalized === '' ? [] : normalized.split(' ');
}

/**
 * Particules de nom (forme normalisée) : gardées dans le nom et dans l'index, jamais exigées
 * d'une requête (CL-DON-03). « ngo » (« fille de »), « nga », « mbe », et les particules
 * françaises « de », « du », « des », « d » (« d'Almeida »). Liste à confirmer sur les noms des
 * familles pilotes (ADR 0034).
 */
export const NAME_PARTICLES: ReadonlySet<string> = new Set([
  'ngo',
  'nga',
  'mbe',
  'de',
  'du',
  'des',
  'd',
]);

/** Vrai si le mot normalisé est une particule de nom. */
export function isNameParticle(token: string): boolean {
  return NAME_PARTICLES.has(token);
}

// ---------------------------------------------------------------------------------------------
// Clé phonétique

/** Seuls les mots en lettres latines de base reçoivent une clé ; les autres se gardent tels quels. */
const LATIN_WORD = /^[a-z]+$/;

/**
 * Règles de la clé (ADR 0034), en passes successives. Dans une passe, le mot est lu de gauche à
 * droite et la première graphie qui convient, dans l'ordre de la liste, est remplacée ; ce
 * qu'une passe écrit n'est relu que par les passes suivantes.
 *
 * 1. Consonnes. « ph » → f (Philomène, Filomène) ; « tch », « tsh », « sch », « ch », « sh » → x,
 *    marque du son « ch » (Tchoupo, Choupo, Shoupo) ; « dj » → j (Djoumessi, Joumessi) ;
 *    « gn » → ny (Gnamien, Nyamien) ; « qu », « ck », « q » → k (Tsafack, Tsafak) ; « c » devant
 *    e, i, y → s (Cécile, Sésile), sinon → k (Camga, Kamga) ; la lettre « x » → ks (Félix,
 *    Féliks : la marque x ne se confond donc avec aucune lettre) ; « h » muet (Hélène, Elène).
 * 2. Voyelles. « eau », « au » → o (Claude, Klode) ; « ain », « ein », « aim », « eim » devant
 *    consonne ou en fin → in (Germain, Germin) ; « ai », « ei » → e (Claire, Klère) ; « ou »,
 *    « w » → u (Nkoulou, Nkulu ; Kwam, Kouam) ; « y » → i (Biyong).
 * 3. Lettres doublées réduites à une (Essomba, Esomba).
 * 4. Nasales. « m » devant consonne ou en fin → n (Kamga, Kanga ; Ndam, Ndan) ; « ng » final → n
 *    (Biyong, Biyon ; Fotsing, Fotsin) ; lettres doublées réduites encore.
 * 5. Finale muette : t, s ou d après une voyelle, dans une clé de 4 lettres et plus (Thomas, Toma).
 */
const CONSONANTS = /ph|tch|tsh|sch|ch|sh|dj|gn|qu|ck|q|c|x|h/g;
const CONSONANT_SOUNDS: Readonly<Record<string, string>> = {
  ph: 'f',
  tch: 'x',
  tsh: 'x',
  sch: 'x',
  ch: 'x',
  sh: 'x',
  dj: 'j',
  gn: 'ny',
  qu: 'k',
  ck: 'k',
  q: 'k',
  x: 'ks',
  h: '',
};
const VOWELS = /eau|au|[ae]i[mn](?![aeiouy])|[ae]i|ou|w|y/g;
const VOWEL_SOUNDS: Readonly<Record<string, string>> = {
  eau: 'o',
  au: 'o',
  ai: 'e',
  ei: 'e',
  ou: 'u',
  w: 'u',
  y: 'i',
};
const DOUBLED = /([a-z])\1+/g;
const NASAL_M = /m(?![aeiou])/g;
const FINAL_NG = /ng$/;
const MUTE_FINAL = /([aeiou])[tsd]$/;

function consonantSound(match: string, offset: number, word: string): string {
  if (match === 'c') return /[eiy]/.test(word.charAt(offset + 1)) ? 's' : 'k';
  return CONSONANT_SOUNDS[match] ?? match;
}

function vowelSound(match: string): string {
  // Les graphies « ain », « ein », « aim », « eim » sont les seules absentes de la table.
  return VOWEL_SOUNDS[match] ?? 'in';
}

/**
 * Clé phonétique d'un mot normalisé (`nameTokens`). Deux graphies d'un même son ont la même
 * clé : « nkoulou » et « nkulu » → « nkulu » ; « biyong » et « biyon » → « bion » ;
 * « tchoupo » et « choupo » → « xupo ». Un mot qui n'est pas en lettres latines de base
 * (chiffres, autre écriture) est sa propre clé. Les limites sont celles de l'ADR 0034 : « an » et
 * « en », « s » et « z », « e » final ne sont pas rapprochés.
 */
export function phoneticKey(token: string): string {
  if (!LATIN_WORD.test(token)) return token;
  let key = token
    .replace(CONSONANTS, consonantSound)
    .replace(VOWELS, vowelSound)
    .replace(DOUBLED, '$1')
    .replace(NASAL_M, 'n')
    .replace(FINAL_NG, 'n')
    .replace(DOUBLED, '$1');
  if (key.length >= 4) key = key.replace(MUTE_FINAL, '$1');
  return key === '' ? token : key;
}

// ---------------------------------------------------------------------------------------------
// Termes indexables d'une personne

/** Un mot indexé ou cherché, avec sa clé phonétique. */
export interface SearchTerm {
  readonly token: string;
  readonly key: string;
  readonly particle: boolean;
}

/**
 * Termes indexables d'une personne. `text` et `keys` sont les colonnes à indexer (FTS5, T-038) :
 * mots distincts séparés par une espace, dans l'ordre des noms.
 */
export interface PersonSearchTerms {
  readonly personId: Id;
  readonly terms: readonly SearchTerm[];
  /** Mots normalisés distincts, séparés par une espace. */
  readonly text: string;
  /** Clés phonétiques distinctes, séparées par une espace. */
  readonly keys: string;
}

/** Ce que l'index lit d'un nom : jamais son auteur ni ses dates. */
export type SearchableName = Pick<
  Name,
  'personId' | 'type' | 'givenNames' | 'surname' | 'displayForm'
>;

/**
 * Termes déjà calculés pendant une construction de l'index, par texte de partie de nom : un même
 * nom de famille ou un même prénom, porté par beaucoup de personnes, n'est normalisé qu'une fois.
 */
type PartCache = Map<string, readonly SearchTerm[]>;

/**
 * Termes d'une partie de nom (prénoms, nom de famille ou forme d'affichage) : ses mots, puis, s'il
 * y en a plusieurs, leur forme accolée (« Ngo Biyong » → « ngobiyong », « Jean-Pierre » →
 * « jeanpierre »), pour qui les tape sans espace.
 */
function partTerms(part: string, cache: PartCache): readonly SearchTerm[] {
  let terms = cache.get(part);
  if (terms === undefined) {
    const tokens = nameTokens(part);
    const all = tokens.length > 1 ? [...tokens, tokens.join('')] : tokens;
    terms = all.map((token) => ({
      token,
      key: phoneticKey(token),
      particle: isNameParticle(token),
    }));
    cache.set(part, terms);
  }
  return terms;
}

function termsOf(
  personId: Id,
  names: readonly SearchableName[],
  cache: PartCache,
): PersonSearchTerms {
  // Une personne a peu de mots : des tableaux suffisent, sans ensemble à construire.
  const terms: SearchTerm[] = [];
  const tokens: string[] = [];
  const keys: string[] = [];
  for (const name of names) {
    // L'ancien prénom n'entre jamais dans l'index (ADR 0023, ADR 0034), quel qu'en soit l'auteur.
    if (name.personId !== personId || name.type === 'former') continue;
    for (const part of [name.givenNames, name.surname, name.displayForm]) {
      if (part === undefined) continue;
      for (const term of partTerms(part, cache)) {
        if (tokens.includes(term.token)) continue;
        tokens.push(term.token);
        terms.push(term);
        if (!keys.includes(term.key)) keys.push(term.key);
      }
    }
  }
  return { personId, terms, text: tokens.join(' '), keys: keys.join(' ') };
}

/**
 * Termes indexables d'une personne, tirés de ses noms : de naissance, d'usage, surnoms, titres,
 * variantes (TRD, Index). Les noms d'une autre personne et les anciens prénoms (`former`) sont
 * ignorés. La liste reçue est celle de la copie locale du lecteur, déjà filtrée (T-052) : un nom
 * masqué n'y est pas, et rien d'autre qu'un nom n'est lu.
 */
export function personSearchTerms(
  personId: Id,
  names: readonly SearchableName[],
): PersonSearchTerms {
  return termsOf(personId, names, new Map());
}

/**
 * Termes indexables de toutes les personnes d'une copie locale, dans l'ordre de `people`. Une
 * personne à compléter sans nom a des termes vides. Un même texte de nom n'est normalisé qu'une
 * fois.
 */
export function buildSearchTerms(source: {
  readonly people: readonly { readonly id: Id }[];
  readonly names: readonly SearchableName[];
}): PersonSearchTerms[] {
  const byPerson = new Map<Id, SearchableName[]>();
  for (const name of source.names) {
    const list = byPerson.get(name.personId);
    if (list === undefined) byPerson.set(name.personId, [name]);
    else list.push(name);
  }
  const cache: PartCache = new Map();
  return source.people.map((person) => termsOf(person.id, byPerson.get(person.id) ?? [], cache));
}

// ---------------------------------------------------------------------------------------------
// Requête

/** Une requête découpée : ses mots, avec leur clé et leur nature de particule. */
export interface QueryTerms {
  readonly terms: readonly SearchTerm[];
}

/**
 * Mots d'une requête. Une particule n'est exigée que si la requête n'est faite que de
 * particules (« Ngo » seul cherche « Ngo ») : elle compte alors comme un mot ordinaire.
 */
export function queryTerms(query: string): QueryTerms {
  const tokens = nameTokens(query);
  const onlyParticles = tokens.every(isNameParticle);
  return {
    terms: tokens.map((token) => ({
      token,
      key: phoneticKey(token),
      particle: !onlyParticles && isNameParticle(token),
    })),
  };
}

/** Niveaux de rapprochement d'un mot, du meilleur au moins bon (TRD, Classement). */
export type TermMatchLevel = 'exact' | 'prefix' | 'phonetic';
const LEVEL_RANK: Readonly<Record<TermMatchLevel, number>> = { exact: 0, prefix: 1, phonetic: 2 };

export interface NameMatch {
  /** Le moins bon des niveaux obtenus par les mots exigés de la requête. */
  readonly level: TermMatchLevel;
  /** Une particule de la requête (« Ngo ») manque à la personne, sans l'écarter. */
  readonly missingParticles: boolean;
}

function bestLevel(term: SearchTerm, person: PersonSearchTerms): TermMatchLevel | undefined {
  let best: TermMatchLevel | undefined;
  for (const candidate of person.terms) {
    if (candidate.token === term.token) return 'exact';
    if (candidate.token.startsWith(term.token)) best = 'prefix';
    else if (best === undefined && candidate.key === term.key) best = 'phonetic';
  }
  return best;
}

/**
 * Une requête retrouve-t-elle une personne par ses termes ? Chaque mot exigé (hors particules)
 * doit être un de ses mots (`exact`), le début d'un de ses mots (`prefix`), ou avoir la clé
 * phonétique d'un de ses mots (`phonetic`). Le niveau rendu est le moins bon de ces mots ;
 * une requête vide ne retrouve personne. Les fautes de frappe (Jaro-Winkler) et le classement
 * relèvent de la recherche (T-038).
 */
export function matchQuery(query: QueryTerms, person: PersonSearchTerms): NameMatch | undefined {
  let level: TermMatchLevel | undefined;
  let missingParticles = false;
  for (const term of query.terms) {
    const found = bestLevel(term, person);
    if (term.particle) {
      if (found === undefined) missingParticles = true;
      continue;
    }
    if (found === undefined) return undefined;
    if (level === undefined || LEVEL_RANK[found] > LEVEL_RANK[level]) level = found;
  }
  return level === undefined ? undefined : { level, missingParticles };
}

// ---------------------------------------------------------------------------------------------
// Fautes de frappe

/** Préfixe commun compté par Winkler, au plus 4 caractères, avec un poids de 0,1. */
const WINKLER_PREFIX = 4;
const WINKLER_WEIGHT = 0.1;

/**
 * Similarité de Jaro-Winkler entre deux textes, de 0 (rien en commun) à 1 (identiques), à
 * calculer sur des formes normalisées (TRD, Fautes de frappe) : « biyong » et « biyogn » → 0,97.
 * Symétrique. Le seuil qui fait d'un candidat un résultat approché est celui de T-038 (recherche)
 * ou de T-040 (doublons).
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  // L'appariement glouton dépend de l'ordre des deux textes : un ordre fixe (le plus court, puis
  // le premier dans l'ordre des chaînes) rend le calcul symétrique.
  const [short, long] = a.length < b.length || (a.length === b.length && a < b) ? [a, b] : [b, a];
  const window = Math.max(0, Math.floor(long.length / 2) - 1);
  const shortMatched = new Array<boolean>(short.length).fill(false);
  const longMatched = new Array<boolean>(long.length).fill(false);
  let matches = 0;
  for (let i = 0; i < short.length; i += 1) {
    const from = Math.max(0, i - window);
    const to = Math.min(long.length - 1, i + window);
    for (let j = from; j <= to; j += 1) {
      if (longMatched[j] === true || short[i] !== long[j]) continue;
      shortMatched[i] = true;
      longMatched[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < short.length; i += 1) {
    if (shortMatched[i] !== true) continue;
    while (longMatched[k] !== true) k += 1;
    if (short[i] !== long[k]) transpositions += 1;
    k += 1;
  }
  const jaro =
    (matches / short.length + matches / long.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(WINKLER_PREFIX, short.length) && short[prefix] === long[prefix]) {
    prefix += 1;
  }
  return jaro + prefix * WINKLER_WEIGHT * (1 - jaro);
}
