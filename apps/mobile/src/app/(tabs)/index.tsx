// Onglet Arbre. L'arbre lui-même arrive avec T-017 (Skia).
import { useTranslator } from '../../i18n/I18nProvider';
import { EmptyTabScreen } from '../../screens/EmptyTabScreen';

export default function TreeScreen() {
  const { t } = useTranslator();
  return (
    <EmptyTabScreen
      testID="screen-tree"
      title={t('common:treeScreen.title')}
      message={t('common:treeScreen.empty')}
    />
  );
}
