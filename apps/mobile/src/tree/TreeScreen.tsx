// Onglet Arbre (T-017) : ouvre la copie locale de l'arbre (T-016) et la dessine. Tant que la base
// s'ouvre, ou s'il n'y a rien à dessiner, la phrase d'attente de T-011 reste affichée. En
// développement, un lien mène à la page de revue des composants de la charte.
import type { Id } from '@lignee/domain';
import { Button } from '@lignee/ui';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useLocalDatabase } from '../db/LocalDatabaseProvider';
import { useTranslator } from '../i18n/I18nProvider';
import { profileRoute } from '../navigation/profileRoute';
import { EmptyTabScreen } from '../screens/EmptyTabScreen';
import { TreeView } from './TreeView';
import { readFirstTreeModel } from './treeModel';

/** Page de revue des composants (développement seulement). */
const CATALOG_ROUTE = '/catalog';

export function TreeScreen() {
  const { t } = useTranslator();
  const database = useLocalDatabase();
  const model = useMemo(
    () => (database.status === 'ready' ? readFirstTreeModel(database.db) : undefined),
    [database],
  );

  // Toucher une personne choisie, ou « Ouvrir la fiche », ouvre sa fiche dans cet arbre (T-024).
  const openPerson = useCallback(
    (personId: Id) => {
      if (model !== undefined) router.push(profileRoute(personId, model.treeId));
    },
    [model],
  );

  if (model !== undefined) return <TreeView model={model} onOpenPerson={openPerson} />;
  const message =
    database.status === 'opening'
      ? t('common:treeScreen.loading')
      : database.status === 'failed'
        ? t('common:treeScreen.failed')
        : t('common:treeScreen.empty');
  return (
    <EmptyTabScreen
      testID="screen-tree"
      title={t('common:treeScreen.title')}
      message={message}
      footer={
        __DEV__ ? (
          <Button
            testID="open-catalog"
            label={t('common:catalog.open')}
            variant="quiet"
            onPress={() => {
              router.push(CATALOG_ROUTE);
            }}
          />
        ) : undefined
      }
    />
  );
}
