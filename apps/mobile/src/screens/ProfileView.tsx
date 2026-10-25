// Fiche d'une personne (T-024 du plan V1) : l'écran affiche ce que `buildProfile` a décidé, il ne
// choisit ni le nom, ni les droits, ni l'ordre des blocs. Lecture seule : la fiche n'a pas
// d'action principale en V1 (la saisie arrive avec T-031, « Qui est-ce pour moi ? » avec T-029).
// Les onglets de la charte (Souvenirs, Documents, Santé) viennent avec la V2 et la V3 : aucun
// onglet vide n'est montré (ADR 0029).
//
// Tailles et espaces viennent des jetons de la charte ; rien n'a de hauteur fixe, le texte du
// téléphone jusqu'à 200 % et le mode Aînés font défiler la page sans rien couper.
import type {
  FuzzyDateDisplay,
  Profile,
  ProfileEvent,
  ProfileFact,
  ProfileName,
  ProfileSectionKey,
} from '@lignee/domain';
import { Avatar, Card, Chip, Header, PrivacyNote, space, useTheme } from '@lignee/ui';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslator } from '../i18n/I18nProvider';
import { fuzzyDateText, multipleBirthText, periodText, titleLine } from '../profile/profileText';

export interface ProfileViewProps {
  readonly profile: Profile;
  /** Nom de l'arbre, pour la mention de confidentialité d'une date de naissance. */
  readonly treeName: string;
  readonly onBack: () => void;
}

/** Une ligne de la fiche : intitulé, valeur, détail ; lue d'un bloc par le lecteur d'écran. */
function Row({
  label,
  value,
  detail,
  note,
  testID,
}: {
  readonly label?: string | undefined;
  readonly value: string;
  readonly detail?: string | undefined;
  readonly note?: ReactNode;
  readonly testID?: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <View testID={testID} accessible style={{ gap: space[1] }}>
      {label !== undefined && (
        <Text style={[typography.etiquette, { color: colors.texteSecondaire }]}>{label}</Text>
      )}
      <Text style={[typography.corps, { color: colors.texte }]}>{value}</Text>
      {detail !== undefined && (
        <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>{detail}</Text>
      )}
      {note}
    </View>
  );
}

function Rows({ children }: { readonly children: ReactNode }) {
  return <View style={{ gap: space[4] }}>{children}</View>;
}

export function ProfileView({ profile, treeName, onBack }: ProfileViewProps) {
  const translator = useTranslator();
  const { t } = translator;
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const dateText = (date: FuzzyDateDisplay | undefined): string =>
    date === undefined ? t('common:profile.fields.unknownDate') : fuzzyDateText(date, translator);
  const placeText = (event: ProfileEvent): string | undefined =>
    event.place === undefined
      ? undefined
      : t('common:profile.fields.place', { place: event.place });
  const unknownName = t('common:profile.unknownName');
  const name = profile.name ?? unknownName;
  const multiple =
    profile.multipleBirth === undefined
      ? undefined
      : multipleBirthText(profile.multipleBirth, unknownName, translator);

  const nameRow = (entry: ProfileName, note?: ReactNode) => (
    <Row
      key={entry.id}
      testID={`profile-name-${entry.type}`}
      label={t(`common:profile.nameTypes.${entry.type}`)}
      value={entry.text}
      detail={periodText(entry.start, entry.end, translator)}
      note={note}
    />
  );
  /** Profession : le texte saisi, sous sa date ; le lieu en détail. */
  const occupationRow = (fact: ProfileFact) => (
    <Row
      key={fact.id}
      label={fact.date === undefined ? undefined : dateText(fact.date)}
      value={fact.value ?? ''}
      detail={placeText(fact)}
    />
  );

  const section = (key: ProfileSectionKey): ReactNode => {
    switch (key) {
      case 'identity':
        if (profile.gender === 'unspecified') return null;
        return (
          <Card key={key} testID="profile-identity" title={t('common:profile.sections.identity')}>
            <Rows>
              <Row
                label={t('common:profile.fields.gender')}
                value={t(`common:profile.genders.${profile.gender}`)}
              />
            </Rows>
          </Card>
        );
      case 'life':
        return (
          <Card key={key} testID="profile-life" title={t('common:profile.sections.life')}>
            <Rows>
              {profile.birth !== undefined && (
                <Row
                  testID="profile-birth"
                  label={t('common:profile.fields.birth')}
                  value={dateText(profile.birth.date)}
                  detail={placeText(profile.birth)}
                  note={
                    profile.birthIsPrivate ? (
                      <PrivacyNote
                        testID="profile-birth-privacy"
                        circle="family"
                        label={t('common:profile.privacy.family', { tree: treeName })}
                      />
                    ) : undefined
                  }
                />
              )}
              {profile.deceased && (
                <Row
                  testID="profile-death"
                  label={t('common:profile.fields.death')}
                  value={dateText(profile.death?.date)}
                  detail={profile.death === undefined ? undefined : placeText(profile.death)}
                />
              )}
            </Rows>
          </Card>
        );
      case 'residences':
        return (
          <Card
            key={key}
            testID="profile-residences"
            title={t('common:profile.sections.residences')}
          >
            <Rows>
              {profile.residences.map((fact) => (
                <Row
                  key={fact.id}
                  label={dateText(fact.date)}
                  value={fact.place ?? t('common:profile.fields.unknownPlace')}
                />
              ))}
            </Rows>
          </Card>
        );
      case 'occupations':
        return (
          <Card
            key={key}
            testID="profile-occupations"
            title={t('common:profile.sections.occupations')}
          >
            <Rows>
              {profile.occupations
                .filter((fact) => fact.value !== undefined)
                .map((fact) => occupationRow(fact))}
            </Rows>
          </Card>
        );
      case 'names':
        return (
          <Card key={key} testID="profile-names" title={t('common:profile.sections.names')}>
            <Rows>
              {profile.birthNameMissing && (
                <Row
                  testID="profile-birth-name-missing"
                  label={t('common:profile.nameTypes.birth')}
                  value={t('common:profile.fields.birthNameToComplete')}
                />
              )}
              {profile.otherNames.map((entry) => nameRow(entry))}
              {profile.formerNames.map((entry) =>
                nameRow(
                  entry,
                  <PrivacyNote
                    testID="profile-former-privacy"
                    circle="you"
                    label={t('common:privacy.onlyYou')}
                  />,
                ),
              )}
            </Rows>
          </Card>
        );
      case 'notes':
        return (
          <Card key={key} testID="profile-notes" title={t('common:profile.sections.notes')}>
            <Text style={[typography.corps, { color: colors.texte }]}>{profile.notes}</Text>
          </Card>
        );
    }
  };

  return (
    <ScrollView
      testID="screen-profile"
      style={{ backgroundColor: colors.fond }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + space[16] }}
    >
      <Header
        title={t('common:profile.title')}
        back={{
          onPress: onBack,
          accessibilityLabel: t('common:controls.back'),
          accessibilityHint: t('common:profile.backHint'),
        }}
      />
      <View style={{ paddingHorizontal: space.margeEcran, gap: space[5] }}>
        <View style={{ alignItems: 'center', gap: space[3] }}>
          <Avatar
            size="xl"
            person={{ firstName: profile.firstName ?? unknownName, birthName: profile.tintName }}
          />
          <Text
            testID="profile-name"
            accessibilityRole="header"
            style={[typography.titreEcran, { color: colors.texte, textAlign: 'center' }]}
          >
            {name}
          </Text>
          {profile.titles.map((title) => (
            <Text
              key={title.id}
              testID="profile-title"
              style={[typography.corps, { color: colors.texteSecondaire, textAlign: 'center' }]}
            >
              {titleLine(title, translator)}
            </Text>
          ))}
          {profile.placeholder && (
            <Text
              style={[
                typography.secondaire,
                { color: colors.texteSecondaire, textAlign: 'center' },
              ]}
            >
              {t('common:profile.placeholderNote')}
            </Text>
          )}
          {multiple !== undefined && (
            <View style={{ alignItems: 'center', gap: space[2] }}>
              <Chip testID="profile-multiple-birth" tone="kinship" label={multiple.kind} />
              {multiple.with !== undefined && (
                <Text
                  testID="profile-multiple-birth-with"
                  style={[
                    typography.secondaire,
                    { color: colors.texteSecondaire, textAlign: 'center' },
                  ]}
                >
                  {multiple.with}
                </Text>
              )}
              {multiple.order !== undefined && (
                <Text
                  style={[
                    typography.secondaire,
                    { color: colors.texteSecondaire, textAlign: 'center' },
                  ]}
                >
                  {multiple.order}
                </Text>
              )}
            </View>
          )}
        </View>
        {profile.sections.map((key) => section(key))}
      </View>
    </ScrollView>
  );
}
