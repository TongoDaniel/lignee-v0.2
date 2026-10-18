// Interrupteur, En-tête et Ligne de réglage : rôles, états et libellés pour le lecteur d'écran,
// zones de 48 ou 56, couleurs Jour et Nuit, texte agrandi, transition de l'interrupteur et
// animations réduites.
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Animated } from 'react-native';

import { Button } from '../src/components/Button';
import { Header } from '../src/components/Header';
import { metrics } from '../src/components/metrics';
import { SettingsGroup, SettingsRow } from '../src/components/SettingsRow';
import { Switch } from '../src/components/Switch';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { motion, opacity, stroke, themes } from '../src/tokens';
import {
  expectReadableTexts,
  expectScalableTexts,
  flat,
  renderThemed,
  THEME_CASES,
  touchHeight,
  touchTargetFor,
} from './helpers';

const noop = () => undefined;

describe.each(THEME_CASES)('Interrupteur ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('est annoncé comme un interrupteur, avec son état et son explication', () => {
    const onValueChange = jest.fn();
    const view = renderThemed(
      <Switch
        label="Option Cousins"
        description="Montre les cousins issus de germain dans l’arbre."
        value={false}
        onValueChange={onValueChange}
      />,
      theme,
    );
    const control = screen.getByRole('switch', { name: 'Option Cousins' });
    expect(control).not.toBeChecked();
    expect(control.props.accessibilityHint).toBe(
      'Montre les cousins issus de germain dans l’arbre.',
    );
    expect(touchHeight(control)).toBeGreaterThanOrEqual(touchTargetFor(theme));
    fireEvent.press(control);
    expect(onValueChange).toHaveBeenCalledWith(true);
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('piste éteinte `filet-fort` et contour `bordure-champ` ; allumée `action`', () => {
    renderThemed(
      <Switch label="Option Cousins" value={false} onValueChange={noop} testID="s" />,
      theme,
    );
    expect(flat(screen.getByTestId('s-track').props.style)).toMatchObject({
      width: metrics.switch.trackWidth,
      height: metrics.switch.trackHeight,
      backgroundColor: colors.filetFort,
      borderColor: colors.bordureChamp,
      borderWidth: stroke.champ,
    });
    screen.unmount();
    renderThemed(<Switch label="Option Cousins" value onValueChange={noop} testID="s" />, theme);
    expect(screen.getByRole('switch')).toBeChecked();
    expect(flat(screen.getByTestId('s-track').props.style).backgroundColor).toBe(colors.action);
  });

  it('santé : piste `sante` quand il est actif, avec l’icône `sante`', () => {
    renderThemed(
      <Switch label="Calque santé" value health onValueChange={noop} testID="s" />,
      theme,
    );
    expect(flat(screen.getByTestId('s-track').props.style).backgroundColor).toBe(colors.sante);
    const icons = screen.getByRole('switch').findAll((n) => n.props.viewBox === '0 0 24 24');
    expect(icons.length).toBe(1);
  });
});

describe('Interrupteur : états et mouvement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('désactivé : annoncé désactivé, opacité 0,4, ne change pas', () => {
    const onValueChange = jest.fn();
    renderThemed(
      <Switch label="Option Cousins" value={false} disabled onValueChange={onValueChange} />,
      { scheme: 'jour', seniorMode: false },
    );
    const control = screen.getByRole('switch');
    expect(control).toBeDisabled();
    expect(flat(control.props.style).opacity).toBe(opacity.desactive);
    fireEvent.press(control);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  function toggle(reduceMotion: boolean) {
    const view = render(
      <ThemeWrapper reduceMotion={reduceMotion}>
        <Switch label="Option Cousins" value={false} onValueChange={noop} />
      </ThemeWrapper>,
    );
    const spy = jest.spyOn(Animated, 'timing');
    view.rerender(
      <ThemeWrapper reduceMotion={reduceMotion}>
        <Switch label="Option Cousins" value onValueChange={noop} />
      </ThemeWrapper>,
    );
    expect(screen.getByRole('switch')).toBeChecked();
    return spy.mock.calls.map(([, config]) => config);
  }

  it('la pastille glisse en 240 ms, courbe entrée-sortie, sans rebond', () => {
    expect(toggle(false)).toEqual([
      expect.objectContaining({ toValue: 1, duration: motion.duration.changementEtat }),
    ]);
  });

  it('ne glisse pas quand le téléphone demande de réduire les animations', () => {
    expect(toggle(true)).toEqual([]);
  });
});

// `rerender` remplace tout l'arbre rendu : le fournisseur de thème doit être redonné.
function ThemeWrapper({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean }) {
  return (
    <ThemeProvider scheme="jour" reduceMotion={reduceMotion}>
      {children}
    </ThemeProvider>
  );
}

describe.each(THEME_CASES)('En-tête ($scheme, mode Aînés : $seniorMode)', (theme) => {
  it('titre d’écran annoncé comme en-tête, sous-titre, lisibles et agrandissables', () => {
    const view = renderThemed(<Header title="Famille" subtitle="12 personnes" />, theme);
    expect(screen.getByRole('header')).toHaveTextContent('Famille');
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('retour : un bouton nommé, zone touchable', () => {
    const onPress = jest.fn();
    renderThemed(
      <Header title="Fiche" back={{ onPress, accessibilityLabel: 'Revenir en arrière' }} />,
      theme,
    );
    const back = screen.getByRole('button', { name: 'Revenir en arrière' });
    expect(flat(back.props.style)).toMatchObject({
      minWidth: touchTargetFor(theme),
      minHeight: touchTargetFor(theme),
    });
    fireEvent.press(back);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('une action à droite : un Bouton compact', () => {
    renderThemed(
      <Header title="Famille" action={<Button label="Inviter" compact onPress={noop} />} />,
      theme,
    );
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeOnTheScreen();
  });
});

describe.each(THEME_CASES)('Ligne de réglage ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('un bouton qui lit le réglage et sa valeur, 60 de haut au moins', () => {
    const onPress = jest.fn();
    const view = renderThemed(
      <SettingsGroup>
        <SettingsRow icon="langues" label="Langue" value="Français" onPress={onPress} />
        <SettingsRow icon="securite" iconTone="action" label="Sécurité" onPress={noop} />
      </SettingsGroup>,
      theme,
    );
    const row = screen.getByRole('button', { name: 'Langue, Français' });
    expect(touchHeight(row)).toBeGreaterThanOrEqual(
      Math.max(metrics.settingsRow.minHeight, touchTargetFor(theme)),
    );
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sécurité' })).toBeOnTheScreen();
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('le groupe pose un filet entre les lignes, pas au-dessus de la première', () => {
    const view = renderThemed(
      <SettingsGroup>
        <SettingsRow icon="langues" label="Langue" onPress={noop} />
        <SettingsRow
          icon="notifications"
          iconTone="celebrate"
          label="Notifications"
          onPress={noop}
        />
      </SettingsGroup>,
      theme,
    );
    const separators = view.UNSAFE_root.findAll(
      (n) => typeof n.type === 'string' && flat(n.props.style).borderTopColor === colors.filet,
    );
    expect(separators).toHaveLength(1);
  });
});
