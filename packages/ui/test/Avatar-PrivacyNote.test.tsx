// Avatar et Mention de confidentialité : teintes Jour et Nuit lisibles, neutre, « Vous », photo et
// repli sur l'initiale, lecteur d'écran, texte agrandi.
import { configure, fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import { Avatar, AVATAR_SIZES } from '../src/components/Avatar';
import { avatarTintColors, avatarTintFromBirthName } from '../src/components/avatarTint';
import { metrics } from '../src/components/metrics';
import { PrivacyNote } from '../src/components/PrivacyNote';
import { iconShapes } from '../src/icons/icons.generated';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { size, themes } from '../src/tokens';
import {
  expectReadableTexts,
  expectScalableTexts,
  flat,
  renderThemed,
  THEME_CASES,
} from './helpers';

// L'avatar est volontairement caché du lecteur d'écran (son nom est lu à côté) : les requêtes du
// test doivent donc voir les éléments cachés.
configure({ defaultIncludeHiddenElements: true });

const CLAIRE = { firstName: 'Claire', birthName: 'Martin' } as const;

describe.each(THEME_CASES)('Avatar ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('montre l’initiale sur la teinte du nom de naissance', () => {
    const view = renderThemed(<Avatar person={CLAIRE} testID="a" />, theme);
    const expected = avatarTintColors(avatarTintFromBirthName('Martin'), colors);
    expect(screen.getByText('C')).toBeOnTheScreen();
    expect(flat(screen.getByTestId('a').props.style).backgroundColor).toBe(expected.background);
    expect(flat(screen.getByText('C').props.style).color).toBe(expected.text);
    expectReadableTexts(view, theme.scheme);
  });

  it('donne la même teinte à deux prénoms nés du même nom, jamais selon le prénom', () => {
    renderThemed(
      <>
        <Avatar person={{ firstName: 'Odette', birthName: 'Diallo' }} testID="odette" />
        <Avatar person={{ firstName: 'Moussa', birthName: 'Diallo' }} testID="moussa" />
      </>,
      theme,
    );
    expect(flat(screen.getByTestId('odette').props.style).backgroundColor).toBe(
      flat(screen.getByTestId('moussa').props.style).backgroundColor,
    );
  });

  it('n’utilise jamais le corail de la santé', () => {
    const names = ['Martin', 'Diallo', 'Bah', 'Lefèvre', 'Ndiaye', 'Nguyễn', 'Okafor', 'Traoré'];
    renderThemed(
      <>
        {names.map((birthName) => (
          <Avatar key={birthName} person={{ firstName: 'A', birthName }} testID={birthName} />
        ))}
      </>,
      theme,
    );
    for (const birthName of names) {
      const background = flat(screen.getByTestId(birthName).props.style).backgroundColor;
      expect([colors.sante, colors.santeDouce]).not.toContain(background);
    }
  });

  it('passe en neutre avec le calque santé : `fond-carte`, initiale `texte-secondaire`', () => {
    const view = renderThemed(<Avatar person={CLAIRE} neutral testID="a" />, theme);
    expect(flat(screen.getByTestId('a').props.style)).toMatchObject({
      backgroundColor: colors.fondCarte,
      borderColor: colors.filetFort,
    });
    expect(flat(screen.getByText('C').props.style).color).toBe(colors.texteSecondaire);
    expectReadableTexts(view, theme.scheme);
  });

  it('« Vous » : avatar doré à silhouette, sans initiale', () => {
    renderThemed(<Avatar you testID="a" />, theme);
    expect(screen.queryByText(/./)).toBeNull();
    const dots = screen
      .getByTestId('a')
      .findAll((node) => (node.type as unknown) === 'RNSVGCircle');
    // Un disque doré, la tête de la silhouette ; le corps est une ellipse.
    expect(dots.length).toBe(2);
  });

  it.each([
    ['s', size.avatarS],
    ['m', size.avatarM],
    ['l', size.avatarL],
    ['xl', size.avatarXl],
  ] as const)('taille %s : disque de %i, initiale à 86 %% du rayon', (name, diameter) => {
    renderThemed(<Avatar person={CLAIRE} size={name} testID="a" />, theme);
    expect(AVATAR_SIZES[name]).toBe(diameter);
    expect(flat(screen.getByTestId('a').props.style)).toMatchObject({
      width: diameter,
      height: diameter,
      borderRadius: metrics.round,
    });
    expect(flat(screen.getByText('C').props.style).fontSize).toBeCloseTo((diameter / 2) * 0.86, 5);
  });

  it('est ignoré du lecteur d’écran sans libellé, annoncé comme une image avec', () => {
    renderThemed(<Avatar person={CLAIRE} testID="a" />, theme);
    expect(screen.getByTestId('a').props.accessible).toBe(false);
    expect(screen.queryByRole('image')).toBeNull();

    screen.unmount();
    // Un avatar n'est pas touchable : il n'a pas d'indication à lire.
    // eslint-disable-next-line react-native-a11y/has-accessibility-hint
    renderThemed(<Avatar person={CLAIRE} accessibilityLabel="Claire Martin" />, theme);
    expect(screen.getByRole('image', { name: 'Claire Martin' })).toBeOnTheScreen();
  });

  it('affiche la photo recadrée en cercle, puis l’initiale si elle ne charge pas', () => {
    renderThemed(
      <Avatar person={{ ...CLAIRE, photoUri: 'https://exemple.test/photo.jpg' }} testID="a" />,
      theme,
    );
    const photo = screen.getByTestId('a').findByType(Image);
    expect(photo.props.source).toEqual({ uri: 'https://exemple.test/photo.jpg' });
    expect(photo.props.resizeMode).toBe('cover');
    expect(flat(photo.props.style).borderRadius).toBe(metrics.round);
    expect(screen.queryByText('C')).toBeNull();

    fireEvent(photo, 'error');

    expect(screen.queryByTestId('a')?.findAllByType(Image)).toHaveLength(0);
    expect(screen.getByText('C')).toBeOnTheScreen();
  });

  it('prend la première lettre du prénom en majuscule, accents et lettres rares compris', () => {
    renderThemed(
      <>
        <Avatar person={{ firstName: 'élise', birthName: 'Bah' }} />
        <Avatar person={{ firstName: ' ñandu', birthName: 'Bah' }} />
      </>,
      theme,
    );
    expect(screen.getByText('É')).toBeOnTheScreen();
    expect(screen.getByText('Ñ')).toBeOnTheScreen();
  });
});

describe.each(THEME_CASES)('Mention privée ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  function svgPaths(shapeName: 'prive' | 'famille'): string[] {
    return iconShapes[shapeName].map((shape) => shape.d);
  }
  function drawn(d: string): boolean {
    return screen.root.findAll((node) => node.props.d === d).length > 0;
  }

  it('dit explicitement qui voit, avec le cadenas de 16', () => {
    const view = renderThemed(<PrivacyNote label="Visible par vous seul" testID="m" />, theme);
    expect(screen.getByText('Visible par vous seul')).toBeOnTheScreen();
    expect(svgPaths('prive').every(drawn)).toBe(true);
    const svg = screen
      .getByTestId('m')
      .findAll((node) => node.props.viewBox === '0 0 24 24' && node.props.width === 16);
    expect(svg.length).toBeGreaterThan(0);
    expect(flat(screen.getByText('Visible par vous seul').props.style).color).toBe(
      colors.texteSecondaire,
    );
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it('cercle familial : icône `famille`, pas le cadenas', () => {
    renderThemed(<PrivacyNote label="Visible par la famille Martin" circle="family" />, theme);
    expect(svgPaths('famille').every(drawn)).toBe(true);
    expect(svgPaths('prive').some(drawn)).toBe(false);
  });

  it('donnée de santé : texte en `sante-texte`, lisible', () => {
    const view = renderThemed(<PrivacyNote label="Visible par vous seul" health />, theme);
    expect(flat(screen.getByText('Visible par vous seul').props.style).color).toBe(
      colors.santeTexte,
    );
    expectReadableTexts(view, theme.scheme);
  });

  it('la phrase passe à la ligne à 200 % sans être tronquée', () => {
    const view = renderThemed(
      <PrivacyNote label="Visible par vous, vos parents et les responsables de la branche" />,
      theme,
    );
    expectScalableTexts(view);
  });
});

describe('Avatar : changement de photo après un échec', () => {
  it('réessaie la nouvelle photo quand l’adresse change', () => {
    const first = { ...CLAIRE, photoUri: 'https://exemple.test/a.jpg' };
    const second = { ...CLAIRE, photoUri: 'https://exemple.test/b.jpg' };
    const view = render(
      <ThemeProvider scheme="jour" reduceMotion>
        <Avatar person={first} testID="a" />
      </ThemeProvider>,
    );
    fireEvent(screen.getByTestId('a').findByType(Image), 'error');
    expect(screen.getByText('C')).toBeOnTheScreen();
    view.rerender(
      <ThemeProvider scheme="jour" reduceMotion>
        <Avatar person={second} testID="a" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('a').findByType(Image).props.source).toEqual({
      uri: 'https://exemple.test/b.jpg',
    });
  });
});
