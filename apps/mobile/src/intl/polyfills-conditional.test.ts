// Sélection conditionnelle des polyfills : sur un moteur à qui ne manque que PluralRules (cas
// fréquent des anciens Hermes), seul ce polyfill s'installe ; les autres gardent l'Intl natif.
describe('installIntlPolyfills sur un Intl sans PluralRules', () => {
  const nativePluralRules = Intl.PluralRules;
  const nativeNumberFormat = Intl.NumberFormat;
  const nativeDateTimeFormat = Intl.DateTimeFormat;

  beforeAll(() => {
    Reflect.deleteProperty(Intl, 'PluralRules');
  });

  afterAll(() => {
    Object.defineProperty(Intl, 'PluralRules', {
      value: nativePluralRules,
      configurable: true,
      writable: true,
    });
  });

  it('n’installe que PluralRules, au chargement du module', () => {
    expect('PluralRules' in Intl).toBe(false);
    let installed: readonly string[] = [];
    jest.isolateModules(() => {
      installed =
        jest.requireActual<typeof import('./polyfills')>('./polyfills').installedIntlPolyfills;
    });

    expect(installed).toEqual(['PluralRules']);
    expect(new Intl.PluralRules('fr').select(0)).toBe('one');
    expect(new Intl.PluralRules('en').select(0)).toBe('other');
    expect(Intl.NumberFormat).toBe(nativeNumberFormat);
    expect(Intl.DateTimeFormat).toBe(nativeDateTimeFormat);
  });
});
