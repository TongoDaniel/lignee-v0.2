// Propriétés du dessin (T-017) sur des arbres générés (polygamie, implexe, unions entre
// générations, parents non précisés) : la scène respecte ses invariants (aucun chevauchement en
// pixels, angles droits, aucun trait de foyer à travers une fiche) ; l'index spatial donne le même
// résultat qu'une recherche exhaustive ; une zone de 48 pixels suffit à toucher chaque fiche, même
// dézoomée ; le parcours accessible atteint toute personne reliée à la personne centrale sans
// aucun geste (ACC-06).
import type { Id } from '@lignee/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TreeLayout } from '../layout-types';
import { zoomLevelFor } from '../scene/levels';
import { buildOutline } from '../scene/outline';
import { buildScene } from '../scene/scene';
import { cullScene, drawnCount, hitTest, indexScene } from '../scene/scene-index';
import { toWorld, visibleRect, type Viewport } from '../scene/viewport';
import { expectSceneInvariants, referenceSpec } from '../test-support/scene-checks';
import { treeViewArbitrary } from '../test-support/view-arbitrary';
import { layoutPrepared, layoutTree, prepareTree } from '../tree-layout';
import type { LayoutGraph } from '../types';

const viewArbitrary = treeViewArbitrary();

function unfoldedLayout(graph: LayoutGraph, centerId: Id): TreeLayout {
  const prepared = prepareTree(graph, centerId);
  const folds = new Map([...prepared.families.families.keys()].map((key) => [key, false]));
  return layoutPrepared(prepared, { folds });
}

describe('propriétés de la scène à peindre (T-017)', { timeout: 120_000 }, () => {
  it('repli par défaut et tout déplié : les invariants tiennent, texte à 100 % et à 200 %', () => {
    const seen = { lines: 0, seeAlso: 0, counters: 0, blockedUnions: 0 };
    fc.assert(
      fc.property(viewArbitrary, fc.constantFrom(1, 1.3, 2), ({ tree, centerId }, textScale) => {
        const spec = referenceSpec({ textScale });
        for (const layout of [layoutTree(tree, centerId), unfoldedLayout(tree, centerId)]) {
          const scene = buildScene(layout, spec);
          expectSceneInvariants(layout, scene);
          seen.lines += scene.edges.filter((edge) => edge.kind === 'link').length;
          seen.seeAlso += scene.seeAlso.length;
          seen.counters += scene.counters.length;
          seen.blockedUnions += scene.edges.filter(
            (edge) =>
              edge.kind === 'union' &&
              edge.points.length === 4 &&
              edge.points[1]?.y !== edge.points[2]?.y,
          ).length;
        }
      }),
      { numRuns: 60 },
    );
    // Les arbres générés doivent exercer les liens, les renvois et les pastilles.
    expect(seen.lines).toBeGreaterThan(0);
    expect(seen.seeAlso).toBeGreaterThan(0);
    expect(seen.counters).toBeGreaterThan(0);
  });

  it('l’index spatial rend exactement ce que touche la zone, ni plus ni moins', () => {
    fc.assert(
      fc.property(
        viewArbitrary,
        fc.record({
          scale: fc.double({ min: 0.3, max: 2, noNaN: true }),
          shiftX: fc.double({ min: -1500, max: 1500, noNaN: true }),
          shiftY: fc.double({ min: -1500, max: 1500, noNaN: true }),
          margin: fc.constantFrom(0, 0.5, 1),
        }),
        ({ tree, centerId }, { scale, shiftX, shiftY, margin }) => {
          const layout = unfoldedLayout(tree, centerId);
          const scene = buildScene(layout, referenceSpec());
          const index = indexScene(scene);
          const viewport: Viewport = { scale, x: shiftX, y: shiftY };
          const area = visibleRect(viewport, { width: 360, height: 800 }, margin);
          const culled = cullScene(index, area);
          const touches = (rect: { left: number; top: number; right: number; bottom: number }) =>
            rect.left <= area.right &&
            area.left <= rect.right &&
            rect.top <= area.bottom &&
            area.top <= rect.bottom;
          const { spec } = scene;
          const expectedPeople = scene.people.filter((person) =>
            touches({
              left: person.x - spec.nodeWidth / 2,
              right: person.x + spec.nodeWidth / 2,
              top: person.y - spec.cardTop,
              bottom: person.y + spec.cardBottom,
            }),
          );
          expect(new Set(culled.people.map((person) => person.id))).toEqual(
            new Set(expectedPeople.map((person) => person.id)),
          );
          // Jamais plus que la scène, et rien de dessiné hors de la zone.
          expect(drawnCount(culled)).toBeLessThanOrEqual(
            scene.people.length +
              scene.missing.length +
              scene.counters.length +
              scene.marks.length +
              scene.edges.length,
          );
        },
      ),
      { numRuns: 60 },
    );
  });

  it('chaque fiche se touche avec une zone de 48 pixels à l’écran, même en vue d’ensemble', () => {
    fc.assert(
      fc.property(
        viewArbitrary,
        fc.constantFrom(0.35, 0.5, 1, 1.5),
        ({ tree, centerId }, scale) => {
          const layout = layoutTree(tree, centerId);
          const spec = referenceSpec();
          const scene = buildScene(layout, spec);
          const index = indexScene(scene);
          const level = zoomLevelFor(scale, spec.zoom);
          const reach = spec.touchTarget / 2 / scale;
          for (const person of scene.people) {
            // Au centre de l'avatar, et au bord de la zone de 48 pixels : la fiche, ou une voisine
            // plus proche de ce point, est touchée ; jamais le vide.
            for (const [dx, dy] of [
              [0, 0],
              [reach * 0.95, 0],
              [-reach * 0.95, 0],
              [0, reach * 0.95],
              [0, -reach * 0.95],
            ] as const) {
              const hit = hitTest(index, { x: person.x + dx, y: person.y + dy }, { scale, level });
              expect(hit).toBeDefined();
            }
            // Au zoom standard ou plus, le centre d'un avatar touche cette personne (ailleurs, une
            // voisine ou une pastille dans la même zone de 48 pixels peut l'emporter).
            if (scale >= 1) {
              const center = hitTest(index, { x: person.x, y: person.y }, { scale, level });
              expect(center?.kind === 'person' && center.person.id === person.id).toBe(true);
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('parcours accessible : toute personne atteinte par la disposition se rejoint sans geste', () => {
    let hidden = 0;
    let followed = 0;
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        // Repli par défaut : certaines personnes ne sont pas dessinées, la liste les atteint.
        const layout = layoutTree(tree, centerId);
        const outline = buildOutline(layout);
        expect(new Set(outline.keys())).toEqual(new Set(layout.structure.rowOf.keys()));
        const reached = new Set<Id>([centerId]);
        const queue: Id[] = [centerId];
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          const entry = outline.get(id);
          if (entry === undefined) continue;
          const next = [
            ...entry.parents.flatMap((parents) => parents.parentIds),
            ...entry.unions.flatMap((union) => [
              ...(union.partnerId === undefined ? [] : [union.partnerId]),
              ...union.childIds,
            ]),
            ...entry.links.map((link) => link.otherId),
          ];
          for (const other of next) {
            if (!reached.has(other)) {
              reached.add(other);
              queue.push(other);
            }
          }
        }
        expect(reached).toEqual(new Set(layout.structure.rowOf.keys()));
        for (const entry of outline.values()) if (!entry.drawn) hidden += 1;
        for (const entry of outline.values())
          if (entry.unions.some((u) => u.folded && u.childIds.length > 0)) followed += 1;
      }),
      { numRuns: 60 },
    );
    expect(hidden).toBeGreaterThan(0);
    expect(followed).toBeGreaterThan(0);
  });

  it('les libellés ne portent aucun identifiant interne : la scène n’expose que des identifiants de personnes', () => {
    fc.assert(
      fc.property(viewArbitrary, ({ tree, centerId }) => {
        const layout = unfoldedLayout(tree, centerId);
        const scene = buildScene(layout, referenceSpec());
        const people = new Set(layout.people.keys());
        for (const mark of scene.marks) {
          expect(people.has(mark.personId)).toBe(true);
          if (mark.kind === 'seeAlso')
            for (const target of mark.targets) expect(people.has(target)).toBe(true);
        }
        // Un point de l'écran retombe sur le monde puis revient au même endroit.
        const viewport: Viewport = { scale: 0.7, x: 120, y: -40 };
        const back = toWorld(viewport, { x: 10, y: 20 });
        expect(back.x * viewport.scale + viewport.x).toBeCloseTo(10, 6);
      }),
      { numRuns: 20 },
    );
  });
});
