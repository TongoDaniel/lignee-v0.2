// Réglages communs des tests de rendu.
// Zones sûres : jest-expo ne simule pas react-native-safe-area-context.
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
