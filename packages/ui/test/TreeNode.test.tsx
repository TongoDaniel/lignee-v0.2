// Nœud de l'arbre : libellé complet, états (chemin, atténué, anniversaire, place à compléter, lien
// probable, santé), appui et appui long, zone de 48 ou 56, texte agrandi, animation réduite.
import { configure, fireEvent, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { iconShapes } from '../src/icons/icons.generated';
import { metrics } from '../src/components/metrics';
import { TreeNode, type TreeNodeProps } from '../src/components/TreeNode';
import { opacity, size, themes } from '../src/tokens';
import {
  expectReadableTexts,
  flat,
  renderThemed,
  THEME_CASES,
  touchHeight,
  touchTargetFor,
  type TestNode,
} from './helpers';

// L'avatar est caché du lecteur d'écran (le libellé du nœud dit tout) : le test doit le voir.
configure({ defaultIncludeHiddenElements: true });

const noop = () => undefined;
const CLAIRE_STATIC: TreeNodeProps = {
  person: { firstName: 'Claire', birthName: 'Martin' },
  name: 'Claire',
  relation: 'Maman',
  accessibilityLabel: 'Claire Martin, votre mère, née en 1968',
  testID: 'n',
};
const CLAIRE: TreeNodeProps = { ...CLAIRE_STATIC, onPress: noop };

/** Un texte du nœud suit la taille du téléphone sans limite ni hauteur fixe autour de lui. */
function expectScalable(text: TestNode): void {
  expect(text.props.allowFontScaling).not.toBe(false);
  expect(text.props.numberOfLines).toBeUndefined();
  expect(text.props.maxFontSizeMultiplier).toBeUndefined();
  let current: TestNode | null = text;
  while (current !== null) {
    const style = flat(current.props.style);
    expect(style.height).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
    current = current.parent;
  }
}

describe.each(THEME_CASES)('Nœud de l’arbre ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('est un bouton au libellé complet, avec une zone de 48 (56 en mode Aînés)', () => {
    renderThemed(<TreeNode {...CLAIRE} accessibilityHint="Ouvre la fiche." />, theme);
    const node = screen.getByRole('button', { name: 'Claire Martin, votre mère, née en 1968' });
    expect(node.props.accessibilityHint).toBe('Ouvre la fiche.');
    expect(touchHeight(node)).toBeGreaterThanOrEqual(touchTargetFor(theme));
    expect(touchTargetFor(theme)).toBe(theme.seniorMode ? 56 : size.cibleTactile);
  });

  it('montre le prénom (15, graisse 500) et le lien en `legende`, lisibles et agrandissables', () => {
    const view = renderThemed(<TreeNode {...CLAIRE} />, theme);
    const name = screen.getByText('Claire', { exact: true });
    const relation = screen.getByText('Maman');
    expect(flat(name.props.style)).toMatchObject({
      color: colors.texte,
      fontFamily: 'InstrumentSans-Medium',
    });
    expect(flat(relation.props.style).color).toBe(colors.texteSecondaire);
    expectScalable(name);
    expectScalable(relation);
    // L'initiale de l'avatar, dans un disque de taille fixe, ne compte pas : elle est cachée.
    expectReadableTexts(view, theme.scheme);
  });

  it('un prénom long passe à la ligne au lieu d’être coupé', () => {
    renderThemed(<TreeNode {...CLAIRE} name="Marie-Madeleine Ndongo-Bekolo" />, theme);
    expectScalable(screen.getByText('Marie-Madeleine Ndongo-Bekolo'));
  });

  it('personne décédée : ses années à la place du lien, rien d’autre', () => {
    renderThemed(<TreeNode {...CLAIRE} relation="Grand-mère" years="1931 – 2019" />, theme);
    expect(screen.getByText('1931 – 2019')).toBeOnTheScreen();
    expect(screen.queryByText('Grand-mère')).toBeNull();
  });

  it('chemin de parenté : anneau `chemin` de 3, séparé de l’avatar par 3 de `fond`', () => {
    renderThemed(<TreeNode {...CLAIRE} state="path" />, theme);
    expect(flat(screen.getByTestId('n-ring').props.style)).toMatchObject({
      borderColor: colors.chemin,
      borderWidth: metrics.treeNode.ringWidth,
      backgroundColor: colors.fond,
      width: size.avatarM + 2 * (metrics.treeNode.ringWidth + metrics.treeNode.ringGap),
    });
    expect(metrics.treeNode.ringWidth).toBe(3);
    expect(metrics.treeNode.ringGap).toBe(3);
  });

  it('normal : pas d’anneau, mais la même place réservée (rien ne bouge quand le chemin s’affiche)', () => {
    renderThemed(<TreeNode {...CLAIRE} />, theme);
    expect(screen.queryByTestId('n-ring')).toBeNull();
  });

  it('atténué : opacité 0,38 sur tout le nœud', () => {
    renderThemed(<TreeNode {...CLAIRE} state="faded" />, theme);
    const faded = screen.root.findAll((node) => flat(node.props.style).opacity === opacity.attenue);
    expect(faded.length).toBeGreaterThan(0);
    expect(opacity.attenue).toBe(0.38);
  });

  it('anniversaire : anneau `fete` et pastille `fete`', () => {
    renderThemed(<TreeNode {...CLAIRE} state="birthday" />, theme);
    expect(flat(screen.getByTestId('n-ring').props.style).borderColor).toBe(colors.fete);
    expect(screen.getByTestId('n-badge')).toBeOnTheScreen();
  });

  it('place à compléter : cercle pointillé `bordure-champ`, icône `ajouter` et la place', () => {
    renderThemed(
      <TreeNode
        name="Mère"
        state="unknown"
        accessibilityLabel="Place de votre mère à compléter"
        accessibilityHint="Ouvre l’ajout."
        onPress={noop}
        testID="n"
      />,
      theme,
    );
    expect(flat(screen.getByTestId('n-unknown').props.style)).toMatchObject({
      borderStyle: 'dashed',
      borderColor: colors.bordureChamp,
      width: size.avatarM,
      height: size.avatarM,
    });
    expect(screen.getByText('Mère')).toBeOnTheScreen();
    // L'icône `ajouter` de la charte est dessinée dans le cercle.
    for (const shape of iconShapes.ajouter) {
      expect(
        screen.getByTestId('n-unknown').findAll((node) => node.props.d === shape.d),
      ).not.toHaveLength(0);
    }
    expect(
      screen.getByRole('button', { name: 'Place de votre mère à compléter' }),
    ).toBeOnTheScreen();
  });

  it('place à compléter : ni lien, ni pastille, ni point de proposition', () => {
    renderThemed(
      <TreeNode
        name="Mère"
        state="unknown"
        relation="Maman"
        health
        probable
        accessibilityLabel="Place à compléter"
        accessibilityHint="Ouvre l’ajout."
        testID="n"
      />,
      theme,
    );
    expect(screen.queryByText('Maman')).toBeNull();
    expect(screen.queryByTestId('n-badge')).toBeNull();
    expect(screen.queryByTestId('n-pending')).toBeNull();
  });

  it('lien probable : point `parente` en haut à droite, et le lien proposé', () => {
    renderThemed(
      <TreeNode
        {...CLAIRE}
        name="Samuel"
        relation="Peut-être son frère"
        probable
        accessibilityLabel="Samuel Bah, peut-être son frère, lien à confirmer"
        accessibilityHint="Ouvre la fiche."
      />,
      theme,
    );
    expect(flat(screen.getByTestId('n-pending').props.style).backgroundColor).toBe(colors.parente);
    expect(screen.getByText('Peut-être son frère')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /lien à confirmer/ })).toBeOnTheScreen();
  });

  it('santé : pastille cœur `sante` et avatar neutre ; sans santé, ni pastille ni neutre', () => {
    renderThemed(<TreeNode {...CLAIRE} health />, theme);
    expect(screen.getByTestId('n-badge')).toBeOnTheScreen();
    const heart = screen
      .getByTestId('n-badge')
      .findAll((node) => node.props.stroke === colors.sante || node.props.fill === colors.sante);
    expect(heart.length).toBeGreaterThan(0);
    expect(
      screen.root.findAll((node) => flat(node.props.style).backgroundColor === colors.fondCarte)
        .length,
    ).toBeGreaterThan(0);

    screen.unmount();
    renderThemed(<TreeNode {...CLAIRE} />, theme);
    expect(screen.queryByTestId('n-badge')).toBeNull();
  });

  it('« Vous » : avatar doré, sans initiale', () => {
    renderThemed(
      <TreeNode
        name="Vous"
        you
        accessibilityLabel="Vous"
        accessibilityHint="Ouvre votre fiche."
        onPress={noop}
        testID="n"
      />,
      theme,
    );
    expect(screen.queryByText('V')).toBeNull();
    expect(screen.getByText('Vous')).toBeOnTheScreen();
  });

  it('appui : ouvre la fiche ; appui long : affiche le chemin, aussi par action d’accessibilité', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    renderThemed(
      <TreeNode
        {...CLAIRE}
        onPress={onPress}
        onLongPress={onLongPress}
        longPressLabel="Voir le lien de parenté"
      />,
      theme,
    );
    const node = screen.getByRole('button');
    fireEvent.press(node);
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent(node, 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);

    expect(node.props.accessibilityActions).toEqual([
      { name: 'longpress', label: 'Voir le lien de parenté' },
    ]);
    fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
    expect(onLongPress).toHaveBeenCalledTimes(2);
  });

  it('sans action, il est lu comme un texte et n’est pas un bouton', () => {
    renderThemed(<TreeNode {...CLAIRE_STATIC} />, theme);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Claire Martin, votre mère, née en 1968')).toBeOnTheScreen();
  });
});

describe('Nœud de l’arbre : anneau d’anniversaire et animations réduites', () => {
  it('l’anneau respire en 2 s quand les animations sont permises', () => {
    const loop = jest.spyOn(Animated, 'loop');
    renderThemed(<TreeNode {...CLAIRE} state="birthday" />, {
      scheme: 'jour',
      seniorMode: false,
      reduceMotion: false,
    });
    expect(loop).toHaveBeenCalledTimes(1);
    expect(metrics.treeNode.breathHalfCycle * 2).toBe(2000);
    loop.mockRestore();
  });

  it('l’anneau reste fixe quand le téléphone demande de réduire les animations', () => {
    const loop = jest.spyOn(Animated, 'loop');
    renderThemed(<TreeNode {...CLAIRE} state="birthday" />, {
      scheme: 'jour',
      seniorMode: false,
      reduceMotion: true,
    });
    expect(loop).not.toHaveBeenCalled();
    expect(flat(screen.getByTestId('n-ring').props.style).borderColor).toBe(themes.jour.fete);
    loop.mockRestore();
  });

  it('aucune animation hors anniversaire', () => {
    const loop = jest.spyOn(Animated, 'loop');
    renderThemed(<TreeNode {...CLAIRE} state="path" />, { scheme: 'jour', seniorMode: false });
    expect(loop).not.toHaveBeenCalled();
    loop.mockRestore();
  });
});
