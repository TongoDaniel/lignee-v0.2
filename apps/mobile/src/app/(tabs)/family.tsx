// Onglet Famille : membres de l'arbre et invitations (tickets de la collaboration).
import { useTranslator } from '../../i18n/I18nProvider';
import { EmptyTabScreen } from '../../screens/EmptyTabScreen';

export default function FamilyScreen() {
  const { t } = useTranslator();
  return (
    <EmptyTabScreen
      testID="screen-family"
      title={t('common:familyScreen.title')}
      message={t('common:familyScreen.empty')}
    />
  );
}
