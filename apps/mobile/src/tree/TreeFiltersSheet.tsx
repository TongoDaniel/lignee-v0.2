// Feuille des filtres de l'arbre (ARB-11, T-025) : côté de la famille, vie, foyer, branche. Chaque
// choix est une ligne de réglage de la charte (48 de haut au moins, 56 en mode Aînés) qui annonce
// combien de personnes il garde ; un seul filtre à la fois, retiré par « Retirer le filtre ». Rien
// ne se fait par geste. Les noms viennent du graphe déjà filtré pour le lecteur.
import type { Id } from '@lignee/domain';
import { Button, SettingsGroup, SettingsRow, Sheet, space, useTheme } from '@lignee/ui';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { useTranslator } from '../i18n/I18nProvider';
import type { FilterChoices, TreeFilter } from './treeFilters';
import { filterTestId, sameFilter } from './treeFilters';

export interface TreeFiltersSheetProps {
  readonly visible: boolean;
  readonly choices: FilterChoices;
  readonly active: TreeFilter | undefined;
  /** Nom d'une personne pour les libellés (« Rose Diallo »). */
  readonly nameOf: (id: Id) => string;
  /** Nombre de personnes que garderait ce filtre. */
  readonly countOf: (filter: TreeFilter) => number;
  readonly onChoose: (filter: TreeFilter) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

export function TreeFiltersSheet({
  visible,
  choices,
  active,
  nameOf,
  countOf,
  onChoose,
  onClear,
  onClose,
}: TreeFiltersSheetProps) {
  const { colors, typography } = useTheme();
  const { t } = useTranslator();

  const row = (filter: TreeFilter, label: string) => {
    const count = t('common:treeScreen.filters.count', { count: countOf(filter) });
    return (
      <SettingsRow
        key={filterTestId(filter)}
        testID={filterTestId(filter)}
        icon="reglages"
        label={label}
        value={
          sameFilter(active, filter) ? t('common:treeScreen.filters.chosen', { count }) : count
        }
        accessibilityHint={t('common:treeScreen.filters.rowHint')}
        onPress={() => {
          onChoose(filter);
        }}
      />
    );
  };

  const section = (title: string, rows: readonly ReactElement[]) =>
    rows.length === 0 ? null : (
      <View key={title} style={{ gap: space[2] }}>
        <Text accessibilityRole="header" style={[typography.titreCarte, { color: colors.texte }]}>
          {title}
        </Text>
        <SettingsGroup>{rows}</SettingsGroup>
      </View>
    );

  return (
    <Sheet
      testID="tree-filters"
      visible={visible}
      title={t('common:treeScreen.filters.title')}
      subtitle={t('common:treeScreen.filters.subtitle')}
      onClose={onClose}
      closeLabel={t('common:treeScreen.filters.close')}
    >
      {section(
        t('common:treeScreen.filters.sideTitle'),
        choices.sides.map((side) =>
          row(
            { kind: 'side', side },
            t(
              side === 'paternal'
                ? 'common:treeScreen.filters.paternal'
                : 'common:treeScreen.filters.maternal',
            ),
          ),
        ),
      )}
      {section(t('common:treeScreen.filters.vitalTitle'), [
        row({ kind: 'vital', status: 'living' }, t('common:treeScreen.filters.living')),
        row({ kind: 'vital', status: 'deceased' }, t('common:treeScreen.filters.deceased')),
      ])}
      {section(
        t('common:treeScreen.filters.foyerTitle'),
        choices.foyers.map((foyer) =>
          row(
            { kind: 'foyer', familyKey: foyer.familyKey },
            t('common:treeScreen.filters.foyerWith', { name: nameOf(foyer.partnerId) }),
          ),
        ),
      )}
      {section(
        t('common:treeScreen.filters.branchTitle'),
        choices.branchRoots.map((rootId) =>
          row(
            { kind: 'branch', rootId },
            t('common:treeScreen.filters.branchOf', { name: nameOf(rootId) }),
          ),
        ),
      )}
      {active === undefined ? null : (
        <Button
          testID="filter-clear"
          label={t('common:treeScreen.filters.clear')}
          variant="secondary"
          fullWidth
          onPress={onClear}
        />
      )}
    </Sheet>
  );
}
