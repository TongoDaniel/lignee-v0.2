// Cas limites cités par T-004, joués pour ce qui relève du modèle : chaque scénario est lu dans
// test/scenarios/<ID>.yaml (schéma strict), converti en objets du modèle, puis validé par les
// schémas. Ce qui reste à jouer ailleurs est listé dans le champ `couverture` de chaque YAML.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { findMultipleBirth, multipleBirthSchema } from '../fact';
import { fuzzyDateFromText } from '../fuzzy-date';
import { formatName, personRecordSchema } from '../person';
import {
  loadScenario,
  otherPartsShape,
  requireScenarioParts,
  scenarioSchema,
} from '../test-support/scenario';
import {
  buildScenarioTree,
  multipleBirthInput,
  scenarioMultipleBirthSchema,
  scenarioTitleSchema,
  scenarioTreeSchema,
  type ScenarioTree,
} from '../test-support/scenario-tree';

/** La fiche d'une personne du scénario : la personne et ses noms, validés ensemble. */
function recordOf(built: ScenarioTree, key: string) {
  return personRecordSchema.parse({
    person: built.data.people.find((person) => person.id === built.id(key)),
    names: built.data.names.filter((name) => name.personId === built.id(key)),
  });
}

describe('CL-POL-15 — épouses qui gardent leur nom, enfants sans le nom du père', () => {
  it('modèle : la famille polygame s’enregistre, chaque fiche avec ses propres noms', () => {
    const scenario = loadScenario(
      'CL-POL-15',
      scenarioSchema('CL-POL-15', {
        arbre: scenarioTreeSchema,
        attendu: z.strictObject({
          valide: z.literal(true),
          noms_de_famille: z.record(z.string(), z.array(z.string())),
          ...otherPartsShape(['saisie'], 'attendu'),
        }),
      }).superRefine(requireScenarioParts('modele', ['saisie'])),
    );
    const built = buildScenarioTree(scenario.arbre);
    expect(built.data.unions).toHaveLength(2);
    expect(built.data.filiations).toHaveLength(4);
    for (const [key, surnames] of Object.entries(scenario.attendu.noms_de_famille)) {
      expect(recordOf(built, key).names.map((name) => name.surname)).toEqual(surnames);
    }
  });
});

describe('CL-DON-01 — nom donné dans l’ordre NOM Prénom', () => {
  it('modèle : prénoms et nom en deux champs, affichés dans l’ordre réglé par l’arbre', () => {
    const scenario = loadScenario(
      'CL-DON-01',
      scenarioSchema('CL-DON-01', {
        arbre: scenarioTreeSchema,
        attendu: z.strictObject({
          champs: z.strictObject({ prenoms: z.string(), nom: z.string() }),
          affichage: z.strictObject({
            nom_puis_prenoms: z.string(),
            prenoms_puis_nom: z.string(),
          }),
          ...otherPartsShape(['fiche', 'saisie'], 'attendu'),
        }),
      }).superRefine(requireScenarioParts('modele', ['fiche', 'saisie'])),
    );
    const [name] = buildScenarioTree(scenario.arbre).data.names;
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
        arbre: scenarioTreeSchema,
        attendu: z.strictObject({
          valide: z.literal(true),
          affichage: z.record(z.string(), z.string()),
          ...otherPartsShape(['saisie'], 'attendu'),
        }),
      }).superRefine(requireScenarioParts('modele', ['saisie'])),
    );
    const built = buildScenarioTree(scenario.arbre);
    for (const [key, expected] of Object.entries(scenario.attendu.affichage)) {
      const [name] = recordOf(built, key).names;
      if (name === undefined) throw new Error(`missing name for ${key}`);
      expect(name.surname).toBeUndefined();
      expect(formatName(name, 'given_first')).toBe(expected);
      expect(formatName(name, 'surname_first')).toBe(expected);
    }
  });
});

describe('CL-FAM-11 — jumeaux', () => {
  const schema = scenarioSchema('CL-FAM-11', {
    arbre: scenarioTreeSchema,
    attendu: z.strictObject({
      valide: z.literal(true),
      meme_naissance: z.record(z.string(), z.array(z.string())),
      refuse: z.array(scenarioMultipleBirthSchema),
      ...otherPartsShape(['fiche', 'saisie'], 'attendu'),
    }),
  }).superRefine(requireScenarioParts('modele', ['fiche', 'saisie']));

  it('modèle : une même naissance, ordre facultatif, retrouvée depuis chaque fiche ; les naissances impossibles sont refusées', () => {
    const scenario = loadScenario('CL-FAM-11', schema);
    const built = buildScenarioTree(scenario.arbre);
    const births = built.data.multipleBirths;
    expect(births).toHaveLength(scenario.arbre.naissances_multiples?.length ?? 0);
    for (const [key, expected] of Object.entries(scenario.attendu.meme_naissance)) {
      const birth = findMultipleBirth(built.id(key), births);
      expect(birth?.members.map((member) => member.personId)).toEqual(expected.map(built.id));
    }
    for (const group of scenario.attendu.refuse) {
      const input = multipleBirthInput(built.context, group, built.id);
      expect(multipleBirthSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('CL-FAM-17 — personne connue seulement par un surnom', () => {
  it('modèle : une personne connue avec son seul surnom, affiché comme nom', () => {
    const scenario = loadScenario(
      'CL-FAM-17',
      scenarioSchema('CL-FAM-17', {
        arbre: scenarioTreeSchema,
        attendu: z.strictObject({
          valide: z.literal(true),
          nature: z.literal('connue'),
          nom_affiche: z.string(),
          nom_de_naissance: z.literal('absent'),
          ...otherPartsShape(['fiche', 'saisie'], 'attendu'),
        }),
      }).superRefine(requireScenarioParts('modele', ['fiche', 'saisie'])),
    );
    const built = buildScenarioTree(scenario.arbre);
    const [line] = scenario.arbre.personnes;
    if (line === undefined) throw new Error('missing person');
    const record = recordOf(built, line.key);
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
        arbre: scenarioTreeSchema,
        attendu: z.strictObject({
          valide: z.literal(true),
          noms_dates: z.record(z.string(), z.array(datedName)),
          ...otherPartsShape(['saisie'], 'attendu'),
        }),
      }).superRefine(requireScenarioParts('modele', ['saisie'])),
    );
    const built = buildScenarioTree(scenario.arbre);
    for (const [key, expected] of Object.entries(scenario.attendu.noms_dates)) {
      const own = recordOf(built, key).names;
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
    const titleLine = scenarioTitleSchema.omit({ personne: true });
    const scenario = loadScenario(
      'CL-FAM-19',
      scenarioSchema('CL-FAM-19', {
        arbre: scenarioTreeSchema,
        attendu: z.strictObject({
          valide: z.literal(true),
          titres_par_personne: z.record(z.string(), z.array(titleLine)),
          ...otherPartsShape(['fiche', 'saisie'], 'attendu'),
        }),
      }).superRefine(requireScenarioParts('modele', ['fiche', 'saisie'])),
    );
    const built = buildScenarioTree(scenario.arbre);
    const titles = built.data.titleRoles;
    expect(titles).toHaveLength(scenario.arbre.titres?.length ?? 0);
    for (const [key, expected] of Object.entries(scenario.attendu.titres_par_personne)) {
      const own = titles.filter((title) => title.personId === built.id(key));
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
