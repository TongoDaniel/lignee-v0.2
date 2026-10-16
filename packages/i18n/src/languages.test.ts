import { describe, expect, it } from 'vitest';

import { isLanguage, resolveLanguage } from './languages';

describe('resolveLanguage', () => {
  it('takes the first supported language of the device, whatever the region', () => {
    expect(resolveLanguage(['en-CM', 'fr-CM'])).toBe('en');
    expect(resolveLanguage(['fr_FR'])).toBe('fr');
    expect(resolveLanguage(['de-DE', 'EN-gb'])).toBe('en');
  });

  it('falls back to French', () => {
    expect(resolveLanguage([])).toBe('fr');
    expect(resolveLanguage(['de-DE', 'pt-BR'])).toBe('fr');
  });
});

describe('isLanguage', () => {
  it('accepts only the interface languages', () => {
    expect(isLanguage('fr')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('fr-FR')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});
