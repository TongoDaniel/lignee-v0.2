// Navigation principale : barre d'onglets de la charte, onglets de la V1 (src/navigation/tabs.ts).
import { Tabs } from 'expo-router/js-tabs';

import { useTranslator } from '../../i18n/I18nProvider';
import { MainTabBar } from '../../navigation/MainTabBar';
import { mainTabs } from '../../navigation/tabs';

export default function TabsLayout() {
  const { t } = useTranslator();
  return (
    <Tabs tabBar={(props) => <MainTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {mainTabs.map((tab) => (
        <Tabs.Screen key={tab.route} name={tab.route} options={{ title: t(tab.label) }} />
      ))}
    </Tabs>
  );
}
