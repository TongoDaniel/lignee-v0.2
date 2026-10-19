// Globales du moteur JavaScript que le code partagé rencontre sans les appeler. Le générateur
// d'arbres de @lignee/domain (chargé par src/dev-seed) déclare `referenceTree`, qui copie avec
// `structuredClone` ; le chargement de développement n'appelle que `generateTree`. Lu par
// tsconfig.src.json seulement (tsconfig.json a les types de Node, qui la déclarent déjà).
declare function structuredClone<T>(value: T): T;
