// Parcours accessible de l'arbre (T-017 ; TRD, « Accessibilité » ; PRD, ACC-06 : « Tout l'arbre se
// parcourt sans pincer ni glisser »). Un dessin Skia n'est lu ni par TalkBack ni par VoiceOver :
// l'arbre a une vue liste équivalente, navigable personne par personne — parents, conjoints dans
// l'ordre des rangs, enfants par foyer. Ce module ne fait que ranger ce que la structure sait ; les
// phrases viennent de `packages/i18n`, les noms du graphe déjà filtré pour le lecteur.
//
// Tout le monde y est, dessiné ou non : les enfants d'un foyer replié, les parents d'une branche
// repliée ne sont jamais hors d'atteinte d'un lecteur d'écran ni d'un doigt qui ne glisse pas.
import type { Id } from '@lignee/domain';

import { unspecifiedKey } from '../folding';
import type { LinkNature, TreeLayout } from '../layout-types';
import type { Foyer, MissingParent } from '../types';

/** Les parents d'une personne, dans un foyer ou seul (l'autre parent n'est pas précisé). */
export interface OutlineParents {
  /** Clé de la famille, pour la déplier ou la replier ; jamais affichée. */
  readonly familyKey: string;
  readonly parentIds: readonly Id[];
  /** Parent connu seul : le parent manquant (« mère non précisée »). */
  readonly missing: MissingParent | undefined;
}

/** Un foyer de la personne (une union, ou deux parents), ou sa colonne « parent non précisé ». */
export interface OutlineUnion {
  readonly familyKey: string;
  readonly kind: 'foyer' | 'unspecified';
  /** Le conjoint ; absent pour la colonne « parent non précisé ». */
  readonly partnerId: Id | undefined;
  readonly missing: MissingParent | undefined;
  readonly childIds: readonly Id[];
  /** Les enfants ne sont pas dessinés : le foyer est replié. */
  readonly folded: boolean;
  /** Union terminée (date de fin, décès, séparation). */
  readonly ended: boolean;
}

/** Une fiche liée ailleurs que dans son foyer : adoption à côté de la naissance, « a élevé »… */
export interface OutlineLink {
  readonly otherId: Id;
  readonly nature: LinkNature;
  /** Renvoi « Voir aussi » plutôt qu'un trait. */
  readonly seeAlso: boolean;
}

export interface OutlineEntry {
  readonly personId: Id;
  /** Dessinée sur l'arbre (sinon on y accède par la liste seulement). */
  readonly drawn: boolean;
  readonly parents: readonly OutlineParents[];
  /** Conjoints dans l'ordre des rangs (ARB-03, UNI-07), puis la colonne « non précisé ». */
  readonly unions: readonly OutlineUnion[];
  readonly links: readonly OutlineLink[];
  /** Branche repliée vers le haut : cette clé déplie les parents. */
  readonly foldedParentsKey: string | undefined;
}

/** Une entrée par personne atteinte, dans l'ordre du parcours de la disposition. */
export function buildOutline(layout: TreeLayout): ReadonlyMap<Id, OutlineEntry> {
  const { structure } = layout;

  const foyersOf = new Map<Id, Foyer[]>();
  const add = (id: Id, foyer: Foyer) => {
    const list = foyersOf.get(id);
    if (list === undefined) foyersOf.set(id, [foyer]);
    else list.push(foyer);
  };
  for (const foyer of structure.foyerOf.values()) {
    add(foyer.hubId, foyer);
    add(foyer.partnerId, foyer);
  }

  const linksOf = new Map<Id, OutlineLink[]>();
  const addLink = (id: Id, link: OutlineLink) => {
    const list = linksOf.get(id);
    if (list === undefined) linksOf.set(id, [link]);
    else list.push(link);
  };
  for (const link of layout.links) {
    // Une filiation qui range l'enfant ou une union est déjà dans ses parents et ses foyers : le
    // lien n'ajoute que le renvoi ou la filiation à côté.
    if (link.nature === 'secondary' || link.drawing === 'seeAlso') {
      const seeAlso = link.drawing === 'seeAlso';
      addLink(link.fromId, { otherId: link.toId, nature: link.nature, seeAlso });
      addLink(link.toId, { otherId: link.fromId, nature: link.nature, seeAlso });
    }
  }

  const entries = new Map<Id, OutlineEntry>();
  for (const personId of structure.rowOf.keys()) {
    const placement = structure.placementOf.get(personId);
    const parents: OutlineParents[] = [];
    if (placement?.kind === 'foyer') {
      const foyer = structure.foyerOf.get(placement.foyerKey);
      if (foyer !== undefined) {
        parents.push({
          familyKey: foyer.key,
          parentIds: [foyer.hubId, foyer.partnerId],
          missing: undefined,
        });
      }
    } else if (placement?.kind === 'unspecified') {
      const column = structure.unitOf.get(placement.parentId)?.unspecified;
      parents.push({
        familyKey: unspecifiedKey(placement.parentId),
        parentIds: [placement.parentId],
        missing: column?.missing ?? 'parent',
      });
    }

    const order = structure.unionOrderOf.get(personId) ?? [];
    const rank = (key: string) => {
      const at = order.indexOf(key);
      return at < 0 ? Infinity : at;
    };
    const foyers = [...(foyersOf.get(personId) ?? [])].sort((a, b) => rank(a.key) - rank(b.key));
    const unions: OutlineUnion[] = foyers.map((foyer) => ({
      familyKey: foyer.key,
      kind: 'foyer',
      partnerId: foyer.hubId === personId ? foyer.partnerId : foyer.hubId,
      missing: undefined,
      childIds: foyer.children,
      folded: layout.families.get(foyer.key)?.folded ?? true,
      ended: foyer.status === 'ended',
    }));
    const column = structure.unitOf.get(personId)?.unspecified;
    if (column !== undefined) {
      const key = unspecifiedKey(personId);
      unions.push({
        familyKey: key,
        kind: 'unspecified',
        partnerId: undefined,
        missing: column.missing,
        childIds: column.children.map((child) => child.childId),
        folded: layout.families.get(key)?.folded ?? true,
        ended: false,
      });
    }

    entries.set(personId, {
      personId,
      drawn: layout.people.has(personId),
      parents,
      unions,
      links: linksOf.get(personId) ?? [],
      foldedParentsKey: layout.people.get(personId)?.foldedParentsKey,
    });
  }
  return entries;
}

/**
 * Personne dessinée la plus proche de `personId` en suivant parents, conjoints, enfants et
 * liens (parcours en largeur, dans l'ordre de la liste). Elle-même si elle est dessinée. Sert à
 * revenir de la liste au dessin quand la personne choisie n'y est pas (foyer ou branche replié).
 */
export function nearestDrawn(outline: ReadonlyMap<Id, OutlineEntry>, personId: Id): Id | undefined {
  const seen = new Set<Id>([personId]);
  const queue: Id[] = [personId];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const entry = outline.get(id);
    if (entry === undefined) continue;
    if (entry.drawn) return id;
    const next = [
      ...entry.parents.flatMap((parents) => parents.parentIds),
      ...entry.unions.flatMap((union) => [
        ...(union.partnerId === undefined ? [] : [union.partnerId]),
        ...union.childIds,
      ]),
      ...entry.links.map((link) => link.otherId),
    ];
    for (const other of next) {
      if (!seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    }
  }
  return undefined;
}
