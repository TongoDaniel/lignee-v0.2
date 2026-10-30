// Messages chargés dans i18next. Un nouvel espace de noms s'ajoute ici et dans `namespaces`
// (un test vérifie que la liste correspond aux fichiers de `messages/`).
import enCommon from '../messages/en/common.json';
import enKinship from '../messages/en/kinship.json';
import frCommon from '../messages/fr/common.json';
import frKinship from '../messages/fr/kinship.json';
import type { Language } from './languages';

export const namespaces = ['common', 'kinship'] as const;

export type Namespace = (typeof namespaces)[number];

export const resources: Readonly<Record<Language, Readonly<Record<Namespace, object>>>> = {
  fr: { common: frCommon, kinship: frKinship },
  en: { common: enCommon, kinship: enKinship },
};
