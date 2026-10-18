// Toast et Feuille : annonce au lecteur d'écran, durées de la charte, persistance en mode Aînés,
// fermeture au voile et au bouton retour, fondu court quand le téléphone réduit les animations,
// Jour et Nuit, texte agrandi.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Text } from 'react-native';

import { Chip } from '../src/components/Chip';
import { Sheet, sheetPanHandlers } from '../src/components/Sheet';
import { Toast } from '../src/components/Toast';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { motion, radius, themes } from '../src/tokens';
import {
  expectReadableTexts,
  expectScalableTexts,
  flat,
  isHost,
  numeric,
  renderThemed,
  THEME_CASES,
  touchTargetFor,
  type ThemeCase,
} from './helpers';

const noop = () => undefined;

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function Themed({ theme, children }: { theme: ThemeCase; children: ReactNode }) {
  return (
    <ThemeProvider
      scheme={theme.scheme}
      seniorMode={theme.seniorMode}
      reduceMotion={theme.reduceMotion ?? false}
    >
      {children}
    </ThemeProvider>
  );
}

describe.each(THEME_CASES)('Toast ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('pilule `notification`, texte `sur-notification` lisible, rôle « status », annoncé', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = renderThemed(
      <Toast
        message="Lucienne a rejoint l’arbre."
        visible
        onHide={noop}
        closeLabel="Fermer"
        testID="toast"
      />,
      theme,
    );
    const toast = screen.getByTestId('toast');
    expect(toast.props.role).toBe('status');
    expect(toast.props.accessibilityLiveRegion).toBe('polite');
    expect(flat(toast.props.style).backgroundColor).toBe(colors.notification);
    expect(announce).toHaveBeenCalledWith('Lucienne a rejoint l’arbre.');
    expectReadableTexts(view, theme.scheme);
    expectScalableTexts(view);
  });

  it(
    theme.seniorMode
      ? 'reste affiché jusqu’à ce qu’on le ferme, bouton Fermer de 56'
      : 'disparaît après 300 ms d’apparition et 2,5 s de présence',
    () => {
      jest.useFakeTimers();
      const onHide = jest.fn();
      const timing = jest.spyOn(Animated, 'timing');
      renderThemed(
        <Toast message="Invitation envoyée." visible onHide={onHide} closeLabel="Fermer" />,
        theme,
      );
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 1, duration: motion.duration.toastApparition }),
      );
      act(() => {
        jest.advanceTimersByTime(
          motion.duration.toastApparition + motion.duration.toastPresence + 1,
        );
      });
      if (theme.seniorMode) {
        expect(timing).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ toValue: 0 }),
        );
        const close = screen.getByRole('button', { name: 'Fermer' });
        expect(flat(close.props.style).minHeight).toBe(touchTargetFor(theme));
        fireEvent.press(close);
      }
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 0, duration: motion.duration.toastDisparition }),
      );
    },
  );
});

describe('Toast : annonce selon le système', () => {
  it('Android : pas d’annonce explicite, la région vivante suffit (pas de double lecture)', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    // Le préréglage de React Native en fait déjà un faux : on efface ses appels précédents.
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    renderThemed(
      <Toast message="Invitation envoyée." visible onHide={noop} closeLabel="Fermer" testID="t" />,
      { scheme: 'jour', seniorMode: false },
    );
    expect(announce).not.toHaveBeenCalled();
    expect(screen.getByTestId('t').props.accessibilityLiveRegion).toBe('polite');
  });

  it('iOS : annonce explicite du message', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    // Le préréglage de React Native en fait déjà un faux : on efface ses appels précédents.
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    renderThemed(
      <Toast message="Invitation envoyée." visible onHide={noop} closeLabel="Fermer" />,
      { scheme: 'jour', seniorMode: false },
    );
    expect(announce).toHaveBeenCalledWith('Invitation envoyée.');
  });
});

describe('Toast : persistance et animations réduites', () => {
  it('persistant hors mode Aînés : bouton Fermer, pas de disparition seule', () => {
    jest.useFakeTimers();
    const timing = jest.spyOn(Animated, 'timing');
    renderThemed(
      <Toast message="Invitation envoyée." visible persistent onHide={noop} closeLabel="Fermer" />,
      { scheme: 'jour', seniorMode: false },
    );
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 0 }),
    );
  });

  it('animations réduites : fondu de 150 ms, sans glisser', () => {
    const timing = jest.spyOn(Animated, 'timing');
    renderThemed(
      <Toast message="Invitation envoyée." visible onHide={noop} closeLabel="Fermer" testID="t" />,
      { scheme: 'jour', seniorMode: false, reduceMotion: true },
    );
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, duration: motion.duration.fonduReduit }),
    );
    const transform = flat(screen.getByTestId('t').props.style).transform as {
      translateY: unknown;
    }[];
    expect(transform[0]?.translateY).toBe(0);
  });

  it('n’affiche rien tant qu’il n’est pas visible', () => {
    renderThemed(
      <Toast message="Invitation envoyée." visible={false} onHide={noop} closeLabel="Fermer" />,
      {
        scheme: 'jour',
        seniorMode: false,
      },
    );
    expect(screen.queryByText('Invitation envoyée.')).toBeNull();
  });
});

describe.each(THEME_CASES)('Feuille ($scheme, mode Aînés : $seniorMode)', (theme) => {
  const colors = themes[theme.scheme];

  it('titre en en-tête, coins `rayon-feuille`, fond `fond-carte`, lisible', () => {
    const view = renderThemed(
      <Sheet
        visible
        title="Inviter vos proches"
        subtitle="Ils recevront un lien pour rejoindre l’arbre."
        onClose={noop}
        closeLabel="Fermer"
        testID="sheet"
      >
        <Chip label="Contenu" />
      </Sheet>,
      theme,
    );
    expect(screen.getByRole('header')).toHaveTextContent('Inviter vos proches');
    const panel = view.UNSAFE_root.findAll(
      (n) => typeof n.type === 'string' && n.props.accessibilityViewIsModal === true,
    )[0];
    expect(flat(panel?.props.style)).toMatchObject({
      backgroundColor: colors.fondCarte,
      borderTopLeftRadius: radius.feuille,
      borderTopRightRadius: radius.feuille,
    });
    // Les textes de la feuille défilent : ils ne sont jamais tronqués ni réduits.
    for (const text of view.UNSAFE_root.findAll((n) => isHost(n, 'Text'))) {
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(view.UNSAFE_root.findAll((n) => isHost(n, 'RCTScrollView')).length).toBeGreaterThan(0);
    expectReadableTexts(view, theme.scheme);
  });

  it('se ferme en touchant le voile, nommé pour le lecteur d’écran, et au bouton retour', () => {
    const onClose = jest.fn();
    renderThemed(
      <Sheet
        visible
        title="Inviter vos proches"
        onClose={onClose}
        closeLabel="Fermer"
        testID="sheet"
      >
        <Text>Contenu</Text>
      </Sheet>,
      theme,
    );
    // Le voile apparaît en fondu sur le fil natif (sous Jest, son opacité reste à 0), et la
    // feuille est modale : le voile n'est pas proposé au lecteur d'écran d'iOS. D'où le geste
    // « échappement » du lecteur d'écran sur la feuille, et le bouton retour d'Android.
    const scrim = screen.getByTestId('sheet-scrim', { includeHiddenElements: true });
    expect(scrim.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Fermer',
    });
    fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByTestId('sheet'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent(screen.getByTestId('sheet-panel'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('Feuille : mouvement', () => {
  function open(reduceMotion: boolean) {
    const timing = jest.spyOn(Animated, 'timing');
    const theme = { scheme: 'jour' as const, seniorMode: false, reduceMotion };
    const view = render(
      <Themed theme={theme}>
        <Sheet visible={false} title="Inviter" onClose={noop} closeLabel="Fermer">
          <Text>Contenu</Text>
        </Sheet>
      </Themed>,
    );
    timing.mockClear();
    view.rerender(
      <Themed theme={theme}>
        <Sheet visible title="Inviter" onClose={noop} closeLabel="Fermer">
          <Text>Contenu</Text>
        </Sheet>
      </Themed>,
    );
    return timing.mock.calls.map(([, config]) => config);
  }

  it('monte en 360 ms', () => {
    expect(open(false)).toEqual([
      expect.objectContaining({ toValue: 1, duration: motion.duration.feuille }),
    ]);
  });

  it('animations réduites : fondu de 150 ms', () => {
    expect(open(true)).toEqual([
      expect.objectContaining({ toValue: 1, duration: motion.duration.fonduReduit }),
    ]);
  });

  describe('geste de la poignée', () => {
    function gesture(dy: number) {
      return { dy, dx: 0 } as never;
    }
    function setup(stillVisible: boolean) {
      jest.useFakeTimers();
      const drag = new Animated.Value(0);
      const onClose = jest.fn();
      const handlers = sheetPanHandlers({
        drag,
        getHeight: () => 400,
        isVisible: () => stillVisible,
        onClose,
      });
      const timing = jest.spyOn(Animated, 'timing');
      return { drag, onClose, handlers, timing };
    }

    it('suit le doigt vers le bas, jamais vers le haut', () => {
      const { drag, handlers } = setup(true);
      handlers.onPanResponderMove(null, gesture(80));
      expect(numeric(drag)).toBe(80);
      handlers.onPanResponderMove(null, gesture(-30));
      expect(numeric(drag)).toBe(0);
    });

    it('relâchée avant le quart, elle se repose sans se fermer', () => {
      const { handlers, onClose, timing } = setup(true);
      handlers.onPanResponderRelease(null, gesture(90));
      expect(onClose).not.toHaveBeenCalled();
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 0 }),
      );
    });

    it('relâchée au-delà du quart, elle demande sa fermeture', () => {
      const { handlers, onClose, timing } = setup(false);
      handlers.onPanResponderRelease(null, gesture(150));
      jest.runAllTimers();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(timing).not.toHaveBeenCalled();
    });

    it('si l’écran ne la ferme pas, elle se repose au lieu de rester à mi-course', () => {
      const { handlers, onClose, timing } = setup(true);
      handlers.onPanResponderRelease(null, gesture(150));
      expect(onClose).toHaveBeenCalledTimes(1);
      jest.runAllTimers();
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 0 }),
      );
    });
  });

  it('fermée, elle ne rend rien', () => {
    renderThemed(
      <Sheet visible={false} title="Inviter" onClose={noop} closeLabel="Fermer">
        <Text>Contenu</Text>
      </Sheet>,
      { scheme: 'jour', seniorMode: false },
    );
    expect(screen.queryByText('Inviter')).toBeNull();
  });
});
