// Étape 6 de la disposition (TRD) : l'implexe. Chaque personne n'a qu'une fiche (ARB-06) ; ce qui
// la relie ailleurs que sous sa famille passe par un lien : une famille et un enfant rangé dans une
// autre fratrie (mariage entre cousins), une famille et un enfant sur une rangée non voisine
// (union entre générations, CL-FAM-10), deux conjoints sur deux rangées, une filiation secondaire.
// Quand un lien traverserait plus de deux rangées ou croiserait trop de traits des foyers, il
// devient un renvoi « voir aussi » vers la fiche déjà dessinée. Règles retenues : ADR 0024.
import type { Id } from '@lignee/domain';

import type { Blocks } from './blocks';
import type { Visibility } from './folding';
import type { GridPoint, LinkNature, PlacedFamily, PlacedLink, PlacedPerson } from './layout-types';
import type { TreeStructure } from './types';

/** Au-delà de cet écart de rangées, un lien devient un renvoi « voir aussi » (TRD, étape 6). */
export const MAX_LINE_ROW_SPAN = 2;
/**
 * Au-delà de ce nombre de traits de foyers croisés, un lien devient un renvoi « voir aussi ».
 * Le cahier dit « trop d'autres traits » sans chiffre : valeur retenue par l'ADR 0024, à revoir
 * avec la revue visuelle de T-017.
 */
export const MAX_LINE_CROSSINGS = 4;

const EPSILON = 1e-9;

interface Segment {
  readonly from: GridPoint;
  readonly to: GridPoint;
}

function side(a: GridPoint, b: GridPoint, c: GridPoint): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(value) < EPSILON ? 0 : Math.sign(value);
}

/** Vrai si les deux segments se coupent en un point intérieur à chacun (pas aux extrémités). */
function cross(p: Segment, q: Segment): boolean {
  return (
    side(p.from, p.to, q.from) * side(p.from, p.to, q.to) < 0 &&
    side(q.from, q.to, p.from) * side(q.from, q.to, p.to) < 0
  );
}

/** Rangée d'un point de la grille (la demi-rangée appartient à la rangée du dessus). */
function rowOfPoint(point: GridPoint): number {
  return Math.floor(point.y + EPSILON);
}

/**
 * Liens hors des foyers, entre personnes dessinées seulement : un lien ne peut donc jamais
 * désigner une personne absente du graphe reçu (masquée pour le lecteur).
 */
export function computeLinks(
  structure: TreeStructure,
  visibility: Visibility,
  built: Blocks,
  familyOfBlock: ReadonlyMap<number, string | undefined>,
  people: ReadonlyMap<Id, PlacedPerson>,
  families: ReadonlyMap<string, PlacedFamily>,
): PlacedLink[] {
  const pending: Omit<PlacedLink, 'crossings' | 'drawing'>[] = [];
  /** Traits parent-enfant des foyers, par rangée du point d'attache. */
  const regularByRow = new Map<number, Segment[]>();
  const point = (person: PlacedPerson): GridPoint => ({ x: person.x, y: person.y });

  for (const family of families.values()) {
    const anchor = family.anchor;
    if (anchor === undefined) continue;
    const anchorRow = rowOfPoint(anchor);
    const first = family.parentIds[0] as Id;
    if (!family.folded) {
      for (const childId of family.shownChildren) {
        const child = people.get(childId);
        if (child === undefined) continue;
        const nextRow = child.row === anchorRow + 1;
        if (nextRow && familyOfBlock.get(built.blockOf.get(childId) ?? -1) === family.key) {
          const list = regularByRow.get(anchorRow);
          const segment = { from: anchor, to: point(child) };
          if (list === undefined) regularByRow.set(anchorRow, [segment]);
          else list.push(segment);
          continue;
        }
        const nature: LinkNature = nextRow ? 'elsewhere' : 'long';
        pending.push({
          nature,
          key: family.key,
          fromId: first,
          toId: childId,
          from: anchor,
          to: point(child),
          rowSpan: child.row - anchorRow,
        });
      }
    }
    if (family.kind === 'foyer') {
      const [hubId, partnerId] = family.parentIds;
      const hub = hubId === undefined ? undefined : people.get(hubId);
      const partner = partnerId === undefined ? undefined : people.get(partnerId);
      if (hub !== undefined && partner !== undefined && hub.row !== partner.row) {
        pending.push({
          nature: 'couple',
          key: family.key,
          fromId: hub.personId,
          toId: partner.personId,
          from: point(hub),
          to: point(partner),
          rowSpan: partner.row - hub.row,
        });
      }
    }
  }

  for (const link of structure.crossLinks) {
    if (link.role !== 'secondary') continue;
    const parent = people.get(link.fromId);
    const child = people.get(link.toId);
    if (parent === undefined || child === undefined) continue;
    pending.push({
      nature: 'secondary',
      key: link.id,
      fromId: link.fromId,
      toId: link.toId,
      from: point(parent),
      to: point(child),
      rowSpan: child.row - parent.row,
    });
  }

  const links = pending.map((link): PlacedLink => {
    // Seuls les traits des rangées que le lien traverse peuvent le croiser.
    const top = Math.min(link.from.y, link.to.y);
    const bottom = Math.max(link.from.y, link.to.y);
    let crossings = 0;
    for (let row = Math.floor(top) - 1; row <= Math.ceil(bottom); row += 1) {
      for (const segment of regularByRow.get(row) ?? []) {
        if (cross(link, segment)) crossings += 1;
      }
    }
    const seeAlso = Math.abs(link.rowSpan) > MAX_LINE_ROW_SPAN || crossings > MAX_LINE_CROSSINGS;
    return { ...link, crossings, drawing: seeAlso ? 'seeAlso' : 'line' };
  });
  // Ordre du dessin : du haut vers le bas, de gauche à droite ; la découverte départage.
  const discovery = (link: PlacedLink) =>
    Math.min(
      visibility.order.get(link.fromId) ?? Infinity,
      visibility.order.get(link.toId) ?? Infinity,
    );
  return links.sort(
    (a, b) =>
      a.from.y - b.from.y ||
      a.from.x - b.from.x ||
      a.to.y - b.to.y ||
      a.to.x - b.to.x ||
      discovery(a) - discovery(b) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}
