// Blocs du formulaire d'une personne (T-031 du plan V1) : un nom, un lieu de vie ou une
// profession, un titre. Chaque bloc reçoit son brouillon et rend le brouillon modifié ; il ne
// décide de rien (ni type de mutation, ni validité d'une date : tout est dans @lignee/domain).
import {
  splitFullName,
  type DateDraftIssue,
  type FactDraft,
  type NameDraft,
  type NameOrder,
  type NameType,
  type TitleDraft,
} from '@lignee/domain';
import { Button, Card, Chip, Field, PrivacyNote, Switch, space, useTheme } from '@lignee/ui';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useTranslator } from '../i18n/I18nProvider';
import { DateInput } from './DateInput';

/** Refus affichés par champ : un texte, ou le refus d'une date. */
export interface FieldErrors {
  readonly text: (field: string) => string | undefined;
  readonly date: (field: string) => DateDraftIssue | undefined;
}

const NAME_TYPES = ['birth', 'usage', 'nickname', 'variant', 'title', 'former'] as const;
const NAME_TYPE_KEYS = {
  birth: 'common:profile.nameTypes.birth',
  usage: 'common:profile.nameTypes.usage',
  nickname: 'common:profile.nameTypes.nickname',
  variant: 'common:profile.nameTypes.variant',
  title: 'common:profile.nameTypes.title',
  former: 'common:profile.nameTypes.former',
} as const satisfies Record<NameType, string>;

interface NameEditorProps {
  readonly index: number;
  readonly name: NameDraft;
  readonly nameOrder: NameOrder;
  readonly errors: FieldErrors;
  readonly onChange: (name: NameDraft) => void;
  readonly onRemove: () => void;
}

export function NameEditor({
  index,
  name,
  nameOrder,
  errors,
  onChange,
  onRemove,
}: NameEditorProps) {
  const { t } = useTranslator();
  const { colors, typography } = useTheme();
  const field = (part: string) => `names.${String(index)}.${part}`;
  const number = String(index + 1);
  // Un ancien prénom enregistré garde son type : le changer le montrerait à toute la famille.
  const types =
    name.id !== undefined && name.type === 'former' ? (['former'] as const) : NAME_TYPES;
  const [single, setSingle] = useState(name.displayForm !== '');
  const [dated, setDated] = useState(name.start.mode !== 'none' || name.end.mode !== 'none');
  const set = (patch: Partial<NameDraft>) => {
    onChange({ ...name, ...patch });
  };
  // Les refus sont lus avant le rendu : aucun nom de champ en clair dans le JSX.
  const givenError = errors.text(field('givenNames'));
  const surnameError = errors.text(field('surname'));
  const displayError = errors.text(field('displayForm')) ?? givenError;
  const startError = errors.text(field('start'));
  const startIssue = errors.date(field('start'));
  const endError = errors.text(field('end'));
  const endIssue = errors.date(field('end'));

  const given = (
    <Field
      key="given"
      testID={`name-${number}-given`}
      label={t('common:personForm.names.givenNames')}
      value={name.givenNames}
      onChangeText={(givenNames) => {
        set({ givenNames });
      }}
      error={givenError}
    />
  );
  const surname = (
    <Field
      key="surname"
      testID={`name-${number}-surname`}
      label={t('common:personForm.names.surname')}
      value={name.surname}
      onChangeText={(value) => {
        set({ surname: value });
      }}
      error={surnameError}
    />
  );
  // L'ordre des champs suit le réglage de l'arbre (CL-DON-01) : « Abenzo Lucien » se tape nom
  // d'abord quand l'arbre écrit les noms ainsi.
  const ordered = nameOrder === 'surname_first' ? [surname, given] : [given, surname];
  const split =
    single || name.surname.trim() !== '' ? undefined : splitFullName(name.givenNames, nameOrder);

  return (
    <Card testID={`name-${number}`} title={t('common:personForm.names.rowTitle', { number })}>
      <View style={{ gap: space[4] }}>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
        >
          {types.map((type) => (
            <Chip
              key={type}
              testID={`name-${number}-type-${type}`}
              label={t(NAME_TYPE_KEYS[type])}
              accessibilityLabel={`${t('common:personForm.names.rowTitle', { number })}, ${t(NAME_TYPE_KEYS[type])}`}
              accessibilityHint={t('common:personForm.names.type')}
              selected={name.type === type}
              onPress={() => {
                set({ type });
              }}
            />
          ))}
        </View>
        {name.type === 'former' && (
          <View style={{ gap: space[2] }}>
            <PrivacyNote
              testID={`name-${number}-private`}
              circle="you"
              label={t('common:privacy.onlyYou')}
            />
            <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>
              {t('common:personForm.names.formerNote')}
            </Text>
          </View>
        )}
        <Switch
          testID={`name-${number}-single`}
          label={t('common:personForm.names.singleForm')}
          description={t('common:personForm.names.singleFormDescription')}
          value={single}
          onValueChange={(value) => {
            setSingle(value);
            // Une seule forme ne mélange pas prénoms et nom de famille : l'autre mode est vidé.
            set(value ? { givenNames: '', surname: '' } : { displayForm: '' });
          }}
        />
        {single ? (
          <Field
            testID={`name-${number}-display`}
            label={t('common:personForm.names.displayForm')}
            value={name.displayForm}
            onChangeText={(displayForm) => {
              set({ displayForm });
            }}
            error={displayError}
          />
        ) : (
          ordered
        )}
        {split !== undefined && (
          <View style={{ gap: space[1] }}>
            <Button
              testID={`name-${number}-split`}
              variant="quiet"
              compact
              label={t('common:personForm.names.split')}
              accessibilityHint={
                nameOrder === 'surname_first'
                  ? t('common:personForm.names.splitHintSurnameFirst')
                  : t('common:personForm.names.splitHintGivenFirst')
              }
              onPress={() => {
                set(split);
              }}
            />
          </View>
        )}
        {dated ? (
          <View style={{ gap: space[4] }}>
            <DateInput
              testID={`name-${number}-start`}
              label={t('common:personForm.names.start')}
              value={name.start}
              onChange={(start) => {
                set({ start });
              }}
              issue={startIssue}
              error={startError}
            />
            <DateInput
              testID={`name-${number}-end`}
              label={t('common:personForm.names.end')}
              value={name.end}
              onChange={(end) => {
                set({ end });
              }}
              issue={endIssue}
              error={endError}
            />
          </View>
        ) : (
          <Button
            testID={`name-${number}-dated`}
            variant="quiet"
            compact
            label={t('common:personForm.names.dated')}
            onPress={() => {
              setDated(true);
            }}
          />
        )}
        <Button
          testID={`name-${number}-remove`}
          variant="quiet"
          compact
          label={t('common:personForm.names.remove')}
          accessibilityLabel={t('common:personForm.names.removeLabel', { number })}
          accessibilityHint={t('common:personForm.removeHint')}
          onPress={onRemove}
        />
      </View>
    </Card>
  );
}

interface FactEditorProps {
  readonly kind: 'residences' | 'occupations';
  readonly index: number;
  readonly fact: FactDraft;
  readonly errors: FieldErrors;
  readonly onChange: (fact: FactDraft) => void;
  readonly onRemove: () => void;
}

/** Un lieu de vie ou une profession : le texte, le lieu écrit à la main, et la date. */
export function FactEditor({ kind, index, fact, errors, onChange, onRemove }: FactEditorProps) {
  const { t } = useTranslator();
  const field = (part: string) => `${kind}.${String(index)}.${part}`;
  const number = String(index + 1);
  const id = `${kind}-${number}`;
  const set = (patch: Partial<FactDraft>) => {
    onChange({ ...fact, ...patch });
  };
  const residence = kind === 'residences';
  const valueError = errors.text(field('value'));
  const placeError = errors.text(field('place'));
  const dateError = errors.text(field('date'));
  const dateIssue = errors.date(field('date'));
  return (
    <Card testID={id}>
      <View style={{ gap: space[4] }}>
        {!residence && (
          <Field
            testID={`${id}-value`}
            label={t('common:personForm.occupations.value')}
            value={fact.value}
            onChangeText={(value) => {
              set({ value });
            }}
            error={valueError}
          />
        )}
        <Field
          testID={`${id}-place`}
          label={t(
            residence
              ? 'common:personForm.residences.place'
              : 'common:personForm.occupations.place',
          )}
          value={fact.place}
          onChangeText={(place) => {
            set({ place });
          }}
          error={placeError}
        />
        <DateInput
          testID={`${id}-date`}
          label={t(
            residence ? 'common:personForm.residences.date' : 'common:personForm.occupations.date',
          )}
          value={fact.date}
          onChange={(date) => {
            set({ date });
          }}
          issue={dateIssue}
          error={dateError}
        />
        <Button
          testID={`${id}-remove`}
          variant="quiet"
          compact
          label={t(
            residence
              ? 'common:personForm.residences.remove'
              : 'common:personForm.occupations.remove',
          )}
          accessibilityLabel={t(
            residence
              ? 'common:personForm.residences.removeLabel'
              : 'common:personForm.occupations.removeLabel',
            { number },
          )}
          accessibilityHint={t('common:personForm.removeHint')}
          onPress={onRemove}
        />
      </View>
    </Card>
  );
}

interface TitleEditorProps {
  readonly index: number;
  readonly title: TitleDraft;
  readonly errors: FieldErrors;
  readonly onChange: (title: TitleDraft) => void;
  readonly onRemove: () => void;
}

/** Un titre daté (CL-FAM-19) : libellé libre, jamais traduit, début et fin. */
export function TitleEditor({ index, title, errors, onChange, onRemove }: TitleEditorProps) {
  const { t } = useTranslator();
  const field = (part: string) => `titles.${String(index)}.${part}`;
  const number = String(index + 1);
  const set = (patch: Partial<TitleDraft>) => {
    onChange({ ...title, ...patch });
  };
  const labelError = errors.text(field('label'));
  const startError = errors.text(field('start'));
  const startIssue = errors.date(field('start'));
  const endError = errors.text(field('end'));
  const endIssue = errors.date(field('end'));
  return (
    <Card testID={`title-${number}`}>
      <View style={{ gap: space[4] }}>
        <Field
          testID={`title-${number}-label`}
          label={t('common:personForm.titles.label')}
          accessibilityHint={t('common:personForm.titles.labelHint')}
          value={title.label}
          onChangeText={(label) => {
            set({ label });
          }}
          error={labelError}
        />
        <DateInput
          testID={`title-${number}-start`}
          label={t('common:personForm.titles.start')}
          value={title.start}
          onChange={(start) => {
            set({ start });
          }}
          issue={startIssue}
          error={startError}
        />
        <DateInput
          testID={`title-${number}-end`}
          label={t('common:personForm.titles.end')}
          value={title.end}
          onChange={(end) => {
            set({ end });
          }}
          issue={endIssue}
          error={endError}
        />
        <Button
          testID={`title-${number}-remove`}
          variant="quiet"
          compact
          label={t('common:personForm.titles.remove')}
          accessibilityLabel={t('common:personForm.titles.removeLabel', { number })}
          accessibilityHint={t('common:personForm.removeHint')}
          onPress={onRemove}
        />
      </View>
    </Card>
  );
}
