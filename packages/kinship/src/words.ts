// Mots d'un lien de parenté (TRD, « Moteur de parenté », question 2 ; PRD, PAR-02 à PAR-08,
// PAR-11) : forme courte (« demi-frère, même père ») et forme expliquée (« fils de votre père et
// de Mariam »). Règles de formulation : ADR 0031. Fonction pure : elle lit un lien présenté
// (`presentRelationships`, ADR 0021) et le graphe du lecteur (genres, parents), et assemble des
// messages de `@lignee/i18n` (espace `kinship`), passés par `t`. Aucun mot n'est écrit ici : la
// langue est celle du traducteur.
//
// Le lien se dit du point de vue de A, à qui l'on parle (« votre père ») : B est, pour A, …
//
// Principe : un lien est une suite de pas, de A vers B (monter vers un parent, descendre vers un
// enfant, passer à un conjoint, passer à un frère ou une sœur au sommet), chacun avec le type de
// sa filiation. La forme courte dit un terme composé quand le chemin en a un (« cousin germain
// par votre père », « belle-sœur », « co-épouse ») ; sinon, et toujours pour la forme expliquée,
// elle dit la chaîne des pas (« fils de l'épouse de votre oncle »). Un lien non biologique n'est
// jamais dit avec un mot de naissance (PAR-06) : son pas porte son type (« père adoptif »,
// « personne qui vous a élevé »).
import type { FiliationType, Gender, Id } from '@lignee/domain';
import type { MessageArgs, MessageKey } from '@lignee/i18n';

import type { KinshipGraph } from './graph';
import type { LineSide, PresentationResult, PresentedLink } from './presentation';
import type { BloodSegment, FiliationLink, Relationship } from './relationship';
import { parentSide, type ParentSide, type SharedParent } from './siblings';

/** Traduction typée de `@lignee/i18n` (`translator.t`). */
export type Translate = <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => string;

/** Ce que les mots lisent, en plus du lien. */
export interface WordsContext {
  /** Graphe du lecteur, déjà filtré : genres, parents. */
  graph: KinshipGraph;
  t: Translate;
  /**
   * Nom affiché d'une personne pour le lecteur (nom d'usage compris, PAR-07), s'il en a un ;
   * `undefined` pour une place à compléter ou une personne sans nom. Sert à la forme expliquée
   * (« fils de votre père et de Mama Rose ») et au côté « par votre parent Veo ».
   */
  nameOf?: (personId: Id) => string | undefined;
}

/** Les deux formes d'un lien (PAR-11). */
export interface LinkWords {
  short: string;
  explained: string;
}

export type ResultWords =
  | { status: 'same_person' | 'none' | 'incomplete'; text: string }
  | {
      status: 'related';
      links: (LinkWords & { rank: PresentedLink['rank'] })[];
      truncated: boolean;
    };

type KinshipKey = Extract<MessageKey, `kinship:${string}`>;
type Params = Readonly<Record<string, string | number>>;

function say(context: WordsContext, key: KinshipKey, params: Params = {}): string {
  // Les paramètres sont vérifiés par les tests (chaque message rendu sans accolade restante) :
  // la signature exacte varie d'un message à l'autre.
  return (context.t as unknown as (key: string, params: Params) => string)(key, params);
}

/** Genre dit par les mots : masculin, féminin, ou forme neutre (autre, non renseigné). */
type WordGender = 'male' | 'female' | 'other';

function wordGender(gender: Gender | undefined): WordGender {
  return gender === 'male' || gender === 'female' ? gender : 'other';
}

function genderOf(context: WordsContext, personId: Id): WordGender {
  return wordGender(context.graph.person(personId)?.gender);
}

const SIDE_GENDER: Readonly<Record<ParentSide, WordGender>> = {
  father: 'male',
  mother: 'female',
  parent: 'other',
};

/** Pas élémentaires (`kinship:step.*`). */
type Step =
  | 'ancestor'
  | 'descendant'
  | 'sibling'
  | 'spouse'
  | 'otherSpouse'
  | 'coSpouse'
  | 'adoptiveParent'
  | 'adoptiveChild'
  | 'raisedBy'
  | 'raisedChild'
  | 'fosteredTo'
  | 'fosteredChild'
  | 'guardian'
  | 'ward'
  | 'donor'
  | 'donorChild'
  | 'carrier'
  | 'carriedChild';

/** Termes composés, dits seulement par rapport à vous (`kinship:term.*`). */
type Term =
  | 'uncle'
  | 'nephew'
  | 'firstCousin'
  | 'cousin'
  | 'bretonUncle'
  | 'bretonNephew'
  | 'secondCousin'
  | 'degreeCousin'
  | 'parentInLaw'
  | 'childInLaw'
  | 'siblingInLaw';

type YouForm = 'you' | 'yourThe' | 'yourOf';
type OtherForm = 'of' | 'theOf' | 'ofOf';
/** Place d'une expression : seule (étiquette), avec son déterminant, ou en complément (« de »). */
type Slot = 'bare' | 'the' | 'of';

const YOU_FORM: Readonly<Record<Slot, YouForm>> = { bare: 'you', the: 'yourThe', of: 'yourOf' };
const OTHER_FORM: Readonly<Record<Slot, OtherForm>> = { bare: 'of', the: 'theOf', of: 'ofOf' };

/** Pas dont la forme expliquée existe seule (lien direct d'une génération). */
const EXPLAINED_STEPS = [
  'ancestor',
  'descendant',
  'adoptiveParent',
  'adoptiveChild',
  'raisedBy',
  'raisedChild',
  'fosteredTo',
  'fosteredChild',
  'guardian',
  'ward',
  'donor',
  'donorChild',
  'carrier',
  'carriedChild',
] as const satisfies readonly Step[];
type ExplainedStep = (typeof EXPLAINED_STEPS)[number];

function isExplainedStep(step: Step | Term): step is ExplainedStep {
  return (EXPLAINED_STEPS as readonly string[]).includes(step);
}

const UP: Readonly<Record<FiliationType, Step>> = {
  birth: 'ancestor',
  adoptive: 'adoptiveParent',
  raised: 'raisedBy',
  fostered: 'fosteredTo',
  guardian: 'guardian',
  donor: 'donor',
  surrogacy: 'carrier',
};

const DOWN: Readonly<Record<FiliationType, Step>> = {
  birth: 'descendant',
  adoptive: 'adoptiveChild',
  raised: 'raisedChild',
  fostered: 'fosteredChild',
  guardian: 'ward',
  donor: 'donorChild',
  surrogacy: 'carriedChild',
};

/** Une expression de la chaîne : un pas ou un terme, vers une personne. */
interface Element {
  kind: 'step' | 'term';
  name: Step | Term;
  /** La personne atteinte par ce pas. */
  personId: Id;
  /** Générations du pas (ancêtre, descendant) ou du terme (oncle : 1, grand-oncle : 2…). */
  generations: number;
  /** Degré civil (`degreeCousin`). */
  degree?: number;
  /** Côté dit après le terme (« par votre père »), pour le premier pas seulement. */
  side?: LineSide;
}

const step = (name: Step, personId: Id, generations = 1): Element => ({
  kind: 'step',
  name,
  personId,
  generations,
});

/** Genre de A, pour l'accord avec « vous » (« qui vous a élevée »). */
function youGender(context: WordsContext, link: PresentedLink): WordGender {
  const from = link.relationships[0]?.segments[0]?.fromId;
  return from === undefined ? 'other' : genderOf(context, from);
}

function startsWithVowel(name: string): boolean {
  return /^[aeiouàâäéèêëîïôöùûüœæ]/iu.test(name);
}

/** « de Vie », « d'Aïcha » (la langue choisit). */
function nameOfPhrase(context: WordsContext, name: string): string {
  return say(context, 'kinship:nameOf', {
    name,
    initial: startsWithVowel(name) ? 'vowel' : 'consonant',
  });
}

function sideText(context: WordsContext, side: LineSide, you: WordGender): string {
  if (side.type !== 'birth') {
    const parent = say(context, `kinship:step.${UP[side.type]}.yourThe` as const, {
      gender: genderOf(context, side.parentId),
      youGender: you,
      generations: 1,
    });
    return say(context, 'kinship:side.plain', { parent });
  }
  const parent = say(context, 'kinship:step.ancestor.yourThe', {
    generations: 1,
    gender: SIDE_GENDER[side.side],
  });
  const name = side.side === 'parent' ? context.nameOf?.(side.parentId) : undefined;
  return name === undefined
    ? say(context, 'kinship:side.plain', { parent })
    : say(context, 'kinship:side.named', { parent, name });
}

/** Une expression dite par rapport à vous (premier pas de la chaîne). */
function renderYou(context: WordsContext, element: Element, slot: Slot, you: WordGender): string {
  const params = {
    gender: genderOf(context, element.personId),
    youGender: you,
    generations: element.generations,
    degree: element.degree ?? 0,
  };
  const form = YOU_FORM[slot];
  const text =
    element.kind === 'step'
      ? say(context, `kinship:step.${element.name as Step}.${form}` as const, params)
      : say(context, `kinship:term.${element.name as Term}.${form}` as const, params);
  return element.side === undefined
    ? text
    : say(context, 'kinship:withSide', { term: text, side: sideText(context, element.side, you) });
}

/** La chaîne `elements` (de A vers B), dite pour sa dernière personne. */
function chainText(
  context: WordsContext,
  elements: readonly Element[],
  slot: Slot,
  you: WordGender,
  named = false,
): string {
  const head = elements.at(-1);
  if (head === undefined) return '';
  if (elements.length === 1) return renderYou(context, head, slot, you);
  const rest = elements.slice(0, -1);
  const previous = rest.at(-1);
  if (previous === undefined) return '';
  const name = named ? context.nameOf?.(previous.personId) : undefined;
  let of: string;
  let who: string;
  if (name === undefined) {
    of = chainText(context, rest, 'of', you);
    who = chainText(context, rest, 'the', you);
  } else if (rest.length === 1) {
    // « fille de votre fille, Nesoine »
    of = say(context, 'kinship:named', { phrase: renderYou(context, previous, 'of', you), name });
    who = say(context, 'kinship:named', { phrase: renderYou(context, previous, 'the', you), name });
  } else {
    // « fille de Vie, sœur de votre père »
    const restBare = chainText(context, rest, 'bare', you);
    of = say(context, 'kinship:explained.ofNamed', {
      nameOf: nameOfPhrase(context, name),
      rest: restBare,
    });
    who = say(context, 'kinship:explained.whoNamed', { name, rest: restBare });
  }
  return say(context, `kinship:step.${head.name as Step}.${OTHER_FORM[slot]}` as const, {
    gender: genderOf(context, head.personId),
    generations: head.generations,
    of,
    who,
    whoGender: genderOf(context, previous.personId),
  });
}

/** Toutes les filiations d'un segment de sang, dans l'ordre du chemin. */
function segmentLinks(segment: BloodSegment): FiliationLink[] {
  return [
    ...segment.ascent,
    ...segment.commonAncestors.flatMap((ancestor) =>
      [ancestor.fromSide, ancestor.toSide].filter((link) => link !== undefined),
    ),
    ...segment.descent,
  ];
}

/** Ajoute des pas de descente, en réunissant les descentes de naissance qui se suivent. */
function pushDescent(elements: Element[], links: readonly FiliationLink[], merge: boolean): void {
  for (const link of links) {
    const last = elements.at(-1);
    if (
      merge &&
      link.type === 'birth' &&
      last?.kind === 'step' &&
      last.name === 'descendant' &&
      last.side === undefined
    ) {
      elements[elements.length - 1] = {
        ...last,
        personId: link.childId,
        generations: last.generations + 1,
      };
    } else {
      elements.push(step(DOWN[link.type], link.childId));
    }
  }
}

/**
 * Pas élémentaires d'un segment de sang : chaque montée (avec son type), le passage d'un frère
 * ou d'une sœur au sommet quand deux ancêtres communs y sont atteints par la naissance, puis la
 * descente (réunie en « petite-fille » si `mergeDescent`).
 */
function bloodSteps(segment: BloodSegment, mergeDescent: boolean): Element[] {
  const elements: Element[] = [];
  const up = segment.generationsUp;
  const down = segment.generationsDown;
  for (const link of segment.ascent) elements.push(step(UP[link.type], link.parentId));
  const tops = segment.commonAncestors;
  const topLinks = tops.flatMap((top) =>
    [top.fromSide, top.toSide].filter((link) => link !== undefined),
  );
  if (up >= 1 && down >= 1 && tops.length >= 2 && topLinks.every((l) => l.type === 'birth')) {
    const below = segment.descent[0]?.parentId ?? segment.toId;
    elements.push(step('sibling', below));
    pushDescent(elements, segment.descent, mergeDescent);
    return elements;
  }
  const [top] = tops;
  if (top?.fromSide !== undefined) elements.push(step(UP[top.fromSide.type], top.personId));
  const descent = [...(top?.toSide === undefined ? [] : [top.toSide]), ...segment.descent];
  pushDescent(elements, descent, mergeDescent && up >= 1);
  return elements;
}

/**
 * Terme composé pour un segment de sang qui part de A (« grand-père », « cousin germain »,
 * « oncle à la mode de Bretagne », « cousine au 8e degré »), avec le côté de A. Seulement si
 * toutes ses filiations sont de naissance, sauf la première montée de A, dite par le côté
 * (« oncle par votre père adoptif ») ; et, pour un collatéral, si la personne visée est un homme
 * ou une femme (sinon, la chaîne de noms épicènes : ADR 0031).
 */
function compoundTerm(
  context: WordsContext,
  segment: BloodSegment,
  side: LineSide | undefined,
): Element | undefined {
  const up = segment.generationsUp;
  const down = segment.generationsDown;
  const links = segmentLinks(segment);
  const [first, ...others] = links;
  if (first === undefined) return undefined;
  const birthAfterFirst = others.every((link) => link.type === 'birth');
  const withSide = (element: Element): Element =>
    side === undefined ? element : { ...element, side };
  if (down === 0) {
    if (up < 2 || !birthAfterFirst) return undefined;
    return withSide(step('ancestor', segment.toId, up));
  }
  if (up === 0) {
    if (down < 2 || first.type !== 'birth' || !birthAfterFirst) return undefined;
    return step('descendant', segment.toId, down);
  }
  if (up === 1 && down === 1) return undefined;
  if (!birthAfterFirst || genderOf(context, segment.toId) === 'other') return undefined;
  const term = (name: Term, generations = 1): Element =>
    withSide({ kind: 'term', name, personId: segment.toId, generations });
  if (down === 1 && up <= 4) return term('uncle', up - 1);
  if (up === 1 && down <= 4) return term('nephew', down - 1);
  if (up === 2 && down === 2) {
    return term(segment.commonAncestors.length >= 2 ? 'firstCousin' : 'cousin');
  }
  if (up === 3 && down === 2) return term('bretonUncle');
  if (up === 2 && down === 3) return term('bretonNephew');
  if (up === 3 && down === 3) return term('secondCousin');
  return { ...term('degreeCousin'), degree: up + down };
}

/** Deux passages d'union de suite : le second conjoint est « l'autre » conjoint. */
function markOtherSpouses(elements: Element[]): Element[] {
  return elements.map((element, index) => {
    const previous = elements[index - 1];
    return element.kind === 'step' &&
      element.name === 'spouse' &&
      previous?.kind === 'step' &&
      previous.name === 'spouse'
      ? { ...element, name: 'otherSpouse' }
      : element;
  });
}

/**
 * Chaîne d'un chemin. `short` : premier segment de sang en terme composé quand il en a un,
 * descentes réunies, et « co-épouse » quand le chemin commence par deux unions établies
 * simultanées. Sinon (forme expliquée) : pas élémentaires.
 */
function pathElements(
  context: WordsContext,
  link: PresentedLink,
  path: Relationship,
  short: boolean,
): Element[] {
  const elements: Element[] = [];
  path.segments.forEach((segment, index) => {
    if (segment.kind === 'union') {
      elements.push(step('spouse', segment.toId));
      return;
    }
    if (segment.generationsUp + segment.generationsDown === 0) return;
    const compound =
      short && index === 0 ? compoundTerm(context, segment, link.fromSide) : undefined;
    if (compound !== undefined) elements.push(compound);
    else elements.push(...bloodSteps(segment, short || segment.generationsUp > 0));
  });
  const marked = markOtherSpouses(elements);
  const [first, second, ...rest] = marked;
  if (
    short &&
    first?.name === 'spouse' &&
    second?.name === 'otherSpouse' &&
    link.alliance?.sharedSpouse?.timing === 'simultaneous' &&
    genderOf(context, second.personId) !== 'other'
  ) {
    return [step('coSpouse', second.personId), ...rest];
  }
  return marked;
}

/** Forme expliquée d'une chaîne : un lien direct a sa phrase, sinon la chaîne nommée. */
function explainedChain(
  context: WordsContext,
  elements: readonly Element[],
  you: WordGender,
): string {
  const [only] = elements;
  if (elements.length === 1 && only !== undefined && isExplainedStep(only.name)) {
    return say(context, `kinship:step.${only.name}.explained` as const, {
      gender: genderOf(context, only.personId),
      youGender: you,
    });
  }
  return chainText(context, elements, 'bare', you, true);
}

/** Un parent de A, dit « votre père », « votre mère adoptive », « votre parent Maette ». */
function yourParent(
  context: WordsContext,
  childId: Id,
  parentId: Id,
  type: FiliationType,
  you: WordGender,
): string {
  const side = parentSide(context.graph, childId, parentId) ?? 'parent';
  const parent = say(context, `kinship:step.${UP[type]}.yourThe` as const, {
    generations: 1,
    gender:
      type === 'birth' || type === 'adoptive' ? SIDE_GENDER[side] : genderOf(context, parentId),
    youGender: you,
  });
  const name = side === 'parent' ? context.nameOf?.(parentId) : undefined;
  return name === undefined ? parent : `${parent} ${name}`;
}

function siblingShort(context: WordsContext, link: PresentedLink, slot: Slot): string {
  const sibling = link.sibling;
  const toId = link.relationships[0]?.segments.at(-1)?.toId;
  if (sibling === undefined || toId === undefined) return '';
  const you = youGender(context, link);
  if (sibling.kind === 'other') {
    return chainText(context, otherSiblingElements(sibling.link.sharedParents), slot, you);
  }
  const terms = {
    birth: { full: 'fullSibling', half: 'halfSibling', full_or_half: 'fullOrHalfSibling' },
    adoption: {
      full: 'adoptedFullSibling',
      half: 'adoptedHalfSibling',
      full_or_half: 'adoptedFullOrHalfSibling',
    },
    birth_and_adoption: {
      full: 'birthAndAdoptionSibling',
      half: 'birthAndAdoptionSibling',
      full_or_half: 'birthAndAdoptionSibling',
    },
  } as const;
  const term = terms[sibling.kind][sibling.sharing];
  return say(context, `kinship:term.${term}.${YOU_FORM[slot]}` as const, {
    gender: genderOf(context, toId),
    side: sibling.link.side ?? 'parent',
  });
}

/** Fratrie par un autre lien que la naissance ou l'adoption : par le parent commun. */
function otherSiblingElements(shared: readonly SharedParent[]): Element[] {
  const [parent] = shared;
  if (parent === undefined) return [];
  return [
    step(UP[parent.fromLink.type], parent.personId),
    step(DOWN[parent.toLink.type], parent.toLink.childId),
  ];
}

function siblingExplained(context: WordsContext, link: PresentedLink): string {
  const sibling = link.sibling;
  const toId = link.relationships[0]?.segments.at(-1)?.toId;
  const fromId = link.relationships[0]?.segments[0]?.fromId;
  if (sibling === undefined || toId === undefined || fromId === undefined) return '';
  const you = youGender(context, link);
  const gender = genderOf(context, toId);
  const shared = sibling.link.sharedParents;
  if (sibling.kind === 'other') {
    return chainText(context, otherSiblingElements(shared), 'bare', you, true);
  }
  const byAdoption = shared.some((parent) => parent.toLink.type === 'adoptive') ? 'yes' : 'no';
  const parentOfA = (parent: SharedParent) =>
    yourParent(context, fromId, parent.personId, parent.fromLink.type, you);
  if (sibling.kind === 'birth_and_adoption') {
    const [birth] = shared;
    const adoptive = sibling.adoptiveParents.map(parentOfA).join(', ');
    return say(context, 'kinship:explained.birthAndAdoptionSibling', {
      gender,
      shared: birth === undefined ? '' : parentOfA(birth),
      adoptive,
    });
  }
  if (sibling.sharing === 'full') {
    // Le père d'abord, puis la mère, puis un parent de genre neutre.
    const order = { father: 0, mother: 1, parent: 2 } as const;
    const sideOf = (parent: SharedParent) =>
      parentSide(context.graph, fromId, parent.personId) ?? 'parent';
    const sorted = [...shared].sort((x, y) => order[sideOf(x)] - order[sideOf(y)]);
    const [p1, p2] = sorted;
    const sides = sorted.map(sideOf);
    const first = p1 === undefined ? undefined : context.nameOf?.(p1.personId);
    const second = p2 === undefined ? undefined : context.nameOf?.(p2.personId);
    if (shared.length !== 2 || p1 === undefined || p2 === undefined) {
      return say(context, 'kinship:explained.fullSiblingUnnamed', { gender, byAdoption });
    }
    // Deux mères, deux pères, ou un parent de genre neutre : « fils de vos parents Ada et Bea ».
    if (sides.every((side) => side === 'parent') && first !== undefined && second !== undefined) {
      return say(context, 'kinship:explained.fullSiblingNamed', {
        gender,
        first,
        second,
        byAdoption,
      });
    }
    return say(context, 'kinship:explained.fullSiblingOf', {
      gender,
      first: parentOfA(p1),
      second: parentOfA(p2),
      byAdoption,
    });
  }
  const [parent] = shared;
  const sharedText = parent === undefined ? '' : parentOfA(parent);
  if (sibling.sharing === 'full_or_half') {
    return say(context, 'kinship:explained.fullOrHalfSibling', {
      gender,
      shared: sharedText,
      byAdoption,
    });
  }
  const other = sibling.link.toOtherParent;
  const otherName =
    other?.status === 'known' || other?.status === 'placeholder'
      ? context.nameOf?.(other.personId)
      : undefined;
  return otherName === undefined
    ? say(context, 'kinship:explained.halfSiblingOtherUnnamed', {
        gender,
        shared: sharedText,
        byAdoption,
      })
    : say(context, 'kinship:explained.halfSibling', {
        gender,
        shared: sharedText,
        otherOf: nameOfPhrase(context, otherName),
        byAdoption,
      });
}

const IN_LAW_TERMS: Readonly<Partial<Record<string, Term>>> = {
  parent_of_spouse: 'parentInLaw',
  spouse_of_child: 'childInLaw',
  sibling_of_spouse: 'siblingInLaw',
  spouse_of_sibling: 'siblingInLaw',
  spouse_of_sibling_of_spouse: 'siblingInLaw',
};

/** Forme courte d'un lien qui n'est pas une fratrie, dans la place `slot`. */
function pathShort(context: WordsContext, link: PresentedLink, slot: Slot): string {
  const [path] = link.relationships;
  if (path === undefined) return '';
  const you = youGender(context, link);
  const toId = path.segments.at(-1)?.toId;
  const alliance = link.alliance;
  if (alliance !== undefined && toId !== undefined) {
    const gender = genderOf(context, toId);
    const inLaw = IN_LAW_TERMS[alliance.kind];
    if (inLaw !== undefined && link.basis === 'birth' && gender !== 'other') {
      return renderYou(
        context,
        { kind: 'term', name: inLaw, personId: toId, generations: 1 },
        slot,
        you,
      );
    }
  }
  return chainText(context, pathElements(context, link, path, true), slot, you);
}

/** « votre mère » : l'autre parent d'un enfant, pour A qui en est l'enfant. */
function otherParentOfYou(context: WordsContext, childId: Id, parentId: Id): string {
  const side = parentSide(context.graph, childId, parentId) ?? 'parent';
  const parent = say(context, 'kinship:step.ancestor.yourThe', {
    generations: 1,
    gender: SIDE_GENDER[side],
  });
  const name = side === 'parent' ? context.nameOf?.(parentId) : undefined;
  return name === undefined ? parent : `${parent} ${name}`;
}

const TIMING_KEYS = {
  simultaneous: 'kinship:explained.otherParentSimultaneous',
  successive: 'kinship:explained.otherParentSuccessive',
  unknown: 'kinship:explained.otherParentUnknown',
} as const;

function pathExplained(context: WordsContext, link: PresentedLink): string {
  const [path] = link.relationships;
  if (path === undefined) return '';
  const you = youGender(context, link);
  const fromId = path.segments[0]?.fromId;
  const toId = path.segments.at(-1)?.toId;
  const elements = pathElements(context, link, path, false);
  const base = explainedChain(context, elements, you);
  const alliance = link.alliance;
  if (alliance === undefined || fromId === undefined || toId === undefined) return base;
  const [crossing] = alliance.crossings;
  switch (alliance.kind) {
    case 'spouse': {
      const spouse = say(context, 'kinship:step.spouse.yourThe', {
        gender: genderOf(context, toId),
      });
      const unions = crossing?.unions ?? [];
      const last = unions.at(-1);
      if (last === undefined || unions.some((union) => union.ending.status === 'no_end_known')) {
        return say(context, 'kinship:explained.spouseNoEnd', { spouse });
      }
      const reason = last.ending.status === 'ended' ? last.ending.reason : 'unspecified';
      return say(context, 'kinship:explained.spouseEnded', { spouse, reason });
    }
    case 'spouse_of_parent': {
      const child = crossing?.fromChild;
      const other = child?.unions[0];
      if (child === undefined || child.timing === 'none' || other === undefined) return base;
      return say(context, TIMING_KEYS[child.timing], {
        link: base,
        otherParent: otherParentOfYou(context, fromId, other.otherParentId),
      });
    }
    case 'child_of_spouse': {
      const child = crossing?.toChild;
      const otherId = child?.unions[0]?.otherParentId;
      const birthParent =
        otherId !== undefined &&
        context.graph
          .parentsOf(toId)
          .some((filiation) => filiation.parentId === otherId && filiation.type === 'birth');
      const otherName = birthParent ? context.nameOf?.(otherId) : undefined;
      if (link.basis !== 'birth' || otherName === undefined || crossing === undefined) return base;
      return say(context, 'kinship:explained.childOfCouple', {
        gender: genderOf(context, toId),
        parent: say(context, 'kinship:step.spouse.yourThe', {
          gender: genderOf(context, crossing.toId),
        }),
        otherOf: nameOfPhrase(context, otherName),
      });
    }
    case 'co_spouse':
      return say(context, 'kinship:explained.coSpouse', { link: base });
    case 'spouse_of_spouse':
      return alliance.sharedSpouse?.timing === 'successive'
        ? say(context, 'kinship:explained.otherSpouseSuccessive', { link: base })
        : say(context, 'kinship:explained.otherSpouseUnknown', { link: base });
    default:
      return base;
  }
}

/** Les deux formes d'un lien présenté (PAR-11), certitude comprise (PAR-08, UNI-10). */
export function describeLink(link: PresentedLink, context: WordsContext): LinkWords {
  const shortIn = (slot: Slot) =>
    link.sibling === undefined ? pathShort(context, link, slot) : siblingShort(context, link, slot);
  const explained =
    link.sibling === undefined ? pathExplained(context, link) : siblingExplained(context, link);
  if (link.certainty === 'certain') return { short: shortIn('bare'), explained };
  const certainty = link.certainty;
  return {
    short: say(context, `kinship:certainty.${certainty}`, { link: shortIn('the') }),
    explained: say(context, `kinship:explained.${certainty}`, { text: explained }),
  };
}

/** Les mots d'une réponse : chaque lien, le principal puis les autres (PAR-05). */
export function describeResult(result: PresentationResult, context: WordsContext): ResultWords {
  switch (result.status) {
    case 'same_person':
      return { status: result.status, text: say(context, 'kinship:result.samePerson') };
    case 'none':
      // « Lien non disponible », sans autre indice (PAR-09, CL-SEC-02).
      return { status: result.status, text: say(context, 'kinship:result.none') };
    case 'incomplete':
      return { status: result.status, text: say(context, 'kinship:result.incomplete') };
    case 'related':
      return {
        status: 'related',
        links: result.links.map((link) => ({ rank: link.rank, ...describeLink(link, context) })),
        truncated: result.truncated,
      };
  }
}

/** « aussi : cousin par votre père » (PAR-05), pour un lien qui n'est pas le principal. */
export function alsoText(words: LinkWords, context: WordsContext): string {
  return say(context, 'kinship:also', { link: words.short });
}
