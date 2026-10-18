// Point d'entrée de @lignee/i18n : textes d'interface FR et EN (ACC-04, ACC-05).
export {
  formatCalendarDate,
  formatDateTime,
  formatNumber,
  formattersFor,
  pluralCategory,
  type CalendarDate,
  type Formatters,
} from './format';
export type { MessageParams } from './generated/message-params';
export {
  defaultLanguage,
  isLanguage,
  languages,
  resolveLanguage,
  type Language,
} from './languages';
export { namespaces, type Namespace } from './resources';
export {
  createTranslator,
  type MessageArgs,
  type MessageKey,
  type Translator,
  type TranslatorOptions,
} from './translator';
