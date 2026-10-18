// Mesures de temps dans les tests (README racine, « Tests de performance »). Les budgets du cahier
// des charges visent l'Android de référence et y seront vérifiés (T-028, T-105) ; en intégration
// continue, les tests ne servent que de garde-fou contre une régression grossière. Une mesure
// unique sur un runner partagé varie trop : on chauffe d'abord, on prend la médiane de plusieurs
// exécutions, et on la compare à un plafond = budget × facteur. Le facteur vaut 3 en CI
// (variable CI), 1,5 sur un poste ; LIGNEE_PERF_FACTOR le remplace. Chaque mesure est écrite
// dans la sortie du test, avec le budget et le plafond, pour suivre la tendance.

/** Facteur de garde-fou en CI (runners partagés, plus lents et chargés). */
export const CI_PERF_FACTOR = 3;
/** Facteur de garde-fou sur un poste de développement. */
export const LOCAL_PERF_FACTOR = 1.5;

/**
 * Facteur appliqué aux budgets : LIGNEE_PERF_FACTOR s'il est défini (nombre strictement positif),
 * sinon 3 en CI, 1,5 ailleurs.
 */
export function perfFactor(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.LIGNEE_PERF_FACTOR?.trim();
  if (raw !== undefined && raw !== '') {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`LIGNEE_PERF_FACTOR must be a positive number, got "${raw}"`);
    }
    return value;
  }
  const ci = env.CI?.trim().toLowerCase();
  return ci !== undefined && ci !== '' && ci !== 'false' && ci !== '0'
    ? CI_PERF_FACTOR
    : LOCAL_PERF_FACTOR;
}

/** Plafond du garde-fou : budget × facteur. */
export function perfCeiling(budgetMs: number, factor = perfFactor()): number {
  return budgetMs * factor;
}

/** Durée d'une exécution, en millisecondes. */
export function timeOnce(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

export interface MedianOptions {
  /** Exécutions de chauffe, non comptées (compilation à la volée, caches). Par défaut 1. */
  readonly warmup?: number;
  /** Exécutions mesurées ; la médiane est retenue. Par défaut 5. */
  readonly runs?: number;
  /** Préparation avant chaque exécution, hors du temps compté (par exemple un cache froid). */
  readonly setup?: () => void;
}

export interface Timing {
  readonly medianMs: number;
  readonly samplesMs: readonly number[];
}

/** Médiane de plusieurs exécutions, après chauffe. */
export function medianTime(run: () => void, options: MedianOptions = {}): Timing {
  const { warmup = 1, runs = 5, setup } = options;
  if (!Number.isInteger(runs) || runs < 1) throw new Error('runs must be a positive integer');
  for (let index = 0; index < warmup; index += 1) {
    setup?.();
    run();
  }
  const samplesMs: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    setup?.();
    samplesMs.push(timeOnce(run));
  }
  return { medianMs: median(samplesMs), samplesMs };
}

/** Médiane d'une liste de durées (la valeur basse du milieu si la liste est paire). */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? Number.NaN;
}

export interface BudgetReport {
  readonly label: string;
  readonly measuredMs: number;
  readonly budgetMs: number;
  readonly factor: number;
  readonly ceilingMs: number;
  /** Ligne écrite dans la sortie du test. */
  readonly line: string;
}

/**
 * Écrit la mesure, le budget et le plafond dans la sortie du test, et rend le plafond à comparer
 * (`expect(report.measuredMs).toBeLessThan(report.ceilingMs)`, dans le test).
 */
export function reportBudget(label: string, measuredMs: number, budgetMs: number): BudgetReport {
  const factor = perfFactor();
  const ceilingMs = perfCeiling(budgetMs, factor);
  const line =
    `[perf] ${label} : ${measuredMs.toFixed(1)} ms ; budget ${String(budgetMs)} ms, ` +
    `garde-fou ${ceilingMs.toFixed(0)} ms (× ${String(factor)})`;
  console.info(line);
  return { label, measuredMs, budgetMs, factor, ceilingMs, line };
}
