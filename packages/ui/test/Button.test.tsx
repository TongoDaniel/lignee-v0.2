// Bouton (components/Bouton) : variantes et couleurs Jour et Nuit, zone de 48 ou 56, libellé pour
// le lecteur d'écran, état désactivé, texte agrandi, retour au toucher et animations réduites.
import { fireEvent, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { Button, type ButtonVariant } from '../src/components/Button';
import { metrics } from '../src/components/metrics';
import { aines, motion, opacity, size, space, themes, typography } from '../src/tokens';
import {
  caseName,
  expectReadableTexts,
  expectScalableTexts,
  flat,
  renderThemed,
  THEME_CASES,
  touchHeight,
  touchTargetFor,
} from './helpers';

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'quiet', 'celebrate', 'danger'];
const noop = () => undefined;

function pill() {
  // La pilule est l'enfant direct du Pressable (rôle « button »).
  const button = screen.getByRole('button');
  return { button, pill: button.children[0] as typeof button };
}

describe.each(THEME_CASES)('Bouton ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it.each(VARIANTS)('%s : texte lisible (4,5:1), agrandissable sans troncature', (variant) => {
    const view = renderThemed(<Button label="Ajouter" variant={variant} onPress={noop} />, theme);
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('principal : fond `action`, texte `sur-action`, pilule sans ombre', () => {
    renderThemed(<Button label="Ajouter" onPress={noop} />, theme);
    const style = flat(pill().pill.props.style);
    expect(style.backgroundColor).toBe(colors.action);
    expect(style.borderRadius).toBe(metrics.round);
    expect(style.boxShadow).toBeUndefined();
    expect(flat(screen.getByText('Ajouter').props.style).color).toBe(colors.surAction);
  });

  it('secondaire et danger : contour de 2 en `bordure-champ` ou `erreur`', () => {
    renderThemed(<Button label="Plus tard" variant="secondary" onPress={noop} />, theme);
    expect(flat(pill().pill.props.style)).toMatchObject({
      borderColor: colors.bordureChamp,
      borderWidth: metrics.button.outlineWidth,
    });
    screen.unmount();
    renderThemed(<Button label="Supprimer la fiche" variant="danger" onPress={noop} />, theme);
    expect(flat(pill().pill.props.style).borderColor).toBe(colors.erreur);
    expect(flat(screen.getByText('Supprimer la fiche').props.style).color).toBe(colors.erreur);
  });

  it('fête : fond `fete-forte`, texte `sur-fete`', () => {
    renderThemed(<Button label="Fêter" variant="celebrate" onPress={noop} />, theme);
    expect(flat(pill().pill.props.style).backgroundColor).toBe(colors.feteForte);
    expect(flat(screen.getByText('Fêter').props.style).color).toBe(colors.surFete);
  });

  it(`a une zone touchable de ${String(touchTargetFor(theme))} au moins, compact compris`, () => {
    renderThemed(<Button label="Ajouter" onPress={noop} />, theme);
    expect(touchHeight(pill().button)).toBeGreaterThanOrEqual(touchTargetFor(theme));
    expect(flat(pill().pill.props.style).minHeight).toBeGreaterThanOrEqual(size.hauteurBouton);
    expect(flat(pill().pill.props.style).minWidth).toBe(touchTargetFor(theme));
    screen.unmount();
    renderThemed(<Button label="Inviter" compact onPress={noop} />, theme);
    expect(flat(pill().pill.props.style).minHeight).toBe(size.hauteurBoutonCompact);
    expect(touchHeight(pill().button)).toBe(touchTargetFor(theme));
  });

  it('suit la taille de texte du thème (× 1,3 en mode Aînés)', () => {
    renderThemed(<Button label="Ajouter" onPress={noop} />, theme);
    const expected = typography.bouton.fontSize * (theme.seniorMode ? aines.facteurTexte : 1);
    expect(flat(screen.getByText('Ajouter').props.style).fontSize).toBeCloseTo(expected);
  });

  it(`thème ${caseName(theme)} : marges de la fiche (espace-6, espace-5 en compact, espace-3 en discret)`, () => {
    renderThemed(<Button label="Ajouter" onPress={noop} />, theme);
    expect(flat(pill().pill.props.style).paddingHorizontal).toBe(space[6]);
    screen.unmount();
    renderThemed(<Button label="Ajouter" compact onPress={noop} />, theme);
    expect(flat(pill().pill.props.style).paddingHorizontal).toBe(space[5]);
    screen.unmount();
    renderThemed(<Button label="Ajouter" variant="quiet" onPress={noop} />, theme);
    expect(flat(pill().pill.props.style).paddingHorizontal).toBe(space[3]);
  });
});

describe('Bouton : lecteur d’écran et états', () => {
  const jour = THEME_CASES[0] ?? { scheme: 'jour' as const, seniorMode: false };

  it('annonce un bouton avec son libellé, ou le libellé complet fourni', () => {
    renderThemed(
      <Button
        label="Ajouter"
        accessibilityLabel="Ajouter votre mère"
        accessibilityHint="Ouvre la fiche à remplir"
        onPress={noop}
      />,
      jour,
    );
    const button = screen.getByRole('button', { name: 'Ajouter votre mère' });
    expect(button.props.accessibilityHint).toBe('Ouvre la fiche à remplir');
    expect(button).not.toBeDisabled();
    screen.unmount();
    renderThemed(<Button label="Inviter" onPress={noop} />, jour);
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeOnTheScreen();
  });

  it('désactivé : annoncé désactivé, opacité 0,4, n’appelle rien', () => {
    const onPress = jest.fn();
    renderThemed(<Button label="Enregistrer" disabled onPress={onPress} />, jour);
    const { button, pill: inner } = pill();
    expect(button).toBeDisabled();
    expect(flat(inner.props.style).opacity).toBe(opacity.desactive);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('appelle onPress au toucher', () => {
    const onPress = jest.fn();
    renderThemed(<Button label="Enregistrer" onPress={onPress} />, jour);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('affiche l’anneau de focus clavier (2 de `focus`, décalé de 2)', () => {
    renderThemed(<Button label="Enregistrer" onPress={noop} />, jour);
    fireEvent(screen.getByRole('button'), 'focus');
    expect(flat(pill().pill.props.style)).toMatchObject({
      outlineColor: themes.jour.focus,
      outlineWidth: 2,
      outlineOffset: 2,
    });
    fireEvent(screen.getByRole('button'), 'blur');
    expect(flat(pill().pill.props.style).outlineWidth).toBeUndefined();
  });
});

// L'animation tourne sur le fil natif (useNativeDriver) : sous Jest, on vérifie ce qui est demandé
// à Animated, pas la valeur dessinée.
describe('Bouton : retour au toucher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function pressIn(reduceMotion: boolean) {
    const spy = jest.spyOn(Animated, 'timing');
    renderThemed(<Button label="Ajouter" onPress={noop} />, {
      scheme: 'jour',
      seniorMode: false,
      reduceMotion,
    });
    fireEvent(screen.getByRole('button'), 'pressIn');
    return spy.mock.calls.map(([, config]) => config);
  }

  it('se réduit à 97 % en 120 ms quand on appuie', () => {
    expect(pressIn(false)).toEqual([
      expect.objectContaining({
        toValue: motion.echelleAppui,
        duration: motion.duration.toucher,
        useNativeDriver: true,
      }),
    ]);
  });

  it('ne bouge pas quand le téléphone demande de réduire les animations', () => {
    expect(pressIn(true)).toEqual([]);
  });
});
