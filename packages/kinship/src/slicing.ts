// Calcul découpé (TRD, Performance, Pratiques : « calculs du moteur de parenté […] découpés pour
// ne jamais bloquer l'interface plus de 50 ms » ; T-028, ADR 0026). Le moteur est écrit une seule
// fois, en générateurs : chaque boucle de travail passe par un point de pause (`pacer.due()`), et
// ne rend la main (`yield`) que si la tranche en cours est écoulée.
//
// - Calcul direct (`findRelationships`, `createKinshipGraph`) : le pas n'est jamais dû, le
//   générateur va d'un trait jusqu'au résultat (`drain`).
// - Calcul découpé (`runInSlices`) : le pas est dû quand l'horloge dépasse la fin de la tranche ;
//   le générateur s'arrête, la main revient à la boucle d'événements (`scheduler.yield`), puis le
//   calcul reprend là où il était. Le résultat est donc exactement celui du calcul direct.
//
// Paquet pur : ni minuterie ni horloge globale. L'appelant fournit les deux (`SliceScheduler`) ;
// sur le téléphone, `performance.now` et `setTimeout(…, 0)`.

/** Un calcul découpable : il rend la main par `yield`, et finit par rendre son résultat. */
export type Steps<T> = Generator<undefined, T, undefined>;

/**
 * Point de pause d'un calcul : `due()` dit si la tranche en cours est écoulée. `weight` : poids du
 * travail fait depuis le point précédent, 1 par défaut ; `HEAVY` pour un pas lourd (mise en forme
 * d'un chemin, tri, lot d'objets), qui lit toujours l'horloge.
 */
export interface Pacer {
  due(weight?: number): boolean;
}

/** Poids d'un pas lourd : l'horloge est lue à chaque fois. */
export const HEAVY = 16;

/** Le calcul direct : jamais de pause. */
export const NEVER_PAUSE: Pacer = { due: () => false };

/** Mène un calcul jusqu'au bout, sans jamais rendre la main. */
export function drain<T>(steps: Steps<T>): T {
  for (;;) {
    const step = steps.next();
    if (step.done === true) return step.value;
  }
}

/** Durée d'une tranche par défaut, en millisecondes de l'appareil (ADR 0026). */
export const DEFAULT_SLICE_MS = 8;
/** Durée maximale d'une tranche : le TRD interdit de bloquer l'interface plus de 50 ms. */
export const MAX_SLICE_MS = 50;
/**
 * Points de pause franchis entre deux lectures de l'horloge. Entre deux points, le travail est
 * de l'ordre de la microseconde sur un poste : 16 points restent bien sous la milliseconde sur
 * le téléphone, sans payer une lecture d'horloge à chaque pas.
 */
export const CLOCK_EVERY = 16;

/**
 * Horloge et main rendue, fournies par l'appelant. Sur le téléphone : `now: () =>
 * performance.now()`, `yield: () => new Promise((resolve) => setTimeout(resolve, 0))`. Dans un
 * test : une horloge simulée, pour un découpage reproductible.
 */
export interface SliceScheduler {
  /** Horloge monotone, en millisecondes. */
  now(): number;
  /** Rend la main à la boucle d'événements ; la promesse se résout quand le calcul peut reprendre. */
  yield(): Promise<void>;
}

/** Signal d'annulation : un `AbortSignal` convient (seul `aborted` est lu). */
export interface CancelSignal {
  readonly aborted: boolean;
}

export interface SliceOptions {
  scheduler: SliceScheduler;
  /** Durée visée d'une tranche, en millisecondes : plus de 0, au plus 50. Par défaut 8. */
  sliceMs?: number;
  /** Lu avant le calcul et à chaque reprise : annulé, le calcul s'arrête sans résultat. */
  signal?: CancelSignal;
}

/** Rejet d'un calcul découpé annulé par son signal. Aucun résultat partiel n'est rendu. */
export class KinshipCancelledError extends Error {
  constructor() {
    super('Kinship calculation cancelled');
    this.name = 'KinshipCancelledError';
  }
}

/** Valide la durée d'une tranche. */
export function sliceDuration(sliceMs: number | undefined): number {
  const value = sliceMs ?? DEFAULT_SLICE_MS;
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SLICE_MS) {
    throw new RangeError(
      `sliceMs must be greater than 0 and at most ${String(MAX_SLICE_MS)}, got ${String(value)}`,
    );
  }
  return value;
}

/** Pas d'une tranche : dû quand l'horloge, lue tous les `CLOCK_EVERY` points, passe la fin. */
class SlicePacer implements Pacer {
  private count = 0;
  deadline = 0;

  constructor(private readonly now: () => number) {}

  due(weight = 1): boolean {
    this.count += weight;
    if (this.count < CLOCK_EVERY) return false;
    this.count = 0;
    return this.now() >= this.deadline;
  }

  start(sliceMs: number): void {
    this.count = 0;
    this.deadline = this.now() + sliceMs;
  }
}

/**
 * Mène un calcul par tranches : chaque tranche dure environ `sliceMs` (plus le travail jusqu'au
 * point de pause suivant), puis la main revient à la boucle d'événements. Le résultat est celui
 * du calcul direct. Annulé (signal), le calcul s'arrête à la reprise suivante et la promesse est
 * rejetée par `KinshipCancelledError`, sans résultat partiel ; le graphe reste intact (ses caches
 * ne sont écrits qu'une fois un calcul fini).
 */
export async function runInSlices<T>(
  start: (pacer: Pacer) => Steps<T>,
  options: SliceOptions,
): Promise<T> {
  const sliceMs = sliceDuration(options.sliceMs);
  const { scheduler, signal } = options;
  // Lu à chaque fois : le signal change pendant les pauses.
  const cancelled = () => signal?.aborted === true;
  if (cancelled()) throw new KinshipCancelledError();
  const pacer = new SlicePacer(() => scheduler.now());
  pacer.start(sliceMs);
  const steps = start(pacer);
  for (;;) {
    const step = steps.next();
    if (step.done === true) return step.value;
    await scheduler.yield();
    if (cancelled()) throw new KinshipCancelledError();
    pacer.start(sliceMs);
  }
}
