// Contrôles de cohérence et invariants de l'arbre (PRD, UNI-09, UNI-18 ; TRD, « Modèle de
// données » et « Hors-ligne et synchronisation », point 3 ; cas limites CL-DON-08 à CL-DON-11).
// Seuils, marges des dates approximatives et contrôles ajoutés au cahier : ADR 0011 (proposée).
//
// Fonctions pures : un arbre (ou la partie qu'en voit un lecteur) en entrée, des constats en
// sortie. Un constat a un code stable, traduit par packages/i18n (aucun texte ici), une sévérité
// et les objets en cause. Deux sévérités :
// - `refusal` : invariant dur, la modification est refusée (troisième parent de naissance, cycle
//   de filiation, union d'une personne avec elle-même) ;
// - `warning` : alerte expliquée, qu'on peut passer outre (UNI-18).
// Une alerte ne part que lorsqu'elle est certaine au vu des étendues des dates floues, marge des
// dates « vers » et « calculée » comprise ; une date en texte libre ou d'un autre calendrier ne
// déclenche rien.
//
// Confidentialité (ADR 0011, point 11) : les alertes se calculent sur le téléphone, sur la copie
// du lecteur ; le serveur n'en renvoie jamais. Un refus du serveur (T-060) peut confirmer un lien
// masqué même avec des objets filtrés : il ne sort pas tel quel (refus générique, T-052, T-060).
import { z } from 'zod';

import type { Fact } from './fact';
import { filiationTypeSchema, type Filiation, type FiliationType } from './filiation';
import {
  addMonthsToDay,
  compareCalendarDays,
  fuzzyDateSpan,
  type CalendarDay,
  type FuzzyDate,
} from './fuzzy-date';
import { idSchema, type Id } from './ids';
import type { Person } from './person';
import type { Union } from './union';

// --- Seuils (UNI-18 ; ADR 0011) --------------------------------------------------------------

/** Âge minimal d'un parent biologique à la naissance de son enfant (UNI-18). */
export const MIN_PARENT_AGE_YEARS = 12;
/** Délai maximal entre la mort du père et la naissance de l'enfant (UNI-18). */
export const POSTHUMOUS_BIRTH_MAX_MONTHS = 10;
/**
 * Âge révolu au-delà duquel une durée de vie est signalée (ADR 0011). La même règle partout :
 * 120 ans révolus passent, 121 ans révolus déclenchent l'alerte, que l'âge soit calculé entre la
 * naissance et le décès (ou le jour donné) ou dit (`checkStatedAge`).
 */
export const MAX_PLAUSIBLE_AGE_YEARS = 120;
/**
 * Marge, en années, de chaque côté d'une date approximative (ADR 0011) : « vers » à la décennie,
 * « vers » à une autre précision, « calculée ».
 */
export const APPROXIMATE_DATE_MARGIN_YEARS = {
  aboutDecade: 10,
  about: 5,
  calculated: 2,
} as const;

// --- Constats ------------------------------------------------------------------------------

/** Codes stables des constats ; le texte vient de packages/i18n. */
export const coherenceCodeSchema = z.enum([
  // Refus (invariants durs)
  'third_birth_parent',
  'filiation_cycle',
  'union_with_self',
  // Alertes qu'on peut passer outre (UNI-18)
  'parent_younger_than_child',
  'parent_too_young',
  'born_long_after_father_death',
  'born_after_mother_death',
  // Alertes ajoutées au cahier (ADR 0011)
  'death_before_birth',
  'implausible_age',
]);
export type CoherenceCode = z.infer<typeof coherenceCodeSchema>;

/** Refus : la modification n'est pas enregistrée ; alerte : expliquée, on peut passer outre. */
export const coherenceSeveritySchema = z.enum(['refusal', 'warning']);
export type CoherenceSeverity = z.infer<typeof coherenceSeveritySchema>;

/** Sévérité de chaque code : elle ne dépend que du code. */
export const COHERENCE_SEVERITY: Readonly<Record<CoherenceCode, CoherenceSeverity>> = {
  third_birth_parent: 'refusal',
  filiation_cycle: 'refusal',
  union_with_self: 'refusal',
  parent_younger_than_child: 'warning',
  parent_too_young: 'warning',
  born_long_after_father_death: 'warning',
  born_after_mother_death: 'warning',
  death_before_birth: 'warning',
  implausible_age: 'warning',
};

/** Un objet en cause : son type (les mêmes que les cibles des règles de visibilité) et son id. */
export const coherenceObjectSchema = z.strictObject({
  type: z.enum(['person', 'union', 'filiation', 'fact']),
  id: idSchema,
});
export type CoherenceObject = z.infer<typeof coherenceObjectSchema>;

/**
 * Un constat. `objects` est ordonné pour l'explication : pour un cycle, le chemin (personne,
 * lien, personne… lien qui revient) ; pour une filiation, le parent, l'enfant, le lien puis les
 * faits datés lus ; pour un troisième parent, l'enfant puis chaque parent et son lien.
 * `suggestedFiliationTypes` : les autres types de lien proposés à la place (CL-DON-11).
 */
export const coherenceIssueSchema = z
  .strictObject({
    code: coherenceCodeSchema,
    severity: coherenceSeveritySchema,
    objects: z.array(coherenceObjectSchema),
    suggestedFiliationTypes: z.array(filiationTypeSchema).min(1).optional(),
  })
  .refine((issue) => issue.severity === COHERENCE_SEVERITY[issue.code], {
    message: 'Severity does not match the code',
    path: ['severity'],
  });
export type CoherenceIssue = z.infer<typeof coherenceIssueSchema>;

/** Vrai si l'un des constats est un refus. */
export function hasRefusal(issues: readonly CoherenceIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'refusal');
}

/**
 * Clé stable d'un constat (code et objets en cause) : pour garder qu'on a passé outre une alerte
 * et ne pas la reposer tant que les mêmes objets sont en cause.
 */
export function coherenceIssueKey(issue: Pick<CoherenceIssue, 'code' | 'objects'>): string {
  return [issue.code, ...issue.objects.map((object) => `${object.type}:${object.id}`)].join('|');
}

/** Ce que lisent les contrôles d'un arbre (`TreeData` et la base du téléphone conviennent). */
export interface CoherenceTree {
  readonly people: readonly Pick<Person, 'id' | 'gender' | 'vitalStatus'>[];
  readonly unions: readonly Pick<Union, 'id' | 'spouses'>[];
  readonly filiations: readonly Pick<Filiation, 'id' | 'parentId' | 'childId' | 'type'>[];
  readonly facts: readonly Pick<Fact, 'id' | 'subject' | 'type' | 'date'>[];
}

/** Options des contrôles : la date du jour, en paramètre (aucune horloge lue ici). */
export interface CoherenceOptions {
  /** Jour de référence ; sans lui, l'âge d'une personne vivante n'est pas contrôlé. */
  readonly today?: CalendarDay;
}

function issue(
  code: CoherenceCode,
  objects: CoherenceObject[],
  suggestedFiliationTypes?: FiliationType[],
): CoherenceIssue {
  return {
    code,
    severity: COHERENCE_SEVERITY[code],
    objects,
    ...(suggestedFiliationTypes === undefined ? {} : { suggestedFiliationTypes }),
  };
}

const person = (id: Id): CoherenceObject => ({ type: 'person', id });
const filiationObject = (id: Id): CoherenceObject => ({ type: 'filiation', id });
const factObject = (id: Id): CoherenceObject => ({ type: 'fact', id });

// --- Étendue tolérée d'une date floue ------------------------------------------------------

/** Étendue d'une date : premier et dernier jour possibles, `undefined` du côté ouvert. */
export interface DaySpan {
  readonly earliest: CalendarDay | undefined;
  readonly latest: CalendarDay | undefined;
}

/**
 * Étendue d'une date floue pour les contrôles de cohérence : l'étendue nominale
 * (`fuzzyDateSpan`), élargie de la marge d'une date « vers » ou « calculée » (ADR 0011).
 * `undefined` pour un texte libre ou un autre calendrier : rien n'en est déduit.
 */
export function toleratedSpan(date: FuzzyDate): DaySpan | undefined {
  const span = fuzzyDateSpan(date);
  if (span === undefined || date.qualifier === 'text') return undefined;
  const margin =
    date.qualifier === 'about'
      ? date.precision === 'decade'
        ? APPROXIMATE_DATE_MARGIN_YEARS.aboutDecade
        : APPROXIMATE_DATE_MARGIN_YEARS.about
      : date.qualifier === 'calculated'
        ? APPROXIMATE_DATE_MARGIN_YEARS.calculated
        : 0;
  return {
    earliest: span.earliest && addMonthsToDay(span.earliest, -12 * margin),
    latest: span.latest && addMonthsToDay(span.latest, 12 * margin),
  };
}

/** Vrai si `a` est certainement avant `b` (strictement). */
function before(a: CalendarDay | undefined, b: CalendarDay | undefined): boolean {
  return a !== undefined && b !== undefined && compareCalendarDays(a, b) < 0;
}

// --- Index d'un arbre ----------------------------------------------------------------------

/** Naissance ou décès d'une personne : étendue réunie de ses faits datés, et ces faits. */
export interface LifeEvent extends DaySpan {
  readonly factIds: readonly Id[];
}

function lifeEvent(facts: readonly Pick<Fact, 'id' | 'date'>[]): LifeEvent | undefined {
  let event: { earliest: CalendarDay | undefined; latest: CalendarDay | undefined } | undefined;
  const factIds: Id[] = [];
  for (const fact of facts) {
    const span = fact.date && toleratedSpan(fact.date);
    if (span === undefined) continue;
    factIds.push(fact.id);
    if (event === undefined) {
      event = { ...span };
      continue;
    }
    // Plusieurs versions (V2) : l'étendue qui les contient toutes.
    event.earliest =
      event.earliest && span.earliest && compareCalendarDays(span.earliest, event.earliest) < 0
        ? span.earliest
        : span.earliest && event.earliest;
    event.latest =
      event.latest && span.latest && compareCalendarDays(span.latest, event.latest) > 0
        ? span.latest
        : span.latest && event.latest;
  }
  return event === undefined ? undefined : { ...event, factIds };
}

/** Naissance et décès de chaque personne, lus une fois dans les faits, puis gardés. */
export interface LifeEvents {
  readonly birth: (personId: Id) => LifeEvent | undefined;
  readonly death: (personId: Id) => LifeEvent | undefined;
}

/**
 * Naissances et décès datés d'un ensemble de faits : pour chaque personne, l'étendue tolérée
 * qui réunit ses faits datés de ce type (`undefined` s'il n'y en a pas), et ces faits.
 */
export function createLifeEvents(facts: CoherenceTree['facts']): LifeEvents {
  const birthFacts = new Map<Id, Pick<Fact, 'id' | 'date'>[]>();
  const deathFacts = new Map<Id, Pick<Fact, 'id' | 'date'>[]>();
  for (const fact of facts) {
    if (fact.subject.kind !== 'person') continue;
    if (fact.type === 'birth') push(birthFacts, fact.subject.personId, fact);
    if (fact.type === 'death') push(deathFacts, fact.subject.personId, fact);
  }
  const cache = (byPerson: Map<Id, Pick<Fact, 'id' | 'date'>[]>) => {
    const events = new Map<Id, LifeEvent | undefined>();
    return (personId: Id) => {
      if (!events.has(personId)) events.set(personId, lifeEvent(byPerson.get(personId) ?? []));
      return events.get(personId);
    };
  };
  return { birth: cache(birthFacts), death: cache(deathFacts) };
}

interface TreeIndex extends LifeEvents {
  readonly people: ReadonlyMap<Id, Pick<Person, 'id' | 'gender' | 'vitalStatus'>>;
  readonly filiationsByChild: ReadonlyMap<Id, CoherenceTree['filiations'][number][]>;
  readonly childrenByParent: ReadonlyMap<Id, CoherenceTree['filiations'][number][]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function indexTree(
  tree: CoherenceTree,
  filiations: CoherenceTree['filiations'] = tree.filiations,
  events: LifeEvents = createLifeEvents(tree.facts),
): TreeIndex {
  const filiationsByChild = new Map<Id, CoherenceTree['filiations'][number][]>();
  const childrenByParent = new Map<Id, CoherenceTree['filiations'][number][]>();
  for (const filiation of filiations) {
    push(filiationsByChild, filiation.childId, filiation);
    push(childrenByParent, filiation.parentId, filiation);
  }
  return {
    people: new Map(tree.people.map((entry) => [entry.id, entry])),
    birth: events.birth,
    death: events.death,
    filiationsByChild,
    childrenByParent,
  };
}

// --- Contrôles de dates d'une filiation (UNI-18) -------------------------------------------

/** Liens biologiques : l'âge du parent à la naissance compte. */
const BIOLOGICAL: ReadonlySet<FiliationType> = new Set(['birth', 'donor', 'surrogacy']);
/** Liens pour lesquels un parent plus jeune que l'enfant est signalé (ADR 0011). */
const OLDER_PARENT: ReadonlySet<FiliationType> = new Set([
  'birth',
  'donor',
  'surrogacy',
  'adoptive',
]);

function filiationDateIssues(
  index: TreeIndex,
  filiation: CoherenceTree['filiations'][number],
): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  const parentBirth = index.birth(filiation.parentId);
  const childBirth = index.birth(filiation.childId);
  const objects = (...events: (LifeEvent | undefined)[]) => [
    person(filiation.parentId),
    person(filiation.childId),
    filiationObject(filiation.id),
    ...events.flatMap((event) => event?.factIds.map(factObject) ?? []),
  ];

  if (OLDER_PARENT.has(filiation.type) && before(childBirth?.latest, parentBirth?.earliest)) {
    issues.push(issue('parent_younger_than_child', objects(parentBirth, childBirth)));
  } else if (
    BIOLOGICAL.has(filiation.type) &&
    parentBirth?.earliest !== undefined &&
    before(childBirth?.latest, addMonthsToDay(parentBirth.earliest, 12 * MIN_PARENT_AGE_YEARS))
  ) {
    issues.push(issue('parent_too_young', objects(parentBirth, childBirth)));
  }

  // Naissance après la mort du parent : seulement pour qui a porté l'enfant ou l'a conçu.
  const rule = posthumousRule(index, filiation);
  const parentDeath = rule === undefined ? undefined : index.death(filiation.parentId);
  if (rule === 'mother' && before(parentDeath?.latest, childBirth?.earliest)) {
    issues.push(issue('born_after_mother_death', objects(parentDeath, childBirth)));
  } else if (
    rule === 'father' &&
    parentDeath?.latest !== undefined &&
    before(addMonthsToDay(parentDeath.latest, POSTHUMOUS_BIRTH_MAX_MONTHS), childBirth?.earliest)
  ) {
    issues.push(issue('born_long_after_father_death', objects(parentDeath, childBirth)));
  }
  return issues;
}

/**
 * Règle de naissance posthume d'un lien (ADR 0011). Gestation pour autrui : la personne qui
 * porte l'enfant (règle de la mère). Lien de naissance : la mère (genre « femme ») ne peut pas
 * mourir avant la naissance, sauf si l'enfant a aussi un lien de gestation pour autrui ; tout
 * autre parent de naissance a les 10 mois du père (règle la plus large quand le genre ne dit pas
 * qui a porté l'enfant). Donneur, adoption et autres liens : aucune.
 */
function posthumousRule(
  index: TreeIndex,
  filiation: CoherenceTree['filiations'][number],
): 'mother' | 'father' | undefined {
  if (filiation.type === 'surrogacy') return 'mother';
  if (filiation.type !== 'birth') return undefined;
  if (index.people.get(filiation.parentId)?.gender !== 'female') return 'father';
  const carried = (index.filiationsByChild.get(filiation.childId) ?? []).some(
    (other) => other.type === 'surrogacy',
  );
  return carried ? undefined : 'mother';
}

// --- Contrôles d'une personne (ADR 0011) ---------------------------------------------------

function personIssues(
  index: TreeIndex,
  entry: Pick<Person, 'id' | 'vitalStatus'>,
  options: CoherenceOptions,
): CoherenceIssue[] {
  const birth = index.birth(entry.id);
  const death = index.death(entry.id);
  const objects = (...events: (LifeEvent | undefined)[]) => [
    person(entry.id),
    ...events.flatMap((event) => event?.factIds.map(factObject) ?? []),
  ];
  if (before(death?.latest, birth?.earliest)) {
    return [issue('death_before_birth', objects(birth, death))];
  }
  // Jour du 121e anniversaire au plus tôt : à partir de lui, l'âge révolu dépasse 120 ans.
  const oldest = birth?.latest && addMonthsToDay(birth.latest, 12 * (MAX_PLAUSIBLE_AGE_YEARS + 1));
  if (oldest === undefined) return [];
  // Morte à 121 ans révolus ou plus, ou dite vivante et âgée de 121 ans révolus au jour donné.
  if (death?.earliest !== undefined) {
    return compareCalendarDays(death.earliest, oldest) >= 0
      ? [issue('implausible_age', objects(birth, death))]
      : [];
  }
  if (
    entry.vitalStatus === 'living' &&
    options.today !== undefined &&
    compareCalendarDays(options.today, oldest) >= 0
  ) {
    return [issue('implausible_age', objects(birth))];
  }
  return [];
}

/**
 * Âge dit (« mort à 150 ans ») : une alerte s'il est négatif ou si l'âge révolu dépasse
 * `MAX_PLAUSIBLE_AGE_YEARS`, la même limite que pour un âge calculé depuis les dates (complète
 * `birthDateFromAge`, qui calcule sans juger).
 */
export function checkStatedAge(age: number): CoherenceIssue[] {
  // Âge révolu : « 120 ans et demi » vaut 120 ans, comme dans le calcul depuis les dates.
  return Number.isFinite(age) && age >= 0 && Math.floor(age) <= MAX_PLAUSIBLE_AGE_YEARS
    ? []
    : [issue('implausible_age', [])];
}

// --- Invariants (refus) --------------------------------------------------------------------

/** Types proposés à la place d'un troisième lien de naissance (CL-DON-11). */
const OTHER_FILIATION_TYPES: FiliationType[] = filiationTypeSchema.options.filter(
  (type) => type !== 'birth',
);

function thirdBirthParentIssue(
  childId: Id,
  births: readonly Pick<Filiation, 'id' | 'parentId'>[],
): CoherenceIssue | undefined {
  const parents = new Set(births.map((filiation) => filiation.parentId));
  if (parents.size <= 2) return undefined;
  return issue(
    'third_birth_parent',
    [
      person(childId),
      ...births.flatMap((filiation) => [person(filiation.parentId), filiationObject(filiation.id)]),
    ],
    OTHER_FILIATION_TYPES,
  );
}

/**
 * Chemin de descendance de `from` à `to` (personne, lien, personne…), tous types de lien
 * confondus, par un parcours en largeur ; `undefined` s'il n'y en a pas.
 */
function descentPath(
  index: TreeIndex,
  from: Id,
  to: Id,
  within?: ReadonlySet<Id>,
): CoherenceObject[] | undefined {
  const reachedBy = new Map<Id, CoherenceTree['filiations'][number] | undefined>([
    [from, undefined],
  ]);
  const queue: Id[] = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as Id;
    for (const filiation of index.childrenByParent.get(current) ?? []) {
      const next = filiation.childId;
      if (within !== undefined && !within.has(next)) continue;
      if (next === to) {
        reachedBy.set(to, filiation);
        return rebuildPath(reachedBy, from, to);
      }
      if (reachedBy.has(next)) continue;
      reachedBy.set(next, filiation);
      queue.push(next);
    }
  }
  return undefined;
}

function rebuildPath(
  reachedBy: ReadonlyMap<Id, CoherenceTree['filiations'][number] | undefined>,
  from: Id,
  to: Id,
): CoherenceObject[] {
  const steps: CoherenceObject[] = [];
  let current = to;
  let link = reachedBy.get(current);
  // Le chemin se lit à l'envers ; quand `from` vaut `to`, le premier lien ferme la boucle.
  while (link !== undefined) {
    steps.unshift(person(link.parentId), filiationObject(link.id));
    current = link.parentId;
    if (current === from) break;
    link = reachedBy.get(current);
  }
  return steps;
}

/** Composantes fortement connexes du graphe des filiations (Tarjan, sans récursion). */
function cyclicComponents(
  people: readonly Id[],
  index: TreeIndex,
): { members: Id[]; selfLoop: boolean }[] {
  const order = new Map<Id, number>();
  const low = new Map<Id, number>();
  const onStack = new Set<Id>();
  const stack: Id[] = [];
  const components: { members: Id[]; selfLoop: boolean }[] = [];
  let counter = 0;
  const childrenOf = (id: Id) => (index.childrenByParent.get(id) ?? []).map((f) => f.childId);

  for (const root of people) {
    if (order.has(root)) continue;
    const frames: { id: Id; children: Id[]; next: number }[] = [];
    const open = (id: Id) => {
      order.set(id, counter);
      low.set(id, counter);
      counter += 1;
      stack.push(id);
      onStack.add(id);
      frames.push({ id, children: childrenOf(id), next: 0 });
    };
    open(root);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1] as (typeof frames)[number];
      if (frame.next < frame.children.length) {
        const child = frame.children[frame.next] as Id;
        frame.next += 1;
        if (!order.has(child)) open(child);
        else if (onStack.has(child)) {
          low.set(frame.id, Math.min(low.get(frame.id) ?? 0, order.get(child) ?? 0));
        }
        continue;
      }
      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent !== undefined) {
        low.set(parent.id, Math.min(low.get(parent.id) ?? 0, low.get(frame.id) ?? 0));
      }
      if (low.get(frame.id) === order.get(frame.id)) {
        const members: Id[] = [];
        let member: Id | undefined;
        do {
          member = stack.pop();
          if (member === undefined) break;
          onStack.delete(member);
          members.push(member);
        } while (member !== frame.id);
        const selfLoop = members.length === 1 && childrenOf(frame.id).includes(frame.id);
        if (members.length > 1 || selfLoop)
          components.push({ members: members.reverse(), selfLoop });
      }
    }
  }
  return components;
}

// --- Points d'entrée -----------------------------------------------------------------------

/**
 * Tous les constats d'un arbre : unions d'une personne avec elle-même, cycles de filiation (un
 * constat par groupe de personnes en boucle, avec un chemin qui l'explique), troisièmes parents
 * de naissance, puis alertes de dates de chaque filiation et de chaque personne. Ordre stable :
 * celui des objets dans l'arbre.
 */
export function findCoherenceIssues(
  tree: CoherenceTree,
  options: CoherenceOptions = {},
): CoherenceIssue[] {
  const index = indexTree(tree);
  const issues: CoherenceIssue[] = [];
  for (const union of tree.unions) issues.push(...checkUnion(union));

  // Toutes les personnes citées, même absentes de `people` (une copie partielle).
  const ids = new Set<Id>(tree.people.map((entry) => entry.id));
  for (const filiation of tree.filiations) {
    ids.add(filiation.parentId);
    ids.add(filiation.childId);
  }
  for (const { members, selfLoop } of cyclicComponents([...ids], index)) {
    const start = members[0] as Id;
    const path = selfLoop
      ? (index.childrenByParent.get(start) ?? [])
          .filter((filiation) => filiation.childId === start)
          .slice(0, 1)
          .flatMap((filiation) => [person(start), filiationObject(filiation.id)])
      : descentPath(index, start, start, new Set(members));
    issues.push(issue('filiation_cycle', path ?? members.map(person)));
  }

  for (const [childId, filiations] of index.filiationsByChild) {
    const found = thirdBirthParentIssue(
      childId,
      filiations.filter((filiation) => filiation.type === 'birth'),
    );
    if (found !== undefined) issues.push(found);
  }

  for (const filiation of tree.filiations) issues.push(...filiationDateIssues(index, filiation));
  for (const entry of tree.people) issues.push(...personIssues(index, entry, options));
  return issues;
}

/**
 * Constats que causerait l'ajout (ou la modification, même identifiant) d'une filiation :
 * refus d'un cycle (avec le chemin qui reviendrait sur l'enfant), refus d'un troisième parent de
 * naissance (avec les autres types de lien proposés), puis alertes de dates de ce lien. Pour la
 * saisie sur le téléphone et la vérification d'une mutation par le serveur.
 */
export function checkNewFiliation(
  tree: CoherenceTree,
  filiation: Pick<Filiation, 'id' | 'parentId' | 'childId' | 'type'>,
): CoherenceIssue[] {
  // Index réduit à ce que lit une saisie : les enfants de chacun (pour le chemin), les liens de
  // l'enfant, le parent, et les faits de ces deux personnes.
  const childrenByParent = new Map<Id, CoherenceTree['filiations'][number][]>();
  const ofChild: CoherenceTree['filiations'][number][] = [];
  for (const existing of tree.filiations) {
    if (existing.id === filiation.id) continue;
    push(childrenByParent, existing.parentId, existing);
    if (existing.childId === filiation.childId) ofChild.push(existing);
  }
  const concerned = new Set([filiation.parentId, filiation.childId]);
  const parent = tree.people.find((entry) => entry.id === filiation.parentId);
  const index: TreeIndex = {
    ...createLifeEvents(
      tree.facts.filter(
        (fact) => fact.subject.kind === 'person' && concerned.has(fact.subject.personId),
      ),
    ),
    people: new Map(parent === undefined ? [] : [[parent.id, parent]]),
    filiationsByChild: new Map([[filiation.childId, [...ofChild, filiation]]]),
    childrenByParent,
  };
  const issues: CoherenceIssue[] = [];

  if (filiation.parentId === filiation.childId) {
    issues.push(
      issue('filiation_cycle', [person(filiation.childId), filiationObject(filiation.id)]),
    );
  } else {
    const path = descentPath(index, filiation.childId, filiation.parentId);
    if (path !== undefined) {
      issues.push(
        issue('filiation_cycle', [
          ...path,
          person(filiation.parentId),
          filiationObject(filiation.id),
        ]),
      );
    }
  }

  if (filiation.type === 'birth') {
    const births = ofChild.filter((existing) => existing.type === 'birth');
    const found = thirdBirthParentIssue(filiation.childId, [...births, filiation]);
    if (found !== undefined) issues.push(found);
  }

  issues.push(...filiationDateIssues(index, filiation));
  return issues;
}

/** Refus d'une union d'une personne avec elle-même (le schéma le refuse aussi). */
export function checkUnion(union: Pick<Union, 'id' | 'spouses'>): CoherenceIssue[] {
  const [first, second] = union.spouses;
  return first.personId === second.personId
    ? [issue('union_with_self', [{ type: 'union', id: union.id }, person(first.personId)])]
    : [];
}

/**
 * Alertes de dates qui touchent une personne : sa propre vie (décès avant la naissance, âge
 * invraisemblable), et chaque filiation dont elle est le parent ou l'enfant. Après la saisie
 * d'une naissance ou d'un décès.
 */
export function checkPersonDates(
  tree: CoherenceTree,
  personId: Id,
  options: CoherenceOptions = {},
): CoherenceIssue[] {
  const index = indexTree(tree);
  const entry = index.people.get(personId);
  const issues: CoherenceIssue[] = entry === undefined ? [] : personIssues(index, entry, options);
  const links = [
    ...(index.filiationsByChild.get(personId) ?? []),
    ...(index.childrenByParent.get(personId) ?? []),
  ];
  for (const filiation of links) issues.push(...filiationDateIssues(index, filiation));
  return issues;
}
