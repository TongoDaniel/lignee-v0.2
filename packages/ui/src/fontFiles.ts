// Fichier généré : ne pas modifier.
// Source : docs/charte/tokens.json (type.fonts). Générateur : packages/ui/scripts/generate-tokens.ts.
// Pour changer une valeur, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui tokens`.

// Au démarrage de l’app : `const [loaded] = useFonts(fontFiles);` (expo-font).
// Les `require` sont résolus par Metro, qui embarque les TTF comme des assets et renvoie leur
// identifiant. Node ne sait pas les charger : ce fichier n’est importé ni par l’index du paquet
// ni par un test. Importez-le par `@lignee/ui/fontFiles`, depuis l’app seulement.
import type { FontName } from './tokens';

// `require` de Metro (les types de Node sont exclus de src/).
declare const require: (path: string) => number;

export const fontFiles: { readonly [K in FontName]: number } = {
  'FrauncesLignee-Display': require('../assets/fonts/FrauncesLignee-Display.ttf'),
  'FrauncesLignee-Italic': require('../assets/fonts/FrauncesLignee-Italic.ttf'),
  'InstrumentSans-Regular': require('../assets/fonts/InstrumentSans-Regular.ttf'),
  'InstrumentSans-Medium': require('../assets/fonts/InstrumentSans-Medium.ttf'),
  'InstrumentSans-SemiBold': require('../assets/fonts/InstrumentSans-SemiBold.ttf'),
  'InstrumentSans-Bold': require('../assets/fonts/InstrumentSans-Bold.ttf'),
  'LaBelleAurore-Regular': require('../assets/fonts/LaBelleAurore-Regular.ttf'),
};
