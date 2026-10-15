// Messages de commit conventionnels (TRD, « Organisation du code », Conventions).
// Exemple : `feat(kinship): calcule le chemin le plus court`.
// La portée est facultative ; si elle est donnée, elle doit être un module connu.
const scopes = [
  'kinship',
  'layout',
  'domain',
  'sync',
  'voice',
  'ui',
  'i18n',
  'db',
  'api',
  'worker',
  'mobile',
  'web',
  'admin',
  'exploitation',
  'docs',
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', scopes],
  },
};
