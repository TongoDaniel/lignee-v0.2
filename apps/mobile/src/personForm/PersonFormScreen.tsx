// Saisir ou modifier une personne à la main (T-031 du plan V1 ; PRD UNI-01, UNI-15, CAR-01).
// L'écran recueille un brouillon (`PersonDraft`) ; @lignee/domain en fait la liste de changements
// (`planPersonChanges`), @lignee/sync l'enregistre en un lot dans la copie locale et dans la file
// (`recordLocalChanges`), hors ligne. Aucune règle ici : ni choix du type de mutation, ni validité
// d'une date, ni droit de voir un ancien prénom.
//
// Une seule action principale : Enregistrer (en pied d'écran). Supprimer demande une confirmation
// qui liste ce que la suppression emporte (ADR 0027). Les lieux sont du texte : aucune permission
// de localisation n'est demandée (CAR-01).
import {
  emptyFactDraft,
  emptyNameDraft,
  emptyPersonDraft,
  emptyTitleDraft,
  formatName,
  moveGivenNamesToFormer,
  planPersonChanges,
  suggestFormerNameIndex,
  validatePersonDraft,
  type CalendarDay,
  type CoherenceIssue,
  type DateDraftIssueCode,
  type DeletionPlan,
  type EntryIssue,
  type Gender,
  type Id,
  type PersonDraft,
  type VitalStatus,
} from '@lignee/domain';
import {
  previewCoherence,
  readDeletionPlan,
  readEntryContext,
  readPersonDraft,
  recordLocalChanges,
  type EntryContext,
} from '@lignee/sync';
import {
  Button,
  Card,
  Chip,
  Field,
  Header,
  Icon,
  PrivacyNote,
  Sheet,
  Switch,
  space,
  useTheme,
} from '@lignee/ui';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createLocalId, notifyLocalChange } from '../db/localChanges';
import { useLocalDatabase } from '../db/LocalDatabaseProvider';
import { useTranslator } from '../i18n/I18nProvider';
import { joinNames } from '../profile/profileText';
import { DateInput } from './DateInput';
import { describeSaveFailure } from './failures';
import { coherenceText, entryIssueText, recordIssueText } from './messages';
import { FactEditor, NameEditor, TitleEditor, type FieldErrors } from './PersonFormFields';

export interface PersonFormScreenProps {
  /** Fiche à modifier ; absent : une nouvelle personne. */
  readonly personId?: string | undefined;
  readonly treeId?: string | undefined;
  /** Générateur d'identifiants (UUIDv7) ; remplacé dans les tests. */
  readonly newId?: () => Id;
  /** Horloge du téléphone, lue ici et nulle part dans les paquets. */
  readonly now?: () => number;
  /** Jour d'aujourd'hui, pour les alertes sur l'âge d'une personne vivante. */
  readonly today?: () => CalendarDay;
  /** Après un enregistrement ; par défaut, retour à l'écran précédent. */
  readonly onDone?: () => void;
  /** Après une suppression ; par défaut, retour à l'arbre. */
  readonly onDeleted?: () => void;
  readonly onBack?: () => void;
}

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'missing' }
  | { readonly status: 'no-tree' }
  | {
      readonly status: 'ready';
      readonly context: EntryContext;
      readonly original: PersonDraft | undefined;
    };

function defaultToday(): CalendarDay {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function goToTree(): void {
  router.replace('/');
}

/** Message d'attente, d'absence ou d'échec, sous l'en-tête. */
function Notice({
  title,
  message,
  testID,
  onBack,
}: {
  readonly title: string;
  readonly message: string;
  readonly testID: string;
  readonly onBack: () => void;
}) {
  const { t } = useTranslator();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: colors.fond }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + space[6] }}
    >
      <Header
        title={title}
        back={{
          onPress: onBack,
          accessibilityLabel: t('common:controls.back'),
          accessibilityHint: t('common:personForm.backHint'),
        }}
      />
      <Text
        style={[
          typography.corps,
          { color: colors.texteSecondaire, paddingHorizontal: space.margeEcran },
        ]}
      >
        {message}
      </Text>
    </ScrollView>
  );
}

export function PersonFormScreen(props: PersonFormScreenProps) {
  const { personId, treeId, onBack = goBack } = props;
  const { t } = useTranslator();
  const database = useLocalDatabase();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const editing = personId !== undefined;
  const title = t(editing ? 'common:personForm.titleEdit' : 'common:personForm.titleNew');

  useEffect(() => {
    setState({ status: 'loading' });
    if (database.status === 'opening') return;
    if (database.status === 'failed') {
      setState({ status: 'failed' });
      return;
    }
    const { db } = database;
    // La lecture suit le premier dessin : relire un grand arbre ne bloque pas l'ouverture.
    const timer = setTimeout(() => {
      try {
        const options = treeId === undefined ? {} : { treeId };
        if (personId === undefined) {
          const context = readEntryContext(db, options);
          setState(
            context === undefined
              ? { status: 'no-tree' }
              : { status: 'ready', context, original: undefined },
          );
          return;
        }
        const read = readPersonDraft(db, personId, options);
        setState(
          read === undefined
            ? { status: 'missing' }
            : { status: 'ready', context: read.context, original: read.draft },
        );
      } catch {
        // Aucun détail exposé ni journalisé : l'erreur pourrait citer une donnée saisie.
        setState({ status: 'failed' });
      }
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [database, personId, treeId]);

  switch (state.status) {
    case 'loading':
      return (
        <Notice
          testID="screen-person-form-loading"
          title={title}
          message={t('common:personForm.loading')}
          onBack={onBack}
        />
      );
    case 'failed':
      return (
        <Notice
          testID="screen-person-form-failed"
          title={title}
          message={t('common:personForm.failed')}
          onBack={onBack}
        />
      );
    case 'missing':
      return (
        <Notice
          testID="screen-person-form-missing"
          title={title}
          message={t('common:personForm.notFound')}
          onBack={onBack}
        />
      );
    case 'no-tree':
      return (
        <Notice
          testID="screen-person-form-no-tree"
          title={title}
          message={t('common:personForm.noTree')}
          onBack={onBack}
        />
      );
    case 'ready':
      if (database.status !== 'ready') return null;
      return (
        <PersonForm
          {...props}
          title={title}
          context={state.context}
          original={state.original}
          db={database.db}
        />
      );
  }
}

type Db = Extract<ReturnType<typeof useLocalDatabase>, { status: 'ready' }>['db'];

interface PersonFormProps extends PersonFormScreenProps {
  readonly title: string;
  readonly context: EntryContext;
  readonly original: PersonDraft | undefined;
  readonly db: Db;
}

const GENDERS = [
  ['female', 'common:profile.genders.female'],
  ['male', 'common:profile.genders.male'],
  ['other', 'common:profile.genders.other'],
  ['unspecified', 'common:personForm.identity.unspecified'],
] as const satisfies readonly (readonly [Gender, string])[];

const VITAL = [
  ['living', 'common:personForm.identity.yes'],
  ['deceased', 'common:personForm.identity.no'],
  ['unknown', 'common:actions.dontKnow'],
] as const satisfies readonly (readonly [VitalStatus, string])[];

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ gap: space[3] }}>
      <Text accessibilityRole="header" style={[typography.titreSection, { color: colors.texte }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ChoiceGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  readonly label: string;
  readonly options: readonly (readonly [Value, string])[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly testID: string;
}) {
  const { t } = useTranslator();
  const { colors, typography } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      <Text style={[typography.etiquette, { color: colors.texteSecondaire }]}>{label}</Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
      >
        {options.map(([option, key]) => (
          <Chip
            key={option}
            testID={`${testID}-${option}`}
            label={t(key as never)}
            accessibilityLabel={`${label} ${t(key as never)}`}
            accessibilityHint={label}
            selected={value === option}
            onPress={() => {
              onChange(option);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function PersonForm({
  title,
  context,
  original,
  db,
  personId: editedId,
  newId = createLocalId,
  now = Date.now,
  today = defaultToday,
  onDone = goBack,
  onDeleted = goToTree,
  onBack = goBack,
}: PersonFormProps) {
  const translator = useTranslator();
  const { t } = translator;
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const editing = editedId !== undefined;
  // La personne créée garde un identifiant stable d'une tentative à l'autre.
  const createdId = useRef<Id | undefined>(undefined);
  createdId.current ??= newId();
  const personId = editedId ?? createdId.current;

  const [draft, setDraft] = useState<PersonDraft>(original ?? emptyPersonDraft());
  const [attempted, setAttempted] = useState(false);
  const [recordErrors, setRecordErrors] = useState<Readonly<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [alerts, setAlerts] = useState<readonly CoherenceIssue[]>([]);
  const [formerDismissed, setFormerDismissed] = useState(false);
  const [deletion, setDeletion] = useState<DeletionPlan | undefined>(undefined);

  const change = (next: PersonDraft) => {
    setDraft(next);
    // Une correction rend les anciens refus caducs : ils reviennent à l'enregistrement suivant.
    setRecordErrors({});
    setFormError(undefined);
    setAlerts([]);
  };
  const entryIssues = useMemo<readonly EntryIssue[]>(
    () => (attempted ? validatePersonDraft(draft) : []),
    [attempted, draft],
  );
  const errors: FieldErrors = {
    text: (field) => {
      const recorded = recordErrors[field];
      if (recorded !== undefined) return recorded;
      const issue = entryIssues.find((entry) => entry.field === field && entry.part === undefined);
      return issue === undefined ? undefined : entryIssueText(translator, issue.code);
    },
    date: (field) => {
      const issue = entryIssues.find((entry) => entry.field === field && entry.part !== undefined);
      return issue?.part === undefined
        ? undefined
        : { code: issue.code as DateDraftIssueCode, part: issue.part };
    },
  };

  const plan = () =>
    planPersonChanges({
      draft,
      ...(original === undefined ? {} : { original }),
      personId,
      authorAccountId: context.accountId,
      places: context.places,
      newId,
    });

  /**
   * Enregistre la saisie. Les alertes de dates se montrent avant d'écrire ; la personne choisit
   * de passer outre (le paramètre `acknowledged`), et l’enregistrement suit tout de suite.
   */
  const save = (acknowledged: boolean) => {
    setAttempted(true);
    setRecordErrors({});
    setFormError(undefined);
    if (validatePersonDraft(draft).length > 0) {
      setFormError(t('common:personForm.problems'));
      return;
    }
    const prepared = plan();
    if (prepared.changes.length === 0) {
      onDone();
      return;
    }
    const input = {
      treeId: context.treeId,
      authorAccountId: context.accountId,
      changes: prepared.changes,
      now: now(),
      newId,
    };
    try {
      if (!acknowledged) {
        const found = previewCoherence(db, { ...input, personId, today: today() }).filter(
          (issue) => coherenceText(translator, issue.code) !== undefined,
        );
        if (found.length > 0) {
          setAlerts(found);
          return;
        }
      }
      recordLocalChanges(db, input);
      notifyLocalChange();
      onDone();
    } catch (error) {
      const failure = describeSaveFailure(error, prepared, translator);
      setRecordErrors(failure.fields);
      setFormError(
        failure.form ??
          (Object.keys(failure.fields).length > 0 ? t('common:personForm.problems') : undefined),
      );
    }
  };
  const submit = () => {
    save(false);
  };
  const confirmAlerts = () => {
    setAlerts([]);
    save(true);
  };

  // --- Suppression (ADR 0027) : un lot, avec tout ce qui dépend de la fiche.
  const askDeletion = () => {
    try {
      const read = readDeletionPlan(db, personId, { treeId: context.treeId });
      if (read === undefined) setFormError(t('common:personForm.errors.record.unknownObject'));
      else setDeletion(read.plan);
    } catch {
      setFormError(t('common:personForm.delete.failed'));
    }
  };
  const confirmDeletion = () => {
    if (deletion === undefined) return;
    try {
      recordLocalChanges(db, {
        treeId: context.treeId,
        authorAccountId: context.accountId,
        changes: deletion.changes,
        now: now(),
        newId,
      });
      notifyLocalChange();
      setDeletion(undefined);
      onDeleted();
    } catch (error) {
      setDeletion(undefined);
      const code =
        error instanceof Error && 'issues' in error
          ? (error as { issues: readonly { code: string }[] }).issues[0]?.code
          : undefined;
      setFormError(
        code === undefined
          ? t('common:personForm.delete.failed')
          : recordIssueText(translator, code),
      );
    }
  };
  const deletionList = (summary: DeletionPlan['summary']): string => {
    const parts = [
      summary.names > 0 ? t('common:personForm.delete.names', { count: summary.names }) : '',
      summary.facts > 0 ? t('common:personForm.delete.facts', { count: summary.facts }) : '',
      summary.titles > 0 ? t('common:personForm.delete.titles', { count: summary.titles }) : '',
      summary.links > 0 ? t('common:personForm.delete.links', { count: summary.links }) : '',
      summary.unions > 0 ? t('common:personForm.delete.unions', { count: summary.unions }) : '',
    ].filter((part) => part !== '');
    return joinNames(parts, translator);
  };
  const shownName = (): string | undefined => {
    const named = draft.names.find(
      (name) =>
        name.type !== 'former' &&
        (name.givenNames.trim() !== '' ||
          name.surname.trim() !== '' ||
          name.displayForm.trim() !== ''),
    );
    return named === undefined ? undefined : formatName(named, context.nameOrder).trim();
  };

  const formerIndex = formerDismissed ? undefined : suggestFormerNameIndex(draft);
  const update = <Key extends keyof PersonDraft>(key: Key, value: PersonDraft[Key]) => {
    change({ ...draft, [key]: value });
  };
  const replaceAt = <Item,>(list: readonly Item[], index: number, item: Item): Item[] =>
    list.map((entry, at) => (at === index ? item : entry));
  const removeAt = <Item,>(list: readonly Item[], index: number): Item[] =>
    list.filter((_, at) => at !== index);

  const deceased = draft.vitalStatus === 'deceased';
  const birthDateIssue = errors.date('birth.date');
  const birthDateError = errors.text('birth.date');
  const birthPlaceError = errors.text('birth.place');
  const deathDateIssue = errors.date('death.date');
  const deathDateError = errors.text('death.date');
  const deathPlaceError = errors.text('death.place');
  const deathCauseError = errors.text('deathCause');
  const notesError = errors.text('notes');
  const alertsShown = alerts.length > 0;
  const saveLabel = alertsShown
    ? t('common:personForm.saveAnyway')
    : t(editing ? 'common:personForm.saveEdit' : 'common:personForm.saveNew');

  return (
    <View testID="screen-person-form" style={{ flex: 1, backgroundColor: colors.fond }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space[8] }}
      >
        <Header
          title={title}
          back={{
            onPress: onBack,
            accessibilityLabel: t('common:controls.back'),
            accessibilityHint: t('common:personForm.backHint'),
          }}
        />
        <View style={{ paddingHorizontal: space.margeEcran, gap: space[6] }}>
          {formError !== undefined && (
            <View
              testID="person-form-error"
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}
            >
              <Icon name="alerte" color={colors.erreur} />
              <Text style={[typography.corps, { color: colors.erreur, flex: 1 }]}>{formError}</Text>
            </View>
          )}
          {alertsShown && (
            <Card testID="person-form-alerts" title={t('common:personForm.coherence.title')}>
              <View style={{ gap: space[3] }} accessibilityLiveRegion="polite">
                <Text style={[typography.corps, { color: colors.texte }]}>
                  {t('common:personForm.coherence.intro')}
                </Text>
                {alerts.map((issue, index) => (
                  <Text
                    key={`${issue.code}-${String(index)}`}
                    style={[typography.corps, { color: colors.texte }]}
                  >
                    {coherenceText(translator, issue.code)}
                  </Text>
                ))}
              </View>
            </Card>
          )}

          <Section title={t('common:personForm.names.title')}>
            {(!editing || draft.placeholder) && (
              <Switch
                testID="person-form-unknown"
                label={t('common:personForm.unknown.label')}
                description={t('common:personForm.unknown.description')}
                value={draft.placeholder}
                disabled={editing && !draft.placeholder}
                onValueChange={(placeholder) => {
                  update('placeholder', placeholder);
                }}
              />
            )}
            {(!draft.placeholder || draft.names.some((name) => name.id !== undefined)) &&
              draft.names.map((name, index) => (
                <NameEditor
                  key={name.id ?? `new-${String(index)}`}
                  index={index}
                  name={name}
                  nameOrder={context.nameOrder}
                  errors={errors}
                  onChange={(next) => {
                    update('names', replaceAt(draft.names, index, next));
                  }}
                  onRemove={() => {
                    // Jamais de liste vide : le champ du nom manquant reste affiché pour porter son erreur.
                    const rest = removeAt(draft.names, index);
                    update('names', rest.length > 0 ? rest : [emptyNameDraft('birth')]);
                  }}
                />
              ))}
            {!draft.placeholder && (
              <Button
                testID="person-form-add-name"
                variant="secondary"
                icon="ajouter"
                label={t('common:personForm.names.add')}
                onPress={() => {
                  update('names', [...draft.names, emptyNameDraft('usage')]);
                }}
              />
            )}
            {formerIndex !== undefined && (
              <Card
                testID="person-form-suggest-former"
                title={t('common:personForm.suggestFormer.title')}
              >
                <View style={{ gap: space[3] }}>
                  <Text style={[typography.corps, { color: colors.texte }]}>
                    {t(
                      draft.names[formerIndex]?.id === undefined
                        ? 'common:personForm.suggestFormer.body'
                        : 'common:personForm.suggestFormer.bodySeen',
                    )}
                  </Text>
                  <PrivacyNote circle="you" label={t('common:privacy.onlyYou')} />
                  <Button
                    testID="person-form-suggest-former-accept"
                    variant="secondary"
                    label={t('common:personForm.suggestFormer.accept')}
                    onPress={() => {
                      change(moveGivenNamesToFormer(draft, formerIndex));
                    }}
                  />
                  <Button
                    testID="person-form-suggest-former-keep"
                    variant="quiet"
                    label={t('common:personForm.suggestFormer.keep')}
                    onPress={() => {
                      setFormerDismissed(true);
                    }}
                  />
                </View>
              </Card>
            )}
          </Section>

          <Section title={t('common:personForm.identity.title')}>
            <ChoiceGroup
              testID="person-form-gender"
              label={t('common:personForm.identity.gender')}
              options={GENDERS}
              value={draft.gender}
              onChange={(gender) => {
                update('gender', gender);
              }}
            />
            <ChoiceGroup
              testID="person-form-vital"
              label={t('common:personForm.identity.alive')}
              options={VITAL}
              value={draft.vitalStatus}
              onChange={(vitalStatus) => {
                update('vitalStatus', vitalStatus);
              }}
            />
          </Section>

          <Section title={t('common:personForm.birth.title')}>
            <DateInput
              testID="person-form-birth-date"
              label={t('common:personForm.birth.date')}
              value={draft.birth.date}
              onChange={(date) => {
                update('birth', { ...draft.birth, date });
              }}
              issue={birthDateIssue}
              error={birthDateError}
            />
            <Field
              testID="person-form-birth-place"
              label={t('common:personForm.birth.place')}
              accessibilityHint={t('common:personForm.birth.placeHint')}
              value={draft.birth.place}
              onChangeText={(place) => {
                update('birth', { ...draft.birth, place });
              }}
              error={birthPlaceError}
            />
          </Section>

          {deceased && (
            <Section title={t('common:personForm.death.title')}>
              <DateInput
                testID="person-form-death-date"
                label={t('common:personForm.death.date')}
                value={draft.death.date}
                onChange={(date) => {
                  update('death', { ...draft.death, date });
                }}
                issue={deathDateIssue}
                error={deathDateError}
              />
              <Field
                testID="person-form-death-place"
                label={t('common:personForm.death.place')}
                value={draft.death.place}
                onChangeText={(place) => {
                  update('death', { ...draft.death, place });
                }}
                error={deathPlaceError}
              />
              <Field
                testID="person-form-death-cause"
                label={t('common:personForm.death.cause')}
                accessibilityHint={t('common:personForm.death.causeNote')}
                value={draft.deathCause.value}
                onChangeText={(value) => {
                  update('deathCause', { ...draft.deathCause, value });
                }}
                error={deathCauseError}
              />
              <PrivacyNote
                testID="person-form-death-cause-private"
                circle="you"
                label={t('common:privacy.onlyYou')}
              />
              <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>
                {t('common:personForm.death.causeNote')}
              </Text>
            </Section>
          )}

          <Section title={t('common:personForm.residences.title')}>
            {draft.residences.map((fact, index) => (
              <FactEditor
                key={fact.id ?? `new-${String(index)}`}
                kind="residences"
                index={index}
                fact={fact}
                errors={errors}
                onChange={(next) => {
                  update('residences', replaceAt(draft.residences, index, next));
                }}
                onRemove={() => {
                  update('residences', removeAt(draft.residences, index));
                }}
              />
            ))}
            <Button
              testID="person-form-add-residence"
              variant="secondary"
              icon="lieu"
              label={t('common:personForm.residences.add')}
              onPress={() => {
                update('residences', [...draft.residences, emptyFactDraft()]);
              }}
            />
          </Section>

          <Section title={t('common:personForm.occupations.title')}>
            {draft.occupations.map((fact, index) => (
              <FactEditor
                key={fact.id ?? `new-${String(index)}`}
                kind="occupations"
                index={index}
                fact={fact}
                errors={errors}
                onChange={(next) => {
                  update('occupations', replaceAt(draft.occupations, index, next));
                }}
                onRemove={() => {
                  update('occupations', removeAt(draft.occupations, index));
                }}
              />
            ))}
            <Button
              testID="person-form-add-occupation"
              variant="secondary"
              icon="ajouter"
              label={t('common:personForm.occupations.add')}
              onPress={() => {
                update('occupations', [...draft.occupations, emptyFactDraft()]);
              }}
            />
          </Section>

          <Section title={t('common:personForm.titles.title')}>
            {draft.titles.map((item, index) => (
              <TitleEditor
                key={item.id ?? `new-${String(index)}`}
                index={index}
                title={item}
                errors={errors}
                onChange={(next) => {
                  update('titles', replaceAt(draft.titles, index, next));
                }}
                onRemove={() => {
                  update('titles', removeAt(draft.titles, index));
                }}
              />
            ))}
            <Button
              testID="person-form-add-title"
              variant="secondary"
              icon="ajouter"
              label={t('common:personForm.titles.add')}
              onPress={() => {
                update('titles', [...draft.titles, emptyTitleDraft()]);
              }}
            />
          </Section>

          <Section title={t('common:personForm.notes.label')}>
            <Field
              testID="person-form-notes"
              label={t('common:personForm.notes.label')}
              value={draft.notes}
              onChangeText={(notes) => {
                update('notes', notes);
              }}
              error={notesError}
            />
          </Section>

          {editing && (
            <Button
              testID="person-form-delete"
              variant="danger"
              label={t('common:personForm.delete.action')}
              onPress={askDeletion}
            />
          )}
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: colors.fond,
          borderTopWidth: 1,
          borderTopColor: colors.filet,
          paddingHorizontal: space.margeEcran,
          paddingTop: space[3],
          paddingBottom: insets.bottom + space[3],
        }}
      >
        <Button
          testID="person-form-save"
          fullWidth
          label={saveLabel}
          accessibilityLabel={
            editing || alertsShown ? saveLabel : t('common:personForm.saveNewLabel')
          }
          accessibilityHint={t('common:personForm.saveHint')}
          onPress={alertsShown ? confirmAlerts : submit}
        />
      </View>

      <Sheet
        testID="person-form-delete-sheet"
        visible={deletion !== undefined}
        title={t('common:personForm.delete.title')}
        {...(shownName() === undefined || shownName() === ''
          ? {}
          : { subtitle: shownName() as string })}
        onClose={() => {
          setDeletion(undefined);
        }}
        closeLabel={t('common:controls.close')}
      >
        <View style={{ gap: space[3] }}>
          <Text style={[typography.corps, { color: colors.texte }]}>
            {t('common:personForm.delete.irreversible')}
          </Text>
          {deletion !== undefined && (
            <Text
              testID="person-form-delete-list"
              style={[typography.corps, { color: colors.texte }]}
            >
              {deletionList(deletion.summary) === ''
                ? t('common:personForm.delete.nothingElse')
                : t('common:personForm.delete.alsoRemoves', {
                    list: deletionList(deletion.summary),
                  })}
            </Text>
          )}
          <Button
            testID="person-form-delete-confirm"
            variant="danger"
            fullWidth
            label={t('common:personForm.delete.confirm')}
            accessibilityLabel={t('common:personForm.delete.confirmLabel')}
            accessibilityHint={t('common:personForm.delete.irreversible')}
            onPress={confirmDeletion}
          />
          <Button
            testID="person-form-delete-keep"
            variant="secondary"
            fullWidth
            label={t('common:personForm.delete.keep')}
            onPress={() => {
              setDeletion(undefined);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}
