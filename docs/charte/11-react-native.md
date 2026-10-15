# Mise en œuvre React Native

Le kit de la charte contient tout ce qu’il faut pour brancher l’identité dans l’app Expo : `code/tokens.ts` (couleurs Jour et Nuit, typographie, espacements, rayons, tailles, ombres, mouvement), `code/fonts/` (les sept fichiers TTF), `code/tailwind.preset.js` (si vous utilisez NativeWind), `code/tokens.json` (la source), les icônes SVG en `currentColor` et les fichiers de marque (icône d’app, écran de lancement).

## Où ranger les fichiers

| Dans le kit | Dans l’app |
| --- | --- |
| `code/tokens.ts`, `code/fonts/`, `code/tailwind.preset.js` | `src/theme/` |
| `icones/` (SVG en `currentColor`) | `src/icones/` |
| `applications/` (icône d’app, écran de lancement) | `assets/marque/` |

Les exemples ci-dessous partent de cette organisation. Chaque bloc commence par le nom du fichier.

## Règles

- Ne tapez jamais une couleur, une taille ou un rayon dans un composant : importez-les de `tokens.ts`.
- Une modification de couleur se fait dans la charte, puis on régénère `tokens.ts`. Les deux développeurs utilisent le même fichier.
- Chaque composant de la charte (Bouton, Puce, Carte, Champ…) devient un composant React Native du même nom, avec les props décrites dans sa fiche.

## Polices

Chargez les polices au démarrage avec expo-font, sous les noms de `fontFiles`. Sur Android, une police personnalisée ne change pas de graisse avec `fontWeight` : chaque graisse est une famille à part (`InstrumentSans-SemiBold`). Les styles de `typography` utilisent donc `fontFamily` seul.

```tsx
// App.tsx
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { fontFiles } from './src/theme/tokens';
import { ThemeProvider } from './src/theme/ThemeProvider';
import Navigation from './src/Navigation';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded] = useFonts(fontFiles);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;
  return <ThemeProvider><Navigation /></ThemeProvider>;
}
```

## Thème Jour et Nuit

```tsx
// src/theme/ThemeProvider.tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type ThemeColors } from './tokens';

const ThemeContext = createContext<ThemeColors>(themes.jour);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return <ThemeContext.Provider value={scheme === 'dark' ? themes.nuit : themes.jour}>{children}</ThemeContext.Provider>;
}

export const useCouleurs = () => useContext(ThemeContext);
```

## Exemple : le bouton principal

```tsx
// src/composants/Bouton.tsx
import { Pressable, Text } from 'react-native';
import { opacity, radius, size, space, typography } from '../theme/tokens';
import { useCouleurs } from '../theme/ThemeProvider';

type Props = { libelle: string; onPress: () => void; desactive?: boolean };

export function Bouton({ libelle, onPress, desactive }: Props) {
  const c = useCouleurs();
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ disabled: !!desactive }}
      style={({ pressed }) => ({
        minHeight: size.hauteurBouton, minWidth: size.cibleTactile,
        paddingHorizontal: space[6], paddingVertical: space[2],
        borderRadius: radius.pilule, backgroundColor: c.action,
        alignItems: 'center', justifyContent: 'center',
        opacity: desactive ? opacity.desactive : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <Text style={[typography.bouton, { color: c.surAction, textAlign: 'center' }]}>{libelle}</Text>
    </Pressable>
  );
}
```

`minHeight` plutôt que `height` : quand le texte du téléphone est agrandi, le bouton grandit avec son libellé au lieu de le couper.

## Icônes

Installez `react-native-svg` et `react-native-svg-transformer` (avec la configuration `metro.config.js` décrite dans son README), puis importez les fichiers de `src/icones/` comme des composants :

```tsx
import Sante from '../icones/sante.svg';

<Sante width={size.iconeM} height={size.iconeM} color={c.sante} />
```

Les fichiers sont dessinés en `currentColor` : la prop `color` leur donne leur couleur. Gardez le trait à 2 px : ne mettez pas à l’échelle un fichier de 24 px pour en faire une icône de 48 px, utilisez `size.iconeL` (28) au plus dans l’interface.

## NativeWind

Si vous utilisez NativeWind, ajoutez le preset de la charte après celui de NativeWind, dans `tailwind.config.js` : `presets: [require('nativewind/preset'), require('./src/theme/tailwind.preset.js')]`. Les couleurs sémantiques ont une valeur Jour par défaut et une valeur Nuit avec le suffixe `-nuit` : `className="bg-fond dark:bg-fond-nuit"`.

## L’arbre

- Calculez la disposition (générations, couples, enfants) dans une fonction pure, testée à part, puis dessinez avec `react-native-svg` (ou Skia au-delà de quelques centaines de personnes).
- Déplacement et zoom : `react-native-gesture-handler` et `react-native-reanimated`, avec les trois niveaux de zoom de la section « L’arbre ».
- Rendez chaque personne touchable avec un libellé d’accessibilité complet : « Claire Martin, votre mère, née en 1968 ».

## Configuration Expo

L’icône d’app, l’icône adaptative Android et l’écran de lancement se déclarent dans `app.json` : voir la section « Applications ».
