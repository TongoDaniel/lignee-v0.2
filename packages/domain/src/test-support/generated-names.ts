// Noms générés, de consonance camerounaise plausible, faits de syllabes inventées : aucune liste
// de vraies personnes ni de vraies familles. Une coïncidence avec un nom existant reste possible,
// jamais avec une famille entière (prénoms, noms, liens et dates sont tirés indépendamment).
import type { Gender } from '../person';
import type { Random } from './random';

const ONSETS = [
  'b',
  'mb',
  'nd',
  'ng',
  'ny',
  't',
  'tch',
  'k',
  'kw',
  'f',
  'y',
  'l',
  'm',
  'n',
  's',
  'z',
  'dj',
  'g',
  'w',
  'h',
  'p',
  'v',
  'ts',
  'nj',
] as const;
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ou', 'é', 'a', 'o'] as const;
const SURNAME_ENDINGS = [
  'ng',
  'm',
  'ndo',
  'mbe',
  'ssi',
  'ka',
  'la',
  'ko',
  'ga',
  'ne',
  'tou',
  'fo',
] as const;
const FEMALE_ENDINGS = ['a', 'é', 'ine', 'ou', 'ette', 'ia'] as const;
const MALE_ENDINGS = ['o', 'i', 'n', 'm', 'ou', 'é'] as const;
const NICKNAME_PREFIXES = ['Tonton', 'Tantine', 'Papa', 'Mama', 'Ya', 'Grand'] as const;
const PLACE_SUFFIXES = ['', '', ' Village', '-Centre', ' II'] as const;

function syllable(random: Random): string {
  return random.pick(ONSETS) + random.pick(VOWELS);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Nom de famille : deux ou trois syllabes et une finale (« Mbatéka », « Ndoukoung »). */
export function generateSurname(random: Random): string {
  const count = random.int(1, 2);
  let value = '';
  for (let index = 0; index < count; index += 1) value += syllable(random);
  return capitalize(value + random.pick(SURNAME_ENDINGS));
}

/** Prénom : une ou deux syllabes et une finale selon le genre, sans règle stricte. */
export function generateGivenName(random: Random, gender: Gender): string {
  const count = random.int(1, 2);
  let value = '';
  for (let index = 0; index < count; index += 1) value += syllable(random);
  const endings = gender === 'female' ? FEMALE_ENDINGS : gender === 'male' ? MALE_ENDINGS : VOWELS;
  return capitalize(value + random.pick(endings));
}

/** Surnom porté comme nom (« Tonton Bobo », CL-FAM-17). */
export function generateNickname(random: Random): string {
  const core = syllable(random);
  return `${random.pick(NICKNAME_PREFIXES)} ${capitalize(core + core.slice(-1))}`;
}

/** Nom de lieu inventé. */
export function generatePlaceName(random: Random): string {
  return (
    capitalize(syllable(random) + syllable(random) + random.pick(SURNAME_ENDINGS)) +
    random.pick(PLACE_SUFFIXES)
  );
}
