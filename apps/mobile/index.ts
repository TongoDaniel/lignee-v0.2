// Point d'entrée de l'app (`main` de package.json). Les polyfills Intl s'installent avant tout
// autre module : expo-router, i18next et intl-messageformat les trouvent déjà en place.
import './src/intl/polyfills';
import 'expo-router/entry';
