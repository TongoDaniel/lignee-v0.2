// Propriétés des contrôles de cohérence (T-007) sur des arbres générés (polygamie, lévirat,
// sororat, implexe, places à compléter, objets masqués) et sur des dates floues générées :
// - aucun refus sur un arbre valide, et chaque constat désigne des objets de l'arbre ;
// - un arbre volontairement fautif (cycle, troisième parent de naissance) est toujours refusé ;
// - une alerte de date n'est jamais fausse : tout jour possible des dates la confirme ;
// - la simultanéité déduite est confirmée par tout jour possible, et chaque question, une fois
//   répondue, ne revient pas ;
// - « présumée vivante » protège : jamais « non vivante » si la personne peut avoir moins de 100 ans ;
// - mesure sur l'arbre type de 5 000 personnes.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  checkNewFiliation,
  coherenceIssueSchema,
  findCoherenceIssues,
  hasRefusal,
  MIN_PARENT_AGE_YEARS,
  POSTHUMOUS_BIRTH_MAX_MONTHS,
  type CoherenceIssue,
} from '../coherence';
import type { Fact } from '../fact';
import type { Filiation, FiliationType } from '../filiation';
import {
  addMonthsToDay,
  compareCalendarDays,
  fuzzyDateSpan,
  type CalendarDay,
  type FuzzyDate,
} from '../fuzzy-date';
import type { Id } from '../ids';
import type { Gender } from '../person';
import { treeArbitrary } from '../test-support/arbitraries';
import { fuzzyDateArbitrary } from '../test-support/fuzzy-date-arbitrary';
import type { TreeData } from '../test-support/tree-data';
import { generateTree, referenceTree } from '../test-support/tree-generator';
import type { Union, UnionSimultaneity } from '../union';
import {
  answerSimultaneity,
  resolveSimultaneity,
  simultaneityFromDates,
  simultaneityQuestions,
} from '../union-simultaneity';
import { assessVitalStatus, assessVitalStatuses } from '../vital-status';

// --- Jours concrets ------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function dayNumber(day: CalendarDay): number {
  const date = new Date(0);
  date.setUTCFullYear(day.year, day.month - 1, day.day);
  return Math.round(date.getTime() / MS_PER_DAY);
}

function fromNumber(number: number): CalendarDay {
  const date = new Date(number * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * Un jour possible d'une date floue, tiré dans son étendue nominale (sans marge) ; un côté ouvert
 * s'étend sur 150 ans. `undefined` pour un texte libre ou un autre calendrier.
 */
function possibleDay(date: FuzzyDate | undefined, draw: number): CalendarDay | undefined {
  const span = date && fuzzyDateSpan(date);
  if (span === undefined || (span.earliest === undefined && span.latest === undefined)) {
    return undefined;
  }
  const low =
    span.earliest === undefined
      ? dayNumber(span.latest as CalendarDay) - 150 * 365
      : dayNumber(span.earliest);
  const high =
    span.latest === undefined
      ? dayNumber(span.earliest as CalendarDay) + 150 * 365
      : dayNumber(span.latest);
  return fromNumber(low + Math.floor(draw * (high - low + 1)));
}

const cmp = compareCalendarDays;

// --- Arbres --------------------------------------------------------------------------------

const objectIds = (tree: TreeData) =>
  new Set<Id>([
    ...tree.people.map((entry) => entry.id),
    ...tree.unions.map((entry) => entry.id),
    ...tree.filiations.map((entry) => entry.id),
    ...tree.facts.map((entry) => entry.id),
  ]);

/** Un cycle expliqué : personne, lien, personne… chaque lien va de la personne qui le précède à la suivante, et le dernier revient sur la première. */
function expectClosedPath(issue: CoherenceIssue, filiations: readonly Filiation[]) {
  const byId = new Map(filiations.map((filiation) => [filiation.id, filiation]));
  const { objects } = issue;
  expect(objects.length % 2).toBe(0);
  for (let index = 0; index < objects.length; index += 2) {
    const from = objects[index];
    const link = byId.get(objects[index + 1]?.id ?? '');
    const to = objects[(index + 2) % objects.length];
    expect(from?.type).toBe('person');
    expect(link).toBeDefined();
    expect(link?.parentId).toBe(from?.id);
    expect(link?.childId).toBe(to?.id);
  }
}

/** Descendants de `id`, tous types de lien. */
function descendants(tree: TreeData, id: Id): Set<Id> {
  const result = new Set<Id>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop() as Id;
    for (const filiation of tree.filiations) {
      if (filiation.parentId === current && !result.has(filiation.childId)) {
        result.add(filiation.childId);
        queue.push(filiation.childId);
      }
    }
  }
  return result;
}

describe('arbres générés valides', () => {
  it('aucun refus, aucune fausse alerte de cycle ; chaque constat est bien formé et vise des objets de l’arbre (500 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 150, rates: 'varied' }), (tree) => {
        const issues = findCoherenceIssues(tree);
        expect(hasRefusal(issues)).toBe(false);
        const ids = objectIds(tree);
        for (const found of issues) {
          expect(coherenceIssueSchema.parse(found)).toEqual(found);
          for (const object of found.objects) expect(ids.has(object.id)).toBe(true);
        }
        // Chaque filiation existante, revérifiée comme si on la saisissait, n'est pas refusée.
        for (const filiation of tree.filiations.slice(0, 20)) {
          expect(hasRefusal(checkNewFiliation(tree, filiation))).toBe(false);
        }
      }),
      { numRuns: 500 },
    );
  }, 180_000);

  it('les dates du générateur, plausibles par construction, ne déclenchent aucune alerte (300 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ maxSize: 200 }), (tree) => {
        expect(findCoherenceIssues(tree)).toEqual([]);
      }),
      { numRuns: 300 },
    );
  }, 120_000);
});

describe('arbres générés volontairement fautifs', () => {
  it('un lien d’un descendant vers son ancêtre est refusé, avec un chemin qui revient sur l’enfant (500 arbres)', () => {
    fc.assert(
      fc.property(
        treeArbitrary({ minSize: 10, maxSize: 150, rates: 'varied' }),
        fc.nat(),
        fc.constantFrom<FiliationType>('birth', 'adoptive', 'raised', 'fostered', 'guardian'),
        (tree, pick, type) => {
          const ancestors = tree.filiations.map((filiation) => filiation.parentId);
          if (ancestors.length === 0) return;
          const ancestor = ancestors[pick % ancestors.length] as Id;
          const below = [...descendants(tree, ancestor)];
          const descendant = below[pick % below.length] as Id;
          const back: Filiation = {
            id: `0190a000-0000-7000-8000-${String(pick % 1e12).padStart(12, '0')}`,
            treeId: tree.tree.id,
            parentId: descendant,
            childId: ancestor,
            type,
            certainty: 'certain',
            recognitionStatus: 'unknown',
          };
          const refused = checkNewFiliation(tree, back).filter(
            (found) => found.code === 'filiation_cycle',
          );
          expect(refused).toHaveLength(1);
          expectClosedPath(refused[0] as CoherenceIssue, [...tree.filiations, back]);
          expect(refused[0]?.objects[0]).toEqual({ type: 'person', id: ancestor });

          const filiations = [...tree.filiations, back];
          const inTree = findCoherenceIssues({ ...tree, filiations }).filter(
            (found) => found.code === 'filiation_cycle',
          );
          expect(inTree.length).toBeGreaterThanOrEqual(1);
          for (const found of inTree) expectClosedPath(found, filiations);
        },
      ),
      { numRuns: 500 },
    );
  }, 180_000);

  it('un troisième parent de naissance est refusé ; le même lien d’un autre type ne l’est pas pour cette raison (500 arbres)', () => {
    fc.assert(
      fc.property(treeArbitrary({ minSize: 10, maxSize: 150 }), fc.nat(), (tree, pick) => {
        const counts = new Map<Id, Set<Id>>();
        for (const filiation of tree.filiations) {
          if (filiation.type !== 'birth') continue;
          counts.set(
            filiation.childId,
            (counts.get(filiation.childId) ?? new Set()).add(filiation.parentId),
          );
        }
        const children = [...counts].filter(([, parents]) => parents.size === 2);
        if (children.length === 0) return;
        const [child, parents] = children[pick % children.length] as [Id, Set<Id>];
        const strangers = tree.people.filter(
          (entry) => entry.id !== child && !parents.has(entry.id),
        );
        const stranger = strangers[pick % strangers.length];
        if (stranger === undefined) return;
        const link = (type: FiliationType): Filiation => ({
          id: '0190a000-0000-7000-8000-00000000abcd',
          treeId: tree.tree.id,
          parentId: stranger.id,
          childId: child,
          type,
          certainty: 'certain',
          recognitionStatus: 'unknown',
        });
        const third = checkNewFiliation(tree, link('birth'));
        expect(third.map((found) => found.code)).toContain('third_birth_parent');
        expect(hasRefusal(third)).toBe(true);
        for (const type of ['adoptive', 'raised', 'fostered', 'guardian'] as const) {
          expect(checkNewFiliation(tree, link(type)).map((found) => found.code)).not.toContain(
            'third_birth_parent',
          );
        }
        expect(
          findCoherenceIssues({ ...tree, filiations: [...tree.filiations, link('birth')] }).map(
            (found) => found.code,
          ),
        ).toContain('third_birth_parent');
      }),
      { numRuns: 500 },
    );
  }, 180_000);
});

// --- Dates floues : une alerte n'est jamais fausse -----------------------------------------

const TREE = generateTree({ seed: 3, size: 2 });
const [PARENT, CHILD] = TREE.people as [TreeData['people'][number], TreeData['people'][number]];

function fact(id: string, personId: Id, type: 'birth' | 'death', date: FuzzyDate): Fact {
  return {
    id: `0190a000-0000-7000-8000-${id.padStart(12, '0')}`,
    treeId: TREE.tree.id,
    subject: { kind: 'person', personId },
    type,
    date,
    authorAccountId: TREE.tree.ownerAccountId,
  };
}

const dates = fuzzyDateArbitrary({ minYear: 1900, maxYear: 2000, withText: true });

describe('dates floues générées', () => {
  it('chaque alerte de filiation est confirmée par tous les jours possibles des dates ; avec des jours exacts, la règle et l’alerte coïncident (5 000 tirages)', () => {
    fc.assert(
      fc.property(
        dates,
        dates,
        dates,
        fc.constantFrom<Gender>('female', 'male', 'other'),
        fc.constantFrom<FiliationType>('birth', 'donor', 'surrogacy', 'adoptive', 'raised'),
        fc.array(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), {
          minLength: 3,
          maxLength: 3,
        }),
        (parentBirth, parentDeath, childBirth, gender, type, draws) => {
          const filiation: Filiation = {
            id: '0190a000-0000-7000-8000-0000000000f1',
            treeId: TREE.tree.id,
            parentId: PARENT.id,
            childId: CHILD.id,
            type,
            certainty: 'certain',
            recognitionStatus: 'unknown',
          };
          const tree = {
            people: [
              { ...PARENT, gender },
              { ...CHILD, vitalStatus: 'unknown' as const },
            ],
            unions: [],
            filiations: [filiation],
            facts: [
              fact('1', PARENT.id, 'birth', parentBirth),
              fact('2', PARENT.id, 'death', parentDeath),
              fact('3', CHILD.id, 'birth', childBirth),
            ],
          };
          const found = new Set(
            findCoherenceIssues(tree)
              .filter((issue) => issue.objects.some((object) => object.id === filiation.id))
              .map((issue) => issue.code),
          );
          const pb = possibleDay(parentBirth, draws[0] as number);
          const pd = possibleDay(parentDeath, draws[1] as number);
          const cb = possibleDay(childBirth, draws[2] as number);
          if (found.has('parent_younger_than_child')) {
            expect(pb && cb && cmp(pb, cb) > 0).toBe(true);
          }
          if (found.has('parent_too_young')) {
            expect(pb && cb && cmp(cb, addMonthsToDay(pb, 12 * MIN_PARENT_AGE_YEARS)) < 0).toBe(
              true,
            );
          }
          if (found.has('born_after_mother_death')) {
            expect(pd && cb && cmp(cb, pd) > 0).toBe(true);
          }
          if (found.has('born_long_after_father_death')) {
            expect(pd && cb && cmp(cb, addMonthsToDay(pd, POSTHUMOUS_BIRTH_MAX_MONTHS)) > 0).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 5000 },
    );
  }, 120_000);

  it('avec des jours exacts, l’alerte part dès que la règle est enfreinte (2 000 tirages)', () => {
    const day = fc
      .integer({
        min: dayNumber({ year: 1900, month: 1, day: 1 }),
        max: dayNumber({ year: 2000, month: 12, day: 31 }),
      })
      .map(fromNumber);
    const exact = (value: CalendarDay): FuzzyDate => ({
      qualifier: 'exact',
      precision: 'day',
      date: value,
      calendar: 'gregorian',
    });
    fc.assert(
      fc.property(
        day,
        day,
        day,
        fc.constantFrom<Gender>('female', 'male'),
        (pb, pd, cb, gender) => {
          const filiation: Filiation = {
            id: '0190a000-0000-7000-8000-0000000000f2',
            treeId: TREE.tree.id,
            parentId: PARENT.id,
            childId: CHILD.id,
            type: 'birth',
            certainty: 'certain',
            recognitionStatus: 'unknown',
          };
          const codes = findCoherenceIssues({
            people: [{ ...PARENT, gender }, CHILD],
            unions: [],
            filiations: [filiation],
            facts: [
              fact('1', PARENT.id, 'birth', exact(pb)),
              fact('2', PARENT.id, 'death', exact(pd)),
              fact('3', CHILD.id, 'birth', exact(cb)),
            ],
          }).map((issue) => issue.code);
          const younger = cmp(pb, cb) > 0;
          expect(codes.includes('parent_younger_than_child')).toBe(younger);
          expect(codes.includes('parent_too_young')).toBe(
            !younger && cmp(cb, addMonthsToDay(pb, 12 * MIN_PARENT_AGE_YEARS)) < 0,
          );
          const lateBirth =
            gender === 'female'
              ? cmp(cb, pd) > 0
              : cmp(cb, addMonthsToDay(pd, POSTHUMOUS_BIRTH_MAX_MONTHS)) > 0;
          expect(
            codes.includes(
              gender === 'female' ? 'born_after_mother_death' : 'born_long_after_father_death',
            ),
          ).toBe(lateBirth);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('la simultanéité déduite des dates est confirmée par tous les jours possibles (5 000 tirages)', () => {
    const optional = fc.option(dates, { nil: undefined });
    fc.assert(
      fc.property(
        optional,
        optional,
        optional,
        optional,
        fc.array(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), {
          minLength: 4,
          maxLength: 4,
        }),
        (startA, endA, startB, endB, draws) => {
          const [first, second] = generateTree({ seed: 5, size: 3 }).people;
          if (first === undefined || second === undefined) return;
          const union = (id: string, start?: FuzzyDate, end?: FuzzyDate): Union => ({
            id: `0190a000-0000-7000-8000-${id.padStart(12, '0')}`,
            treeId: TREE.tree.id,
            spouses: [
              { personId: first.id, rank: 1 },
              { personId: second.id, rank: 1 },
            ],
            type: 'unspecified',
            ...(start === undefined ? {} : { start }),
            ...(end === undefined ? {} : { end }),
          });
          const a = union('a', startA, endA);
          const b = union('b', startB, endB);
          const deduced = simultaneityFromDates({ unions: [a, b], facts: [] }, a, b);
          if (deduced === undefined) return;
          const [sa, ea, sb, eb] = [startA, endA, startB, endB].map((date, index) =>
            possibleDay(date, draws[index] as number),
          );
          // Un tirage où une union finirait avant de commencer n'est pas une réalité possible.
          if (sa && ea && cmp(sa, ea) > 0) return;
          if (sb && eb && cmp(sb, eb) > 0) return;
          if (deduced === 'successive') {
            const aThenB = ea !== undefined && sb !== undefined && cmp(ea, sb) <= 0;
            const bThenA = eb !== undefined && sa !== undefined && cmp(eb, sa) <= 0;
            expect(aThenB || bThenA).toBe(true);
          } else {
            // Un début inconnu est au plus tard la fin, une fin inconnue au plus tôt le début :
            // le cas le plus défavorable au chevauchement.
            const [latestA, latestB] = [sa ?? ea, sb ?? eb];
            const [earliestEndA, earliestEndB] = [ea ?? sa, eb ?? sb];
            expect(latestA && earliestEndB && cmp(latestA, earliestEndB) < 0).toBe(true);
            expect(latestB && earliestEndA && cmp(latestB, earliestEndA) < 0).toBe(true);
          }
        },
      ),
      { numRuns: 5000 },
    );
  }, 120_000);
});

describe('questions de simultanéité sur des arbres générés', () => {
  it('une question par personne au plus ; une fois répondue, elle ne revient pas, et la réponse se modifie (500 arbres)', () => {
    fc.assert(
      fc.property(
        treeArbitrary({ maxSize: 150, rates: 'varied' }),
        fc.constantFrom<UnionSimultaneity>('simultaneous', 'successive'),
        (tree, value) => {
          const questions = simultaneityQuestions(tree);
          const asked = questions.map((question) => question.personId);
          expect(new Set(asked).size).toBe(asked.length);
          let unions = tree.unions;
          for (const question of questions) unions = answerSimultaneity(unions, question, value);
          expect(simultaneityQuestions({ ...tree, unions })).toEqual([]);
          // Réponse modifiée : toujours aucune question, et la nouvelle réponse est lue.
          const other: UnionSimultaneity = value === 'simultaneous' ? 'successive' : 'simultaneous';
          for (const question of questions) unions = answerSimultaneity(unions, question, other);
          expect(simultaneityQuestions({ ...tree, unions })).toEqual([]);
          for (const question of questions) {
            const own = unions.filter((union) => question.unionIds.includes(union.id));
            const [a, b] = own;
            if (a === undefined || b === undefined) continue;
            const resolved = resolveSimultaneity({ ...tree, unions }, question.personId, a, b);
            if (resolved.source === 'answer') expect(resolved.value).toBe(other);
          }
        },
      ),
      { numRuns: 500 },
    );
  }, 180_000);
});

describe('présumée vivante sur des dates générées', () => {
  it('jamais « non vivante » par l’âge si un jour possible de naissance est à moins de 100 ans (3 000 tirages)', () => {
    const today = { year: 2026, month: 10, day: 16 };
    fc.assert(
      fc.property(
        fuzzyDateArbitrary({ minYear: 1850, maxYear: 2026, withText: true }),
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (birth, draw) => {
          const tree = {
            people: [{ ...PARENT, vitalStatus: 'unknown' as const }],
            facts: [fact('1', PARENT.id, 'birth', birth)],
          };
          const assessment = assessVitalStatus(tree, PARENT.id, today);
          if (assessment.presumedLiving) return;
          expect(assessment.reason).toBe('born_100_years_ago_or_more');
          const day = possibleDay(birth, draw);
          expect(day && cmp(addMonthsToDay(day, 1200), today) <= 0).toBe(true);
        },
      ),
      { numRuns: 3000 },
    );
  });
});

describe('performance sur l’arbre type de 5 000 personnes', () => {
  // Budget large pour la CI ; la mesure réelle est affichée et reportée dans le README.
  const BUDGET_MS = 2000;

  it(`contrôle complet, questions, présumée vivante et 100 saisies en moins de ${String(BUDGET_MS)} ms chacun`, () => {
    const tree = referenceTree(5000);
    const time = <T>(run: () => T): [T, number] => {
      const started = performance.now();
      const result = run();
      return [result, performance.now() - started];
    };
    const [issues, full] = time(() =>
      findCoherenceIssues(tree, { today: { year: 2026, month: 10, day: 16 } }),
    );
    const [questions, asking] = time(() => simultaneityQuestions(tree));
    const [statuses, living] = time(() =>
      assessVitalStatuses(tree, { year: 2026, month: 10, day: 16 }),
    );
    const [, entries] = time(() => {
      for (const filiation of tree.filiations.slice(0, 100)) checkNewFiliation(tree, filiation);
    });
    console.info(
      `arbre type 5 000 : contrôle complet ${full.toFixed(0)} ms (${String(issues.length)} constats), questions ${asking.toFixed(0)} ms (${String(questions.length)}), présumée vivante ${living.toFixed(0)} ms (${String(statuses.size)}), 100 saisies de filiation ${entries.toFixed(0)} ms`,
    );
    expect(hasRefusal(issues)).toBe(false);
    for (const elapsed of [full, asking, living, entries]) expect(elapsed).toBeLessThan(BUDGET_MS);
  }, 60_000);
});
