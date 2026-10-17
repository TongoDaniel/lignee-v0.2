// Arbitraire des propriétés de la disposition : un arbre généré et une personne centrale.
// `treeArbitrary({ rates: 'varied' })` tire chaque probabilité entre 0 et un plafond, et
// fast-check y favorise les bornes : beaucoup d'arbres sortent sans union ni filiation. Ici, les
// probabilités qui font les cas de T-008 (mariage, polygamie, enfant de mère non précisée,
// remariage, lévirat, sororat, implexe, adoption) restent hautes, et la personne centrale est
// prise dans la plus grande famille reliée de l'arbre. Une part des tirages garde l'arbitraire
// de packages/domain, pour les formes extrêmes. Réservé aux tests.
import type { Id } from '@lignee/domain';
import {
  DEFAULT_TREE_GENERATOR_RATES,
  deterministicIds,
  generateTree,
  treeArbitrary,
  type GeneratedTree,
} from '@lignee/domain/test-support';
import fc from 'fast-check';

const rate = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

/** Arbres riches en polygamie, unions successives et parents non précisés. */
export function familyTreeArbitrary(maxSize = 150): fc.Arbitrary<GeneratedTree> {
  return fc
    .record({
      seed: fc.integer({ min: 0, max: 0x7fffffff }),
      size: fc.integer({ min: 2, max: maxSize }),
      polygamy: rate(0.2, 0.8),
      unknownParent: rate(0.3, 1),
      remarriage: rate(0.3, 1),
      levirate: rate(0.3, 1),
      sororate: rate(0.1, 0.9),
      implex: rate(0.05, 0.5),
      withinTree: rate(0.1, 0.7),
      adoption: rate(0, 0.3),
      placeholder: rate(0, 0.4),
    })
    .map(({ seed, size, ...rates }) =>
      generateTree({
        seed,
        size,
        rates: { ...DEFAULT_TREE_GENERATOR_RATES, marriage: 0.95, ...rates },
      }),
    );
}

/**
 * Ajoute des unions entre des personnes tirées au hasard, souvent de générations différentes
 * (« union entre générations », TRD étape 1) : le générateur n'en produit pas, et ce sont elles
 * qui donnent des traits longs. Chaque couple tiré `[i, j]` désigne deux personnes par leur
 * position ; un couple déjà uni ou une même personne est ignoré. Rang : le suivant de chacun.
 */
export function withCrossUnions(
  tree: GeneratedTree,
  couples: readonly (readonly [number, number])[],
): GeneratedTree {
  if (tree.people.length < 2 || couples.length === 0) return tree;
  const nextId = deterministicIds(1_800_000_000_000 + tree.seed);
  const unions = [...tree.unions];
  const rankOf = (id: Id) =>
    Math.max(
      0,
      ...unions.flatMap((union) =>
        union.spouses.filter((spouse) => spouse.personId === id).map((spouse) => spouse.rank),
      ),
    ) + 1;
  for (const [i, j] of couples) {
    const a = tree.people[i % tree.people.length]?.id;
    const b = tree.people[j % tree.people.length]?.id;
    if (a === undefined || b === undefined || a === b) continue;
    const united = unions.some((union) =>
      union.spouses.every((spouse) => spouse.personId === a || spouse.personId === b),
    );
    if (united) continue;
    unions.push({
      id: nextId(),
      treeId: tree.tree.id,
      type: 'unspecified',
      spouses: [
        { personId: a, rank: rankOf(a) },
        { personId: b, rank: rankOf(b) },
      ],
    });
  }
  return { ...tree, unions };
}

/** Personnes de la plus grande famille reliée (filiations et unions), dans l'ordre de l'arbre. */
export function largestFamily(tree: GeneratedTree): Id[] {
  const parent = new Map<Id, Id>(tree.people.map((person) => [person.id, person.id]));
  const find = (id: Id): Id => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    parent.set(id, root);
    return root;
  };
  const join = (a: Id, b: Id) => parent.set(find(a), find(b));
  for (const filiation of tree.filiations) join(filiation.parentId, filiation.childId);
  for (const union of tree.unions) join(union.spouses[0].personId, union.spouses[1].personId);
  const sizes = new Map<Id, number>();
  for (const person of tree.people) {
    const root = find(person.id);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  let best: Id | undefined;
  for (const [root, size] of sizes)
    if (best === undefined || size > (sizes.get(best) ?? 0)) best = root;
  return tree.people.map((person) => person.id).filter((id) => find(id) === best);
}

/** Un arbre et une personne centrale. */
export interface TreeView {
  tree: GeneratedTree;
  centerId: Id;
}

export function treeViewArbitrary(maxSize = 150): fc.Arbitrary<TreeView> {
  return fc
    .oneof(
      { weight: 3, arbitrary: familyTreeArbitrary(maxSize) },
      {
        weight: 1,
        arbitrary: fc
          .tuple(
            familyTreeArbitrary(maxSize),
            fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 4 }),
          )
          .map(([tree, couples]) => withCrossUnions(tree, couples)),
      },
      { weight: 1, arbitrary: treeArbitrary({ minSize: 1, maxSize }) },
    )
    .chain((tree) =>
      fc.record({
        tree: fc.constant(tree),
        centerId: fc.constantFrom(...largestFamily(tree)),
      }),
    );
}
