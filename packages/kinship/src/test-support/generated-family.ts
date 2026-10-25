// Un arbre généré (`generateTree` de @lignee/domain, graine figée) réécrit en section `arbre` de
// scénario (test/scenarios/README.md), pour être figé dans le jeu de paires annotées (T-023) :
// le jeu ne dépend plus du générateur, qui peut changer sans fausser les paires. Seule la
// structure lue par le moteur de parenté est gardée : personnes (genre, place à compléter,
// « distincte de »), unions (rangs, dates, motif de fin), filiations (type, certitude), parents
// candidats, réponses de simultanéité et décès datés (ils bornent les unions, ADR 0012). Ni noms
// d'usage, ni lieux, ni règles de visibilité (toutes les personnes sont visibles du lecteur), ni
// type d'union : rien de cela n'entre dans l'attendu structurel. Réservé aux tests.
import type { FuzzyDate, Id } from '@lignee/domain';
import {
  scenarioCertainties,
  scenarioEndReasons,
  scenarioFiliationTypes,
  scenarioQualifiers,
  scenarioSimultaneities,
  type TreeData,
} from '@lignee/domain/test-support';

const GENDER_CODES = { male: 'M', female: 'F', other: 'A', unspecified: 'N' } as const;

function reverse<K extends string, V extends string>(map: Readonly<Record<K, V>>): Map<V, K> {
  return new Map(Object.entries(map).map(([key, value]) => [value as V, key as K]));
}

const QUALIFIERS = reverse(scenarioQualifiers);
const END_REASONS = reverse(scenarioEndReasons);
const FILIATION_TYPES = reverse(scenarioFiliationTypes);
const CERTAINTIES = reverse(scenarioCertainties);
const SIMULTANEITIES = reverse(scenarioSimultaneities);

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Cannot write ${what} in a scenario`);
  return value;
}

/** « 1950 », « 1950-03 », « 1950-03-07 ». */
function bound(value: { year: number; month?: number | undefined; day?: number | undefined }) {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return [
    pad(value.year, 4),
    ...(value.month === undefined ? [] : [pad(value.month, 2)]),
    ...(value.day === undefined ? [] : [pad(value.day, 2)]),
  ].join('-');
}

/** Date floue complète au format `scenarioFuzzyDateSchema`. */
export function scenarioDateOf(date: FuzzyDate): Record<string, string> {
  const qualificatif = need(QUALIFIERS.get(date.qualifier), `qualifier ${date.qualifier}`);
  if (date.qualifier === 'text') return { qualificatif, texte: date.originalText };
  return {
    qualificatif,
    ...(date.precision === 'decade' ? { precision: 'decennie' } : {}),
    ...(date.qualifier === 'between'
      ? { de: bound(date.from), a: bound(date.to) }
      : { date: bound(date.date) }),
    ...(date.originalText === undefined ? {} : { texte: date.originalText }),
    ...(date.calendar === 'hijri' ? { calendrier: 'hegirien' } : {}),
  };
}

function asciiKey(value: string): string {
  const key = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(key) ? key : `p_${key}`;
}

export interface FrozenFamily {
  /** Section `arbre`, prête à écrire en YAML. */
  arbre: Record<string, unknown>;
  /** Nom court de chaque personne de l'arbre généré. */
  keyOf: ReadonlyMap<Id, string>;
}

/**
 * Section `arbre` d'un arbre généré. Nom court : le prénom de naissance sans accents, suffixé
 * d'un numéro s'il est déjà pris (à défaut, un autre prénom saisi, ou `sans_prenom`) ; une place à
 * compléter s'appelle `inconnu`, `inconnue` ou `place`, numérotée.
 */
export function freezeGeneratedFamily(data: TreeData): FrozenFamily {
  const keyOf = new Map<Id, string>();
  const taken = new Set<string>();
  for (const person of data.people) {
    const names = data.names.filter((name) => name.personId === person.id);
    const given = (
      names.find((name) => name.type === 'birth' && name.givenNames) ??
      names.find((name) => name.givenNames)
    )?.givenNames;
    const base =
      given !== undefined
        ? asciiKey(given.split(' ')[0] ?? '')
        : person.nature === 'known'
          ? 'sans_prenom'
          : person.gender === 'male'
            ? 'inconnu'
            : person.gender === 'female'
              ? 'inconnue'
              : 'place';
    let key = base;
    for (let index = 2; taken.has(key); index += 1) key = `${base}_${String(index)}`;
    taken.add(key);
    keyOf.set(person.id, key);
  }
  const key = (id: Id) => need(keyOf.get(id), `person ${id}`);

  const unions = data.unions.map((union) => {
    const [a, b] = union.spouses;
    return {
      conjoints: [key(a.personId), key(b.personId)],
      [`rang_${key(a.personId)}`]: a.rank,
      [`rang_${key(b.personId)}`]: b.rank,
      ...(union.start === undefined ? {} : { debut: scenarioDateOf(union.start) }),
      ...(union.end === undefined ? {} : { fin: scenarioDateOf(union.end) }),
      ...(union.endReason === undefined
        ? {}
        : { motif: need(END_REASONS.get(union.endReason), `end reason ${union.endReason}`) }),
    };
  });
  const spousesOf = (unionId: Id) => {
    const union = need(
      data.unions.find((candidate) => candidate.id === unionId),
      `union ${unionId}`,
    );
    const pair = union.spouses.map((spouse) => spouse.personId);
    const repeated = data.unions.filter((other) =>
      other.spouses.every((spouse) => pair.includes(spouse.personId)),
    );
    if (repeated.length > 1) throw new Error('Two unions between the same spouses');
    return union.spouses.map((spouse) => key(spouse.personId));
  };

  // Les deux parents de même type et de même certitude d'un enfant sur une ligne, sinon une ligne
  // par filiation ; dans l'ordre de l'arbre généré.
  const filiations: Record<string, unknown>[] = [];
  const grouped = new Map<string, { parents: string[]; line: Record<string, unknown> }>();
  for (const filiation of data.filiations) {
    const type = need(FILIATION_TYPES.get(filiation.type), `type ${filiation.type}`);
    const certainty = need(CERTAINTIES.get(filiation.certainty), filiation.certainty);
    const groupKey = `${filiation.childId}|${type}|${certainty}`;
    const group = grouped.get(groupKey);
    if (group !== undefined && group.parents.length === 1) {
      group.parents.push(key(filiation.parentId));
      continue;
    }
    const parents = [key(filiation.parentId)];
    const line = {
      parents,
      enfant: key(filiation.childId),
      ...(type === 'naissance' ? {} : { type }),
      ...(certainty === 'certain' ? {} : { certitude: certainty }),
    };
    grouped.set(groupKey, { parents, line });
    filiations.push(line);
  }

  const candidates = new Map<string, string[]>();
  for (const candidate of data.parentCandidates) {
    const child = key(candidate.childId);
    candidates.set(child, [...(candidates.get(child) ?? []), key(candidate.candidateId)]);
  }

  const placeholders = data.people.filter((person) => person.nature === 'placeholder');
  const distinct = data.people.filter((person) => person.distinctFrom !== undefined);
  const deaths = data.facts.filter(
    (fact) => fact.type === 'death' && fact.subject.kind === 'person' && fact.date !== undefined,
  );

  const arbre: Record<string, unknown> = {
    personnes: data.people.map((person) => `${key(person.id)}/${GENDER_CODES[person.gender]}`),
    ...(placeholders.length === 0 ? {} : { a_completer: placeholders.map((p) => key(p.id)) }),
    ...(distinct.length === 0
      ? {}
      : {
          distinctes: distinct.map((person) => ({
            place: key(person.id),
            de: (person.distinctFrom ?? []).map(key),
          })),
        }),
    ...(unions.length === 0 ? {} : { unions }),
    ...(filiations.length === 0 ? {} : { filiations }),
    ...(candidates.size === 0
      ? {}
      : {
          candidats: [...candidates].map(([enfant, list]) => ({ enfant, candidates: list })),
        }),
    ...(data.simultaneityAnswers.length === 0
      ? {}
      : {
          simultaneites: data.simultaneityAnswers.map((answer) => ({
            unions: answer.unionIds.map(spousesOf),
            reponse: need(SIMULTANEITIES.get(answer.simultaneity), answer.simultaneity),
          })),
        }),
    ...(deaths.length === 0
      ? {}
      : {
          faits: deaths.map((fact) => ({
            personne: key(fact.subject.kind === 'person' ? fact.subject.personId : ''),
            type: 'deces',
            date: scenarioDateOf(need(fact.date, 'death date')),
          })),
        }),
  };
  return { arbre, keyOf };
}
