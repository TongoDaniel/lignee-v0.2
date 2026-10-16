import { describe, expect, it, vi } from 'vitest';

import { createTranslator, type Translator } from './index';

describe('createTranslator', () => {
  it('speaks French by default, with the charter wording', () => {
    const { t, language } = createTranslator();
    expect(language).toBe('fr');
    expect(t('common:app.name')).toBe('Lignée');
    expect(t('common:actions.confirm')).toBe('Valider');
    expect(t('common:actions.yesAdd')).toBe('Oui, ajouter');
    expect(t('common:actions.dontKnow')).toBe('Je ne sais pas');
    expect(t('common:privacy.onlyYou')).toBe('Visible par vous seul');
  });

  it('speaks English when asked', () => {
    const { t } = createTranslator({ language: 'en' });
    expect(t('common:actions.confirm')).toBe('Confirm');
    expect(t('common:actions.dontKnow')).toBe('I don’t know');
  });

  it('inserts parameters', () => {
    expect(createTranslator().t('common:tree.personJoined', { name: 'Awa' })).toBe(
      'Awa a rejoint l’arbre.',
    );
    expect(
      createTranslator({ language: 'en' }).t('common:tree.personJoined', { name: 'Awa' }),
    ).toBe('Awa has joined the tree.');
  });

  it('follows ICU plural rules of each language', () => {
    const fr = createTranslator({ language: 'fr' });
    const en = createTranslator({ language: 'en' });
    const count = (tr: Translator, n: number): string => tr.t('common:people.count', { count: n });

    expect(count(fr, 0)).toBe('Aucune personne');
    expect(count(fr, 1)).toBe('1 personne');
    // En français, 1,5 reste au singulier ; en anglais, 1.5 passe au pluriel.
    expect(count(fr, 1.5)).toBe('1,5 personne');
    expect(count(fr, 2)).toBe('2 personnes');
    expect(count(fr, 1234)).toMatch(new RegExp('^1[\\u00a0\\u202f]234 personnes$'));

    expect(count(en, 0)).toBe('No one');
    expect(count(en, 1)).toBe('1 person');
    expect(count(en, 1.5)).toBe('1.5 people');
    expect(count(en, 1234)).toBe('1,234 people');
  });

  it('switches language at once, without a new instance (CPT-12)', async () => {
    const translator = createTranslator();
    const { t } = translator;
    expect(t('common:actions.cancel')).toBe('Annuler');

    await translator.changeLanguage('en');

    expect(translator.language).toBe('en');
    expect(t('common:actions.cancel')).toBe('Cancel');
    expect(translator.format.number(1234.5)).toBe('1,234.5');
  });

  it('notifies subscribers of each change, until they unsubscribe', async () => {
    const translator = createTranslator();
    const listener = vi.fn();
    const unsubscribe = translator.subscribe(listener);

    await translator.changeLanguage('en');
    expect(listener).toHaveBeenLastCalledWith('en');
    await translator.changeLanguage('fr');
    expect(listener).toHaveBeenLastCalledWith('fr');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await translator.changeLanguage('en');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps translators independent from one another', async () => {
    const a = createTranslator();
    const b = createTranslator();
    await a.changeLanguage('en');
    expect(a.t('common:actions.save')).toBe('Save');
    expect(b.t('common:actions.save')).toBe('Enregistrer');
  });

  it('rejects unknown keys and missing or wrong parameters at compile time', () => {
    // Jamais appelée : `tsc --noEmit` (typecheck) échoue si une seule de ces lignes compile.
    const compileTimeChecks = ({ t }: Translator): void => {
      // @ts-expect-error clé inconnue
      t('common:actions.unknown');
      // @ts-expect-error espace de noms absent
      t('actions.confirm');
      // @ts-expect-error paramètre manquant
      t('common:tree.personJoined');
      // @ts-expect-error paramètre mal nommé
      t('common:tree.personJoined', { nom: 'Awa' });
      // @ts-expect-error un pluriel attend un nombre
      t('common:people.count', { count: 'deux' });
      // @ts-expect-error un message sans paramètre n'en accepte pas
      t('common:actions.confirm', { name: 'Awa' });
    };
    expect(compileTimeChecks).toBeTypeOf('function');
  });
});
