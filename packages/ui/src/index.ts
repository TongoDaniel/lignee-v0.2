// Point d'entrée de @lignee/ui : tokens de la charte (générés), thème, contraste, et composants de
// base de la charte (T-014). Les composants de personne et de navigation arrivent avec T-015.
// Correspondance avec les noms de la charte : docs/adr/0016-noms-des-composants-en-anglais.md.
export * from './tokens';
export * from './theme';
export * from './contrast';

export {
  ThemeProvider,
  useTheme,
  useSystemReduceMotion,
  type ThemeProviderProps,
  type UiTheme,
} from './theme/ThemeProvider';

export { Icon, iconNames, type IconName, type IconProps } from './icons/Icon';
export { Logo, logoDrawingFor, type LogoKind, type LogoProps } from './logo/Logo';

export { Button, type ButtonProps, type ButtonVariant } from './components/Button';
export { Card, type CardProps, type CardThumbnailTone } from './components/Card';
export { Chip, type ChipProps, type ChipTone } from './components/Chip';
export {
  Field,
  type FieldKeyboard,
  type FieldProps,
  type FieldVoiceInput,
} from './components/Field';
export { Header, type HeaderBack, type HeaderProps } from './components/Header';
export {
  SettingsGroup,
  SettingsRow,
  type SettingsGroupProps,
  type SettingsIconTone,
  type SettingsRowProps,
} from './components/SettingsRow';
export { Sheet, type SheetProps } from './components/Sheet';
export { Switch, type SwitchProps } from './components/Switch';
export { Toast, type ToastProps } from './components/Toast';
export { curve, timing, type CurveName, type Timing } from './components/motion';
