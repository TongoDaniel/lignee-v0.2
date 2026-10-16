// Messages chargés dans i18next. Un nouvel espace de noms s'ajoute ici et dans `namespaces`
// (un test vérifie que la liste correspond aux fichiers de `messages/`).
import enCommun from '../messages/en/commun.json';
import frCommun from '../messages/fr/commun.json';
import type { Language } from './languages';

export const namespaces = ['commun'] as const;

export type Namespace = (typeof namespaces)[number];

export const resources: Readonly<Record<Language, Readonly<Record<Namespace, object>>>> = {
  fr: { commun: frCommun },
  en: { commun: enCommun },
};
