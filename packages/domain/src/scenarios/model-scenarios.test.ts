// Cas limites cités par T-004, joués pour ce qui relève du modèle : chaque scénario est lu dans
// test/scenarios/<ID>.yaml, converti en objets du modèle, puis validé par les schémas.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { findMultipleBirth, multipleBirthSchema, titleRoleSchema } from '../fact';
import { filiationSchema } from '../filiation';
import { fuzzyDateFromText } from '../fuzzy-date';
import {
  formatName,
  nameSchema,
  personRecordSchema,
  personSchema,
  type Name,
  type Person,
} from '../person';
import { unionSchema, type Union } from '../union';
import { nameFromScenario, testTree, type TestTree } from '../test-support/fixtures';
import {
  loadScenario,
  scenarioNameSchema,
  scenarioPersonSchema,
  type ScenarioName,
} from '../test-support/scenario';

const unionLineSchema = z.looseObject({ conjoints: z.tuple([z.string(), z.string()]) });
const filiationLineSchema = z.strictObject({
  parents: z.array(z.string()).min(1).max(2),
  enfant: z.string(),
});

const treeSection = z.looseObject({
  personnes: z.array(scenarioPersonSchema),
  noms: z.array(scenarioNameSchema).default([]),
  unions: z.array(unionLineSchema).default([]),
  filiations: z.array(filiationLineSchema).default([]),
});

/** Personnes, noms, unions et filiations d'un scénario, validés par les schémas du modèle. */
function buildTree(tree: TestTree, section: z.infer<typeof treeSection>) {
  const names = section.noms.map((line: ScenarioName) =>
    nameSchema.parse(nameFromScenario(tree, line)),
  );
  const people = new Map<string, Person>();
  for (const { key, gender } of section.personnes) {
    const person = personSchema.parse({
      id: tree.personId(key),
      treeId: tree.treeId,
      nature: 'known',
      gender,
    });
    people.set(key, person);
  }
  const unions: Union[] = section.unions.map((line) => {
    const [a, b] = line.conjoints;
    const rank = (key: string) => z.int().parse(line[`rang_${key}`]);
    return unionSchema.parse({
      id: tree.nextId(),
      treeId: tree.treeId,
      spouses: [
        { personId: tree.personId(a), rank: rank(a) },
        { personId: tree.personId(b), rank: rank(b) },
      ],
    });
  });
  const filiations = section.filiations.flatMap((line) =>
    line.parents.map((parent) =>
      filiationSchema.parse({
        id: tree.nextId(),
        treeId: tree.treeId,
        parentId: tree.personId(parent),
        childId: tree.personId(line.enfant),
        type: 'birth',
        certainty: 'certain',
      }),
    ),
  );
  return { people, names, unions, filiations };
}

function namesOf(tree: TestTree, key: string, names: readonly Name[]): Name[] {
  return names.filter((name) => name.personId === tree.personId(key));
}

describe('CL-POL-15 — épouses qui gardent leur nom, enfants sans le nom du père', () => {
  const scenario = loadScenario(
    'CL-POL-15',
    z.looseObject({
      arbre: treeSection,
      attendu: z.object({ noms_de_famille: z.record(z.string(), z.array(z.string())) }),
    }),
  );

  it('enregistre la famille polygame et garde à chacun les seuls noms saisis pour lui', () => {
    const tree = testTree();
    const { people, names, unions, filiations } = buildTree(tree, scenario.arbre);
    expect(people.size).toBe(5);
    expect(unions).toHaveLength(2);
    expect(filiations).toHaveLength(4);

    for (const [key, surnames] of Object.entries(scenario.attendu.noms_de_famille)) {
      expect(namesOf(tree, key, names).map((name) => name.surname)).toEqual(surnames);
      // La fiche se valide avec ses seuls noms : rien n'est hérité du conjoint ni du père.
      const person = people.get(key);
      expect(person).toBeDefined();
      expect(() =>
        personRecordSchema.parse({ person, names: namesOf(tree, key, names) }),
      ).not.toThrow();
    }
  });
});

describe('CL-DON-01 — nom donné dans l’ordre NOM Prénom', () => {
  const scenario = loadScenario(
    'CL-DON-01',
    z.looseObject({
      arbre: treeSection,
      attendu: z.object({
        champs: z.object({ prenoms: z.string(), nom: z.string() }),
        affichage: z.object({ nom_puis_prenoms: z.string(), prenoms_puis_nom: z.string() }),
      }),
    }),
  );

  it('garde prénoms et nom dans deux champs, affichés dans l’ordre réglé par l’arbre', () => {
    const tree = testTree();
    const { names } = buildTree(tree, scenario.arbre);
    const [name] = names;
    expect(name?.givenNames).toBe(scenario.attendu.champs.prenoms);
    expect(name?.surname).toBe(scenario.attendu.champs.nom);
    if (name === undefined) throw new Error('missing name');
    expect(formatName(name, 'surname_first')).toBe(scenario.attendu.affichage.nom_puis_prenoms);
    expect(formatName(name, 'given_first')).toBe(scenario.attendu.affichage.prenoms_puis_nom);
  });
});

describe('CL-DON-02 — une seule forme de nom, sans nom de famille', () => {
  const scenario = loadScenario(
    'CL-DON-02',
    z.looseObject({
      arbre: treeSection,
      attendu: z.object({ valide: z.literal(true), affichage: z.record(z.string(), z.string()) }),
    }),
  );

  it('accepte le nom tel quel, sans nom de famille, dans les deux ordres', () => {
    const tree = testTree();
    const { names } = buildTree(tree, scenario.arbre);
    for (const [key, expected] of Object.entries(scenario.attendu.affichage)) {
      const [name] = namesOf(tree, key, names);
      if (name === undefined) throw new Error(`missing name for ${key}`);
      expect(name.surname).toBeUndefined();
      expect(formatName(name, 'given_first')).toBe(expected);
      expect(formatName(name, 'surname_first')).toBe(expected);
    }
  });
});

describe('CL-FAM-11 — jumeaux', () => {
  const groupSchema = z.strictObject({
    enfants: z.array(z.string()),
    ordre: z.array(z.int()).optional(),
  });
  const scenario = loadScenario(
    'CL-FAM-11',
    z.looseObject({
      arbre: treeSection.extend({ naissances_multiples: z.array(groupSchema) }),
      attendu: z.object({
        valide: z.literal(true),
        meme_naissance: z.record(z.string(), z.array(z.string())),
        refuse: z.array(groupSchema),
      }),
    }),
  );

  function toInput(tree: TestTree, group: z.infer<typeof groupSchema>) {
    return {
      id: tree.nextId(),
      treeId: tree.treeId,
      members: group.enfants.map((key, index) => {
        const birthOrder = group.ordre?.[index];
        return {
          personId: tree.personId(key),
          ...(birthOrder === undefined ? {} : { birthOrder }),
        };
      }),
    };
  }

  it('enregistre une même naissance, ordre facultatif, retrouvée depuis chaque fiche', () => {
    const tree = testTree();
    buildTree(tree, scenario.arbre);
    const births = scenario.arbre.naissances_multiples.map((group) =>
      multipleBirthSchema.parse(toInput(tree, group)),
    );
    for (const [key, expected] of Object.entries(scenario.attendu.meme_naissance)) {
      const birth = findMultipleBirth(tree.personId(key), births);
      expect(birth?.members.map((member) => member.personId)).toEqual(
        expected.map((other) => tree.personId(other)),
      );
    }
  });

  it('refuse une naissance d’un seul enfant, un enfant en double ou deux fois le même rang', () => {
    const tree = testTree();
    for (const group of scenario.attendu.refuse) {
      expect(multipleBirthSchema.safeParse(toInput(tree, group)).success).toBe(false);
    }
  });
});

describe('CL-FAM-17 — personne connue seulement par un surnom', () => {
  const scenario = loadScenario(
    'CL-FAM-17',
    z.looseObject({
      arbre: treeSection,
      attendu: z.object({
        valide: z.literal(true),
        nature: z.literal('connue'),
        nom_affiche: z.string(),
        nom_de_naissance: z.literal('absent'),
      }),
    }),
  );

  it('enregistre une personne connue avec son seul surnom, affiché comme nom', () => {
    const tree = testTree();
    const { people, names } = buildTree(tree, scenario.arbre);
    const [key] = people.keys();
    if (key === undefined) throw new Error('missing person');
    const record = personRecordSchema.parse({
      person: people.get(key),
      names: namesOf(tree, key, names),
    });
    expect(record.person.nature).toBe('known');
    expect(record.names.some((name) => name.type === 'birth')).toBe(false);
    const [nickname] = record.names;
    expect(nickname?.type).toBe('nickname');
    if (nickname === undefined) throw new Error('missing nickname');
    expect(formatName(nickname, 'given_first')).toBe(scenario.attendu.nom_affiche);
  });
});

describe('CL-FAM-18 — changement de nom', () => {
  const datedName = z.strictObject({
    nom: z.string(),
    prenoms: z.string(),
    debut: z.string().optional(),
    fin: z.string().optional(),
  });
  const scenario = loadScenario(
    'CL-FAM-18',
    z.looseObject({
      arbre: treeSection,
      attendu: z.object({
        valide: z.literal(true),
        noms_dates: z.record(z.string(), z.array(datedName)),
      }),
    }),
  );

  it('garde les noms successifs avec leurs dates', () => {
    const tree = testTree();
    const { people, names } = buildTree(tree, scenario.arbre);
    for (const [key, expected] of Object.entries(scenario.attendu.noms_dates)) {
      const own = namesOf(tree, key, names);
      expect(own).toHaveLength(expected.length);
      expected.forEach((line, index) => {
        const name = own[index];
        expect(name?.surname).toBe(line.nom);
        expect(name?.givenNames).toBe(line.prenoms);
        expect(name?.start).toEqual(
          line.debut === undefined ? undefined : fuzzyDateFromText(line.debut),
        );
        expect(name?.end).toEqual(line.fin === undefined ? undefined : fuzzyDateFromText(line.fin));
      });
      expect(() => personRecordSchema.parse({ person: people.get(key), names: own })).not.toThrow();
    }
  });
});

describe('CL-FAM-19 — titre traditionnel', () => {
  const titleLine = z.strictObject({
    personne: z.string().optional(),
    libelle: z.string(),
    debut: z.string().optional(),
    fin: z.string().optional(),
  });
  const scenario = loadScenario(
    'CL-FAM-19',
    z.looseObject({
      arbre: treeSection.extend({ titres: z.array(titleLine) }),
      attendu: z.object({
        valide: z.literal(true),
        sous_le_nom: z.record(z.string(), z.array(titleLine)),
      }),
    }),
  );

  it('enregistre des titres datés, rattachés à la personne', () => {
    const tree = testTree();
    buildTree(tree, scenario.arbre);
    const titles = scenario.arbre.titres.map((line) =>
      titleRoleSchema.parse({
        id: tree.nextId(),
        treeId: tree.treeId,
        personId: tree.personId(line.personne ?? ''),
        label: line.libelle,
        ...(line.debut === undefined ? {} : { start: fuzzyDateFromText(line.debut) }),
        ...(line.fin === undefined ? {} : { end: fuzzyDateFromText(line.fin) }),
      }),
    );
    for (const [key, expected] of Object.entries(scenario.attendu.sous_le_nom)) {
      const own = titles.filter((title) => title.personId === tree.personId(key));
      expect(
        own.map((title) => ({
          libelle: title.label,
          ...(title.start === undefined ? {} : { debut: title.start.originalText }),
          ...(title.end === undefined ? {} : { fin: title.end.originalText }),
        })),
      ).toEqual(expected);
    }
  });
});
