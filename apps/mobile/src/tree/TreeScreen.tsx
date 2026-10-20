// Onglet Arbre (T-017) : ouvre la copie locale de l'arbre (T-016) et la dessine. Tant que la base
// s'ouvre, ou s'il n'y a rien à dessiner, la phrase d'attente de T-011 reste affichée. En
// développement, un lien mène à la page de revue des composants de la charte.
import { Button } from '@lignee/ui';
import { router } from 'expo-router';
import { useMemo } from 'react';

import { useLocalDatabase } from '../db/LocalDatabaseProvider';
import { useTranslator } from '../i18n/I18nProvider';
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

  if (model !== undefined) return <TreeView model={model} />;
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
