// Mouvement de l'arbre (T-018) : retour à « Vous », fil d'Ariane, pousse, réglage « Réduire les
// animations » (ARB-09, ARB-13). Logique pure : aucun téléphone ni Skia nécessaires.
import { generateTree } from '@lignee/domain/tree-generator';
import {
  buildScene,
  createTreeLayoutCache,
  toScreen,
  toggleFamily,
  type FoldChoices,
  type TreeScene,
} from '@lignee/layout';
import { motion, space } from '@lignee/ui';
import { devReaderSnapshot } from '@lignee/sync/dev-seed';

import { sceneSpecFor } from '../tree/sceneSpec';
import { modelFromSnapshot, type TreeModel } from '../tree/treeModel';
import { bottomCenterFrame } from '../tree/treeFrames';
import { appearance, framePlan, GROWTH_TIMING, planGrowth } from '../tree/treeMotion';
import { MAX_TRAIL_AFTER_YOU, recenterTrail, startTrail } from '../tree/trail';

const spec = sceneSpecFor({ seniorScale: 1, systemFontScale: 1, touchTarget: 48 });
const size = { width: 360, height: 800 };

function model(): TreeModel {
  const generated = generateTree({ seed: 7, size: 200 });
  const reader = generated.accounts[0];
  if (reader === undefined) throw new Error('no account');
  const built = modelFromSnapshot(devReaderSnapshot(generated, reader.accountId));
  if (built === undefined) throw new Error('empty model');
  return built;
}

function sceneAround(built: TreeModel, centerId: string, folds: FoldChoices = new Map()) {
  const layout = createTreeLayoutCache().layout(built.graph, centerId, folds);
  return { layout, scene: buildScene(layout, spec) };
}

describe('retour à « Vous » (ARB-09)', () => {
  it('met « Vous » en bas au centre de l’écran, à l’échelle standard', () => {
    const built = model();
    const { scene } = sceneAround(built, built.centerId);
    const frame = bottomCenterFrame(scene, built.centerId, size, space[6]);
    const you = scene.personById.get(built.centerId);
    if (you === undefined) throw new Error('you not drawn');
    expect(frame.scale).toBe(1);
    expect(toScreen(frame, you)).toEqual({
      x: size.width / 2,
      y: size.height - space[6] - spec.cardBottom,
    });
  });

  it('recentrer sur une autre personne déplace « Vous » : le retour doit recomposer le dessin', () => {
    const built = model();
    const { scene: home } = sceneAround(built, built.centerId);
    const youSpot = { x: size.width / 2, y: size.height - space[6] - spec.cardBottom };
    // Une personne dont le dessin recentré montre encore « Vous », ailleurs qu'à sa place.
    const found = home.people
      .filter((person) => person.id !== built.centerId)
      .map((person) => ({ person, moved: sceneAround(built, person.id).scene }))
      .find(({ moved }) => moved.personById.has(built.centerId));
    if (found === undefined) throw new Error('no recentered scene shows Vous');
    const frame = bottomCenterFrame(found.moved, found.person.id, size, space[6]);
    const you = found.moved.personById.get(built.centerId);
    if (you === undefined) throw new Error('you not drawn');
    expect(toScreen(frame, you)).not.toEqual(youSpot);
    // Le retour recompose autour de « Vous » : il est de nouveau à sa place.
    const back = bottomCenterFrame(home, built.centerId, size, space[6]);
    const homeYou = home.personById.get(built.centerId);
    if (homeYou === undefined) throw new Error('you not drawn');
    expect(toScreen(back, homeYou)).toEqual(youSpot);
  });
});

describe('fil d’Ariane', () => {
  it('s’allonge à chaque recentrage et « Vous » reste le premier', () => {
    let trail = startTrail('you');
    trail = recenterTrail(trail, 'a', 'you');
    trail = recenterTrail(trail, 'b', 'you');
    expect(trail).toEqual(['you', 'a', 'b']);
  });

  it('revenir à une étape du fil le raccourcit jusqu’à elle', () => {
    expect(recenterTrail(['you', 'a', 'b', 'c'], 'a', 'you')).toEqual(['you', 'a']);
  });

  it('revenir à « Vous » remet le fil à zéro', () => {
    expect(recenterTrail(['you', 'a', 'b'], 'you', 'you')).toEqual(['you']);
  });

  it('garde « Vous » et les plus récentes au-delà du maximum', () => {
    let trail = startTrail('you');
    for (let step = 0; step < MAX_TRAIL_AFTER_YOU + 3; step += 1) {
      trail = recenterTrail(trail, `p${String(step)}`, 'you');
    }
    expect(trail).toHaveLength(MAX_TRAIL_AFTER_YOU + 1);
    expect(trail[0]).toBe('you');
    expect(trail[trail.length - 1]).toBe(`p${String(MAX_TRAIL_AFTER_YOU + 2)}`);
  });
});

describe('cadre : animé ou d’un coup (ARB-13)', () => {
  it('réglage « Réduire les animations » actif : aucune animation demandée', () => {
    expect(framePlan(true)).toEqual({ animated: false });
  });

  it('réglage inactif : durée et courbe des jetons de mouvement', () => {
    expect(framePlan(false)).toEqual({
      animated: true,
      duration: motion.duration.transition,
      easing: motion.easing.entreeSortie,
    });
  });

  it('un recentrage change le dessin : le cadre arrive d’un coup même sans réglage', () => {
    expect(framePlan(false, true)).toEqual({ animated: false });
  });
});

describe('pousse de l’arbre (07-mouvement.md)', () => {
  const built = model();
  const { scene } = sceneAround(built, built.centerId);
  const open = { id: 1, kind: 'opening' } as const;

  it('réglage « Réduire les animations » actif : aucun plan, l’arbre s’affiche directement', () => {
    expect(planGrowth(scene, open, true)).toBeUndefined();
  });

  it('à l’ouverture, chaque personne et chaque trait a un retard, « Vous » d’abord', () => {
    const plan = planGrowth(scene, open, false);
    if (plan === undefined) throw new Error('no plan');
    expect(plan.persons.size).toBe(scene.people.length);
    expect(plan.edges.size).toBe(scene.edges.length);
    expect(plan.persons.get(built.centerId)).toBe(0);
    for (const [id, delay] of plan.persons) {
      if (id !== built.centerId) expect(delay).toBeGreaterThan(0);
    }
  });

  it('les générations se décalent de la valeur du jeton, les traits avant les personnes', () => {
    const plan = planGrowth(scene, open, false);
    if (plan === undefined) throw new Error('no plan');
    const you = scene.personById.get(built.centerId);
    if (you === undefined) throw new Error('you not drawn');
    const delays = new Set([...plan.edges.values()].map((edge) => edge.delay));
    const sorted = [...delays].sort((a, b) => a - b);
    expect(sorted[0]).toBe(0);
    for (const [a, b] of sorted.slice(1).map((d, i) => [sorted[i] ?? 0, d] as const)) {
      expect(b - a).toBe(motion.duration.decalageGeneration);
    }
    const firstPerson = Math.min(
      ...[...plan.persons].filter(([id]) => id !== built.centerId).map(([, delay]) => delay),
    );
    expect(firstPerson).toBeGreaterThan(0);
    expect(plan.timing).toEqual(GROWTH_TIMING);
    expect(plan.timing.edge).toBe(motion.duration.arbre);
  });

  it('la durée totale couvre le dernier élément à apparaître', () => {
    const plan = planGrowth(scene, open, false);
    if (plan === undefined) throw new Error('no plan');
    const lastPerson = Math.max(...plan.persons.values()) + plan.timing.person;
    const lastEdge =
      Math.max(...[...plan.edges.values()].map((edge) => edge.delay)) + plan.timing.edge;
    expect(plan.total).toBe(Math.max(lastPerson, lastEdge));
  });

  it('un trait se trace en s’éloignant de l’origine', () => {
    const plan = planGrowth(scene, open, false);
    if (plan === undefined) throw new Error('no plan');
    const you = scene.personById.get(built.centerId);
    if (you === undefined) throw new Error('you not drawn');
    for (const [edge, growth] of plan.edges) {
      const first = edge.points[0];
      const last = edge.points[edge.points.length - 1];
      if (first === undefined || last === undefined) continue;
      const from = growth.reversed ? last : first;
      const to = growth.reversed ? first : last;
      expect(Math.abs(from.y - you.y)).toBeLessThanOrEqual(Math.abs(to.y - you.y));
    }
  });

  it('ouvrir un foyer ne fait pousser que ce qui est nouveau', () => {
    const { layout } = sceneAround(built, built.centerId);
    const folded = [...layout.families.values()].find((family) => family.folded);
    if (folded === undefined) throw new Error('no folded family in the generated tree');
    const unfolded = buildScene(
      createTreeLayoutCache().layout(built.graph, built.centerId, toggleFamily(layout, folded.key)),
      spec,
    );
    const counter = scene.counters.find((c) => c.familyKey === folded.key);
    const anchorY = counter?.y ?? scene.personById.get(built.centerId)?.y ?? 0;
    const plan = planGrowth(unfolded, { id: 2, kind: 'unfold', previous: scene, anchorY }, false);
    if (plan === undefined) throw new Error('no plan for an unfolded family');
    expect(plan.persons.size).toBeGreaterThan(0);
    expect(plan.persons.size).toBeLessThan(unfolded.people.length);
    for (const id of plan.persons.keys()) expect(scene.personById.has(id)).toBe(false);
    expect(plan.persons.has(built.centerId)).toBe(false);
    expect(
      planGrowth(unfolded, { id: 2, kind: 'unfold', previous: scene, anchorY }, true),
    ).toBeUndefined();
  });

  it('sans rien de nouveau, aucune pousse n’est demandée', () => {
    const same: TreeScene = scene;
    expect(
      planGrowth(same, { id: 3, kind: 'unfold', previous: scene, anchorY: 0 }, false),
    ).toBeUndefined();
  });
});

describe('avancement d’un élément', () => {
  const [x1, y1, x2, y2] = motion.easing.sortie;
  const at = (elapsed: number, delay = 0, duration = 600) =>
    appearance(elapsed, delay, duration, x1, y1, x2, y2);

  it('part de 0, finit à 1 et ne bouge pas avant son retard', () => {
    expect(at(0)).toBe(0);
    expect(at(-10)).toBe(0);
    expect(at(100, 200)).toBe(0);
    expect(at(600)).toBe(1);
    expect(at(10_000)).toBe(1);
  });

  it('suit la courbe de sortie : plus de la moitié faite à mi-parcours, sans dépasser 1', () => {
    expect(at(300)).toBeGreaterThan(0.5);
    for (let t = 0; t <= 600; t += 20) {
      expect(at(t)).toBeGreaterThanOrEqual(0);
      expect(at(t)).toBeLessThanOrEqual(1);
    }
  });

  it('la courbe de sortie ne rebondit jamais (rien ne rebondit hors d’un ajout)', () => {
    let previous = 0;
    for (let t = 0; t <= 600; t += 10) {
      const value = at(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});
