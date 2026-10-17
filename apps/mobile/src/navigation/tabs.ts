// Onglets de la barre principale en V1.
//
// La charte (components/BarreOnglets) prévoit Arbre, Famille, Santé, Mémoire, dans cet ordre.
// Santé est la V3 (calque santé, après l'analyse d'impact) et Mémoire la V2 (PRD, « Mémoire ») :
// ils n'apparaissent pas en V1 (doute n° 5 de docs/plan/v1-decoupage.md, ADR 0015). Quand ils arriveront,
// ils s'ajoutent ici, à leur place dans l'ordre de la charte.
import type { MessageKey } from '@lignee/i18n';
import type { ComponentType } from 'react';

import { FamilyIcon } from '../icons/FamilyIcon';
import { TreeSymbolIcon, type IconProps } from '../icons/TreeSymbolIcon';

export interface MainTab {
  /** Nom de la route dans app/(tabs)/ (fichier sans extension). */
  readonly route: string;
  /** Libellé de l'onglet, lu aussi par le lecteur d'écran. */
  readonly label: MessageKey & `common:navigation.${string}`;
  /** Ce que fait l'onglet, lu par le lecteur d'écran après le libellé. */
  readonly hint: MessageKey & `common:navigation.${string}`;
  readonly Icon: ComponentType<IconProps>;
}

export const mainTabs: readonly MainTab[] = [
  {
    route: 'index',
    label: 'common:navigation.tree',
    hint: 'common:navigation.treeHint',
    Icon: TreeSymbolIcon,
  },
  {
    route: 'family',
    label: 'common:navigation.family',
    hint: 'common:navigation.familyHint',
    Icon: FamilyIcon,
  },
];
