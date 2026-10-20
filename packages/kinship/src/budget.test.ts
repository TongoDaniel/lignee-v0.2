// CL-FAM-20 « Arbre de 5 000 personnes », partie moteur (T-028, ADR 0026) : les budgets du TRD
// sur l'Android de référence (lien en moins de 50 ms, ouverture en moins de 1 s, jamais plus de
// 50 ms d'interface bloquée), ramenés au poste par le facteur de ralentissement estimé
// (`test-support/reference-device.ts`), puis comparés au garde-fou habituel (`reportBudget`).
// La question mesurée est celle de l'écran « Qui est-ce pour moi ? » (T-029) : les liens
// présentés, alliance nommée comprise. Méthode stable sur une machine chargée : un premier
// passage sur toutes les paires (médiane de 3), puis les 10 plus lentes remesurées (médiane de 9
// à chaud, de 7 sur un graphe neuf) ; seul ce second passage est comparé au budget.
import type { Id } from '@lignee/domain';
import {
  loadScenario,
  medianTime,
  perfCeiling,
  referenceTree,
  reportBudget,
  scenarioSchema,
} from '@lignee/domain/test-support';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createAllianceContext, type AllianceContext } from './alliance';
import {
  createKinshipGraph,
  createKinshipGraphInSlices,
  type KinshipGraph,
  type KinshipGraphInput,
} from './graph';
import { presentRelationships, presentRelationshipsInSlices } from './presentation';
import { chiefOfFamily, closePairs, pairsOf } from './test-support/perf-trees';
import { deviceSlowdown, emulatedSliceMs, onThisMachine } from './test-support/reference-device';
import { measuringScheduler } from './test-support/schedulers';

const TIMEOUT = 60_000;

const schema = scenarioSchema('CL-FAM-20', {
  action: z.strictObject({
    arbre_type: z.literal(5000),
    paires_au_hasard: z.number().int().positive(),
    paires_proches: z.number().int().positive(),
    chef_de_famille: z.strictObject({
      epouses: z.literal(8),
      enfants: z.literal(40),
      petits_enfants_par_enfant: z.literal(3),
    }),
    question: z.literal('lien_presente'),
  }),
  attendu: z.strictObject({
    lien_ms: z.number().positive(),
    ouverture_graphe_ms: z.number().positive(),
    tranche_max_ms: z.number().positive(),
    reponse_ms: z.number().positive(),
    calcul_decoupe: z.literal('identique_au_calcul_direct'),
  }),
});

type Pair = readonly [Id, Id];

/**
 * Les `keep` paires les plus lentes, après un premier passage (médiane de 3, graphe chaud) sur
 * toutes les paires.
 */
function slowestPairs(
  graph: KinshipGraph,
  pairs: readonly Pair[],
  allianceContext: AllianceContext,
  keep: number,
): Pair[] {
  return pairs
    .map((pair) => ({
      pair,
      ms: medianTime(() => presentRelationships(graph, pair[0], pair[1], { allianceContext }), {
        warmup: 1,
        runs: 3,
      }).medianMs,
    }))
    .sort((x, y) => y.ms - x.ms)
    .slice(0, keep)
    .map(({ pair }) => pair);
}

/** Pire temps à chaud (médiane de 9 par paire), sur un graphe déjà interrogé. */
function worstWarm(
  input: KinshipGraphInput,
  pairs: readonly Pair[],
  allianceContext: AllianceContext,
): number {
  let worst = 0;
  for (const [a, b] of pairs) {
    const graph = createKinshipGraph(input);
    const { medianMs } = medianTime(() => presentRelationships(graph, a, b, { allianceContext }), {
      warmup: 1,
      runs: 9,
    });
    worst = Math.max(worst, medianMs);
  }
  return worst;
}

/**
 * Vide le cache des ensembles d'ancêtres du graphe, son seul cache : la question suivante est
 * celle d'un graphe neuf. Un graphe reconstruit avant chaque mesure ferait mesurer le ramasse-
 * miettes de la construction plutôt que le calcul.
 */
function emptyCaches(graph: KinshipGraph): void {
  const cache = (graph as unknown as { ancestorCache?: unknown }).ancestorCache;
  if (!(cache instanceof Map)) throw new Error('KinshipGraph has no ancestorCache any more');
  cache.clear();
}

/** Pire temps de la première question, caches du graphe vides (médiane de 7). */
function worstCold(
  input: KinshipGraphInput,
  pairs: readonly Pair[],
  allianceContext: AllianceContext,
): number {
  let worst = 0;
  const graph = createKinshipGraph(input);
  for (const [a, b] of pairs) {
    const { medianMs } = medianTime(() => presentRelationships(graph, a, b, { allianceContext }), {
      warmup: 1,
      runs: 7,
      setup: () => {
        emptyCaches(graph);
      },
    });
    worst = Math.max(worst, medianMs);
  }
  return worst;
}

/**
 * Plus longue tranche du calcul découpé, avec la tranche du téléphone ramenée au poste : médiane,
 * sur 5 passages comptés, de la plus longue tranche de chaque passage (graphe, puis chaque
 * question).
 */
async function longestSlice(
  input: KinshipGraphInput,
  pairs: readonly Pair[],
  allianceContext: AllianceContext,
): Promise<number> {
  const sliceMs = emulatedSliceMs();
  const maxima: number[] = [];
  let slices = 0;
  for (let run = 0; run < 6; run += 1) {
    const scheduler = measuringScheduler();
    scheduler.begin();
    const graph = await createKinshipGraphInSlices(input, { scheduler, sliceMs });
    scheduler.end();
    for (const [a, b] of pairs) {
      scheduler.begin();
      await presentRelationshipsInSlices(graph, a, b, { allianceContext, scheduler, sliceMs });
      scheduler.end();
    }
    // Le premier passage chauffe le code (compilation à la volée) : il n'est pas compté.
    if (run > 0) maxima.push(Math.max(...scheduler.slices));
    slices = scheduler.slices.length;
  }
  console.info(`CL-FAM-20, calcul découpé : ${String(slices)} tranches par passage`);
  maxima.sort((x, y) => x - y);
  return maxima[Math.floor((maxima.length - 1) / 2)] ?? 0;
}

/** Mesures tentées au plus, contre une machine chargée par d'autres tâches. */
const ATTEMPTS = 3;

/**
 * Compare une mesure au budget du téléphone ramené au poste. La charge d'une machine partagée ne
 * fait qu'allonger les temps : une mesure au-dessus du garde-fou est reprise, au plus 3 fois, et
 * la plus basse est gardée. Une vraie régression dépasse à chaque fois (ADR 0026).
 */
async function expectWithin(
  label: string,
  measure: () => number | Promise<number>,
  deviceBudgetMs: number,
): Promise<void> {
  // Arrondi au centième de milliseconde, pour une ligne [perf] lisible.
  const budgetMs = Math.round(onThisMachine(deviceBudgetMs) * 100) / 100;
  const fullLabel = `${label} (budget du téléphone ${String(deviceBudgetMs)} ms ÷ ${String(deviceSlowdown())})`;
  let best = Number.POSITIVE_INFINITY;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    best = Math.min(best, await measure());
    if (best < perfCeiling(budgetMs)) break;
  }
  const report = reportBudget(fullLabel, best, budgetMs);
  expect(report.measuredMs).toBeLessThan(report.ceilingMs);
}

describe('CL-FAM-20 — arbre de 5 000 personnes, budgets du moteur', () => {
  it(
    'lien présenté en moins de 50 ms et graphe ouvert en moins de 1 s, sur le téléphone',
    async () => {
      const scenario = loadScenario('CL-FAM-20', schema);
      const { action, attendu } = scenario;
      const tree = referenceTree(action.arbre_type);
      const input: KinshipGraphInput = tree;
      const graph = createKinshipGraph(input);
      const allianceContext = createAllianceContext(tree);

      // Ouverture : graphe et contexte de l'alliance, une fois par arbre.
      await expectWithin(
        'CL-FAM-20, ouverture du graphe',
        () =>
          medianTime(
            () => {
              createKinshipGraph(input);
              createAllianceContext(tree);
            },
            { warmup: 2, runs: 9 },
          ).medianMs,
        attendu.ouverture_graphe_ms,
      );

      const ids = tree.people.map((person) => person.id);
      const close = closePairs(graph, tree.filiations, action.paires_proches);
      expect(close.length).toBeGreaterThan(50);
      const pairs = [...pairsOf(ids, action.paires_au_hasard), ...close].filter(
        ([a, b]) => a !== b,
      );
      const slowest = slowestPairs(graph, pairs, allianceContext, 10);
      await expectWithin(
        'CL-FAM-20, lien le plus lent, caches vides',
        () => worstCold(input, slowest, allianceContext),
        attendu.lien_ms,
      );
      await expectWithin(
        'CL-FAM-20, lien le plus lent, à chaud',
        () => worstWarm(input, slowest, allianceContext),
        attendu.lien_ms,
      );
      // PAR-01 (200 ms hors-ligne) est plus large que le budget du TRD : tenu avec lui.
      expect(attendu.reponse_ms).toBeGreaterThanOrEqual(attendu.lien_ms);

      // Calcul découpé : jamais plus de 50 ms d'interface bloquée sur le téléphone.
      await expectWithin(
        'CL-FAM-20, plus longue tranche du calcul découpé',
        () => longestSlice(input, slowest, allianceContext),
        attendu.tranche_max_ms,
      );
    },
    TIMEOUT,
  );

  it(
    'chef de famille à 8 épouses et 40 enfants : lien présenté en moins de 50 ms',
    async () => {
      const scenario = loadScenario('CL-FAM-20', schema);
      const family = chiefOfFamily();
      const { chef_de_famille: expected } = scenario.action;
      expect(family.wives).toHaveLength(expected.epouses);
      expect(family.children).toHaveLength(expected.enfants);
      const input: KinshipGraphInput = family;
      const graph = createKinshipGraph(input);
      const allianceContext = createAllianceContext({ people: family.people });
      const ids = family.people.map((person) => person.id);
      // Le chef, ses épouses et ses enfants entre eux, plus des paires au hasard.
      const core = [family.head, ...family.wives, ...family.children].map((person) => person.id);
      const pairs: Pair[] = [
        ...core.flatMap((a, index) => core.slice(index + 1, index + 4).map((b): Pair => [a, b])),
        ...[...pairsOf(ids, 200)].filter(([a, b]) => a !== b),
      ];
      const slowest = slowestPairs(graph, pairs, allianceContext, 10);
      await expectWithin(
        'CL-FAM-20, chef de famille, caches vides',
        () => worstCold(input, slowest, allianceContext),
        scenario.attendu.lien_ms,
      );
      await expectWithin(
        'CL-FAM-20, chef de famille, à chaud',
        () => worstWarm(input, slowest, allianceContext),
        scenario.attendu.lien_ms,
      );
    },
    TIMEOUT,
  );
});
