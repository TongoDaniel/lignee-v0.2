// Barre d'onglets principale : adaptateur entre la navigation (Expo Router) et le composant
// `TabBar` de @lignee/ui (charte, components/BarreOnglets). Le composant dessine ; ici on traduit
// les libellés, on donne l'onglet courant et on relaie le toucher à la navigation.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { TabBar, type TabBarItem } from '@lignee/ui';

import { useTranslator } from '../i18n/I18nProvider';
import { mainTabs } from './tabs';

export function MainTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useTranslator();

  const items: TabBarItem[] = [];
  for (const route of state.routes) {
    const tab = mainTabs.find((candidate) => candidate.route === route.name);
    if (tab === undefined) continue;
    items.push({
      key: route.key,
      label: t(tab.label),
      hint: t(tab.hint),
      icon: tab.icon,
      testID: `tab-${route.name}`,
    });
  }
  const activeKey = state.routes[state.index]?.key ?? '';

  const onSelect = (key: string): void => {
    const route = state.routes.find((candidate) => candidate.key === key);
    if (route === undefined) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  return (
    <TabBar
      testID="main-tab-bar"
      items={items}
      activeKey={activeKey}
      onSelect={onSelect}
      bottomInset={insets.bottom}
    />
  );
}
