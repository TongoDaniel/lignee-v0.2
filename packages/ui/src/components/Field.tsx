// Champ (components/Champ) : libellé toujours visible au-dessus, boîte de 56 au moins, contour
// `bordure-champ` de 1,5 ; au focus, 2,5 en `action`, curseur `action`. En erreur : contour
// `erreur` et message sous le champ avec l'icône `alerte`, jamais la couleur seule. Le micro
// propose la saisie à la voix ; il est proposé d'office en mode Aînés (09-accessibilite.md).
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { Icon } from '../icons/Icon';
import { radius, size, space, stroke } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { metrics } from './metrics';

export type FieldKeyboard = 'text' | 'number' | 'date' | 'email' | 'phone';

const KEYBOARDS: { readonly [K in FieldKeyboard]: KeyboardTypeOptions } = {
  text: 'default',
  number: 'number-pad',
  date: 'numbers-and-punctuation',
  email: 'email-address',
  phone: 'phone-pad',
};

/** Saisie à la voix : le bouton micro dans le champ, et son libellé pour le lecteur d'écran. */
export interface FieldVoiceInput {
  readonly onPress: () => void;
  /** « Dicter le prénom », déjà traduit. */
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  /**
   * Faux : pas de micro, même en mode Aînés. Vrai : micro, même hors mode Aînés. Absent : micro
   * en mode Aînés seulement (README de Champ : « activé par défaut en mode Aînés »).
   */
  readonly enabled?: boolean;
}

export interface FieldProps {
  /** Libellé, toujours affiché : jamais remplacé par le texte d'exemple. Déjà traduit. */
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  /** Texte d'exemple (`texte-discret`), jamais une information. */
  readonly placeholder?: string;
  /** Une phrase qui dit quoi corriger (« Indiquez un prénom. »). */
  readonly error?: string;
  /** Indication pour le lecteur d'écran, hors erreur. */
  readonly accessibilityHint?: string;
  readonly voiceInput?: FieldVoiceInput;
  readonly keyboard?: FieldKeyboard;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  accessibilityHint,
  voiceInput,
  keyboard = 'text',
  disabled = false,
  testID,
}: FieldProps) {
  const theme = useTheme();
  const { colors, typography, touchTarget, seniorMode } = theme;
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error !== '';
  const borderWidth = hasError || focused ? metrics.field.focusBorderWidth : stroke.champ;
  const borderColor = hasError ? colors.erreur : focused ? colors.action : colors.bordureChamp;
  // Le contour plus épais au focus ne déplace pas le texte : la marge compense.
  const paddingHorizontal = metrics.field.paddingHorizontal - (borderWidth - stroke.champ);
  const showMic = voiceInput !== undefined && (voiceInput.enabled ?? seniorMode) && !disabled;
  // Saisie en Instrument Sans 17, graisse 500.
  const inputStyle = { ...typography.corps, fontFamily: typography.etiquette.fontFamily };

  return (
    <View testID={testID} style={[styles.container, { gap: space[2] }]}>
      <Text
        style={[
          typography.etiquette,
          { color: colors.texteSecondaire, paddingLeft: metrics.field.labelInset },
        ]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            minHeight: Math.max(size.hauteurBouton, touchTarget),
            borderRadius: radius.champ,
            backgroundColor: colors.fondCarte,
            borderWidth,
            borderColor,
            paddingLeft: paddingHorizontal,
            gap: space[2],
          },
        ]}
      >
        <TextInput
          testID={testID === undefined ? undefined : `${testID}-input`}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.texteDiscret}
          cursorColor={colors.action}
          selectionColor={colors.action}
          keyboardType={KEYBOARDS[keyboard]}
          editable={!disabled}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          accessibilityLabel={label}
          accessibilityHint={hasError ? error : accessibilityHint}
          accessibilityState={{ disabled }}
          style={[
            inputStyle,
            styles.input,
            {
              color: disabled ? colors.texteDiscret : colors.texte,
              minHeight: touchTarget,
              paddingVertical: space[2],
              paddingRight: showMic ? 0 : paddingHorizontal,
            },
          ]}
        />
        {showMic && (
          <Pressable
            testID={testID === undefined ? undefined : `${testID}-voice`}
            onPress={voiceInput.onPress}
            accessibilityRole="button"
            accessibilityLabel={voiceInput.accessibilityLabel}
            accessibilityHint={voiceInput.accessibilityHint}
            style={[styles.mic, { minWidth: touchTarget, minHeight: touchTarget }]}
          >
            <Icon name="micro" color={colors.action} />
          </Pressable>
        )}
      </View>
      {hasError && (
        <View
          style={[
            styles.message,
            { gap: metrics.field.messageGap, paddingLeft: metrics.field.labelInset },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          accessible
        >
          <Icon name="alerte" size={size.iconeS} color={colors.erreur} />
          <Text style={[typography.etiquette, styles.messageText, { color: colors.erreur }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
  },
  mic: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageText: {
    flex: 1,
  },
});
