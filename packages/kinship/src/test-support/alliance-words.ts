// Lien par alliance attendu d'un scénario (`attendu.liens`, en mots) ramené à la structure qu'il
// désigne, en attendant les dictionnaires (T-026 en français, T-027 en anglais). Les mots viennent
// du cahier (PAR-04 : « épouse de votre père », « mari de votre mère », « co-épouse » ; CL-FAM-01 :
// « fils de l'épouse de votre père » ; TRD : « co-wife ») ; les autres formes et l'anglais sont
// proposés dans l'ADR 0019. « belle-mère » et « beau-père » n'y figurent pas : ambigus (PAR-04).
// Quand T-026 et T-027 existeront, les scénarios compareront les mots calculés et ce tableau
// disparaîtra. Réservé aux tests.
import type { Gender, Id } from '@lignee/domain';

import type { KinshipGraph } from '../graph';
import type { AllianceKind, KinshipResult } from '../relationship';

type Gendered = Extract<Gender, 'male' | 'female'>;

/** Ce que les mots d'un lien par alliance disent de sa structure. */
export interface AllianceWordsMeaning {
  kind: AllianceKind;
  /** Genre de la personne visée (accord). */
  gender: Gendered;
  /** Genres des personnes intermédiaires du chemin, dans l'ordre (le père, son épouse…). */
  via: Gendered[];
}

interface Entry extends AllianceWordsMeaning {
  en: string;
}

const SPOUSE = { male: { fr: 'mari', en: 'husband' }, female: { fr: 'épouse', en: 'wife' } };
const PARENT = { male: { fr: 'père', en: 'father' }, female: { fr: 'mère', en: 'mother' } };
const CHILD = { male: { fr: 'fils', en: 'son' }, female: { fr: 'fille', en: 'daughter' } };
const GENDERS: readonly Gendered[] = ['male', 'female'];
/** Le conjoint d'une personne de ce genre, dans les exemples des scénarios (couples mixtes). */
const other = (gender: Gendered): Gendered => (gender === 'male' ? 'female' : 'male');
/** « de votre » / « du » / « de l' » devant un nom. */
const ofThe = (noun: string) => (/^[aeéiou]/.test(noun) ? `de l'${noun}` : `du ${noun}`);

function table(): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  for (const parent of GENDERS) {
    const spouse = other(parent);
    // « épouse de votre père », « mari de votre mère » (PAR-04).
    entries.set(`${SPOUSE[spouse].fr} de votre ${PARENT[parent].fr}`, {
      kind: 'spouse_of_parent',
      gender: spouse,
      via: [parent],
      en: `your ${PARENT[parent].en}'s ${SPOUSE[spouse].en}`,
    });
    for (const child of GENDERS) {
      // « fils de l'épouse de votre père » (CL-FAM-01).
      entries.set(`${CHILD[child].fr} ${ofThe(SPOUSE[spouse].fr)} de votre ${PARENT[parent].fr}`, {
        kind: 'step_sibling',
        gender: child,
        via: [parent, spouse],
        en: `${CHILD[child].en} of your ${PARENT[parent].en}'s ${SPOUSE[spouse].en}`,
      });
    }
  }
  for (const spouse of GENDERS) {
    for (const child of GENDERS) {
      // « fille de votre mari ».
      entries.set(`${CHILD[child].fr} de votre ${SPOUSE[spouse].fr}`, {
        kind: 'child_of_spouse',
        gender: child,
        via: [spouse],
        en: `your ${SPOUSE[spouse].en}'s ${CHILD[child].en}`,
      });
    }
    // « autre épouse de votre mari » : sans simultanéité établie.
    const target = other(spouse);
    entries.set(`autre ${SPOUSE[target].fr} de votre ${SPOUSE[spouse].fr}`, {
      kind: 'spouse_of_spouse',
      gender: target,
      via: [spouse],
      en: `your ${SPOUSE[spouse].en}'s other ${SPOUSE[target].en}`,
    });
  }
  // « co-épouse » : deux épouses d'un même homme, unions simultanées (PAR-04, TRD : « co-wife »).
  entries.set('co-épouse', { kind: 'co_spouse', gender: 'female', via: ['male'], en: 'co-wife' });
  return entries;
}

const WORDS = table();

/**
 * Structure désignée par un lien attendu, en français et en anglais ; lève une erreur si les mots
 * ne sont pas un lien par alliance connu, ou si l'anglais ne dit pas la même chose que le
 * français.
 */
export function allianceMeaningOfWords(fr: string, en: string): AllianceWordsMeaning {
  const entry = WORDS.get(fr);
  if (entry === undefined) throw new Error(`Not a known alliance phrase: ${fr}`);
  if (entry.en !== en)
    throw new Error(`"${en}" does not translate "${fr}" (expected "${entry.en}")`);
  return { kind: entry.kind, gender: entry.gender, via: entry.via };
}

/** Tous les mots du tableau (pour vérifier qu'aucun n'est « belle-mère » ni « beau-père »). */
export function knownAlliancePhrases(): string[] {
  return [...WORDS.keys()];
}

function gendered(graph: KinshipGraph, id: Id): Gendered | undefined {
  const gender = graph.person(id)?.gender;
  return gender === 'male' || gender === 'female' ? gender : undefined;
}

/**
 * Ce que les mots diraient du lien le plus proche calculé (le premier chemin) : nature, genre de
 * la personne visée et des intermédiaires. Un lien de sang, ou un genre non renseigné, n'a pas
 * de mots ici : `undefined`.
 */
export function allianceMeaningOfResult(
  graph: KinshipGraph,
  result: KinshipResult,
): AllianceWordsMeaning | undefined {
  if (result.status !== 'related') return undefined;
  const [closest] = result.relationships;
  const alliance = closest?.alliance;
  const first = closest?.segments[0];
  const last = closest?.segments.at(-1);
  if (alliance === undefined || first === undefined || last === undefined) return undefined;
  const ends = new Set([first.fromId, last.toId]);
  const via: Gendered[] = [];
  const seen = new Set<Id>();
  for (const crossing of alliance.crossings) {
    for (const id of [crossing.fromId, crossing.toId]) {
      if (ends.has(id) || seen.has(id)) continue;
      seen.add(id);
      const gender = gendered(graph, id);
      if (gender === undefined) return undefined;
      via.push(gender);
    }
  }
  const gender = gendered(graph, last.toId);
  return gender === undefined ? undefined : { kind: alliance.kind, gender, via };
}
