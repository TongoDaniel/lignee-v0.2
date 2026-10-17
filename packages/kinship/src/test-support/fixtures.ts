// Aides de test du moteur de parenté : petits arbres écrits au format des scénarios (noms courts,
// genres, unions, filiations), et vérification indépendante de la forme d'un chemin. Réservé aux
// tests (lit des fichiers via @lignee/domain/test-support), exclu de tsconfig.src.json.
import type { Id } from '@lignee/domain';
import { buildScenarioTree, scenarioTreeSchema, type TreeData } from '@lignee/domain/test-support';

import { createKinshipGraph, type KinshipGraph } from '../graph';
import type { BloodSegment, Relationship } from '../relationship';

export interface Fixture {
  graph: KinshipGraph;
  data: TreeData;
  id: (key: string) => Id;
  keyOf: (id: Id) => string | undefined;
}

export interface FixtureOptions {
  /** Personnes « à compléter » (nature `placeholder`). */
  placeholders?: readonly string[];
  /** Personnes retirées du graphe du lecteur, comme le ferait le filtre de visibilité. */
  hidden?: readonly string[];
  /** Places à compléter dites distinctes d'autres personnes (`distinctFrom`, ADR 0017). */
  distinct?: Readonly<Record<string, readonly string[]>>;
}

/** Petit arbre au format de la section `arbre` des scénarios (test/scenarios/README.md). */
export function fixture(section: unknown, options: FixtureOptions = {}): Fixture {
  const tree = buildScenarioTree(scenarioTreeSchema.parse(section));
  const placeholders = new Set((options.placeholders ?? []).map((key) => tree.id(key)));
  const hidden = new Set((options.hidden ?? []).map((key) => tree.id(key)));
  const data: TreeData = {
    ...tree.data,
    people: tree.data.people.map((person) => {
      if (!placeholders.has(person.id)) return person;
      const key = tree.keyOf(person.id) ?? '';
      const distinct = (options.distinct?.[key] ?? []).map((other) => tree.id(other));
      return {
        ...person,
        nature: 'placeholder' as const,
        ...(distinct.length === 0 ? {} : { distinctFrom: distinct }),
      };
    }),
  };
  // Seules les personnes sont retirées : unions et filiations qui les citent restent, pour
  // vérifier que le moteur ne les traverse jamais (défense en profondeur).
  const graph = createKinshipGraph({
    people: data.people.filter((person) => !hidden.has(person.id)),
    unions: data.unions,
    filiations: data.filiations,
    parentCandidates: data.parentCandidates,
  });
  return { graph, data, id: tree.id, keyOf: tree.keyOf };
}

/**
 * Description courte d'un chemin, en noms courts, pour des attentes lisibles : `2/1[a+b]` pour
 * un segment de sang (générations montées et descendues, ancêtres communs triés par nom),
 * `=x` pour une union vers x.
 */
export function describeRelationship(
  relationship: Relationship,
  keyOf: (id: Id) => string | undefined,
) {
  const key = (id: Id) => keyOf(id) ?? id;
  return relationship.segments
    .map((segment) =>
      segment.kind === 'union'
        ? `=${key(segment.toId)}`
        : `${String(segment.generationsUp)}/${String(segment.generationsDown)}[${segment.commonAncestors
            .map((ancestor) => key(ancestor.personId))
            .sort()
            .join('+')}]`,
    )
    .join(' ');
}

/**
 * Problèmes de forme d'un chemin de `a` vers `b`, vérifiés sans se fier au moteur : segments qui
 * se suivent, filiations et unions présentes dans le graphe et reliant bien les personnes dites,
 * générations comptées juste, aucune personne absente du graphe, chemin simple (aucune personne
 * deux fois), résumé (`degree`, `certainty`, `personIds`…) conforme aux segments.
 */
export function relationshipIssues(
  graph: KinshipGraph,
  relationship: Relationship,
  a: Id,
  b: Id,
): string[] {
  const issues: string[] = [];
  const { segments } = relationship;
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (first?.kind !== 'blood' || last?.kind !== 'blood')
    issues.push('must start and end with blood');
  if (first?.fromId !== a) issues.push('does not start at A');
  if (last?.toId !== b) issues.push('does not end at B');
  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    if (previous !== undefined && previous.toId !== segment.fromId)
      issues.push(`gap before ${String(index)}`);
    if (previous !== undefined && previous.kind === segment.kind)
      issues.push(`no alternation at ${String(index)}`);
  });

  const people: Id[] = [];
  const order = { certain: 0, probable: 1, hypothetical: 2 } as const;
  let weakest = 0;
  let degree = 0;
  const types = new Set<string>();
  const unionIds: Id[] = [];
  let crossings = 0;
  const checkLink = (link: BloodSegment['ascent'][number], where: string) => {
    const filiation = graph.filiation(link.filiationId);
    if (
      filiation?.parentId !== link.parentId ||
      filiation.childId !== link.childId ||
      filiation.type !== link.type ||
      filiation.certainty !== link.certainty
    ) {
      issues.push(`${where}: filiation ${link.filiationId} does not match the graph`);
    }
    weakest = Math.max(weakest, order[link.certainty]);
    types.add(link.type);
  };

  for (const segment of segments) {
    if (segment.kind === 'union') {
      crossings += 1;
      // Toutes les unions présentes entre les deux conjoints, triées, avec leurs rangs.
      const expected = graph
        .unionsOf(segment.fromId)
        .filter((union) => union.spouses.some((spouse) => spouse.personId === segment.toId))
        .map((union) => union.id)
        .sort();
      const listed = segment.unions.map((union) => union.unionId);
      if (listed.length === 0 || JSON.stringify(listed) !== JSON.stringify(expected)) {
        issues.push(`unions between ${segment.fromId} and ${segment.toId} are not all listed`);
      }
      for (const ref of segment.unions) {
        const ranks = new Map(
          graph.union(ref.unionId)?.spouses.map((spouse) => [spouse.personId, spouse.rank]),
        );
        if (ranks.get(segment.fromId) !== ref.fromRank || ranks.get(segment.toId) !== ref.toRank) {
          issues.push(`union ${ref.unionId}: wrong ranks`);
        }
      }
      unionIds.push(...listed);
      continue;
    }
    degree += segment.generationsUp + segment.generationsDown;
    // Montée.
    let current = segment.fromId;
    segment.ascent.forEach((link, index) => {
      checkLink(link, `ascent[${String(index)}]`);
      if (link.childId !== current) issues.push('ascent is not a chain');
      current = link.parentId;
    });
    const belowApexFrom = current;
    // Descente, à partir du bas.
    let currentDown = segment.toId;
    [...segment.descent].reverse().forEach((link, index) => {
      checkLink(link, `descent[${String(index)}]`);
      if (link.childId !== currentDown) issues.push('descent is not a chain');
      currentDown = link.parentId;
    });
    const belowApexTo = currentDown;

    if (segment.commonAncestors.length === 0) issues.push('no common ancestor');
    for (const ancestor of segment.commonAncestors) {
      if (segment.generationsUp === 0) {
        if (ancestor.fromSide !== undefined || ancestor.personId !== segment.fromId) {
          issues.push('direct line from the start: the start is the ancestor');
        }
      } else if (ancestor.fromSide === undefined) {
        issues.push('missing fromSide');
      } else {
        checkLink(ancestor.fromSide, 'fromSide');
        if (
          ancestor.fromSide.childId !== belowApexFrom ||
          ancestor.fromSide.parentId !== ancestor.personId
        ) {
          issues.push('fromSide does not reach the ancestor');
        }
      }
      if (segment.generationsDown === 0) {
        if (ancestor.toSide !== undefined || ancestor.personId !== segment.toId) {
          issues.push('direct line to the end: the end is the ancestor');
        }
      } else if (ancestor.toSide === undefined) {
        issues.push('missing toSide');
      } else {
        checkLink(ancestor.toSide, 'toSide');
        if (
          ancestor.toSide.childId !== belowApexTo ||
          ancestor.toSide.parentId !== ancestor.personId
        ) {
          issues.push('toSide does not reach the ancestor');
        }
      }
    }
    const up = segment.generationsUp;
    const down = segment.generationsDown;
    if (segment.ascent.length !== Math.max(up - 1, 0)) issues.push('wrong ascent length');
    if (segment.descent.length !== Math.max(down - 1, 0)) issues.push('wrong descent length');
    const expectedSharing =
      up === 0 && down === 0
        ? 'same_person'
        : up === 0 || down === 0
          ? 'direct_line'
          : segment.commonAncestors.length >= 2
            ? 'full'
            : 'half';
    if (segment.sharing !== expectedSharing)
      issues.push(`sharing ${segment.sharing}, expected ${expectedSharing}`);
    if (expectedSharing === 'same_person' || expectedSharing === 'direct_line') {
      if (segment.commonAncestors.length !== 1) issues.push('a direct line has one apex');
    }
    if (relationship.kind === 'blood' && expectedSharing === 'same_person')
      issues.push('empty blood link');

    const segmentNodes = [
      ...(up === 0 ? [] : [segment.fromId, ...segment.ascent.map((link) => link.parentId)]),
      ...segment.commonAncestors.map((ancestor) => ancestor.personId),
      ...(down === 0
        ? []
        : [
            segment.commonAncestors[0]?.toSide?.childId ?? '',
            ...segment.descent.map((link) => link.childId),
          ]),
    ];
    // Le début d'un segment après une union est déjà compté (fin de l'union) : on ne l'ajoute pas
    // deux fois.
    const fresh =
      people.length > 0 && segmentNodes[0] === people[people.length - 1]
        ? segmentNodes.slice(1)
        : segmentNodes;
    people.push(...fresh);
  }

  if (new Set(people).size !== people.length) issues.push('the path visits a person twice');
  for (const person of people) if (!graph.has(person)) issues.push(`absent person ${person}`);
  const sortedPeople = [...new Set(people)].sort();
  if (JSON.stringify(sortedPeople) !== JSON.stringify(relationship.personIds))
    issues.push('wrong personIds');
  if (relationship.degree !== degree) issues.push('wrong degree');
  if (relationship.unionCount !== crossings) issues.push('wrong unionCount');
  if (JSON.stringify(relationship.unionIds) !== JSON.stringify(unionIds))
    issues.push('wrong unionIds');
  if (relationship.kind !== (crossings === 0 ? 'blood' : 'alliance')) issues.push('wrong kind');
  if (order[relationship.certainty] !== weakest)
    issues.push('certainty is not the weakest of the path');
  if (
    JSON.stringify([...relationship.filiationTypes].sort()) !== JSON.stringify([...types].sort())
  ) {
    issues.push('wrong filiationTypes');
  }
  return issues;
}
