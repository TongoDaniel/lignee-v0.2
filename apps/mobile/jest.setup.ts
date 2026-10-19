// Réglages communs des tests de rendu.
// Zones sûres : jest-expo ne simule pas react-native-safe-area-context.
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Base locale : les modules natifs (expo-sqlite avec SQLCipher, trousseau) n'existent pas sous
// Jest. Les écrans la voient « en cours d'ouverture » ; la logique est testée dans @lignee/sync.
jest.mock('./src/db/openAppDatabase', () => ({
  openAppDatabase: () => new Promise(() => undefined),
}));
