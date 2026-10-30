// Jeu de 200 paires annotées (T-023, plan V1 ; PRD, PAR-02 ; TRD, « Moteur de parenté », Tests),
// joué contre le moteur : packages/kinship/test-data/paires-annotees/. Chaque paire porte
// l'attendu structurel de ses liens (le principal, puis les autres), vérifié ici en entier, dans
// les deux sens, et les mots de chaque lien : français (T-026), comparés au dictionnaire ;
// anglais encore « à rédiger » (T-027), comptés.
// Un lien changé par le moteur, une paire mal formée ou une catégorie sous son quota font échouer
// ces tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Id } from '@lignee/domain';
import { createTranslator } from '@lignee/i18n';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { createAllianceContext } from './alliance';
import { createKinshipGraph } from './graph';
import { invertPresentedLink, presentRelationships } from './presentation';
import {
  PAIRS_DIR,
  PAIR_CATEGORIES,
  TO_WRITE,
  expectedSignature,
  familySchema,
  loadPairSet,
  pairIssues,
  pairNameOf,
  pairSetHeaderSchema,
  pairSetIssues,
  resultSignature,
  vocabularyKeys,
  wordFields,
  type AnnotatedPair,
  type LoadedFamily,
} from './test-support/annotated-pairs';
import { neverEntered } from './test-support/never-entered';
import { describeResult } from './words';

const HEAVY_TIMEOUT_MS = 60_000;

/** Les liens présentés de A vers B, et de B vers A, dans le graphe du lecteur. */
function play({ tree }: LoadedFamily, pair: AnnotatedPair) {
  const hidden = new Set((pair.masques ?? []).map((key) => tree.id(key)));
  const visible = neverEntered(tree.data, hidden, new Set(), new Set());
  const graph = createKinshipGraph(visible);
  const options = { allianceContext: createAllianceContext(visible) };
  const a = tree.id(pair.de);
  const b = tree.id(pair.vers);
  const keyOf = (id: Id) => tree.keyOf(id) ?? id;
  const forward = presentRelationships(graph, a, b, options);
  const backward = presentRelationships(graph, b, a, options);
  return { forward, backward, keyOf, graph };
}

describe('T-023 — jeu de 200 paires annotées (PAR-02)', () => {
  it('le jeu est bien formé : 200 paires, identifiants uniques, chaque paire valide', () => {
    const { header, families } = loadPairSet();
    const { issues } = pairSetIssues(
      header,
      families.map(({ family }) => family),
    );
    expect(issues).toEqual([]);
    expect(header.total).toBe(200);
  });

  it('chaque catégorie atteint son quota, et le README donne la même répartition', () => {
    const { header, families } = loadPairSet();
    const { counts } = pairSetIssues(
      header,
      families.map(({ family }) => family),
    );
    const readme = readFileSync(join(PAIRS_DIR, 'README.md'), 'utf8');
    const lines = [];
    for (const category of PAIR_CATEGORIES) {
      const count = counts.get(category) ?? 0;
      const quota = header.quotas[category];
      expect(count, category).toBeGreaterThanOrEqual(quota);
      // Ligne de la table, colonnes alignées ou non.
      const row = new RegExp(
        `^\\| \`${category}\` +\\| ${String(quota)} +\\| ${String(count)} +\\|$`,
        'm',
      );
      expect(
        readme,
        `README : ${category}, quota ${String(quota)}, ${String(count)} paires`,
      ).toMatch(row);
      lines.push(`${category} ${String(count)}/${String(quota)}`);
    }
    console.log(`[paires] répartition (paires/quota) : ${lines.join(', ')}`);
  });

  it(
    'partie structurelle : chaque lien calculé est celui de l’attendu, dans l’ordre (100 %)',
    () => {
      const { families } = loadPairSet();
      const failures: string[] = [];
      let played = 0;
      for (const loaded of families) {
        for (const pair of loaded.family.paires) {
          const { forward, keyOf } = play(loaded, pair);
          const actual = resultSignature(forward, keyOf);
          played += 1;
          try {
            expect(actual).toEqual(expectedSignature(pair));
          } catch {
            failures.push(
              `${pair.id} (${pair.de} → ${pair.vers}) : calculé\n${stringify(actual, { lineWidth: 100 })}`,
            );
          }
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
      expect(played).toBe(200);
    },
    HEAVY_TIMEOUT_MS,
  );

  it(
    'le lien de B vers A est exactement l’inverse de celui de A vers B, sur chaque paire',
    () => {
      const { families } = loadPairSet();
      for (const loaded of families) {
        for (const pair of loaded.family.paires) {
          const { forward, backward } = play(loaded, pair);
          if (forward.status === 'related' && backward.status === 'related') {
            expect(backward.links, pair.id).toEqual(forward.links.map(invertPresentedLink));
          } else {
            expect(backward.status, pair.id).toBe(forward.status);
          }
        }
      }
    },
    HEAVY_TIMEOUT_MS,
  );

  it(
    'le jeu échoue si le moteur change un lien : un arbre retouché change la signature',
    () => {
      // Retirer une filiation du lien principal (ou l'union traversée) change ce que le moteur
      // rend : la comparaison stricte de la partie structurelle le voit, sur chaque paire liée.
      const { families } = loadPairSet();
      let checked = 0;
      for (const loaded of families) {
        for (const pair of loaded.family.paires) {
          const { forward, keyOf } = play(loaded, pair);
          if (forward.status !== 'related') continue;
          const [main] = forward.links;
          const path = main?.relationships[0];
          if (path === undefined) continue;
          const filiationIds = new Set(
            path.segments.flatMap((segment) =>
              segment.kind === 'union'
                ? []
                : [
                    ...segment.ascent,
                    ...segment.commonAncestors.flatMap((ancestor) =>
                      [ancestor.fromSide, ancestor.toSide].filter((link) => link !== undefined),
                    ),
                    ...segment.descent,
                  ].map((link) => link.filiationId),
            ),
          );
          const unionIds = new Set(path.unionIds);
          const { tree } = loaded;
          const hidden = new Set((pair.masques ?? []).map((key) => tree.id(key)));
          const altered = neverEntered(tree.data, hidden, unionIds, filiationIds);
          const result = presentRelationships(
            createKinshipGraph(altered),
            tree.id(pair.de),
            tree.id(pair.vers),
            { allianceContext: createAllianceContext(altered) },
          );
          expect(resultSignature(result, keyOf), pair.id).not.toEqual(expectedSignature(pair));
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(150);
    },
    HEAVY_TIMEOUT_MS,
  );

  it(
    'T-026 — les mots français de chaque lien sont ceux du dictionnaire (100 %), courts et expliqués',
    () => {
      // Dictionnaire français : `describeResult` (src/words.ts) et les messages `kinship` de
      // @lignee/i18n. Chaque lien de chaque paire est écrit (forme courte et forme expliquée,
      // PAR-11) et comparé aux mots calculés, dans l'ordre des liens.
      const { families } = loadPairSet();
      const { t } = createTranslator({ language: 'fr' });
      const failures: string[] = [];
      let compared = 0;
      for (const loaded of families) {
        for (const pair of loaded.family.paires) {
          if (typeof pair.attendu === 'string') continue;
          const { forward, graph } = play(loaded, pair);
          const words = describeResult(forward, {
            graph,
            t,
            nameOf: pairNameOf(loaded.tree, graph),
          });
          const actual =
            words.status === 'related'
              ? words.links.map((link) => ({ court: link.short, explique: link.explained }))
              : [];
          const expected = pair.attendu.map((link) => link.fr);
          compared += expected.length;
          try {
            expect(actual).toEqual(expected);
          } catch {
            failures.push(`${pair.id} : calculé\n${stringify(actual, { lineWidth: 100 })}`);
          }
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
      expect(compared).toBe(264);
    },
    HEAVY_TIMEOUT_MS,
  );

  it('les mots anglais sont comptés ; « à rédiger » accepté tant que T-027 n’est pas fait', () => {
    const { families } = loadPairSet();
    const fields = wordFields(families.map(({ family }) => family));
    const pending = (language: 'fr' | 'en') =>
      fields.filter((field) => field.language === language && field.words === TO_WRITE).length;
    const total = fields.length / 2;
    console.log(
      `[paires] mots à rédiger : français ${String(pending('fr'))}/${String(total)} (T-026), ` +
        `anglais ${String(pending('en'))}/${String(total)} (T-027)`,
    );
    expect(pending('fr')).toBe(0);
    // Aucun dictionnaire anglais n'est encore vérifié (T-027) : un mot anglais écrit ne serait
    // comparé à rien. T-027 branche ici son dictionnaire, comme le test français ci-dessus.
    const written = fields.filter((field) => field.language === 'en' && field.words !== TO_WRITE);
    expect(
      written.map((field) => `${field.pair}[${String(field.index)}].${field.language}`),
      'mots anglais écrits sans dictionnaire pour les vérifier (T-027)',
    ).toEqual([]);
    expect(total).toBeGreaterThanOrEqual(200);
  });

  it('le jeu couvre le vocabulaire minimal de PAR-02, pour chaque genre visé', () => {
    // Forme de base du lien et genre de la personne visée (B) : ce que les mots devront dire. Une
    // paire retirée ou remplacée ne doit pas faire disparaître l'un de ces mots.
    const both = (key: string) => [`${key} M`, `${key} F`];
    const required = [
      ...['1/0', '0/1', '2/0', '0/2', '3/0', '0/3', '2/1', '1/2', '3/1', '2/2', '3/3'].flatMap(
        (line) => both(`ligne ${line}`),
      ),
      ...both('ligne 1/3'), // petit-neveu, petite-nièce
      ...both('ligne 3/2'), // oncle « à la mode de Bretagne » (PAR-02)
      ...both('ligne 2/3'), // neveu « à la mode de Bretagne »
      ...both('ligne 4/4'), // « cousin au 8e degré » (PAR-02)
      ...['full', 'half', 'full_or_half'].flatMap((sharing) => both(`fratrie ${sharing}`)),
      ...[
        'spouse',
        'parent_of_spouse',
        'child_of_spouse',
        'spouse_of_child',
        'spouse_of_parent',
        'sibling_of_spouse',
        'spouse_of_sibling',
        'spouse_of_sibling_of_spouse',
        'spouse_of_spouse',
        'step_sibling',
      ].flatMap(both),
      'co_spouse F',
      'genre A', // une personne visée de genre « autre »
      'ligne 1/0 M adoptive',
      'ligne 0/1 F adoptive',
      'ligne 1/0 M raised',
      'ligne 1/0 M fostered',
      'ligne 0/1 F guardian',
      'ligne 1/0 M donor',
      'ligne 1/0 F surrogacy',
      'fratrie full F adoptive', // « sœur par adoption »
    ];
    const covered = vocabularyKeys(loadPairSet().families.map(({ family }) => family));
    expect(required.filter((key) => !covered.has(key))).toEqual([]);
  });
});

describe('T-023 — une paire mal formée est refusée', () => {
  const family = (paires: unknown[]): unknown => ({
    famille: 'F99',
    titre: 'Famille de contrôle',
    origine: 'composee',
    arbre: {
      personnes: ['ben/M', 'kwoa/F', 'finae/M'],
      unions: [{ conjoints: ['ben', 'kwoa'] }],
      filiations: [{ parents: ['ben', 'kwoa'], enfant: 'finae' }],
    },
    paires,
  });
  const good = {
    id: 'F99-01',
    de: 'finae',
    vers: 'ben',
    categorie: 'degres_civils',
    pourquoi: 'Père : une génération au-dessus (TRD, question 1).',
    attendu: [
      { chemin: '1/0[ben]', cote_de: { par: 'ben', cote: 'father' }, fr: TO_WRITE, en: TO_WRITE },
    ],
  };
  const issuesOf = (pair: unknown): string[] => {
    const parsed = familySchema.safeParse(family([pair]));
    if (!parsed.success) return parsed.error.issues.map((issue) => issue.message);
    const [only] = parsed.data.paires;
    return only === undefined ? ['no pair'] : pairIssues(parsed.data, only);
  };

  it('la paire de contrôle est acceptée', () => {
    expect(issuesOf(good)).toEqual([]);
  });

  it.each([
    ['une clé inconnue', { ...good, commentaire: 'x' }, /Unrecognized key/],
    ['une catégorie inconnue', { ...good, categorie: 'divers' }, /Invalid option/],
    ['une justification absente', { ...good, pourquoi: '' }, /Too small/],
    [
      'des mots vides',
      { ...good, attendu: [{ ...good.attendu[0], fr: { court: '', explique: 'votre père' } }] },
      /Too small/,
    ],
    [
      'des mots sans forme expliquée (PAR-11)',
      { ...good, attendu: [{ ...good.attendu[0], fr: { court: 'père' } }] },
      /Invalid input/,
    ],
    [
      'des mots en une seule chaîne',
      { ...good, attendu: [{ ...good.attendu[0], fr: 'père' }] },
      /Invalid input/,
    ],
    ['un attendu vide', { ...good, attendu: [] }, /expected array to have >=1/],
    ['une personne hors de la famille', { ...good, vers: 'samuel' }, /samuel is not in F99/],
    [
      'un segment illisible',
      { ...good, attendu: [{ ...good.attendu[0], chemin: '1-0 ben' }] },
      /bad segment/,
    ],
    [
      'un ancêtre inconnu',
      { ...good, attendu: [{ ...good.attendu[0], chemin: '1/0[pierre]' }] },
      /pierre is not in F99/,
    ],
    [
      'des ancêtres non triés',
      {
        ...good,
        vers: 'finae',
        de: 'kwoa',
        attendu: [{ chemin: '0/1[kwoa+ben]', fr: TO_WRITE, en: TO_WRITE }],
      },
      /not sorted/,
    ],
    [
      'une fratrie sur un chemin qui n’en est pas une',
      {
        ...good,
        attendu: [{ ...good.attendu[0], fratrie: { type: 'birth', partage: 'full' } }],
      },
      /fratrie exactly/,
    ],
    [
      'une alliance sans union traversée',
      { ...good, attendu: [{ ...good.attendu[0], alliance: { type: 'spouse' } }] },
      /alliance exactly/,
    ],
    [
      'une union traversée sans alliance',
      { ...good, vers: 'kwoa', attendu: [{ chemin: '=kwoa', fr: TO_WRITE, en: TO_WRITE }] },
      /alliance exactly/,
    ],
    ['A et B identiques sans meme_personne', { ...good, vers: 'finae' }, /meme_personne/],
    [
      'une paire de visibilité sans personne masquée',
      { ...good, categorie: 'visibilite' },
      /hides someone/,
    ],
    ['A masqué', { ...good, masques: ['finae'] }, /is A or B/],
  ] as const)('refuse %s', (_label, pair, reason) => {
    const issues = issuesOf(pair);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join(' ; ')).toMatch(reason);
  });

  it('refuse un jeu dont une catégorie tombe sous son quota, ou dont le total diffère', () => {
    const parsed = familySchema.parse(family([good]));
    const header = {
      version: 1 as const,
      total: 2,
      quotas: pairSetHeaderSchema.shape.quotas.parse(
        Object.fromEntries(PAIR_CATEGORIES.map((category) => [category, 1])),
      ),
    };
    const { issues } = pairSetIssues(header, [parsed]);
    expect(issues).toContain('1 pairs, expected 2');
    expect(issues.some((issue) => issue.startsWith('polygamie: 0 pairs, under its quota'))).toBe(
      true,
    );
  });

  it('refuse deux fois la même paire, ou un identifiant repris', () => {
    const parsed = familySchema.parse(family([good, { ...good, id: 'F99-02' }]));
    const quotas = pairSetHeaderSchema.shape.quotas.parse(
      Object.fromEntries(PAIR_CATEGORIES.map((category) => [category, 1])),
    );
    const { issues } = pairSetIssues({ version: 1, total: 2, quotas }, [parsed]);
    expect(issues.some((issue) => issue.includes('repeats'))).toBe(true);
    const twice = familySchema.parse(family([good, { ...good, vers: 'kwoa', id: 'F99-01' }]));
    expect(
      pairSetIssues({ version: 1, total: 2, quotas }, [twice]).issues.some((issue) =>
        issue.includes('twice'),
      ),
    ).toBe(true);
  });
});
