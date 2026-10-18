// Onglets de fiche, barre d'onglets et notification : rôles et états pour le lecteur d'écran,
// couleurs Jour et Nuit, zones de 48 ou 56, texte agrandi, trait qui glisse en 240 ms (ou fondu de
// 150 ms quand les animations sont réduites).
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Animated } from 'react-native';

import { metrics } from '../src/components/metrics';
import { Notification } from '../src/components/Notification';
import { ProfileTabs, type ProfileTab } from '../src/components/ProfileTabs';
import { TabBar, type TabBarItem } from '../src/components/TabBar';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { motion, palette, radius, shadows, size, space, themes } from '../src/tokens';
import {
  expectReadableTexts,
  expectScalableTexts,
  flat,
  numeric,
  renderThemed,
  THEME_CASES,
  touchHeight,
  touchTargetFor,
} from './helpers';

const noop = () => undefined;
const LIST_ID = 'tab-list';

const PROFILE_TABS: readonly ProfileTab[] = [
  { key: 'memories', label: 'Souvenirs', accessibilityHint: 'Affiche cette rubrique.' },
  { key: 'documents', label: 'Documents' },
];

describe.each(THEME_CASES)('Onglets de fiche ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('annonce une liste d’onglets, l’actif sélectionné, avec zone de 48 (56 en mode Aînés)', () => {
    const view = renderThemed(
      <ProfileTabs tabs={PROFILE_TABS} active="memories" onChange={noop} testID={LIST_ID} />,
      theme,
    );
    expect(screen.getByTestId(LIST_ID).props.accessibilityRole).toBe('tablist');
    expect(screen.getByRole('tab', { name: 'Souvenirs' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Documents' })).not.toBeSelected();
    expect(screen.getByRole('tab', { name: 'Souvenirs' }).props.accessibilityHint).toBe(
      'Affiche cette rubrique.',
    );
    for (const tab of screen.getAllByRole('tab')) {
      expect(touchHeight(tab)).toBeGreaterThanOrEqual(touchTargetFor(theme));
    }
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('actif : graisse 600 et `texte` ; autres : graisse 500 et `texte-secondaire`', () => {
    renderThemed(<ProfileTabs tabs={PROFILE_TABS} active="documents" onChange={noop} />, theme);
    expect(flat(screen.getByText('Documents').props.style)).toMatchObject({
      fontFamily: 'InstrumentSans-SemiBold',
      color: colors.texte,
    });
    expect(flat(screen.getByText('Souvenirs').props.style)).toMatchObject({
      fontFamily: 'InstrumentSans-Medium',
      color: colors.texteSecondaire,
    });
    const expectedSize = metrics.profileTabs.fontSize * (theme.seniorMode ? 1.3 : 1);
    expect(flat(screen.getByText('Souvenirs').props.style).fontSize).toBeCloseTo(expectedSize, 5);
  });

  it('change d’onglet au toucher, pas pour l’onglet déjà actif', () => {
    const onChange = jest.fn();
    renderThemed(<ProfileTabs tabs={PROFILE_TABS} active="memories" onChange={onChange} />, theme);
    fireEvent.press(screen.getByRole('tab', { name: 'Souvenirs' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('tab', { name: 'Documents' }));
    expect(onChange).toHaveBeenCalledWith('documents');
  });

  it('trait de 4 en `action` sous l’onglet actif, filet en `filet` sur `fond-carte`', () => {
    renderThemed(
      <ProfileTabs tabs={PROFILE_TABS} active="memories" onChange={noop} testID="t" />,
      theme,
    );
    expect(flat(screen.getByTestId('t').props.style)).toMatchObject({
      backgroundColor: colors.fondCarte,
      borderBottomColor: colors.filet,
    });
    // Le trait se pose après la mesure de la rangée.
    fireEvent(screen.getByTestId('t'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 60, x: 0, y: 0 } },
    });
    const indicator = flat(screen.getByTestId('t-indicator').props.style);
    expect(indicator).toMatchObject({
      height: 4,
      width: 72,
      backgroundColor: colors.action,
    });
    // Premier onglet de deux : centré dans la première moitié (160 de large).
    const [translate] = indicator.transform as [{ translateX: unknown }];
    expect(numeric(translate.translateX)).toBe((160 - 72) / 2);
  });
});

describe('Onglets de fiche : le trait glisse', () => {
  function Wrapper({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
    return (
      <ThemeProvider scheme="jour" reduceMotion={reduceMotion}>
        {children}
      </ThemeProvider>
    );
  }

  function switchTab(reduceMotion: boolean) {
    const view = render(
      <Wrapper reduceMotion={reduceMotion}>
        <ProfileTabs tabs={PROFILE_TABS} active="memories" onChange={noop} testID="t" />
      </Wrapper>,
    );
    fireEvent(screen.getByTestId('t'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 60, x: 0, y: 0 } },
    });
    const spy = jest.spyOn(Animated, 'timing');
    view.rerender(
      <Wrapper reduceMotion={reduceMotion}>
        <ProfileTabs tabs={PROFILE_TABS} active="documents" onChange={noop} testID="t" />
      </Wrapper>,
    );
    const calls = spy.mock.calls.map(([, config]) => config);
    spy.mockRestore();
    return calls;
  }

  it('glisse en 240 ms, courbe entrée-sortie, sans rebond', () => {
    expect(switchTab(false)).toEqual([
      expect.objectContaining({
        toValue: 160 + (160 - 72) / 2,
        duration: motion.duration.transition,
      }),
    ]);
    expect(motion.duration.transition).toBe(240);
  });

  it('se transforme en fondu de 150 ms quand les animations sont réduites', () => {
    expect(switchTab(true)).toEqual([
      expect.objectContaining({ toValue: 1, duration: motion.duration.fonduReduit }),
    ]);
    expect(motion.duration.fonduReduit).toBe(150);
  });
});

const TAB_ITEMS: readonly TabBarItem[] = [
  {
    key: 'tree',
    label: 'Arbre',
    hint: 'Affiche votre arbre.',
    icon: 'treeSymbol',
    testID: 'tab-tree',
  },
  {
    key: 'family',
    label: 'Famille',
    hint: 'Affiche les membres de votre famille.',
    icon: 'famille',
    testID: 'tab-family',
  },
];

describe.each(THEME_CASES)('Barre d’onglets ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('annonce des onglets avec libellé, indication et état, zone de 48 (56 en mode Aînés)', () => {
    renderThemed(
      <TabBar items={TAB_ITEMS} activeKey="tree" onSelect={noop} testID={LIST_ID} />,
      theme,
    );
    expect(screen.getByTestId(LIST_ID).props.accessibilityRole).toBe('tablist');
    const tree = screen.getByRole('tab', { name: 'Arbre' });
    expect(tree).toBeSelected();
    expect(tree.props.accessibilityHint).toBe('Affiche votre arbre.');
    expect(screen.getByRole('tab', { name: 'Famille' })).not.toBeSelected();
    for (const tab of screen.getAllByRole('tab')) {
      expect(flat(tab.props.style).minHeight).toBe(touchTargetFor(theme));
    }
  });

  it('actif en `action` et graisse 600, inactif en `texte-secondaire` ; libellé en `legende`', () => {
    renderThemed(<TabBar items={TAB_ITEMS} activeKey="family" onSelect={noop} />, theme);
    expect(flat(screen.getByText('Famille').props.style)).toMatchObject({
      color: colors.action,
      fontFamily: 'InstrumentSans-SemiBold',
    });
    expect(flat(screen.getByText('Arbre').props.style)).toMatchObject({
      color: colors.texteSecondaire,
      fontFamily: 'InstrumentSans-Medium',
    });
  });

  it('est posée sur `fond-carte` avec un `filet` en haut, au-dessus de l’indicateur d’accueil', () => {
    renderThemed(
      <TabBar items={TAB_ITEMS} activeKey="tree" onSelect={noop} bottomInset={24} testID="bar" />,
      theme,
    );
    expect(flat(screen.getByTestId('bar').props.style)).toMatchObject({
      backgroundColor: colors.fondCarte,
      borderTopColor: colors.filet,
      paddingBottom: 24,
      paddingHorizontal: space.margeEcran,
    });
  });

  it('dessine des icônes de 28, le symbole compact pour l’Arbre', () => {
    renderThemed(<TabBar items={TAB_ITEMS} activeKey="tree" onSelect={noop} />, theme);
    const svgs = screen.root.findAll(
      (node) => typeof node.props.viewBox === 'string' && node.props.width === size.iconeL,
    );
    expect(svgs.map((svg) => svg.props.viewBox as string)).toEqual(
      expect.arrayContaining(['-104.12 -104.12 208.25 211.12', '0 0 24 24']),
    );
    expect(size.iconeL).toBe(28);
  });

  it('le libellé suit le texte du téléphone, plafonné à 200 %', () => {
    renderThemed(<TabBar items={TAB_ITEMS} activeKey="tree" onSelect={noop} />, theme);
    for (const label of ['Arbre', 'Famille']) {
      const text = screen.getByText(label);
      expect(text.props.maxFontSizeMultiplier).toBe(2);
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.numberOfLines).toBeUndefined();
    }
  });

  it('relaie le toucher de chaque onglet, y compris l’onglet courant (retour en haut)', () => {
    const onSelect = jest.fn();
    renderThemed(<TabBar items={TAB_ITEMS} activeKey="tree" onSelect={onSelect} />, theme);
    fireEvent.press(screen.getByTestId('tab-tree'));
    expect(onSelect).toHaveBeenLastCalledWith('tree');
    fireEvent.press(screen.getByTestId('tab-family'));
    expect(onSelect).toHaveBeenLastCalledWith('family');
  });

  it('texte lisible sur `fond-carte`', () => {
    const view = renderThemed(<TabBar items={TAB_ITEMS} activeKey="tree" onSelect={noop} />, theme);
    expectReadableTexts(view, theme.scheme);
  });
});

describe.each(THEME_CASES)('Notification ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];
  const content = {
    appName: 'Lignée',
    title: 'Odette a ajouté une photo',
    text: 'Ouvrez Lignée pour la voir.',
    time: 'Maintenant',
  };

  it('affiche surtitre en capitales, titre, texte et moment, lisibles et agrandissables', () => {
    const view = renderThemed(<Notification {...content} />, theme);
    expect(screen.getByText('Odette a ajouté une photo')).toBeOnTheScreen();
    expect(screen.getByText('Ouvrez Lignée pour la voir.')).toBeOnTheScreen();
    expect(screen.getByText('Maintenant')).toBeOnTheScreen();
    // Le surtitre est écrit « Lignée » et mis en capitales à l'affichage.
    expect(flat(screen.getByText('Lignée').props.style)).toMatchObject({
      textTransform: 'uppercase',
      color: colors.texteSecondaire,
    });
    expect(flat(screen.getByText('Odette a ajouté une photo').props.style)).toMatchObject({
      fontFamily: 'InstrumentSans-Bold',
      color: colors.texte,
    });
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('pose une icône d’app de 40, symbole or sur `vert-700`, cachée du lecteur d’écran', () => {
    renderThemed(<Notification {...content} />, theme);
    const box = screen.root.findAll(
      (node) => flat(node.props.style).backgroundColor === palette.vert700,
    )[0];
    expect(flat(box?.props.style)).toMatchObject({
      width: 40,
      height: 40,
      borderRadius: metrics.notification.iconBoxRadius,
    });
    expect(box?.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByLabelText('Lignée', { includeHiddenElements: true })).toBeTruthy();
  });

  it('est une carte flottante : `fond-carte`, rayon de carte, ombre flottante', () => {
    renderThemed(<Notification {...content} testID="n" />, theme);
    const banner = screen
      .getByTestId('n')
      .findAll((node) => flat(node.props.style).backgroundColor === colors.fondCarte)[0];
    expect(flat(banner?.props.style)).toMatchObject({
      borderRadius: radius.carte,
      boxShadow: shadows[theme.scheme].flottante.boxShadow,
    });
  });

  it('est lue d’un bloc : surtitre, titre, texte, moment', () => {
    renderThemed(<Notification {...content} />, theme);
    expect(
      screen.getByLabelText(
        'Lignée. Odette a ajouté une photo. Ouvrez Lignée pour la voir.. Maintenant',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('touchable : un bouton qui ouvre l’événement', () => {
    const onPress = jest.fn();
    renderThemed(
      <Notification
        {...content}
        onPress={onPress}
        accessibilityLabel="Odette a ajouté une photo"
        accessibilityHint="Ouvre la photo."
      />,
      theme,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Odette a ajouté une photo' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('titre seul : sans texte ni moment', () => {
    renderThemed(<Notification appName="Lignée" title="12 personnes ont été ajoutées" />, theme);
    expect(screen.getByText('12 personnes ont été ajoutées')).toBeOnTheScreen();
  });
});
