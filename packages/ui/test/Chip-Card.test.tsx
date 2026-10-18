// Puce et Carte : teintes Jour et Nuit lisibles, zone touchable quand elles se touchent, libellés,
// texte agrandi sans troncature, ombre et rayon de la carte.
import { fireEvent, screen } from '@testing-library/react-native';

import { Button } from '../src/components/Button';
import { Card, type CardThumbnailTone } from '../src/components/Card';
import { Chip, type ChipTone } from '../src/components/Chip';
import { metrics } from '../src/components/metrics';
import { radius, shadows, space, themes } from '../src/tokens';
import {
  expectReadableTexts,
  expectScalableTexts,
  flat,
  renderThemed,
  THEME_CASES,
  touchHeight,
  touchTargetFor,
} from './helpers';

const TONES: readonly ChipTone[] = [
  'green',
  'kinship',
  'celebrate',
  'health',
  'memory',
  'documents',
  'neutral',
];
const noop = () => undefined;
const THUMBNAILS: readonly CardThumbnailTone[] = ['celebrate', 'memory', 'documents', 'kinship'];

describe.each(THEME_CASES)('Puce ($scheme, mode Aînés : $seniorMode)', (theme) => {
  it.each(TONES)('%s : texte `*-texte` lisible sur sa teinte douce', (tone) => {
    const view = renderThemed(<Chip label="Sœur d’Odette" tone={tone} />, theme);
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('santé : toujours avec l’icône `sante`, jamais la couleur seule', () => {
    renderThemed(<Chip label="Antécédent" tone="health" testID="chip" />, theme);
    const svg = screen.getByTestId('chip').findAll((n) => n.props.viewBox === '0 0 24 24');
    expect(svg.length).toBe(1);
  });

  it('non touchable : lue comme un texte, sans rôle de bouton', () => {
    renderThemed(<Chip label="Papa" tone="green" />, theme);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Papa')).toBeOnTheScreen();
  });

  it(`touchable : un bouton avec libellé et une zone de ${String(touchTargetFor(theme))}`, () => {
    const onPress = jest.fn();
    renderThemed(
      <Chip
        label="Papa"
        tone="kinship"
        onPress={onPress}
        accessibilityLabel="Voir le lien Papa"
        accessibilityHint="Ouvre la fiche"
      />,
      theme,
    );
    const button = screen.getByRole('button', { name: 'Voir le lien Papa' });
    expect(touchHeight(button)).toBeGreaterThanOrEqual(touchTargetFor(theme));
    expect(flat(button.props.style).minWidth).toBe(touchTargetFor(theme));
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe.each(THEME_CASES)('Carte ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('fond `fond-carte`, rayon de carte, ombre de carte, marge `espace-5`', () => {
    renderThemed(<Card title="Album de famille" text="24 photos" testID="card" />, theme);
    const body = screen.getByTestId('card').children[0] as never as { props: { style: unknown } };
    expect(flat(body.props.style)).toMatchObject({
      backgroundColor: colors.fondCarte,
      borderRadius: radius.carte,
      boxShadow: shadows[theme.scheme].carte.boxShadow,
      padding: space[5],
    });
  });

  it.each(THUMBNAILS)('vignette %s : textes lisibles, agrandissables', (tone) => {
    const view = renderThemed(
      <Card title="Album de famille" text="24 photos" thumbnail={{ icon: 'photo', tone }} />,
      theme,
    );
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
    const sized = view.UNSAFE_root.findAll(
      (n) => flat(n.props.style).width === metrics.card.thumbnailSize,
    );
    expect(sized.length).toBeGreaterThan(0);
  });

  it('qui s’ouvre : un bouton nommé par son titre et son texte, zone touchable', () => {
    const onPress = jest.fn();
    renderThemed(<Card title="Album de famille" text="24 photos" onPress={onPress} />, theme);
    const button = screen.getByRole('button', { name: 'Album de famille, 24 photos' });
    expect(touchHeight(button)).toBeGreaterThanOrEqual(touchTargetFor(theme));
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('qui s’ouvre : pas de contenu touchable dedans (refusé au typage, ignoré au rendu)', () => {
    renderThemed(
      // @ts-expect-error -- une carte qui s'ouvre n'a pas d'enfants : un bouton dedans serait
      // inaccessible au lecteur d'écran, qui ne lit que le bouton englobant.
      <Card title="Album de famille" onPress={noop}>
        <Button label="Partager" onPress={noop} />
      </Card>,
      theme,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Partager')).toBeNull();
  });

  it('posée : son contenu garde ses propres boutons', () => {
    renderThemed(
      <Card title="Album de famille">
        <Button label="Partager" onPress={noop} />
      </Card>,
      theme,
    );
    expect(screen.getByRole('button', { name: 'Partager' })).toBeOnTheScreen();
  });

  it('sans onPress : pas de bouton', () => {
    renderThemed(<Card title="Album de famille" />, theme);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
