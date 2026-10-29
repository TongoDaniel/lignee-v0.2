// Filtres de l'arbre et vue « descendance » (ARB-11, ARB-14, T-025) : logique pure, sans Skia. Les
// arbres sont générés ou inventés (aucune donnée réelle). La non-fuite compare le graphe reçu à
// l'arbre entier : toute personne masquée doit rester absente de tout ce que les filtres et la vue
// produisent (ensembles, scène, parcours, fiches, textes).
import type { Id } from '@lignee/domain';
import { generateTree } from '@lignee/domain/tree-generator';
import { buildOutline, buildScene, layoutTree } from '@lignee/layout';
import { devReaderSnapshot } from '@lignee/sync/dev-seed';

import { canOpenDescendants, descendantsLayout, hasDescendants } from '../tree/descendantsView';
import { buildPersonCards } from '../tree/personCards';
import { sceneSpecFor } from '../tree/sceneSpec';
import {
  countPeople,
  filterChoices,
  matchingPeople,
  sameFilter,
  type FilterSource,
  type TreeFilter,
} from '../tree/treeFilters';
import { topCenterFrame } from '../tree/treeFrames';
import { modelFromSnapshot, type TreeModel } from '../tree/treeModel';
import { pierreModel } from '../testing/pierre';

const spec = sceneSpecFor({ seniorScale: 1, systemFontScale: 1, touchTarget: 48 });

/** Arbre généré lu par un lecteur : les objets restreints sont retirés (projection de dev). */
function readerModel(seed: number, size: number) {
  const generated = generateTree({ seed, size });
  const reader = generated.accounts[0];
  if (reader === undefined) throw new Error('no account');
  const snapshot = devReaderSnapshot(generated, reader.accountId);
  const model = modelFromSnapshot(snapshot);
  if (model === undefined) throw new Error('empty model');
  const visible = new Set(snapshot.people.map((person) => person.id));
  const hidden = new Set(
    generated.people.map((person) => person.id).filter((id) => !visible.has(id)),
  );
  return { model, hidden, visible };
}

function sourceOf(model: TreeModel, centerId: Id = model.centerId): FilterSource {
  const layout = layoutTree(model.graph, centerId);
  return { graph: model.graph, cards: model.cards, centerId, outline: buildOutline(layout) };
}

/** Tous les filtres que l'écran peut proposer pour cette disposition, plus la vie. */
function everyFilter(model: TreeModel, centerId: Id): TreeFilter[] {
  const source = sourceOf(model, centerId);
  const choices = filterChoices(source, layoutTree(model.graph, centerId));
  return [
    ...choices.sides.map((side) => ({ kind: 'side', side }) as const),
    { kind: 'vital', status: 'living' },
    { kind: 'vital', status: 'deceased' },
    ...choices.foyers.map((foyer) => ({ kind: 'foyer', familyKey: foyer.familyKey }) as const),
    ...choices.branchRoots.map((rootId) => ({ kind: 'branch', rootId }) as const),
  ];
}

describe('ARB-11 — les filtres n’affichent jamais une personne masquée', () => {
  // Plusieurs arbres, plusieurs graines : chacun a des personnes masquées pour ce lecteur.
  const seeds = [3, 7, 11, 19, 23];

  it('le jeu de test masque vraiment des personnes (le test ne serait pas vide)', () => {
    const hiddenCounts = seeds.map((seed) => readerModel(seed, 250).hidden.size);
    expect(Math.max(...hiddenCounts)).toBeGreaterThan(0);
  });

  it.each(seeds)(
    'graine %s : aucun filtre, aucune scène, aucun parcours ni fiche ne cite un masqué',
    (seed) => {
      const { model, hidden, visible } = readerModel(seed, 250);
      // Plusieurs centres : « Vous » et quelques autres personnes de l'arbre.
      const centers = [model.centerId, ...[...visible].filter((id) => id !== model.centerId)]
        .filter((id) => model.cards.get(id)?.placeholder === false)
        .slice(0, 6);
      let filtersSeen = 0;
      for (const centerId of centers) {
        const layout = layoutTree(model.graph, centerId);
        const outline = buildOutline(layout);
        const scene = buildScene(layout, spec, { supposedFiliations: model.supposedFiliations });
        const source = { graph: model.graph, cards: model.cards, centerId, outline };
        for (const filter of everyFilter(model, centerId)) {
          filtersSeen += 1;
          const matching = matchingPeople(filter, source);
          for (const id of matching) {
            expect(hidden.has(id)).toBe(false);
            expect(visible.has(id)).toBe(true);
          }
          expect(countPeople(matching, model.cards)).toBeLessThanOrEqual(visible.size);
        }
        // Dessin, parcours en liste et fiches : jamais un masqué.
        for (const id of [...scene.personById.keys(), ...outline.keys(), ...model.cards.keys()]) {
          expect(hidden.has(id)).toBe(false);
        }
        const text = JSON.stringify([...outline.values()]);
        for (const id of hidden) expect(text).not.toContain(id);
      }
      expect(filtersSeen).toBeGreaterThan(0);
    },
    30_000,
  );

  it.each(seeds)(
    'graine %s : la vue descendance ne montre aucun masqué, ni dans le dessin ni dans le parcours',
    (seed) => {
      const { model, hidden } = readerModel(seed, 250);
      let opened = 0;
      for (const [id, card] of model.cards) {
        if (card.placeholder) continue;
        const outline = buildOutline(layoutTree(model.graph, id));
        if (!canOpenDescendants(id, model.cards, outline)) continue;
        opened += 1;
        const layout = descendantsLayout(model.graph, id, new Map());
        const scene = buildScene(layout, spec, { supposedFiliations: model.supposedFiliations });
        for (const personId of [...scene.personById.keys(), ...buildOutline(layout).keys()]) {
          expect(hidden.has(personId)).toBe(false);
        }
        const text = JSON.stringify([...layout.people.keys(), layout.links]);
        for (const hiddenId of hidden) expect(text).not.toContain(hiddenId);
        if (opened >= 25) break;
      }
      expect(opened).toBeGreaterThan(0);
    },
    30_000,
  );
});

describe('ARB-14 — la descendance de Pierre', () => {
  it('montre ses trois foyers et leurs petits-enfants, dessinés avec la scène de l’arbre', () => {
    const { model, scenario } = pierreModel();
    const pierre = model.centerId;
    const layout = descendantsLayout(model.graph, pierre, new Map());
    const scene = buildScene(layout, spec, { supposedFiliations: model.supposedFiliations });
    const drawn = [...scene.personById.keys()].map((id) => scenario.keyOf(id)).sort();
    expect(drawn).toEqual(
      [
        'pierre',
        'rose',
        'odile',
        'clarisse',
        'jean',
        'anne',
        'marthe',
        'serge',
        'paul',
        'luc',
        'zoe',
        'lise',
        'noe',
        'tom',
        'ugo',
        'yvette',
        'vic',
      ].sort(),
    );
    // Trois foyers : les trois épouses sont à la demi-rangée de Pierre, ses enfants dessous.
    const outline = buildOutline(layout);
    const households = outline.get(pierre)?.unions.filter((union) => union.kind === 'foyer');
    expect(households?.map((union) => scenario.keyOf(union.partnerId ?? ''))).toEqual([
      'rose',
      'odile',
      'clarisse',
    ]);
    // Chaque foyer a son enfant, rangé dessous (une rangée plus bas que Pierre).
    expect(
      households?.map((union) => union.childIds.map((child) => scenario.keyOf(child))),
    ).toEqual([['jean'], ['marthe'], ['paul']]);
    for (const child of ['jean', 'marthe', 'paul']) {
      expect(layout.people.get(scenario.id(child))?.row).toBe(1);
    }
    // Petits-enfants (rangée 2) et arrière-petit-enfant (rangée 4), tout déplié.
    for (const grandchild of ['luc', 'lise', 'noe', 'tom']) {
      expect(layout.people.get(scenario.id(grandchild))?.row).toBe(2);
    }
    expect(layout.people.get(scenario.id('vic'))?.row).toBe(4);
    // Ni ses parents, ni son frère, ni la famille de la belle-fille.
    for (const outside of ['jacques', 'lea', 'andre', 'bruno', 'carla']) {
      expect(scene.personById.has(scenario.id(outside))).toBe(false);
    }
    // Chaque fiche une seule fois dans la scène.
    expect(scene.people.length).toBe(17);
  });

  it('l’ancêtre est en haut au centre du cadre, ses descendants vers le bas', () => {
    const { model } = pierreModel();
    const layout = descendantsLayout(model.graph, model.centerId, new Map());
    const scene = buildScene(layout, spec, { supposedFiliations: model.supposedFiliations });
    const frame = topCenterFrame(scene, model.centerId, { width: 360, height: 800 }, 24);
    const ancestor = scene.personById.get(model.centerId);
    if (ancestor === undefined) throw new Error('no ancestor');
    const screenX = ancestor.x * frame.scale + frame.x;
    const screenY = ancestor.y * frame.scale + frame.y;
    expect(screenX).toBeCloseTo(180);
    expect(screenY).toBeCloseTo(24 + spec.radius);
    for (const person of scene.people) {
      expect(person.y * frame.scale + frame.y).toBeGreaterThanOrEqual(screenY);
    }
  });

  it('seules les personnes qui ont des enfants offrent la vue', () => {
    const { model, scenario } = pierreModel();
    const can = (key: string) =>
      canOpenDescendants(
        scenario.id(key),
        model.cards,
        buildOutline(layoutTree(model.graph, scenario.id(key))),
      );
    expect(can('pierre')).toBe(true);
    expect(can('luc')).toBe(true);
    expect(can('vic')).toBe(false);
    expect(hasDescendants(undefined)).toBe(false);
  });
});

describe('critères de filtre prouvés sur un arbre inventé', () => {
  function withVitalStatus(
    pick: (key: string) => 'living' | 'deceased' | 'unknown',
    centerKey = 'luc',
  ) {
    const { model, scenario } = pierreModel(centerKey);
    const people = scenario.data.people.map((person) => ({
      ...person,
      vitalStatus: pick(scenario.keyOf(person.id)),
    }));
    const cards = buildPersonCards({
      people,
      names: scenario.data.names,
      facts: scenario.data.facts,
      nameOrder: scenario.data.tree.nameOrder,
    });
    return { scenario, source: { ...sourceOf(model), cards } };
  }

  it('vivants et décédés suivent le statut noté, jamais le contraire', () => {
    const { scenario, source } = withVitalStatus((key) =>
      key === 'jacques' ? 'deceased' : 'living',
    );
    const living = matchingPeople({ kind: 'vital', status: 'living' }, source);
    const deceased = matchingPeople({ kind: 'vital', status: 'deceased' }, source);
    expect([...deceased].map((id) => scenario.keyOf(id))).toEqual(['jacques']);
    expect(living.has(scenario.id('jacques'))).toBe(false);
    expect(living.has(scenario.id('luc'))).toBe(true);
    expect(living.size).toBe(scenario.data.people.length - 1);
  });

  it('un statut inconnu n’est ni vivant ni décédé', () => {
    const { source } = withVitalStatus(() => 'unknown');
    expect(matchingPeople({ kind: 'vital', status: 'living' }, source).size).toBe(0);
    expect(matchingPeople({ kind: 'vital', status: 'deceased' }, source).size).toBe(0);
  });

  it('les foyers proposés sont ceux de la personne au centre, dans l’ordre des rangs', () => {
    const { model, scenario } = pierreModel();
    const layout = layoutTree(model.graph, model.centerId);
    const choices = filterChoices(sourceOf(model), layout);
    expect(choices.foyers.map((foyer) => scenario.keyOf(foyer.partnerId))).toEqual([
      'rose',
      'odile',
      'clarisse',
    ]);
    const second = choices.foyers[1];
    if (second === undefined) throw new Error('no second household');
    const members = matchingPeople({ kind: 'foyer', familyKey: second.familyKey }, sourceOf(model));
    expect([...members].map((id) => scenario.keyOf(id)).sort()).toEqual(
      ['marthe', 'odile', 'pierre'].sort(),
    );
  });

  it('les branches proposées sont les parents et grands-parents dessinés au-dessus', () => {
    const { model, scenario } = pierreModel('jean');
    const layout = layoutTree(model.graph, model.centerId);
    const keys = filterChoices(sourceOf(model), layout).branchRoots.map((id) => scenario.keyOf(id));
    expect(keys).toContain('pierre');
    expect(keys).toContain('rose');
    expect(keys).toContain('jacques');
    // Les parents (rangée -1) précèdent les grands-parents (rangée -2).
    expect(keys.indexOf('pierre')).toBeLessThan(keys.indexOf('jacques'));
    // Ni la personne au centre ni ses enfants.
    expect(keys).not.toContain('jean');
    expect(keys).not.toContain('luc');
  });

  it('les côtés ne sont proposés que si le parent est connu et de genre noté', () => {
    const { model, scenario } = pierreModel('jean');
    const choices = filterChoices(sourceOf(model), layoutTree(model.graph, model.centerId));
    expect(choices.sides).toEqual(['paternal', 'maternal']);
    const members = matchingPeople({ kind: 'side', side: 'paternal' }, sourceOf(model));
    expect([...members].map((id) => scenario.keyOf(id)).sort()).toEqual(
      ['andre', 'jacques', 'lea', 'pierre'].sort(),
    );
    // Vu de Pierre, dont les parents sont notés mais pas ceux de Rose : un seul côté.
    const fromPierre = pierreModel('luc');
    const lucChoices = filterChoices(
      sourceOf(fromPierre.model),
      layoutTree(fromPierre.model.graph, fromPierre.model.centerId),
    );
    expect(lucChoices.sides).toEqual(['paternal', 'maternal']);
    const tom = pierreModel('tom');
    expect(
      filterChoices(sourceOf(tom.model), layoutTree(tom.model.graph, tom.model.centerId)).sides,
    ).toEqual(['paternal']);
  });

  it('deux filtres identiques se reconnaissent, deux différents non', () => {
    const paternal: TreeFilter = { kind: 'side', side: 'paternal' };
    expect(sameFilter(paternal, { kind: 'side', side: 'paternal' })).toBe(true);
    expect(sameFilter(paternal, { kind: 'side', side: 'maternal' })).toBe(false);
    expect(sameFilter(paternal, { kind: 'vital', status: 'living' })).toBe(false);
    expect(sameFilter(undefined, undefined)).toBe(true);
    expect(sameFilter(undefined, paternal)).toBe(false);
  });
});
