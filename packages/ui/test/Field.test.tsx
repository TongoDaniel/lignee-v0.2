// Champ : libellé toujours visible et lu, contour 1,5 puis 2,5 au focus, erreur avec icône et
// texte, micro proposé d'office en mode Aînés, désactivé, Jour et Nuit, texte agrandi.
import { fireEvent, screen } from '@testing-library/react-native';

import { Field } from '../src/components/Field';
import { metrics } from '../src/components/metrics';
import { aines, size, stroke, themes, typography } from '../src/tokens';
import {
  expectReadableTexts,
  expectScalableTexts,
  flat,
  renderThemed,
  THEME_CASES,
  touchTargetFor,
} from './helpers';

const noop = () => undefined;

function box() {
  return screen.getByTestId('field-input').parent?.parent as never as {
    props: { style: unknown };
  };
}

describe.each(THEME_CASES)('Champ ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('lit le libellé visible au lecteur d’écran, garde le texte d’exemple en `texte-discret`', () => {
    const view = renderThemed(
      <Field
        label="Prénom"
        value=""
        onChangeText={noop}
        placeholder="Par exemple : Lucienne"
        testID="field"
      />,
      theme,
    );
    const input = screen.getByLabelText('Prénom');
    expect(input.props.placeholderTextColor).toBe(colors.texteDiscret);
    // Affiché, mais lu une seule fois : par la zone de saisie qu'il nomme.
    expect(screen.getByText('Prénom', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('Prénom')).toBeNull();
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('boîte de 56 au moins, contour `bordure-champ` de 1,5, puis 2,5 en `action` au focus', () => {
    renderThemed(<Field label="Prénom" value="" onChangeText={noop} testID="field" />, theme);
    expect(flat(box().props.style)).toMatchObject({
      borderColor: colors.bordureChamp,
      borderWidth: stroke.champ,
    });
    expect(flat(box().props.style).minHeight).toBeGreaterThanOrEqual(size.hauteurBouton);
    fireEvent(screen.getByTestId('field-input'), 'focus');
    expect(flat(box().props.style)).toMatchObject({
      borderColor: colors.action,
      borderWidth: metrics.field.focusBorderWidth,
    });
    expect(screen.getByTestId('field-input').props.cursorColor).toBe(colors.action);
  });

  it('texte saisi en 17 (× 1,3 en mode Aînés), zone de saisie touchable', () => {
    renderThemed(
      <Field label="Prénom" value="Lucienne" onChangeText={noop} testID="field" />,
      theme,
    );
    const style = flat(screen.getByTestId('field-input').props.style);
    expect(style.fontSize).toBeCloseTo(
      typography.corps.fontSize * (theme.seniorMode ? aines.facteurTexte : 1),
    );
    expect(style.minHeight).toBe(touchTargetFor(theme));
  });

  it('erreur : contour `erreur`, message avec l’icône `alerte`, annoncé', () => {
    const view = renderThemed(
      <Field
        label="Prénom"
        value=""
        onChangeText={noop}
        error="Indiquez un prénom pour enregistrer la fiche."
        testID="field"
      />,
      theme,
    );
    expect(flat(box().props.style).borderColor).toBe(colors.erreur);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Indiquez un prénom pour enregistrer la fiche.');
    expect(alert.findAll((n) => n.props.viewBox === '0 0 24 24').length).toBe(1);
    expect(screen.getByLabelText('Prénom').props.accessibilityHint).toBe(
      'Indiquez un prénom pour enregistrer la fiche.',
    );
    expectReadableTexts(view, theme.scheme);
  });

  it(`micro : ${theme.seniorMode ? 'proposé d’office' : 'seulement si demandé'}, zone touchable`, () => {
    const onPress = jest.fn();
    renderThemed(
      <Field
        label="Prénom"
        value=""
        onChangeText={noop}
        voiceInput={{ onPress, accessibilityLabel: 'Dicter le prénom' }}
      />,
      theme,
    );
    const mic = screen.queryByRole('button', { name: 'Dicter le prénom' });
    if (!theme.seniorMode) {
      expect(mic).toBeNull();
      return;
    }
    expect(mic).not.toBeNull();
    expect(flat(mic?.props.style).minHeight).toBe(touchTargetFor(theme));
    if (mic) fireEvent.press(mic);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Champ : options', () => {
  const jour = { scheme: 'jour' as const, seniorMode: false };

  it('micro forcé hors mode Aînés, ou retiré en mode Aînés', () => {
    renderThemed(
      <Field
        label="Prénom"
        value=""
        onChangeText={noop}
        voiceInput={{ onPress: noop, accessibilityLabel: 'Dicter le prénom', enabled: true }}
      />,
      jour,
    );
    expect(screen.getByRole('button', { name: 'Dicter le prénom' })).toBeOnTheScreen();
    screen.unmount();
    renderThemed(
      <Field
        label="Prénom"
        value=""
        onChangeText={noop}
        voiceInput={{ onPress: noop, accessibilityLabel: 'Dicter le prénom', enabled: false }}
      />,
      { scheme: 'jour', seniorMode: true },
    );
    expect(screen.queryByRole('button', { name: 'Dicter le prénom' })).toBeNull();
  });

  it('désactivé : non modifiable, annoncé désactivé', () => {
    renderThemed(<Field label="Prénom" value="Lucienne" onChangeText={noop} disabled />, jour);
    const input = screen.getByLabelText('Prénom');
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toEqual({ disabled: true });
  });

  it('transmet la saisie', () => {
    const onChangeText = jest.fn();
    renderThemed(<Field label="Prénom" value="" onChangeText={onChangeText} />, jour);
    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Lucienne');
    expect(onChangeText).toHaveBeenCalledWith('Lucienne');
  });
});
