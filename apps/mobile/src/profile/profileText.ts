// Mots de la fiche (T-024 du plan V1) : de la structure calculée par `buildProfile`
// (@lignee/domain, sans aucun mot) au texte de la langue en cours (@lignee/i18n). Aucune décision
// ici : ni choix du nom, ni droit de voir un nom, ni ordre des blocs (tout cela est dans le
// domaine). Fonctions pures, testées sans écran.
import type { FuzzyDateDisplay, MultipleBirthKind, ProfileMultipleBirth } from '@lignee/domain';
import type { Translator } from '@lignee/i18n';

type DisplayBound = Extract<FuzzyDateDisplay, { kind: 'point' }>['date'];

function boundText(
  bound: DisplayBound,
  calendar: 'gregorian' | 'hijri',
  translator: Translator,
): string {
  if (calendar === 'hijri') {
    return translator.t('common:profile.dates.hijri', { year: String(bound.year) });
  }
  if (bound.precision === 'decade') {
    return translator.t('common:profile.dates.decade', { year: String(bound.year) });
  }
  try {
    return translator.format.calendarDate({
      year: bound.year,
      ...(bound.month === undefined ? {} : { month: bound.month }),
      ...(bound.day === undefined ? {} : { day: bound.day }),
    });
  } catch {
    // Une date incomplète ou hors limites ne doit pas casser la fiche : l'année suffit.
    return String(bound.year);
  }
}

/** Date floue en toutes lettres : « 1er mars 1931 », « vers 1940 », « entre 1935 et 1940 »… */
export function fuzzyDateText(date: FuzzyDateDisplay, translator: Translator): string {
  const { t } = translator;
  switch (date.kind) {
    case 'text':
      return date.text;
    case 'range':
      return t('common:profile.dates.between', {
        from: boundText(date.from, date.calendar, translator),
        to: boundText(date.to, date.calendar, translator),
      });
    case 'point': {
      const text = boundText(date.date, date.calendar, translator);
      switch (date.qualifier) {
        case 'exact':
          return text;
        case 'about':
        case 'calculated':
          return t('common:profile.dates.about', { date: text });
        case 'before':
          return t('common:profile.dates.before', { date: text });
        case 'after':
          return t('common:profile.dates.after', { date: text });
      }
    }
  }
}

/** « de 1968 à 2004 », « depuis 2004 », « jusqu’à 2004 » ; rien si la période n'a pas de date. */
export function periodText(
  start: FuzzyDateDisplay | undefined,
  end: FuzzyDateDisplay | undefined,
  translator: Translator,
): string | undefined {
  const { t } = translator;
  if (start !== undefined && end !== undefined) {
    return t('common:profile.period.range', {
      start: fuzzyDateText(start, translator),
      end: fuzzyDateText(end, translator),
    });
  }
  if (start !== undefined) {
    return t('common:profile.period.since', { start: fuzzyDateText(start, translator) });
  }
  if (end !== undefined) {
    return t('common:profile.period.until', { end: fuzzyDateText(end, translator) });
  }
  return undefined;
}

/** Titre sous le nom, avec sa période s'il en a une : « Fon, depuis 2004 ». Libellé non traduit. */
export function titleLine(
  title: {
    readonly label: string;
    readonly start?: FuzzyDateDisplay;
    readonly end?: FuzzyDateDisplay;
  },
  translator: Translator,
): string {
  const period = periodText(title.start, title.end, translator);
  return period === undefined
    ? title.label
    : translator.t('common:profile.titleWithPeriod', { label: title.label, period });
}

/** « Adama », « Adama et Ines », « Adama, Ines et Ivan ». */
export function joinNames(names: readonly string[], translator: Translator): string {
  const last = names[names.length - 1];
  if (last === undefined) return '';
  if (names.length === 1) return last;
  return translator.t('common:profile.list.and', { list: names.slice(0, -1).join(', '), last });
}

const KIND_KEYS = {
  twins: 'common:profile.multipleBirth.twins',
  triplets: 'common:profile.multipleBirth.triplets',
  quadruplets: 'common:profile.multipleBirth.quadruplets',
  multiple: 'common:profile.multipleBirth.multiple',
} as const satisfies Record<MultipleBirthKind, string>;

export interface MultipleBirthText {
  /** Le mot de la puce : « Jumeaux ». */
  readonly kind: string;
  /** « Avec Adama » ; absent si aucun des autres enfants n'a de nom. */
  readonly with?: string;
  /** « Ordre de naissance : 2 », si le rang est connu. */
  readonly order?: string;
}

export function multipleBirthText(
  birth: ProfileMultipleBirth,
  unknownName: string,
  translator: Translator,
): MultipleBirthText {
  const { t } = translator;
  const kind = t(KIND_KEYS[birth.kind]);
  const names = birth.others.map((other) => other.name ?? unknownName);
  const withText =
    names.length === 0
      ? undefined
      : t('common:profile.multipleBirth.with', {
          names: joinNames(names, translator),
        });
  return {
    kind,
    ...(withText === undefined ? {} : { with: withText }),
    ...(birth.order === undefined
      ? {}
      : {
          order: t('common:profile.multipleBirth.order', {
            order: translator.format.number(birth.order),
          }),
        }),
  };
}
