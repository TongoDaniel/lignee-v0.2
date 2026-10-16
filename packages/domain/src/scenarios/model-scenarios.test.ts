// Cas limites cités par T-004, joués pour ce qui relève du modèle : chaque scénario est lu dans
// test/scenarios/<ID>.yaml (schéma strict), converti en objets du modèle, puis validé par les
// schémas. Ce qui reste à jouer ailleurs est listé dans le champ `couverture` de chaque YAML.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { findMultipleBirth, multipleBirthSchema, titleRoleSchema } from '../fact';
import { filiationSchema } from '../filiation';
import { fuzzyDateFromText } from '../fuzzy-date';
import { formatName, nameSchema, personRecordSchema, personSchema, type Name } from '../person';
import { unionSchema } from '../union';
import { nameFromScenario, testTree, type TestTree } from '../test-support/fixtures';
import {
  loadScenario,
  scenarioFiliationSchema,
  scenarioNameSchema,
  scenarioPersonSchema,
  scenarioSchema,
  scenarioUnionSchema,
} from '../test-support/scenario';

const treeShape = {
  personnes: z.array(scenarioPersonSchema),
  noms: z.array(scenarioNameSchema).optional(),
  unions: z.array(scenarioUnionSchema).optional(),
  filiations: z.array(scenarioFiliationSchema).optional(),
};
const treeSection = z.strictObject(treeShape);
type TreeSection = z.infer<typeof treeSection>;

/** Personnes, noms, unions et filiations d'un scénario, validés par les schémas du modèle. */
function buildTree(tree: TestTree, section: TreeSection) {
  const people = new Map(
    section.personnes.map(({ key, gender }) => [
      key,
      personSchema.parse({ id: tree.personId(key), treeId: tree.treeId, nature: 'known', gender }),
    ]),
  );
  const known = (key: string) => {
    if (!people.has(key)) throw new Error(`Unknown person in scenario: ${key}`);
    return tree.personId(key);
  };
  const names = (section.noms ?? []).map((line) => {
    known(line.personne);
    return nameSchema.parse(nameFromScenario(tree, line));
  });
  const unions = (section.unions ?? []).map((line) =>
    unionSchema.parse({
      id: tree.nextId(),
      treeId: tree.treeId,
      spouses: [
        { personId: known(line.spouses[0]), rank: line.ranks[0] },
        { personId: known(line.spouses[1]), rank: line.ranks[1] },
      ],
    }),
  );
  const filiations = (section.filiations ?? []).flatMap((line) =>
    line.parents.map((parent) =>
      filiationSchema.parse({
        id: tree.nextId(),
        treeId: tree.treeId,
        parentId: known(parent),
        childId: known(line.enfant),
        type: 'birth',
        certainty: 'certain',
      }),
    ),
  );
  return { people, names, unions, filiations, known };
}

function namesOf(tree: TestTree, key: string, names: readonly Name[]): Name[] {
  return names.filter((name) => name.personId === tree.personId(key));
}

function recordOf(tree: TestTree, built: ReturnType<typeof buildTree>, key: string) {
  return personRecordSchema.parse({
    person: built.people.get(key),
    names: namesOf(tree, key, built.names),
  });
}

describe('CL-POL-15 — épouses qui gardent leur nom, enfants sans le nom du père', () => {
  it('modèle : la famille polygame s’enregistre, chaque fiche avec ses propres noms', () => {
    const scenario = loadScenario(
      'CL-POL-15',
      scenarioSchema('CL-POL-15', {
        arbre: treeSection,
        attendu: z.strictObject({
          valide: z.literal(true),
          noms_de_famille: z.record(z.string(), z.array(z.string())),
        }),
      }),
    );
    const tree = testTree();
    const built = buildTree(tree, scenario.arbre);
    expect(built.unions).toHaveLength(2);
    expect(built.filiations).toHaveLength(4);
    for (const [key, surnames] of Object.entries(scenario.attendu.noms_de_famille)) {
      expect(recordOf(tree, built, key).names.map((name) => name.surname)).toEqual(surnames);
    }
  });
});

describe('CL-DON-01 — nom donné dans l’ordre NOM Prénom', () => {
  it('modèle : prénoms et nom en deux champs, affichés dans l’ordre réglé par l’arbre', () => {
    const scenario = loadScenario(
      'CL-DON-01',
      scenarioSchema('CL-DON-01', {
        arbre: treeSection,
        attendu: z.strictObject({
          champs: z.strictObject({ prenoms: z.string(), nom: z.string() }),
          affichage: z.strictObject({
            nom_puis_prenoms: z.string(),
            prenoms_puis_nom: z.string(),
          }),
        }),
      }),
    );
    const tree = testTree();
    const [name] = buildTree(tree, scenario.arbre).names;
    if (name === undefined) throw new Error('missing name');
    expect(name.givenNames).toBe(scenario.attendu.champs.prenoms);
    expect(name.surname).toBe(scenario.attendu.champs.nom);
    expect(formatName(name, 'surname_first')).toBe(scenario.attendu.affichage.nom_puis_prenoms);
    expect(formatName(name, 'given_first')).toBe(scenario.attendu.affichage.prenoms_puis_nom);
  });
});

describe('CL-DON-02 — une seule forme de nom, sans nom de famille', () => {
  it('modèle : le nom est accepté tel quel, sans nom de famille, dans les deux ordres', () => {
    const scenario = loadScenario(
      'CL-DON-02',
      scenarioSchema('CL-DON-02', {
        arbre: treeSection,
        attendu: z.strictObject({
          valide: z.literal(true),
          affichage: z.record(z.string(), z.string()),
        }),
      }),
    );
    const tree = testTree();
    const built = buildTree(tree, scenario.arbre);
    for (const [key, expected] of Object.entries(scenario.attendu.affichage)) {
      const [name] = recordOf(tree, built, key).names;
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
  const schema = scenarioSchema('CL-FAM-11', {
    arbre: z.strictObject({ ...treeShape, naissances_multiples: z.array(groupSchema) }),
    attendu: z.strictObject({
      valide: z.literal(true),
      meme_naissance: z.record(z.string(), z.array(z.string())),
      refuse: z.array(groupSchema),
    }),
  });

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

  it('modèle : une même naissance, ordre facultatif, retrouvée depuis chaque fiche ; les naissances impossibles sont refusées', () => {
    const scenario = loadScenario('CL-FAM-11', schema);
    const tree = testTree();
    const { known } = buildTree(tree, scenario.arbre);
    const births = scenario.arbre.naissances_multiples.map((group) => {
      group.enfants.forEach(known);
      return multipleBirthSchema.parse(toInput(tree, group));
    });
    for (const [key, expected] of Object.entries(scenario.attendu.meme_naissance)) {
      const birth = findMultipleBirth(known(key), births);
      expect(birth?.members.map((member) => member.personId)).toEqual(expected.map(known));
    }
    for (const group of scenario.attendu.refuse) {
      expect(multipleBirthSchema.safeParse(toInput(tree, group)).success).toBe(false);
    }
  });
});

describe('CL-FAM-17 — personne connue seulement par un surnom', () => {
  it('modèle : une personne connue avec son seul surnom, affiché comme nom', () => {
    const scenario = loadScenario(
      'CL-FAM-17',
      scenarioSchema('CL-FAM-17', {
        arbre: treeSection,
        attendu: z.strictObject({
          valide: z.literal(true),
          nature: z.literal('connue'),
          nom_affiche: z.string(),
          nom_de_naissance: z.literal('absent'),
        }),
      }),
    );
    const tree = testTree();
    const built = buildTree(tree, scenario.arbre);
    const [key] = built.people.keys();
    if (key === undefined) throw new Error('missing person');
    const record = recordOf(tree, built, key);
    expect(record.person.nature).toBe('known');
    expect(record.names.some((name) => name.type === 'birth')).toBe(false);
    const [nickname] = record.names;
    if (nickname === undefined) throw new Error('missing nickname');
    expect(nickname.type).toBe('nickname');
    expect(formatName(nickname, 'given_first')).toBe(scenario.attendu.nom_affiche);
  });
});

describe('CL-FAM-18 — changement de nom', () => {
  it('modèle : les noms successifs gardent leurs dates', () => {
    const datedName = z.strictObject({
      nom: z.string(),
      prenoms: z.string(),
      debut: z.string().optional(),
      fin: z.string().optional(),
    });
    const scenario = loadScenario(
      'CL-FAM-18',
      scenarioSchema('CL-FAM-18', {
        arbre: treeSection,
        attendu: z.strictObject({
          valide: z.literal(true),
          noms_dates: z.record(z.string(), z.array(datedName)),
        }),
      }),
    );
    const tree = testTree();
    const built = buildTree(tree, scenario.arbre);
    for (const [key, expected] of Object.entries(scenario.attendu.noms_dates)) {
      const own = recordOf(tree, built, key).names;
      expect(
        own.map((name) => ({
          nom: name.surname,
          prenoms: name.givenNames,
          ...(name.start === undefined ? {} : { debut: name.start }),
          ...(name.end === undefined ? {} : { fin: name.end }),
        })),
      ).toEqual(
        expected.map((line) => ({
          nom: line.nom,
          prenoms: line.prenoms,
          ...(line.debut === undefined ? {} : { debut: fuzzyDateFromText(line.debut) }),
          ...(line.fin === undefined ? {} : { fin: fuzzyDateFromText(line.fin) }),
        })),
      );
    }
  });
});

describe('CL-FAM-19 — titre traditionnel', () => {
  it('modèle : des titres datés, rattachés à leur personne', () => {
    const titleLine = z.strictObject({
      libelle: z.string(),
      debut: z.string().optional(),
      fin: z.string().optional(),
    });
    const scenario = loadScenario(
      'CL-FAM-19',
      scenarioSchema('CL-FAM-19', {
        arbre: z.strictObject({
          ...treeShape,
          titres: z.array(titleLine.extend({ personne: z.string() })),
        }),
        attendu: z.strictObject({
          valide: z.literal(true),
          titres_par_personne: z.record(z.string(), z.array(titleLine)),
        }),
      }),
    );
    const tree = testTree();
    const { known } = buildTree(tree, scenario.arbre);
    const titles = scenario.arbre.titres.map((line) =>
      titleRoleSchema.parse({
        id: tree.nextId(),
        treeId: tree.treeId,
        personId: known(line.personne),
        label: line.libelle,
        authorAccountId: tree.authorAccountId,
        ...(line.debut === undefined ? {} : { start: fuzzyDateFromText(line.debut) }),
        ...(line.fin === undefined ? {} : { end: fuzzyDateFromText(line.fin) }),
      }),
    );
    for (const [key, expected] of Object.entries(scenario.attendu.titres_par_personne)) {
      const own = titles.filter((title) => title.personId === known(key));
      expect(
        own.map((title) => ({
          libelle: title.label,
          ...(title.start === undefined ? {} : { debut: title.start }),
          ...(title.end === undefined ? {} : { fin: title.end }),
        })),
      ).toEqual(
        expected.map((line) => ({
          libelle: line.libelle,
          ...(line.debut === undefined ? {} : { debut: fuzzyDateFromText(line.debut) }),
          ...(line.fin === undefined ? {} : { fin: fuzzyDateFromText(line.fin) }),
        })),
      );
    }
  });
});
