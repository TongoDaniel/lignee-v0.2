// Générateur d'arbres reproductible (graine) pour les tests : polygamie avec rangs, unions
// successives, lévirat, sororat, implexe (mariage entre cousins germains), parents non précisés
// avec candidats, places à compléter, adoption et confiage, jumeaux, dates floues simples, noms
// générés, et objets masqués au hasard par des règles de visibilité (futurs tests de non-fuite).
//
// Tous les objets produits passent les schémas de packages/domain. Les filiations vont toujours
// d'une génération à une suivante : aucun cycle, par construction ; et au plus deux parents de
// naissance par enfant. Les propriétés de tree-generator.test.ts le vérifient sans se fier au
// générateur.
import type { Certainty } from '../common';
import type { Fact } from '../fact';
import type { Filiation, FiliationType, ParentCandidate } from '../filiation';
import { fuzzyDateFromText, type FuzzyDate } from '../fuzzy-date';
import type { Id } from '../ids';
import type { Name, Person } from '../person';
import type { KinshipStep, Place } from '../place';
import type { Tree } from '../tree';
import type { Union, UnionType } from '../union';
import type { VisibilityRule } from '../visibility';
import {
  generateGivenName,
  generateNickname,
  generatePlaceName,
  generateSurname,
} from './generated-names';
import { createRandom, seededIds, type Random } from './random';
import { emptyTreeData, type TreeData } from './tree-data';

/** Probabilités du générateur, chacune entre 0 et 1. */
export interface TreeGeneratorRates {
  /** Une personne en âge de se marier se marie. */
  marriage: number;
  /** Un homme marié prend une ou plusieurs autres épouses en même temps. */
  polygamy: number;
  /** Une épouse supplémentaire, ou la nouvelle épouse d'un veuf, est la sœur de l'épouse. */
  sororate: number;
  /** Une personne épouse un cousin germain (implexe). */
  implex: number;
  /** Le conjoint vient d'une autre lignée de l'arbre plutôt que de l'extérieur. */
  withinTree: number;
  /** Une veuve épouse le frère du défunt. */
  levirate: number;
  /** Un veuf ou une veuve se remarie hors de la famille (unions successives). */
  remarriage: number;
  /** Un homme polygame a un enfant dont la mère n'est pas précisée (candidates : ses épouses). */
  unknownParent: number;
  /** Un conjoint venu de l'extérieur a des parents à compléter, ou est lui-même à compléter. */
  placeholder: number;
  /** Un enfant a aussi un lien adoptif, « a élevé », de confiage ou de tutelle. */
  adoption: number;
  /** Une naissance est multiple (jumeaux, parfois triplés). */
  twins: number;
  /** Un objet (personne, union, filiation, fait, nom) porte une règle de visibilité restreinte. */
  hidden: number;
  /** Une personne est créée « à placer », sans lien. */
  toPlace: number;
}

export const DEFAULT_TREE_GENERATOR_RATES: Readonly<TreeGeneratorRates> = {
  marriage: 0.85,
  polygamy: 0.2,
  sororate: 0.25,
  implex: 0.08,
  withinTree: 0.25,
  levirate: 0.5,
  remarriage: 0.3,
  unknownParent: 0.3,
  placeholder: 0.15,
  adoption: 0.04,
  twins: 0.03,
  hidden: 0.08,
  toPlace: 0.01,
};

export interface TreeGeneratorOptions {
  seed: number;
  /** Nombre exact de personnes, places à compléter et personnes à placer comprises (au moins 1). */
  size: number;
  rates?: Partial<TreeGeneratorRates>;
}

/** Ce que le générateur a produit, compté au fil de la génération. */
export interface TreeFeatures {
  /** Personnes ayant au moins deux unions simultanées. */
  polygamousPeople: number;
  /** Unions qui suivent la fin d'une autre par décès (lévirat et remariages compris). */
  successiveUnions: number;
  levirate: number;
  sororate: number;
  /** Unions entre cousins germains. */
  implex: number;
  placeholders: number;
  /** Enfants rattachés à leur père seul, avec les épouses comme mères candidates. */
  unknownParentChildren: number;
  /** Filiations adoptives, « a élevé », de confiage ou de tutelle. */
  nonBirthFiliations: number;
  multipleBirths: number;
  /** Objets qui portent une règle autre que « tout l'arbre ». */
  hiddenObjects: number;
  toPlace: number;
}

/** Un compte membre de l'arbre, relié ou non à une fiche (le premier est le propriétaire). */
export interface GeneratedAccount {
  accountId: Id;
  personId: Id | undefined;
}

export interface GeneratedTree extends TreeData {
  seed: number;
  accounts: GeneratedAccount[];
  features: TreeFeatures;
}

const CURRENT_YEAR = 2025;
const LAST_MARRIAGE_BIRTH_YEAR = CURRENT_YEAR - 20;

type Sex = 'female' | 'male';

interface NameSpec {
  type: Name['type'];
  givenNames?: string;
  surname?: string;
  displayForm?: string;
  start?: number;
}

interface PersonInfo {
  id: Id;
  gender: Person['gender'];
  nature: Person['nature'];
  generation: number;
  birthYear: number;
  deathYear: number | undefined;
  birthParents: Id[];
  children: Id[];
  unions: UnionInfo[];
  surname: string | undefined;
  names: NameSpec[];
  married: boolean;
}

interface UnionInfo {
  id: Id;
  spouses: [PersonInfo, PersonInfo];
  ranks: [number, number];
  startYear: number;
  endYear: number | undefined;
  endReason: Union['endReason'];
  simultaneity: Union['simultaneity'];
  type: UnionType;
}

interface FiliationSpec {
  parent: PersonInfo;
  child: PersonInfo;
  type: FiliationType;
  certainty: Certainty;
  originUnion: UnionInfo | undefined;
  recognitionStatus: Filiation['recognitionStatus'];
}

const UNION_TYPES: readonly UnionType[] = [
  'customary',
  'customary',
  'civil',
  'religious',
  'free_union',
  'unspecified',
];
const NON_BIRTH_TYPES: readonly FiliationType[] = ['adoptive', 'fostered', 'raised', 'guardian'];
const OCCUPATIONS = [
  'cultivatrice',
  'cultivateur',
  'enseignante',
  'enseignant',
  'commerçante',
  'menuisier',
  'couturière',
  'infirmier',
  'chauffeur',
] as const;
const TITLES = ['Chef de famille', 'Notable', 'Successeur désigné', 'Responsable d’association'];
const KINSHIP_STEPS: readonly KinshipStep[] = ['parent', 'child', 'spouse', 'sibling'];

/**
 * Date floue simple autour de `year` (T-005) : année exacte, « vers », jour précis, intervalle
 * « entre », ou texte seul, avec le texte d'origine quand il y en a un.
 */
function dateText(random: Random, year: number): FuzzyDate {
  const draw = random.next();
  const y = String(year);
  if (draw < 0.4) {
    return { qualifier: 'exact', precision: 'year', date: { year }, calendar: 'gregorian' };
  }
  if (draw < 0.7) {
    return {
      qualifier: 'about',
      precision: 'year',
      date: { year },
      originalText: `vers ${y}`,
      calendar: 'gregorian',
    };
  }
  if (draw < 0.85) {
    // Jour 1 à 28 : il existe dans tous les mois.
    return {
      qualifier: 'exact',
      precision: 'day',
      date: { year, month: random.int(1, 12), day: random.int(1, 28) },
      calendar: 'gregorian',
    };
  }
  if (draw < 0.95) {
    const to = year + random.int(1, 5);
    return {
      qualifier: 'between',
      precision: 'year',
      from: { year },
      to: { year: to },
      originalText: `entre ${y} et ${String(to)}`,
      calendar: 'gregorian',
    };
  }
  return fuzzyDateFromText(`vers ${y}, d'après la famille`);
}

/**
 * Génère un arbre de `size` personnes. Même graine et mêmes options : même arbre, identifiants
 * compris.
 */
export function generateTree(options: TreeGeneratorOptions): GeneratedTree {
  const size = Math.floor(options.size);
  if (!(size >= 1)) throw new RangeError('A generated tree has at least one person');
  const rates: TreeGeneratorRates = { ...DEFAULT_TREE_GENERATOR_RATES, ...options.rates };
  const random = createRandom(options.seed);
  const nextId = seededIds(random);
  const treeId = nextId();

  const features: TreeFeatures = {
    polygamousPeople: 0,
    successiveUnions: 0,
    levirate: 0,
    sororate: 0,
    implex: 0,
    placeholders: 0,
    unknownParentChildren: 0,
    nonBirthFiliations: 0,
    multipleBirths: 0,
    hiddenObjects: 0,
    toPlace: 0,
  };

  const people: PersonInfo[] = [];
  const byId = new Map<Id, PersonInfo>();
  const unions: UnionInfo[] = [];
  const filiations: FiliationSpec[] = [];
  const candidates: { child: PersonInfo; candidate: PersonInfo }[] = [];
  const multipleBirths: PersonInfo[][] = [];
  const toPlace: { person: PersonInfo; reference: PersonInfo }[] = [];
  const queue: PersonInfo[] = [];
  let queueHead = 0;
  /** Célibataires nés dans l'arbre, par génération et par sexe : conjoints possibles. */
  const pools = new Map<string, PersonInfo[]>();
  const ancestorCache = new Map<Id, ReadonlySet<Id>>();
  const polygamous = new Set<Id>();

  const remaining = () => size - people.length;

  function decideDeath(birthYear: number): number | undefined {
    const oldest = birthYear < CURRENT_YEAR - 95;
    if (!oldest && !random.chance(birthYear < 1960 ? 0.35 : 0.06)) return undefined;
    const year = birthYear + (oldest ? random.int(30, 95) : random.int(1, 90));
    return Math.min(year, CURRENT_YEAR - 1);
  }

  function namesFor(gender: Person['gender'], surname: string): NameSpec[] {
    const draw = random.next();
    if (draw < 0.03) return [{ type: 'nickname', displayForm: generateNickname(random) }];
    if (draw < 0.06) return [{ type: 'birth', givenNames: generateGivenName(random, gender) }];
    const names: NameSpec[] = [
      { type: 'birth', givenNames: generateGivenName(random, gender), surname },
    ];
    if (random.chance(0.005)) {
      names.push({ type: 'former', givenNames: generateGivenName(random, gender) });
    }
    if (random.chance(0.02))
      names.push({ type: 'nickname', displayForm: generateNickname(random) });
    return names;
  }

  function addPerson(fields: {
    gender: Person['gender'];
    nature?: Person['nature'];
    generation: number;
    birthYear: number;
    birthParents?: PersonInfo[];
    surname?: string;
  }): PersonInfo | undefined {
    if (remaining() <= 0) return undefined;
    const nature = fields.nature ?? 'known';
    const surname = nature === 'known' ? (fields.surname ?? generateSurname(random)) : undefined;
    const info: PersonInfo = {
      id: nextId(),
      gender: fields.gender,
      nature,
      generation: fields.generation,
      birthYear: fields.birthYear,
      deathYear: nature === 'known' ? decideDeath(fields.birthYear) : undefined,
      birthParents: (fields.birthParents ?? []).map((parent) => parent.id),
      children: [],
      unions: [],
      surname,
      names: surname === undefined ? [] : namesFor(fields.gender, surname),
      married: false,
    };
    for (const parent of fields.birthParents ?? []) parent.children.push(info.id);
    people.push(info);
    byId.set(info.id, info);
    if (nature === 'placeholder') features.placeholders += 1;
    return info;
  }

  function get(id: Id): PersonInfo {
    const info = byId.get(id);
    if (info === undefined) throw new Error(`Unknown generated person ${id}`);
    return info;
  }

  function poolKey(generation: number, sex: Sex) {
    return `${String(generation)}:${sex}`;
  }

  function isSex(gender: Person['gender']): gender is Sex {
    return gender === 'female' || gender === 'male';
  }

  function opposite(sex: Sex): Sex {
    return sex === 'male' ? 'female' : 'male';
  }

  /** Peut se marier : connue, femme ou homme, en âge et en vie à 20 ans. */
  function marriageable(info: PersonInfo): boolean {
    return (
      info.nature === 'known' &&
      isSex(info.gender) &&
      info.birthYear <= LAST_MARRIAGE_BIRTH_YEAR &&
      (info.deathYear === undefined || info.deathYear >= info.birthYear + 20)
    );
  }

  function enqueueBornInTree(info: PersonInfo) {
    queue.push(info);
    if (marriageable(info) && isSex(info.gender)) {
      const key = poolKey(info.generation, info.gender);
      const pool = pools.get(key);
      if (pool === undefined) pools.set(key, [info]);
      else pool.push(info);
    }
  }

  function ancestors(info: PersonInfo): ReadonlySet<Id> {
    const cached = ancestorCache.get(info.id);
    if (cached !== undefined) return cached;
    const result = new Set<Id>();
    for (const parentId of info.birthParents) {
      result.add(parentId);
      for (const ancestor of ancestors(get(parentId))) result.add(ancestor);
    }
    ancestorCache.set(info.id, result);
    return result;
  }

  function shareParent(a: PersonInfo, b: PersonInfo): boolean {
    return a.birthParents.some((parent) => b.birthParents.includes(parent));
  }

  function unrelated(a: PersonInfo, b: PersonInfo): boolean {
    const ancestorsOfA = ancestors(a);
    if (ancestorsOfA.has(b.id) || ancestors(b).has(a.id)) return false;
    for (const ancestor of ancestors(b)) if (ancestorsOfA.has(ancestor)) return false;
    return true;
  }

  function siblings(info: PersonInfo): PersonInfo[] {
    const result = new Set<Id>();
    for (const parentId of info.birthParents) {
      for (const childId of get(parentId).children) if (childId !== info.id) result.add(childId);
    }
    return [...result].map(get);
  }

  function nextRank(info: PersonInfo): number {
    return (
      info.unions.reduce((max, union) => {
        const rank = union.spouses[0] === info ? union.ranks[0] : union.ranks[1];
        return Math.max(max, rank);
      }, 0) + 1
    );
  }

  function ongoingUnions(info: PersonInfo): UnionInfo[] {
    return info.unions.filter((union) => union.endYear === undefined);
  }

  function aliveIn(info: PersonInfo, year: number): boolean {
    return info.deathYear === undefined || info.deathYear >= year;
  }

  function spouseOf(union: UnionInfo, info: PersonInfo): PersonInfo {
    return union.spouses[0] === info ? union.spouses[1] : union.spouses[0];
  }

  /** Conjoint libre de sexe `sex` parmi `candidates`, au hasard. */
  function pickFree(candidatesList: PersonInfo[], sex: Sex, year: number): PersonInfo | undefined {
    const free = candidatesList.filter(
      (candidate) =>
        candidate.gender === sex &&
        !candidate.married &&
        marriageable(candidate) &&
        aliveIn(candidate, year),
    );
    return free.length === 0 ? undefined : random.pick(free);
  }

  function findCousin(info: PersonInfo, sex: Sex): PersonInfo | undefined {
    const cousins: PersonInfo[] = [];
    for (const parentId of info.birthParents) {
      for (const grandParentId of get(parentId).birthParents) {
        for (const auntOrUncleId of get(grandParentId).children) {
          if (info.birthParents.includes(auntOrUncleId)) continue;
          for (const cousinId of get(auntOrUncleId).children) {
            const cousin = get(cousinId);
            if (!shareParent(info, cousin)) cousins.push(cousin);
          }
        }
      }
    }
    return pickFree(cousins, sex, info.birthYear + 18);
  }

  function findSister(wife: PersonInfo, husband: PersonInfo): PersonInfo | undefined {
    const sisters = siblings(wife).filter(
      (sister) => !shareParent(sister, husband) && sister !== husband,
    );
    return pickFree(sisters, 'female', husband.birthYear + 18);
  }

  function findUnrelated(info: PersonInfo, sex: Sex): PersonInfo | undefined {
    const pool = pools.get(poolKey(info.generation, sex));
    if (pool === undefined) return undefined;
    for (let attempt = 0; attempt < 8 && pool.length > 0; attempt += 1) {
      const index = random.int(0, pool.length - 1);
      const candidate = pool[index];
      if (candidate === undefined) break;
      if (candidate.married || !aliveIn(candidate, candidate.birthYear + 20)) {
        pool[index] = pool[pool.length - 1] ?? candidate;
        pool.pop();
        continue;
      }
      if (candidate !== info && unrelated(info, candidate)) return candidate;
    }
    return undefined;
  }

  /** Conjoint venu de l'extérieur : connu (parfois avec des parents à compléter) ou à compléter. */
  function newInLaw(info: PersonInfo, sex: Sex): PersonInfo | undefined {
    const birthYear = info.birthYear + (sex === 'female' ? random.int(-2, 12) : random.int(-12, 2));
    if (random.chance(rates.placeholder / 3)) {
      return addPerson({
        gender: sex,
        nature: 'placeholder',
        generation: info.generation,
        birthYear,
      });
    }
    const withParents = random.chance(rates.placeholder) && remaining() >= 3;
    const parents = withParents
      ? [
          addPerson({
            gender: 'male',
            nature: 'placeholder',
            generation: info.generation - 1,
            birthYear: birthYear - 28,
          }),
          addPerson({
            gender: 'female',
            nature: 'placeholder',
            generation: info.generation - 1,
            birthYear: birthYear - 24,
          }),
        ].filter((parent): parent is PersonInfo => parent !== undefined)
      : [];
    const inLaw = addPerson({
      gender: sex,
      generation: info.generation,
      birthYear: Math.min(birthYear, LAST_MARRIAGE_BIRTH_YEAR),
      birthParents: parents,
    });
    if (inLaw !== undefined) {
      for (const parent of parents) {
        filiations.push({
          parent,
          child: inLaw,
          type: 'birth',
          certainty: 'certain',
          originUnion: undefined,
          recognitionStatus: 'unknown',
        });
      }
    }
    return inLaw;
  }

  function createUnion(
    a: PersonInfo,
    b: PersonInfo,
    earliestStart: number,
    simultaneity: Union['simultaneity'],
  ): UnionInfo {
    const lowest = Math.min(a.deathYear ?? CURRENT_YEAR, b.deathYear ?? CURRENT_YEAR, CURRENT_YEAR);
    const start = Math.min(
      Math.max(earliestStart, Math.max(a.birthYear, b.birthYear) + random.int(18, 26)),
      lowest,
    );
    const divorced = simultaneity === undefined && random.chance(0.04);
    const union: UnionInfo = {
      id: nextId(),
      spouses: [a, b],
      ranks: [nextRank(a), nextRank(b)],
      startYear: start,
      endYear: undefined,
      endReason: undefined,
      simultaneity,
      type: random.pick(UNION_TYPES),
    };
    if (divorced && start + 3 < lowest) {
      union.endYear = start + random.int(2, Math.min(15, lowest - start - 1));
      union.endReason = random.chance(0.7) ? 'divorce' : 'separation';
    }
    if (simultaneity === 'simultaneous') {
      // Les unions en cours de chaque conjoint deviennent simultanées avec la nouvelle (UNI-08).
      for (const spouse of [a, b]) {
        const ongoing = ongoingUnions(spouse);
        for (const other of ongoing) other.simultaneity = 'simultaneous';
        if (ongoing.length > 0 && !polygamous.has(spouse.id)) {
          polygamous.add(spouse.id);
          features.polygamousPeople += 1;
        }
      }
    }
    a.unions.push(union);
    b.unions.push(union);
    a.married = true;
    b.married = true;
    unions.push(union);
    addChildren(union);
    return union;
  }

  function addChild(
    birthParents: PersonInfo[],
    year: number,
    origin: UnionInfo | undefined,
  ): PersonInfo | undefined {
    const father = birthParents.find((parent) => parent.gender === 'male');
    const draw = random.next();
    const gender: Person['gender'] = draw < 0.49 ? 'male' : draw < 0.98 ? 'female' : 'unspecified';
    const child = addPerson({
      gender,
      generation: Math.max(...birthParents.map((parent) => parent.generation)) + 1,
      birthYear: year,
      birthParents,
      ...(father?.surname !== undefined && random.chance(0.5) ? { surname: father.surname } : {}),
    });
    if (child === undefined) return undefined;
    for (const parent of birthParents) {
      filiations.push({
        parent,
        child,
        type: 'birth',
        certainty: random.chance(0.9) ? 'certain' : 'probable',
        originUnion: origin,
        recognitionStatus:
          parent === father && random.chance(0.03)
            ? 'unofficial'
            : random.chance(0.5)
              ? 'official'
              : 'unknown',
      });
    }
    if (random.chance(rates.adoption)) addNonBirthLink(child, birthParents);
    enqueueBornInTree(child);
    return child;
  }

  /** Adoption, « a élevé », confiage ou tutelle par un adulte de la génération précédente. */
  function addNonBirthLink(child: PersonInfo, birthParents: PersonInfo[]) {
    const options: PersonInfo[] = [];
    for (const parent of birthParents) {
      // Co-épouses du père, frères et sœurs des parents (CL-POL-11, confiage).
      for (const union of parent.unions) options.push(spouseOf(union, parent));
      options.push(...siblings(parent));
    }
    const eligible = options.filter(
      (adult) =>
        !birthParents.includes(adult) &&
        adult.generation < child.generation &&
        adult.nature === 'known',
    );
    if (eligible.length === 0) return;
    filiations.push({
      parent: random.pick(eligible),
      child,
      type: random.pick(NON_BIRTH_TYPES),
      certainty: 'certain',
      originUnion: undefined,
      recognitionStatus: 'unknown',
    });
    features.nonBirthFiliations += 1;
  }

  function addChildren(union: UnionInfo) {
    const [a, b] = union.spouses;
    const mother = a.gender === 'female' ? a : b.gender === 'female' ? b : undefined;
    const lastYear = Math.min(
      CURRENT_YEAR - 1,
      (mother?.birthYear ?? union.startYear) + 45,
      a.deathYear ?? CURRENT_YEAR,
      b.deathYear ?? CURRENT_YEAR,
      union.endYear ?? CURRENT_YEAR,
    );
    let year = union.startYear + random.int(1, 3);
    const count = random.pick([0, 1, 2, 2, 3, 3, 4, 4, 5, 6]);
    for (let index = 0; index < count && year <= lastYear && remaining() > 0; index += 1) {
      const multiple = random.chance(rates.twins) && remaining() >= 2;
      const births = multiple ? (random.chance(0.1) && remaining() >= 3 ? 3 : 2) : 1;
      const born: PersonInfo[] = [];
      for (let birth = 0; birth < births; birth += 1) {
        const child = addChild([a, b], year, union);
        if (child !== undefined) born.push(child);
      }
      if (born.length >= 2) {
        multipleBirths.push(born);
        features.multipleBirths += 1;
      }
      year += random.int(1, 4);
    }
  }

  /** Enfant d'un homme polygame dont la mère n'est pas précisée (CL-POL-03). */
  function addUnknownMotherChild(father: PersonInfo) {
    const wives = ongoingUnions(father).map((union) => spouseOf(union, father));
    if (wives.length < 2) return;
    const start = Math.max(...ongoingUnions(father).map((union) => union.startYear));
    const year = start + random.int(1, 8);
    if (year > Math.min(CURRENT_YEAR - 1, father.deathYear ?? CURRENT_YEAR)) return;
    const child = addChild([father], year, undefined);
    if (child === undefined) return;
    for (const wife of wives) candidates.push({ child, candidate: wife });
    features.unknownParentChildren += 1;
  }

  /** Trouve un conjoint pour `info` et crée l'union ; `undefined` si personne n'est disponible. */
  function marry(info: PersonInfo, additional: boolean): UnionInfo | undefined {
    if (!isSex(info.gender)) return undefined;
    const sex = opposite(info.gender);
    let spouse: PersonInfo | undefined;
    let kind: 'sororate' | 'implex' | 'other' = 'other';
    if (additional && info.gender === 'male' && random.chance(rates.sororate)) {
      const wife = ongoingUnions(info)
        .map((union) => spouseOf(union, info))
        .find((candidate) => candidate.nature === 'known');
      spouse = wife === undefined ? undefined : findSister(wife, info);
      if (spouse !== undefined) kind = 'sororate';
    }
    if (spouse === undefined && random.chance(rates.implex)) {
      spouse = findCousin(info, sex);
      if (spouse !== undefined) kind = 'implex';
    }
    if (spouse === undefined && random.chance(rates.withinTree)) spouse = findUnrelated(info, sex);
    spouse ??= newInLaw(info, sex);
    if (spouse === undefined) return undefined;
    const simultaneous = ongoingUnions(info).length > 0 || ongoingUnions(spouse).length > 0;
    const union = createUnion(
      info,
      spouse,
      0,
      simultaneous ? 'simultaneous' : random.chance(0.5) ? undefined : 'successive',
    );
    if (kind === 'sororate') features.sororate += 1;
    if (kind === 'implex') features.implex += 1;
    return union;
  }

  /** Veuvage : la veuve épouse le frère du défunt (lévirat), ou le survivant se remarie. */
  function widowhood(deceased: PersonInfo) {
    const deathYear = deceased.deathYear;
    if (deathYear === undefined) return;
    for (const union of ongoingUnions(deceased)) {
      const survivor = spouseOf(union, deceased);
      if (survivor.nature !== 'known' || !aliveIn(survivor, deathYear + 1)) continue;
      union.endYear = Math.max(deathYear, union.startYear);
      union.endReason = 'death';
      const start = deathYear + random.int(1, 3);
      if (start >= CURRENT_YEAR || !aliveIn(survivor, start)) continue;
      let next: PersonInfo | undefined;
      let kind: 'levirate' | 'sororate' | 'other' = 'other';
      if (
        deceased.gender === 'male' &&
        survivor.gender === 'female' &&
        random.chance(rates.levirate)
      ) {
        const brothers = siblings(deceased).filter(
          (brother) =>
            brother.gender === 'male' &&
            brother.nature === 'known' &&
            !shareParent(brother, survivor) &&
            aliveIn(brother, start) &&
            brother.birthYear <= start - 18,
        );
        next = brothers.length === 0 ? undefined : random.pick(brothers);
        if (next !== undefined) kind = 'levirate';
      }
      if (next === undefined && deceased.gender === 'female' && random.chance(rates.sororate)) {
        next = findSister(deceased, survivor);
        if (next !== undefined) kind = 'sororate';
      }
      if (next === undefined && isSex(survivor.gender) && random.chance(rates.remarriage)) {
        next = newInLaw(survivor, opposite(survivor.gender));
      }
      if (next === undefined) continue;
      const simultaneous = ongoingUnions(next).length > 0 || ongoingUnions(survivor).length > 0;
      createUnion(survivor, next, start, simultaneous ? 'simultaneous' : 'successive');
      features.successiveUnions += 1;
      if (kind === 'levirate') features.levirate += 1;
      if (kind === 'sororate') features.sororate += 1;
    }
  }

  function processPerson(info: PersonInfo) {
    if (!marriageable(info)) return;
    if (!info.married) {
      if (!random.chance(rates.marriage)) return;
      marry(info, false);
    }
    if (info.gender === 'male' && info.married && random.chance(rates.polygamy)) {
      const extra = random.int(1, 3);
      for (let index = 0; index < extra && remaining() > 0; index += 1) marry(info, true);
      if (random.chance(rates.unknownParent)) addUnknownMotherChild(info);
    }
    widowhood(info);
  }

  function addFounder() {
    const founder = addPerson({
      gender: random.chance(0.8) ? 'male' : 'female',
      generation: 0,
      birthYear: random.int(1870, 1915),
    });
    if (founder !== undefined) enqueueBornInTree(founder);
  }

  function addToPlace() {
    const known = people.filter((info) => info.nature === 'known');
    if (known.length === 0) return;
    const reference = random.pick(known);
    const person = addPerson({
      gender: random.chance(0.5) ? 'female' : 'male',
      generation: reference.generation,
      birthYear: random.int(1890, 1990),
    });
    if (person === undefined) return;
    toPlace.push({ person, reference });
    features.toPlace += 1;
  }

  const founders = Math.max(1, Math.round(size / 300));
  for (let index = 0; index < founders; index += 1) addFounder();
  while (remaining() > 0) {
    if (random.chance(rates.toPlace)) {
      addToPlace();
      continue;
    }
    const next = queue[queueHead];
    if (next === undefined) {
      addFounder();
      continue;
    }
    queueHead += 1;
    processPerson(next);
  }

  return materialize();

  /** Transforme l'état interne en objets du modèle. */
  function materialize(): GeneratedTree {
    // Comptes : jusqu'à 30 membres reliés à des fiches de personnes vivantes.
    const living = people.filter((info) => info.nature === 'known' && info.deathYear === undefined);
    const accountCount = Math.min(
      30,
      Math.max(1, Math.floor(size / 30)),
      Math.max(1, living.length),
    );
    const accounts: GeneratedAccount[] = [];
    for (let index = 0; index < accountCount; index += 1) {
      // Une fiche n'est reliée qu'à un compte : des fiches distinctes, réparties dans l'arbre.
      const person = living[Math.floor((index * living.length) / accountCount)];
      accounts.push({ accountId: nextId(), personId: person?.id });
    }
    const owner = accounts[0];
    if (owner === undefined) throw new Error('A generated tree has an owner');
    const author = () => random.pick(accounts).accountId;

    const tree: Tree = {
      id: treeId,
      name: `Famille ${generateSurname(random)}`,
      language: random.chance(0.7) ? 'fr' : 'en',
      nameOrder: random.chance(0.5) ? 'given_first' : 'surname_first',
      ownerAccountId: owner.accountId,
      settings: { mapEnabled: random.chance(0.8) },
    };
    const data = emptyTreeData(tree);

    const placeCount = Math.max(3, Math.floor(size / 100));
    for (let index = 0; index < placeCount; index += 1) {
      data.places.push({
        id: nextId(),
        treeId,
        name: generatePlaceName(random),
        formerNames: [],
        ...(random.chance(0.8) ? { country: 'CM' } : {}),
      });
    }
    const placeId = (): Place['id'] => random.pick(data.places).id;

    const unionIds = new Map<UnionInfo, Id>();
    for (const union of unions) {
      unionIds.set(union, union.id);
      const [a, b] = union.spouses;
      data.unions.push({
        id: union.id,
        treeId,
        spouses: [
          { personId: a.id, rank: union.ranks[0] },
          { personId: b.id, rank: union.ranks[1] },
        ],
        type: union.type,
        ...(random.chance(0.6) ? { start: dateText(random, union.startYear) } : {}),
        ...(union.endYear === undefined ? {} : { end: dateText(random, union.endYear) }),
        ...(union.endReason === undefined ? {} : { endReason: union.endReason }),
        ...(union.simultaneity === undefined ? {} : { simultaneity: union.simultaneity }),
        ...(union.simultaneity === 'simultaneous' && random.chance(0.3)
          ? { declaredOption: 'polygamy' as const }
          : {}),
        ...(random.chance(0.1) ? { placeId: placeId() } : {}),
      });
      // Nom d'usage pris au mariage, parfois (les épouses gardent le plus souvent le leur).
      const wife = a.gender === 'female' ? a : b.gender === 'female' ? b : undefined;
      const husband = wife === a ? b : a;
      if (
        wife?.nature === 'known' &&
        husband.surname !== undefined &&
        wife.names[0]?.givenNames !== undefined &&
        random.chance(0.15)
      ) {
        wife.names.push({
          type: 'usage',
          givenNames: wife.names[0].givenNames,
          surname: husband.surname,
          start: union.startYear,
        });
      }
      if (random.chance(0.05)) {
        data.facts.push({
          id: nextId(),
          treeId,
          subject: { kind: 'union', unionId: union.id },
          type: 'other',
          value: 'Dot remise',
          authorAccountId: author(),
        });
      }
    }

    for (const info of people) {
      data.people.push({
        id: info.id,
        treeId,
        nature: info.nature,
        gender: info.gender,
        vitalStatus:
          info.nature === 'placeholder'
            ? 'unknown'
            : info.deathYear !== undefined
              ? 'deceased'
              : info.birthYear < CURRENT_YEAR - 100
                ? 'unknown'
                : 'living',
        version: 0,
      });
      for (const spec of info.names) {
        data.names.push({
          id: nextId(),
          treeId,
          personId: info.id,
          type: spec.type,
          ...(spec.givenNames === undefined ? {} : { givenNames: spec.givenNames }),
          ...(spec.surname === undefined ? {} : { surname: spec.surname }),
          ...(spec.displayForm === undefined ? {} : { displayForm: spec.displayForm }),
          ...(spec.start === undefined ? {} : { start: dateText(random, spec.start) }),
          authorAccountId: author(),
        });
      }
      if (info.nature !== 'known') continue;
      if (random.chance(0.7)) {
        data.facts.push({
          id: nextId(),
          treeId,
          subject: { kind: 'person', personId: info.id },
          type: 'birth',
          date: dateText(random, info.birthYear),
          ...(random.chance(0.5) ? { placeId: placeId() } : {}),
          authorAccountId: author(),
        });
      }
      if (info.deathYear !== undefined && random.chance(0.6)) {
        data.facts.push({
          id: nextId(),
          treeId,
          subject: { kind: 'person', personId: info.id },
          type: 'death',
          date: dateText(random, info.deathYear),
          authorAccountId: author(),
        });
        if (random.chance(0.1)) {
          data.facts.push({
            id: nextId(),
            treeId,
            subject: { kind: 'person', personId: info.id },
            type: 'death_cause',
            value: 'Cause générée pour les tests',
            authorAccountId: author(),
          });
        }
      }
      if (random.chance(0.15)) {
        data.facts.push({
          id: nextId(),
          treeId,
          subject: { kind: 'person', personId: info.id },
          type: 'occupation',
          value: random.pick(OCCUPATIONS),
          authorAccountId: author(),
        });
      }
      if (info.generation <= 1 && info.gender === 'male' && random.chance(0.05)) {
        const start = info.birthYear + random.int(30, 50);
        data.titleRoles.push({
          id: nextId(),
          treeId,
          personId: info.id,
          label: random.pick(TITLES),
          start: dateText(random, Math.min(start, CURRENT_YEAR - 1)),
          authorAccountId: author(),
        });
      }
    }

    for (const spec of filiations) {
      const filiation: Filiation = {
        id: nextId(),
        treeId,
        parentId: spec.parent.id,
        childId: spec.child.id,
        type: spec.type,
        certainty: spec.certainty,
        recognitionStatus: spec.recognitionStatus,
        ...(spec.originUnion === undefined ? {} : { originUnionId: spec.originUnion.id }),
      };
      data.filiations.push(filiation);
      // Reconnaissance tardive d'une paternité non officielle, parfois (CL-FAM-13).
      if (spec.recognitionStatus === 'unofficial' && random.chance(0.3)) {
        const fact: Fact = {
          id: nextId(),
          treeId,
          subject: { kind: 'person', personId: spec.child.id },
          type: 'recognition',
          date: dateText(
            random,
            Math.min(spec.child.birthYear + random.int(1, 20), CURRENT_YEAR - 1),
          ),
          filiationId: filiation.id,
          authorAccountId: author(),
        };
        data.facts.push(fact);
      }
    }

    for (const { child, candidate } of candidates) {
      const entry: ParentCandidate = {
        id: nextId(),
        treeId,
        childId: child.id,
        candidateId: candidate.id,
      };
      data.parentCandidates.push(entry);
    }

    for (const born of multipleBirths) {
      const ordered = random.chance(0.5);
      data.multipleBirths.push({
        id: nextId(),
        treeId,
        members: born.map((info, index) => ({
          personId: info.id,
          ...(ordered ? { birthOrder: index + 1 } : {}),
        })),
      });
    }

    for (const { person, reference } of toPlace) {
      const steps = random.int(1, 3);
      const path: KinshipStep[] = [];
      for (let index = 0; index < steps; index += 1) path.push(random.pick(KINSHIP_STEPS));
      data.toPlace.push({
        id: nextId(),
        treeId,
        personId: person.id,
        referencePersonId: reference.id,
        path,
        side: random.pick(['paternal', 'maternal', 'unknown'] as const),
        status: 'open',
      });
    }

    // Objets masqués au hasard : une règle par objet visé, au plus.
    const targets: VisibilityRule['target'][] = [
      ...data.people.map((item) => ({ type: 'person' as const, id: item.id })),
      ...data.unions.map((item) => ({ type: 'union' as const, id: item.id })),
      ...data.filiations.map((item) => ({ type: 'filiation' as const, id: item.id })),
      ...data.facts.map((item) => ({ type: 'fact' as const, id: item.id })),
      ...data.names.map((item) => ({ type: 'name' as const, id: item.id })),
    ];
    for (const target of targets) {
      if (random.chance(rates.hidden)) {
        const base = { id: nextId(), treeId, target, authorAccountId: author() };
        const level = random.pick(['only_me', 'chosen_people', 'branch'] as const);
        if (level === 'only_me') data.visibilityRules.push({ ...base, level });
        else if (level === 'branch') {
          data.visibilityRules.push({
            ...base,
            level,
            branchRootPersonId: random.pick(data.people).id,
          });
        } else {
          const chosen = new Set<Id>();
          const count = random.int(1, Math.min(3, accounts.length));
          while (chosen.size < count) chosen.add(random.pick(accounts).accountId);
          data.visibilityRules.push({ ...base, level, accountIds: [...chosen] });
        }
        features.hiddenObjects += 1;
      } else if (random.chance(rates.hidden / 4)) {
        data.visibilityRules.push({
          id: nextId(),
          treeId,
          target,
          authorAccountId: author(),
          level: 'tree',
        });
      }
    }

    return { ...data, seed: options.seed, accounts, features };
  }
}

/** Tailles des arbres types (TRD, Tests et qualité ; budgets de la section Performance). */
export const REFERENCE_TREE_SIZES = [100, 1000, 5000] as const;
export type ReferenceTreeSize = (typeof REFERENCE_TREE_SIZES)[number];

const referenceTrees = new Map<ReferenceTreeSize, GeneratedTree>();

/**
 * Arbre type de 100, 1 000 ou 5 000 personnes, avec les probabilités par défaut et une graine
 * fixe : le même pour tous les paquets (moteur de parenté, disposition, synchro). Mis en cache.
 */
export function referenceTree(size: ReferenceTreeSize): GeneratedTree {
  let tree = referenceTrees.get(size);
  if (tree === undefined) {
    tree = generateTree({ seed: 20_260_000 + size, size });
    referenceTrees.set(size, tree);
  }
  return tree;
}
