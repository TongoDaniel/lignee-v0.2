// Onglet Arbre. L'arbre lui-même arrive avec T-017 (Skia). En développement, un lien mène à la
// page de revue des composants de la charte (src/app/catalog.tsx).
import { Button } from '@lignee/ui';
import { router } from 'expo-router';

import { useTranslator } from '../../i18n/I18nProvider';
import { EmptyTabScreen } from '../../screens/EmptyTabScreen';

/** Page de revue des composants (développement seulement). */
const CATALOG_ROUTE = '/catalog';

export default function TreeScreen() {
  const { t } = useTranslator();
  return (
    <EmptyTabScreen
      testID="screen-tree"
      title={t('common:treeScreen.title')}
      message={t('common:treeScreen.empty')}
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
