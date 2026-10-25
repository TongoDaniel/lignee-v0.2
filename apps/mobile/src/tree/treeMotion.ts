// Mouvement de l'arbre (T-018, 07-mouvement.md) : comment le cadre se déplace, et comment l'arbre
// « pousse ». Tout vient des jetons de mouvement de la charte ; rien ici ne touche Skia ni
// Reanimated, afin que les tests prouvent le choix « animé ou d'un coup » sans téléphone.
import type { Id } from '@lignee/domain';
import type { SceneEdge, TreeScene } from '@lignee/layout';
import { motion } from '@lignee/ui';

export type Bezier = readonly [number, number, number, number];

/** Comment le cadre passe d'une position à une autre. */
export type FramePlan =
  | { readonly animated: false }
  | { readonly animated: true; readonly duration: number; readonly easing: Bezier };

/**
 * Déplacement du cadre (retour à « Vous », boutons, ajustement). Réglage « Réduire les animations »
 * actif : jamais d'animation, le cadre change d'un coup (ARB-13). `instant` : le dessin a changé
 * (recentrage), il n'y a pas de trajet à animer entre deux dispositions.
 */
export function framePlan(reduceMotion: boolean, instant = false): FramePlan {
  if (reduceMotion || instant) return { animated: false };
  return {
    animated: true,
    duration: motion.duration.transition,
    easing: motion.easing.entreeSortie,
  };
}

/** Durées de la pousse, en millisecondes, tirées des jetons. */
export interface GrowthTiming {
  /** Un trait se trace (« arbre qui pousse »). */
  readonly edge: number;
  /** Une personne apparaît. */
  readonly person: number;
  /** Retard entre deux générations. */
  readonly stagger: number;
  readonly edgeEasing: Bezier;
  readonly personEasing: Bezier;
}

export const GROWTH_TIMING: GrowthTiming = {
  edge: motion.duration.arbre,
  person: motion.duration.transition,
  stagger: motion.duration.decalageGeneration,
  edgeEasing: motion.easing.entreeSortie,
  personEasing: motion.easing.sortie,
};

/** Ce qui déclenche une pousse : l'ouverture ou un nouveau centre, ou un foyer qui s'ouvre. */
export type GrowthTrigger =
  | { readonly id: number; readonly kind: 'opening' }
  | {
      readonly id: number;
      readonly kind: 'unfold';
      /** Scène avant l'ouverture : ce qui s'y trouvait déjà ne pousse pas. */
      readonly previous: TreeScene;
      /** Ordonnée de la pastille ou de la mention qui a ouvert le foyer. */
      readonly anchorY: number;
    };

export interface EdgeGrowth {
  readonly delay: number;
  /** Le trait se trace depuis son dernier point : il s'éloigne ainsi de l'origine. */
  readonly reversed: boolean;
}

export interface GrowthPlan {
  readonly id: number;
  readonly timing: GrowthTiming;
  /** Durée totale, retards compris : la pousse est finie après elle. */
  readonly total: number;
  /** Retard d'apparition de chaque personne qui pousse. */
  readonly persons: ReadonlyMap<Id, number>;
  /** Retard et sens de chaque trait qui pousse. */
  readonly edges: ReadonlyMap<SceneEdge, EdgeGrowth>;
  /**
   * Retard des places à compléter, pastilles et mentions : ils suivent la dernière génération.
   * Absent quand un foyer s'ouvre : ceux qui étaient déjà là ne clignotent pas.
   */
  readonly rest: number | undefined;
}

function edgeKey(edge: SceneEdge): string {
  return `${edge.familyKey}|${edge.kind}|${edge.childId ?? ''}`;
}

function gapTo(point: { readonly y: number }, anchorY: number): number {
  return Math.abs(point.y - anchorY);
}

function nearestGap(edge: SceneEdge, anchorY: number): number {
  return Math.min(...edge.points.map((point) => gapTo(point, anchorY)));
}

/**
 * Plan de pousse : les traits partent de l'origine, rangée après rangée, puis les personnes
 * apparaissent (07-mouvement.md). `undefined` quand rien ne doit bouger : réglage « Réduire les
 * animations » actif (l'arbre s'affiche directement), ou rien de nouveau à montrer.
 *
 * - Ouverture et nouveau centre : tout pousse depuis la personne centrale, qui est là d'emblée.
 * - Foyer ouvert : seuls les traits et personnes nouveaux poussent, depuis la pastille touchée.
 */
export function planGrowth(
  scene: TreeScene,
  trigger: GrowthTrigger,
  reduceMotion: boolean,
  timing: GrowthTiming = GROWTH_TIMING,
): GrowthPlan | undefined {
  if (reduceMotion) return undefined;
  const { unitY } = scene.spec;
  let anchorY: number;
  let people: readonly { readonly id: Id; readonly y: number }[];
  let edges: readonly SceneEdge[];
  if (trigger.kind === 'opening') {
    anchorY = scene.personById.get(scene.centerId)?.y ?? 0;
    people = scene.people;
    edges = scene.edges;
  } else {
    anchorY = trigger.anchorY;
    const knownEdges = new Set(trigger.previous.edges.map(edgeKey));
    people = scene.people.filter((person) => !trigger.previous.personById.has(person.id));
    edges = scene.edges.filter((edge) => !knownEdges.has(edgeKey(edge)));
  }
  if (people.length === 0 && edges.length === 0) return undefined;

  const rowsOf = (gap: number) => Math.round(gap / unitY);
  const firstRow = Math.min(
    ...people.map((person) => rowsOf(gapTo(person, anchorY))),
    ...edges.map((edge) => rowsOf(nearestGap(edge, anchorY))),
  );
  // La personne centrale est l'origine : elle est là avant les traits qui en partent.
  const origin = trigger.kind === 'opening' ? scene.centerId : undefined;

  const personDelays = new Map<Id, number>();
  for (const person of people) {
    // L'origine est là d'emblée : elle n'a pas de fondu, donc pas de retard à planifier.
    if (person.id === origin) continue;
    const generation = rowsOf(gapTo(person, anchorY)) - firstRow;
    personDelays.set(person.id, generation * timing.stagger + timing.edge / 2);
  }
  const edgeGrowth = new Map<SceneEdge, EdgeGrowth>();
  for (const edge of edges) {
    const first = edge.points[0];
    const last = edge.points[edge.points.length - 1];
    edgeGrowth.set(edge, {
      delay: (rowsOf(nearestGap(edge, anchorY)) - firstRow) * timing.stagger,
      reversed:
        first !== undefined && last !== undefined && gapTo(first, anchorY) > gapTo(last, anchorY),
    });
  }
  let total = 0;
  for (const delay of personDelays.values()) total = Math.max(total, delay + timing.person);
  for (const { delay } of edgeGrowth.values()) total = Math.max(total, delay + timing.edge);
  const rest = trigger.kind === 'opening' ? Math.max(0, ...personDelays.values()) : undefined;
  if (rest !== undefined) total = Math.max(total, rest + timing.person);
  return { id: trigger.id, timing, total, persons: personDelays, edges: edgeGrowth, rest };
}

/**
 * Avancement (0 à 1) d'un élément à `elapsed` millisecondes de pousse, selon la courbe de
 * Bézier (x1, y1, x2, y2). Appelée à chaque image sur le fil de l'interface : worklet.
 */
export function appearance(
  elapsed: number,
  delay: number,
  duration: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  'worklet';
  const t = (elapsed - delay) / duration;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let low = 0;
  let high = 1;
  let s = t;
  for (let step = 0; step < 24; step += 1) {
    const u = 1 - s;
    const x = 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s;
    if (x < t) low = s;
    else high = s;
    s = (low + high) / 2;
  }
  const u = 1 - s;
  return 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s;
}
