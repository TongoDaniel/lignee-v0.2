// Réglages communs des tests de rendu.
// Zones sûres : jest-expo ne simule pas react-native-safe-area-context.
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Base locale : les modules natifs (expo-sqlite avec SQLCipher, trousseau) n'existent pas sous
// Jest. Les écrans la voient « en cours d'ouverture » ; la logique est testée dans @lignee/sync.
jest.mock('./src/db/openAppDatabase', () => ({
  openAppDatabase: () => new Promise(() => undefined),
}));

// Skia : le moteur de dessin est natif, il n'existe pas sous Jest. Le canevas devient une vue qui
// garde ses enfants, chaque forme une vue repérable par son nom (`skia-Circle`, `skia-Text`…) :
// les tests comptent ce qui serait peint. Le rendu réel se vérifie sur le téléphone (issue #34).
jest.mock('@shopify/react-native-skia', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const host = (name: string) => {
    const Component = ({ children, ...props }: { children?: React.ReactNode; text?: string }) =>
      React.createElement(
        View,
        { testID: `skia-${name}`, accessibilityLabel: JSON.stringify(props.text ?? '') },
        children,
      );
    Component.displayName = name;
    return Component;
  };
  const font = {
    measureText: (text: string) => ({ width: Array.from(text).length * 8 }),
    getSize: () => 15,
  };
  return {
    Canvas: host('Canvas'),
    Group: host('Group'),
    Circle: host('Circle'),
    Path: host('Path'),
    RoundedRect: host('RoundedRect'),
    Text: host('Text'),
    DashPathEffect: host('DashPathEffect'),
    LinearGradient: host('LinearGradient'),
    vec: (x: number, y: number) => ({ x, y }),
    useFont: () => font,
  };
});

// Reanimated, Worklets et Gesture Handler : leur moteur est natif. Sous Jest, les valeurs
// partagées sont de simples objets, les animations aboutissent aussitôt et les gestes ne sont pas
// reconnus (les tests appellent les fonctions que les gestes appellent). Le comportement réel au
// doigt se vérifie sur le téléphone (issue #34).
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
    callback(...args);
  },
}));

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  // Stable d'un rendu à l'autre, comme la vraie valeur partagée.
  const sharedValue = <T>(initial: T) => React.useRef({ value: initial }).current;
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => (value: number) => value },
    useSharedValue: sharedValue,
    useDerivedValue: (compute: () => unknown) => ({ value: compute() }),
    useAnimatedReaction: () => undefined,
    withTiming: jest.fn((value: number) => value),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const chain: object = new Proxy(() => chain, { get: () => () => chain });
  return {
    Gesture: new Proxy({}, { get: () => () => chain }),
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
