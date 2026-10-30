// Saisie d'une date floue par morceaux (T-031 du plan V1 ; CL-DON-05, CL-DON-06) : un choix
// (inconnue, précise, vers, avant, après, entre deux dates, en toutes lettres), puis l'année, le
// mois et le jour, ou deux fois ces trois champs. Aucune phrase n'est analysée : « vers 1940 » se
// compose avec le choix « Vers » et l'année 1940. Les refus viennent du domaine
// (`parseDateDraft`) sous forme de codes ; le texte est celui de packages/i18n.
import type { DateBoundDraft, DateDraft, DateDraftIssue, DateMode } from '@lignee/domain';
import { Chip, Field, Switch, space, useTheme } from '@lignee/ui';
import { Text, View } from 'react-native';

import { useTranslator } from '../i18n/I18nProvider';
import { dateIssueText } from './messages';

const MODES = ['none', 'exact', 'about', 'before', 'after', 'between', 'text'] as const;

const MODE_KEYS = {
  none: 'common:personForm.date.modes.none',
  exact: 'common:personForm.date.modes.exact',
  about: 'common:personForm.date.modes.about',
  before: 'common:personForm.date.modes.before',
  after: 'common:personForm.date.modes.after',
  between: 'common:personForm.date.modes.between',
  calculated: 'common:personForm.date.modes.calculated',
  text: 'common:personForm.date.modes.text',
} as const satisfies Record<DateMode, string>;

export interface DateInputProps {
  /** Ce que la date décrit (« Date de naissance »), déjà traduit : libellé du groupe. */
  readonly label: string;
  readonly value: DateDraft;
  readonly onChange: (value: DateDraft) => void;
  /** Refus du domaine sur cette date. */
  readonly issue?: DateDraftIssue | undefined;
  /** Refus de l'enregistrement (déjà traduit), quand il désigne cette date. */
  readonly error?: string | undefined;
  readonly testID: string;
}

type BoundPart = 'year' | 'month' | 'day';

/** Le champ qui porte le refus : le jour, le mois, sinon l'année. */
function partOfIssue(code: DateDraftIssue['code']): BoundPart {
  if (code === 'day_invalid' || code === 'day_needs_month') return 'day';
  if (code === 'month_invalid' || code === 'decade_no_month') return 'month';
  return 'year';
}

function BoundFields({
  heading,
  bound,
  decade,
  onChange,
  errors,
  testID,
}: {
  readonly heading?: string | undefined;
  readonly bound: DateBoundDraft;
  readonly decade: boolean;
  readonly onChange: (bound: DateBoundDraft) => void;
  readonly errors: Partial<Record<BoundPart, string>>;
  readonly testID: string;
}) {
  const { t } = useTranslator();
  const { colors, typography } = useTheme();
  const cell = { flexGrow: 1, flexBasis: 140 } as const;
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      {heading !== undefined && (
        <Text
          accessibilityRole="header"
          style={[typography.etiquette, { color: colors.texteSecondaire }]}
        >
          {heading}
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        <View style={cell}>
          <Field
            testID={`${testID}-year`}
            label={t('common:personForm.date.year')}
            value={bound.year}
            keyboard="number"
            onChangeText={(year) => {
              onChange({ ...bound, year });
            }}
            error={errors.year}
          />
        </View>
        {!decade && (
          <View style={cell}>
            <Field
              testID={`${testID}-month`}
              label={t('common:personForm.date.month')}
              value={bound.month}
              keyboard="number"
              onChangeText={(month) => {
                onChange({ ...bound, month });
              }}
              error={errors.month}
            />
          </View>
        )}
        {!decade && (
          <View style={cell}>
            <Field
              testID={`${testID}-day`}
              label={t('common:personForm.date.day')}
              value={bound.day}
              keyboard="number"
              onChangeText={(day) => {
                onChange({ ...bound, day });
              }}
              error={errors.day}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export function DateInput({ label, value, onChange, issue, error, testID }: DateInputProps) {
  const translator = useTranslator();
  const { t } = translator;
  const { colors, typography } = useTheme();
  const set = (patch: Partial<DateDraft>) => {
    onChange({ ...value, ...patch });
  };

  // Un refus tombe sur le champ qui le porte, jamais sur toute la date.
  const issueText = issue === undefined ? undefined : dateIssueText(translator, issue.code);
  const errorsFor = (part: 'from' | 'to'): Partial<Record<BoundPart, string>> => {
    if (issue !== undefined && issue.part === part && issueText !== undefined) {
      return { [partOfIssue(issue.code)]: issueText };
    }
    if (part === 'from' && issue === undefined && error !== undefined) return { year: error };
    return {};
  };
  const hasBounds = value.mode !== 'none' && value.mode !== 'text';
  const shownModes: readonly DateMode[] =
    value.mode === 'calculated' ? [...MODES, 'calculated'] : MODES;

  return (
    <View testID={testID} style={{ gap: space[3] }}>
      <Text
        accessibilityRole="header"
        style={[typography.etiquette, { color: colors.texteSecondaire }]}
      >
        {label}
      </Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
      >
        {shownModes.map((mode) => (
          <Chip
            key={mode}
            testID={`${testID}-mode-${mode}`}
            label={t(MODE_KEYS[mode])}
            accessibilityLabel={`${label}, ${t(MODE_KEYS[mode])}`}
            accessibilityHint={t('common:personForm.date.mode')}
            selected={value.mode === mode}
            onPress={() => {
              set({ mode });
            }}
          />
        ))}
      </View>
      {value.mode === 'text' && (
        <Field
          testID={`${testID}-text`}
          label={t('common:personForm.date.text')}
          placeholder={t('common:personForm.date.textPlaceholder')}
          value={value.text}
          onChangeText={(text) => {
            set({ text });
          }}
          error={issue?.part === 'text' ? issueText : issue === undefined ? error : undefined}
        />
      )}
      {hasBounds && (
        <View style={{ gap: space[3] }}>
          <BoundFields
            testID={`${testID}-from`}
            heading={value.mode === 'between' ? t('common:personForm.date.first') : undefined}
            bound={value.from}
            decade={value.decade}
            onChange={(from) => {
              set({ from });
            }}
            errors={errorsFor('from')}
          />
          {value.mode === 'between' && (
            <BoundFields
              testID={`${testID}-to`}
              heading={t('common:personForm.date.second')}
              bound={value.to}
              decade={value.decade}
              onChange={(to) => {
                set({ to });
              }}
              errors={errorsFor('to')}
            />
          )}
          <Switch
            testID={`${testID}-decade`}
            label={t('common:personForm.date.decade')}
            description={t('common:personForm.date.decadeDescription')}
            value={value.decade}
            onValueChange={(decade) => {
              set({
                decade,
                // Des années entières n'ont ni mois ni jour : on les vide plutôt que de les cacher.
                ...(decade
                  ? {
                      from: { ...value.from, month: '', day: '' },
                      to: { ...value.to, month: '', day: '' },
                    }
                  : {}),
              });
            }}
          />
          <Switch
            testID={`${testID}-hijri`}
            label={t('common:personForm.date.hijri')}
            value={value.calendar === 'hijri'}
            onValueChange={(hijri) => {
              set({ calendar: hijri ? 'hijri' : 'gregorian' });
            }}
          />
        </View>
      )}
    </View>
  );
}
