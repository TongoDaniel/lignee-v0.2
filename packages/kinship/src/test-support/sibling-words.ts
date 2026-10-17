// Lien attendu d'un scénario (`attendu.lien`, en mots) ramené à la structure de fratrie qu'il
// désigne, en attendant les dictionnaires (T-026 en français, T-027 en anglais). Les mots
// viennent de la charte et du cahier (PAR-03 : « frère », « demi-frère, même père », « demi-sœur,
// même mère », « frère ou demi-frère » ; TRD : « brother or half-brother ») ; « même parent »
// (CL-FAM-08) et les formes anglaises « same father » sont proposés dans l'ADR 0017. Quand
// T-026 et T-027 existeront, les scénarios compareront les mots calculés et ce tableau
// disparaîtra. Réservé aux tests.
import type { Gender } from '@lignee/domain';

import type { ParentSide, SiblingResult } from '../siblings';

/** Ce que les mots d'un lien de fratrie disent de sa structure. */
export interface SiblingWordsMeaning {
  sharing: 'full' | 'half' | 'full_or_half';
  /** Côté du parent commun, dit seulement pour un demi-frère. */
  side?: ParentSide;
  /** Genre de la personne visée (accord). */
  gender: Extract<Gender, 'male' | 'female'>;
}

const NOUNS = {
  male: { fr: 'frère', half: 'demi-frère', en: 'brother', enHalf: 'half-brother' },
  female: { fr: 'sœur', half: 'demi-sœur', en: 'sister', enHalf: 'half-sister' },
} as const;

const SIDES = {
  father: { fr: 'même père', en: 'same father' },
  mother: { fr: 'même mère', en: 'same mother' },
  parent: { fr: 'même parent', en: 'same parent' },
} as const;

function table(): Map<string, SiblingWordsMeaning & { en: string }> {
  const entries = new Map<string, SiblingWordsMeaning & { en: string }>();
  for (const gender of ['male', 'female'] as const) {
    const noun = NOUNS[gender];
    entries.set(noun.fr, { sharing: 'full', gender, en: noun.en });
    entries.set(`${noun.fr} ou ${noun.half}`, {
      sharing: 'full_or_half',
      gender,
      en: `${noun.en} or ${noun.enHalf}`,
    });
    for (const side of ['father', 'mother', 'parent'] as const) {
      entries.set(`${noun.half}, ${SIDES[side].fr}`, {
        sharing: 'half',
        side,
        gender,
        en: `${noun.enHalf}, ${SIDES[side].en}`,
      });
    }
  }
  return entries;
}

const WORDS = table();

/**
 * Structure désignée par un lien attendu, en français et en anglais ; lève une erreur si les mots
 * ne sont pas un lien de fratrie connu, ou si l'anglais ne dit pas la même chose que le français.
 */
export function siblingMeaningOfWords(fr: string, en: string): SiblingWordsMeaning {
  const entry = WORDS.get(fr);
  if (entry === undefined) throw new Error(`Not a known sibling phrase: ${fr}`);
  if (entry.en !== en)
    throw new Error(`"${en}" does not translate "${fr}" (expected "${entry.en}")`);
  return {
    sharing: entry.sharing,
    ...(entry.side === undefined ? {} : { side: entry.side }),
    gender: entry.gender,
  };
}

/**
 * Ce que les mots diraient d'un lien de fratrie calculé : partage, côté pour un demi-frère, genre.
 * Un lien sur une autre base que la naissance, incertain, ou par alliance n'a pas de mots ici
 * (T-021, T-022) : `undefined`.
 */
export function siblingMeaningOfResult(
  result: SiblingResult | undefined,
): SiblingWordsMeaning | undefined {
  if (result?.kind !== 'sibling' || result.basis !== 'birth' || result.certainty !== 'certain') {
    return undefined;
  }
  if (result.toGender !== 'male' && result.toGender !== 'female') return undefined;
  return {
    sharing: result.sharing,
    ...(result.sharing === 'half' && result.side !== undefined ? { side: result.side } : {}),
    gender: result.toGender,
  };
}
