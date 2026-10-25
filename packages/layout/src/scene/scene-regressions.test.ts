// Contre-exemples trouvés par les propriétés du dessin (T-017), rejoués avec leur graine figée :
// ils ne reposent plus sur le hasard de la CI.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { crossedCards, referenceSpec } from '../test-support/scene-checks';
import { treeViewArbitrary } from '../test-support/view-arbitrary';
import { layoutTree } from '../tree-layout';
import { buildScene } from './scene';

describe('contre-exemples figés', () => {
  it('foyer replié dont le conjoint est sur une autre rangée : la pastille se pose sous le départ, pas sous le conjoint', () => {
    // Graine de la CI de #48 (propriété « repli par défaut et tout déplié », 51e arbre) : le chef
    // de famille a une épouse deux rangées plus bas (union entre générations) et une fiche
    // empilée sous lui ; le tronc vertical vers la pastille traversait cette fiche.
    const [[view, textScale]] = fc
      .sample(fc.tuple(treeViewArbitrary(), fc.constantFrom(1, 1.3, 2)), {
        seed: 1901410143,
        numRuns: 51,
      })
      .slice(50) as [
      [ReturnType<typeof treeViewArbitrary> extends fc.Arbitrary<infer T> ? T : never, number],
    ];
    const layout = layoutTree(view.tree, view.centerId);
    // Le cas est bien présent : une famille repliée avec un lien de couple entre deux rangées.
    const folded = layout.links.filter(
      (link) => link.nature === 'couple' && layout.families.get(link.key)?.folded === true,
    );
    expect(folded.length).toBeGreaterThan(0);
    const scene = buildScene(layout, referenceSpec({ textScale }));
    expect(crossedCards(scene)).toEqual([]);
  });
});
