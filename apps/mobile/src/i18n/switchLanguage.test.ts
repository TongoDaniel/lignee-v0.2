// Changement de langue qui échoue : l'interface garde la langue précédente.
import type { Language, Translator } from '@lignee/i18n';
import { createTranslator } from '@lignee/i18n';

import { switchLanguage } from './I18nProvider';

/** Traducteur dont le passage à `failing` échoue après avoir changé la langue. */
function flakyTranslator(failing: Language): Translator & { readonly calls: Language[] } {
  let language: Language = 'fr';
  const calls: Language[] = [];
  const real = createTranslator({ language });
  return {
    ...real,
    calls,
    get language() {
      return language;
    },
    changeLanguage: (next: Language) => {
      calls.push(next);
      language = next;
      return next === failing ? Promise.reject(new Error('échec simulé')) : Promise.resolve();
    },
  };
}

describe('switchLanguage', () => {
  it('passe à la nouvelle langue', async () => {
    const translator = createTranslator({ language: 'fr' });
    await switchLanguage(translator, 'en');
    expect(translator.language).toBe('en');
    expect(translator.t('common:navigation.tree')).toBe('Tree');
  });

  it('revient à la langue précédente si le changement échoue, sans lever d’erreur', async () => {
    const translator = flakyTranslator('en');
    await expect(switchLanguage(translator, 'en')).resolves.toBeUndefined();
    expect(translator.calls).toEqual(['en', 'fr']);
    expect(translator.language).toBe('fr');
  });

  it('ne fait rien si la langue ne change pas', async () => {
    const translator = flakyTranslator('en');
    await switchLanguage(translator, 'fr');
    expect(translator.calls).toEqual([]);
  });
});
