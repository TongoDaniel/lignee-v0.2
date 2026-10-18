// Liens présentés attendus d'un scénario (`attendu.liens`, en mots : le principal, puis `aussi`)
// ramenés à la structure qu'ils désignent, en attendant les dictionnaires (T-026 en français,
// T-027 en anglais). Les mots viennent du cahier (PAR-05 : « cousin par votre père » ; PAR-06 :
// « fils adoptif », « l'a élevé », « confié à » ; UNI-10 : « Peut-être son frère » ; PAR-09 :
// « Lien non disponible ») ; les autres formes et l'anglais sont proposés dans l'ADR 0021, à
// relire par un locuteur natif (PAR-11). La fratrie de naissance et l'alliance reprennent les
// tableaux de T-020 et T-021. Quand T-026 et T-027 existeront, les scénarios compareront les mots
// calculés et ce tableau disparaîtra. Réservé aux tests.
import type { Certainty, FiliationType, Gender } from '@lignee/domain';

import type { KinshipGraph } from '../graph';
import type { PresentationResult, PresentedLink, PresentedSiblingKind } from '../presentation';
import type { AllianceKind } from '../relationship';
import type { ParentSide, SiblingSharing } from '../siblings';
import { allianceMeaningOfResult, allianceMeaningOfWords } from './alliance-words';
import { siblingMeaningOfWords } from './sibling-words';

type Gendered = Extract<Gender, 'male' | 'female'>;

/** Ce que les mots d'un lien présenté disent de sa structure. */
export type PresentedWordsMeaning =
  | { category: 'none' }
  | {
      category: 'sibling';
      kind: PresentedSiblingKind;
      sharing: SiblingSharing;
      side?: ParentSide;
      gender: Gendered;
      certainty: Certainty;
    }
  | {
      category: 'alliance';
      kind: AllianceKind;
      gender: Gendered;
      via: Gendered[];
      /**
       * Filiations non biologiques du chemin (PAR-06) : vide pour tous les mots connus, qui
       * nomment des parents de naissance (« mari de votre mère ») ; « mari de votre mère
       * adoptive » n'a pas encore de mots (T-026, T-027).
       */
      nonBirthTypes: FiliationType[];
      certainty: Certainty;
    }
  | {
      category: 'line';
      generationsUp: number;
      generationsDown: number;
      nonBirthTypes: FiliationType[];
      /**
       * Côté pour A : par un parent de naissance (« par votre père »), ou par la personne qui l'a
       * élevé ou à qui il est confié (le type seul, jamais « père »).
       */
      side?: { side: ParentSide; type: 'birth' } | { type: 'raised' | 'fostered' };
      /** Genre de la personne visée, quand les mots le disent. */
      gender?: Gendered;
      /** Genre de A, quand les mots s'accordent avec lui (« l'a élevée »). */
      fromGender?: Gendered;
      certainty: Certainty;
    };

type LineMeaning = Extract<PresentedWordsMeaning, { category: 'line' }>;
type LineEntry = Omit<LineMeaning, 'certainty'> & { en: string };

const GENDERS: readonly Gendered[] = ['male', 'female'];
const SIDE_WORDS = {
  father: { fr: 'par votre père', en: 'through your father' },
  mother: { fr: 'par votre mère', en: 'through your mother' },
} as const;
const NON_BIRTH_SIDE_WORDS = {
  raised: { fr: 'par la personne qui vous a élevé', en: 'through the person who raised you' },
  fostered: {
    fr: 'par la personne à qui vous êtes confié',
    en: 'through the person you are entrusted to',
  },
} as const;

/** Noms de la ligne directe et des collatéraux : [générations montées, descendues, fr, en]. */
const LINE_NOUNS: readonly [number, number, Record<Gendered, [string, string]>, boolean][] = [
  [1, 0, { male: ['père', 'father'], female: ['mère', 'mother'] }, false],
  [0, 1, { male: ['fils', 'son'], female: ['fille', 'daughter'] }, false],
  [2, 0, { male: ['grand-père', 'grandfather'], female: ['grand-mère', 'grandmother'] }, true],
  [
    3,
    0,
    {
      male: ['arrière-grand-père', 'great-grandfather'],
      female: ['arrière-grand-mère', 'great-grandmother'],
    },
    true,
  ],
  [2, 1, { male: ['oncle', 'uncle'], female: ['tante', 'aunt'] }, true],
  [3, 1, { male: ['grand-oncle', 'great-uncle'], female: ['grand-tante', 'great-aunt'] }, true],
  [2, 2, { male: ['cousin', 'cousin'], female: ['cousine', 'cousin'] }, true],
  [1, 2, { male: ['neveu', 'nephew'], female: ['nièce', 'niece'] }, false],
];

function lineTable(): Map<string, LineEntry> {
  const entries = new Map<string, LineEntry>();
  const line = (generationsUp: number, generationsDown: number) => ({
    category: 'line' as const,
    generationsUp,
    generationsDown,
  });
  for (const [up, down, nouns, withSide] of LINE_NOUNS) {
    for (const gender of GENDERS) {
      const [fr, en] = nouns[gender];
      entries.set(fr, { ...line(up, down), nonBirthTypes: [], gender, en });
      if (!withSide) continue;
      for (const side of ['father', 'mother'] as const) {
        entries.set(`${fr} ${SIDE_WORDS[side].fr}`, {
          ...line(up, down),
          nonBirthTypes: [],
          side: { side, type: 'birth' },
          gender,
          en: `${en} ${SIDE_WORDS[side].en}`,
        });
      }
      for (const type of ['raised', 'fostered'] as const) {
        entries.set(`${fr} ${NON_BIRTH_SIDE_WORDS[type].fr}`, {
          ...line(up, down),
          nonBirthTypes: [type],
          side: { type },
          gender,
          en: `${en} ${NON_BIRTH_SIDE_WORDS[type].en}`,
        });
      }
    }
  }
  // Adoption (PAR-06) : « fils adoptif », « mère adoptive ».
  const adoptive = { male: 'adoptif', female: 'adoptive' } as const;
  for (const gender of GENDERS) {
    const [parentFr, parentEn] = (LINE_NOUNS[0]?.[2] ?? { male: ['', ''], female: ['', ''] })[
      gender
    ];
    const [childFr, childEn] = (LINE_NOUNS[1]?.[2] ?? { male: ['', ''], female: ['', ''] })[gender];
    entries.set(`${parentFr} ${adoptive[gender]}`, {
      ...line(1, 0),
      nonBirthTypes: ['adoptive'],
      gender,
      en: `adoptive ${parentEn}`,
    });
    entries.set(`${childFr} ${adoptive[gender]}`, {
      ...line(0, 1),
      nonBirthTypes: ['adoptive'],
      gender,
      en: `adopted ${childEn}`,
    });
  }
  // « l'a élevé(e) » (PAR-06) : B a élevé A ; l'accord est celui de A.
  for (const fromGender of GENDERS) {
    entries.set(fromGender === 'male' ? "l'a élevé" : "l'a élevée", {
      ...line(1, 0),
      nonBirthTypes: ['raised'],
      fromGender,
      en: fromGender === 'male' ? 'raised him' : 'raised her',
    });
  }
  // « lui est confié(e) » (PAR-06, confiage, kafala) : B est confié à A ; l'accord est celui de B.
  for (const gender of GENDERS) {
    entries.set(gender === 'male' ? 'lui est confié' : 'lui est confiée', {
      ...line(0, 1),
      nonBirthTypes: ['fostered'],
      gender,
      en: 'entrusted to them',
    });
  }
  // « personne à qui vous êtes confié(e) » : A est confié à B ; l'accord est celui de A.
  for (const fromGender of GENDERS) {
    const suffix = fromGender === 'male' ? '' : 'e';
    entries.set(`personne à qui vous êtes confié${suffix}`, {
      ...line(1, 0),
      nonBirthTypes: ['fostered'],
      fromGender,
      en: 'person you are entrusted to',
    });
  }
  return entries;
}

const LINES = lineTable();

/** « frère par adoption » (PAR-06, ADR 0021). */
const ADOPTION_SIBLINGS: Record<string, { gender: Gendered; en: string }> = {
  'frère par adoption': { gender: 'male', en: 'brother by adoption' },
  'sœur par adoption': { gender: 'female', en: 'sister by adoption' },
};

/** Autres formes de l'alliance (`other`, ADR 0020), nommées d'après leurs segments. */
const OTHER_ALLIANCES: Record<string, { gender: Gendered; via: Gendered[]; en: string }> = {
  "fils de l'épouse de votre oncle": {
    gender: 'male',
    via: ['male', 'female'],
    en: "son of your uncle's wife",
  },
};

/** Conjoint (absent du tableau de T-021). */
const SPOUSES: Record<string, { gender: Gendered; en: string }> = {
  mari: { gender: 'male', en: 'husband' },
  épouse: { gender: 'female', en: 'wife' },
};

const MAYBE = { fr: 'peut-être ', en: 'possibly ' };

function check(fr: string, en: string, expected: string) {
  if (en !== expected)
    throw new Error(`"${en}" does not translate "${fr}" (expected "${expected}")`);
}

/**
 * Structure désignée par un lien présenté attendu, en français et en anglais ; lève une erreur si
 * les mots ne sont pas connus, ou si l'anglais ne dit pas la même chose que le français.
 * « Peut-être » (UNI-10) : certitude `probable` ; sinon `certain`.
 */
export function presentedMeaningOfWords(frWords: string, enWords: string): PresentedWordsMeaning {
  if (frWords === 'Lien non disponible') {
    check(frWords, enWords, 'Link not available');
    return { category: 'none' };
  }
  const maybe = frWords.toLowerCase().startsWith(MAYBE.fr);
  if (maybe !== enWords.toLowerCase().startsWith(MAYBE.en)) {
    throw new Error(`"${enWords}" and "${frWords}" disagree on certainty`);
  }
  const certainty: Certainty = maybe ? 'probable' : 'certain';
  const fr = maybe ? frWords.slice(MAYBE.fr.length) : frWords;
  const en = maybe ? enWords.slice(MAYBE.en.length) : enWords;

  const line = LINES.get(fr);
  if (line !== undefined) {
    const { en: expected, ...meaning } = line;
    check(fr, en, expected);
    return { ...meaning, certainty };
  }
  const adoption = ADOPTION_SIBLINGS[fr];
  if (adoption !== undefined) {
    check(fr, en, adoption.en);
    const meaning = {
      category: 'sibling' as const,
      kind: 'adoption' as const,
      sharing: 'full' as const,
    };
    return { ...meaning, gender: adoption.gender, certainty };
  }
  const otherAlliance = OTHER_ALLIANCES[fr];
  if (otherAlliance !== undefined) {
    check(fr, en, otherAlliance.en);
    const { gender, via } = otherAlliance;
    return { category: 'alliance', kind: 'other', gender, via, nonBirthTypes: [], certainty };
  }
  const spouse = SPOUSES[fr];
  if (spouse !== undefined) {
    check(fr, en, spouse.en);
    const { gender } = spouse;
    return { category: 'alliance', kind: 'spouse', gender, via: [], nonBirthTypes: [], certainty };
  }
  try {
    return { category: 'sibling', kind: 'birth', ...siblingMeaningOfWords(fr, en), certainty };
  } catch {
    const meaning = allianceMeaningOfWords(fr, en);
    return { category: 'alliance', ...meaning, nonBirthTypes: [], certainty };
  }
}

function gendered(gender: Gender | undefined): Gendered | undefined {
  return gender === 'male' || gender === 'female' ? gender : undefined;
}

/** Ce que les mots diraient d'un lien présenté calculé. */
export function presentedMeaningOfLink(
  graph: KinshipGraph,
  link: PresentedLink,
): PresentedWordsMeaning | { category: 'unnamed'; link: PresentedLink } {
  const [first] = link.relationships;
  if (first === undefined) return { category: 'unnamed', link };
  const fromId = first.segments[0]?.fromId;
  const toId = first.segments.at(-1)?.toId;
  const gender = gendered(toId === undefined ? undefined : graph.person(toId)?.gender);
  const fromGender = gendered(fromId === undefined ? undefined : graph.person(fromId)?.gender);
  if (link.sibling !== undefined && gender !== undefined) {
    const { sibling } = link;
    return {
      category: 'sibling',
      kind: sibling.kind,
      sharing: sibling.sharing,
      ...(sibling.sharing === 'half' && sibling.link.side !== undefined
        ? { side: sibling.link.side }
        : {}),
      gender,
      certainty: link.certainty,
    };
  }
  if (link.nature === 'alliance') {
    const meaning = allianceMeaningOfResult(graph, {
      status: 'related',
      relationships: [first],
      truncated: false,
    });
    return meaning === undefined
      ? { category: 'unnamed', link }
      : {
          category: 'alliance',
          ...meaning,
          // Comparé aux mots : une alliance par une mère adoptive n'est pas celle par la mère de
          // naissance (PAR-06).
          nonBirthTypes: link.nonBirthTypes,
          certainty: link.certainty,
        };
  }
  const [segment] = first.segments;
  if (segment?.kind !== 'blood') return { category: 'unnamed', link };
  return {
    category: 'line',
    generationsUp: segment.generationsUp,
    generationsDown: segment.generationsDown,
    nonBirthTypes: link.nonBirthTypes,
    ...(link.fromSide === undefined ? {} : { side: link.fromSide }),
    ...(gender === undefined ? {} : { gender }),
    ...(fromGender === undefined ? {} : { fromGender }),
    certainty: link.certainty,
  } as LineMeaning;
}

/** Ce que les mots diraient d'une réponse présentée : un sens par lien, ou « non disponible ». */
export function presentedMeaningsOfResult(graph: KinshipGraph, result: PresentationResult) {
  return result.status === 'related'
    ? result.links.map((link) => presentedMeaningOfLink(graph, link))
    : [{ category: 'none' as const }];
}
