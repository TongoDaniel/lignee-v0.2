// Page de revue des composants de la charte (T-014), pour la relecture visuelle par Daniel.
// En développement seulement : l'onglet Arbre propose « Voir les composants » ; un build de
// production renvoie à l'accueil. Les réglages en haut imposent le mode Aînés, le thème Nuit et les
// animations réduites à la page, sans toucher aux réglages du téléphone.
import {
  Avatar,
  Button,
  Card,
  Chip,
  Field,
  Header,
  Icon,
  iconNames,
  Logo,
  Notification,
  ProfileTabs,
  PrivacyNote,
  SettingsGroup,
  SettingsRow,
  Sheet,
  space,
  Switch,
  TabBar,
  ThemeProvider,
  Toast,
  TreeNode,
  useTheme,
} from '@lignee/ui';
import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslator } from '../i18n/I18nProvider';

const noop = (): void => undefined;
/** Prénom généré pour les exemples (aucune donnée réelle). */
const SAMPLE_NAME = 'Lucienne';
/** Personnes générées pour les exemples (aucune donnée réelle). */
const PEOPLE = {
  claire: { firstName: 'Claire', birthName: 'Martin' },
  odette: { firstName: 'Odette', birthName: 'Diallo' },
  samuel: { firstName: 'Samuel', birthName: 'Bah' },
  moussa: { firstName: 'Moussa', birthName: 'Bah' },
  jean: { firstName: 'Jean', birthName: 'Bah' },
  lucienne: { firstName: 'Lucienne', birthName: 'Martin' },
  luciennePhoto: { firstName: 'Lucienne', birthName: 'Lefèvre' },
} as const;
/** Clés des onglets d'exemple. */
const TAB_KEYS = {
  memories: 'memories',
  documents: 'documents',
  tree: 'tree',
  family: 'family',
} as const;

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

function Row({ children }: { readonly children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>;
}

function Catalog({
  display,
}: {
  readonly display: {
    readonly seniorMode: boolean;
    readonly night: boolean;
    readonly reduceMotion: boolean;
    readonly set: (key: 'seniorMode' | 'night' | 'reduceMotion', value: boolean) => void;
  };
}) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [cousins, setCousins] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [phone, setPhone] = useState('');
  const [profileTab, setProfileTab] = useState<string>(TAB_KEYS.memories);
  const [mainTab, setMainTab] = useState<string>(TAB_KEYS.tree);

  return (
    <View testID="catalog-page" style={{ flex: 1, backgroundColor: colors.fond }}>
      <ScrollView
        testID="screen-catalog"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + space[16],
          gap: space[6],
        }}
      >
        <Header
          title={t('common:catalog.title')}
          subtitle={t('common:catalog.subtitle')}
          back={{
            onPress: () => {
              router.back();
            },
            accessibilityLabel: t('common:controls.back'),
            accessibilityHint: t('common:catalog.backHint'),
          }}
        />
        <View style={{ paddingHorizontal: space.margeEcran, gap: space[8] }}>
          <Section title={t('common:catalog.sections.display')}>
            <Switch
              label={t('common:catalog.display.seniorMode')}
              value={display.seniorMode}
              onValueChange={(value) => {
                display.set('seniorMode', value);
              }}
            />
            <Switch
              label={t('common:catalog.display.night')}
              value={display.night}
              onValueChange={(value) => {
                display.set('night', value);
              }}
            />
            <Switch
              label={t('common:catalog.display.reduceMotion')}
              value={display.reduceMotion}
              onValueChange={(value) => {
                display.set('reduceMotion', value);
              }}
            />
          </Section>

          <Section title={t('common:catalog.sections.buttons')}>
            <Button
              label={t('common:catalog.samples.addSomeone')}
              icon="ajouter"
              accessibilityLabel={t('common:catalog.samples.addMother')}
              accessibilityHint={t('common:catalog.samples.addMotherHint')}
              onPress={noop}
              fullWidth
            />
            <Row>
              <Button
                label={t('common:catalog.samples.invite')}
                variant="secondary"
                onPress={noop}
              />
              <Button label={t('common:actions.later')} variant="quiet" onPress={noop} />
            </Row>
            <Row>
              <Button
                label={t('common:catalog.samples.celebrate')}
                variant="celebrate"
                onPress={noop}
              />
              <Button label={t('common:catalog.samples.delete')} variant="danger" onPress={noop} />
            </Row>
            <Row>
              <Button label={t('common:catalog.samples.invite')} compact onPress={noop} />
              <Button label={t('common:actions.save')} disabled onPress={noop} />
            </Row>
          </Section>

          <Section title={t('common:catalog.sections.chips')}>
            <Row>
              <Chip label={t('common:catalog.samples.dad')} tone="green" />
              <Chip label={t('common:catalog.samples.sisterOf')} tone="kinship" />
              <Chip label={t('common:catalog.samples.you')} tone="celebrate" />
              <Chip label={t('common:catalog.samples.story')} tone="memory" icon="micro" />
              <Chip label={t('common:catalog.samples.deed')} tone="documents" icon="document" />
              <Chip label={t('common:catalog.samples.toConfirm')} tone="neutral" onPress={noop} />
            </Row>
          </Section>

          <Section title={t('common:catalog.sections.cards')}>
            <Card
              title={t('common:catalog.samples.albumTitle')}
              text={t('common:catalog.samples.albumText', { count: 24 })}
              thumbnail={{ icon: 'photo', tone: 'celebrate' }}
              onPress={noop}
            />
            <Card
              title={t('common:catalog.samples.storyTitle')}
              text={t('common:catalog.samples.storyText')}
              thumbnail={{ icon: 'micro', tone: 'memory' }}
            />
          </Section>

          <Section title={t('common:catalog.sections.fields')}>
            <Field
              label={t('common:catalog.samples.firstName')}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNameTouched(true);
              }}
              placeholder={t('common:catalog.samples.firstNamePlaceholder')}
              voiceInput={{
                onPress: noop,
                accessibilityLabel: t('common:catalog.samples.dictateFirstName'),
              }}
              {...(nameTouched && name.trim() === ''
                ? { error: t('common:catalog.samples.firstNameError') }
                : {})}
            />
          </Section>

          <Section title={t('common:catalog.sections.switches')}>
            <Switch
              label={t('common:catalog.samples.cousins')}
              description={t('common:catalog.samples.cousinsHelp')}
              value={cousins}
              onValueChange={setCousins}
            />
          </Section>

          <Section title={t('common:catalog.sections.settings')}>
            <SettingsGroup>
              <SettingsRow
                icon="langues"
                label={t('common:catalog.samples.language')}
                value={t('common:languages.fr')}
                onPress={noop}
              />
              <SettingsRow
                icon="notifications"
                iconTone="celebrate"
                label={t('common:catalog.samples.notifications')}
                value={t('common:catalog.samples.enabled')}
                onPress={noop}
              />
              <SettingsRow
                icon="securite"
                iconTone="action"
                label={t('common:catalog.samples.security')}
                onPress={noop}
              />
            </SettingsGroup>
          </Section>

          <Section title={t('common:catalog.sections.feedback')}>
            <Row>
              <Button
                label={t('common:catalog.samples.showToast')}
                variant="secondary"
                onPress={() => {
                  setToastVisible(true);
                }}
              />
              <Button
                label={t('common:catalog.samples.openSheet')}
                variant="secondary"
                onPress={() => {
                  setSheetVisible(true);
                }}
              />
            </Row>
          </Section>

          <Section title={t('common:catalog.sections.people')}>
            <Row>
              <Avatar person={PEOPLE.claire} size="s" />
              <Avatar person={PEOPLE.odette} />
              <Avatar person={PEOPLE.samuel} size="l" />
              <Avatar person={PEOPLE.luciennePhoto} size="xl" />
              <Avatar you />
              <Avatar person={PEOPLE.moussa} neutral />
            </Row>
            <Row>
              <TreeNode
                name={t('common:catalog.samples.youNodeLabel')}
                you
                state="path"
                accessibilityLabel={t('common:catalog.samples.youNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
                onPress={noop}
              />
              <TreeNode
                person={PEOPLE.claire}
                name={PEOPLE.claire.firstName}
                relation={t('common:catalog.samples.mom')}
                state="path"
                accessibilityLabel={t('common:catalog.samples.motherNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
                onPress={noop}
                onLongPress={noop}
                longPressLabel={t('common:catalog.samples.showPathAction')}
              />
              <TreeNode
                person={PEOPLE.odette}
                name={PEOPLE.odette.firstName}
                years={t('common:catalog.samples.deceasedYears')}
                accessibilityLabel={t('common:catalog.samples.deceasedNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
                onPress={noop}
              />
              <TreeNode
                person={PEOPLE.lucienne}
                name={PEOPLE.lucienne.firstName}
                relation={t('common:catalog.samples.sister')}
                state="birthday"
                accessibilityLabel={t('common:catalog.samples.birthdayNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
                onPress={noop}
              />
              <TreeNode
                person={PEOPLE.samuel}
                name={PEOPLE.samuel.firstName}
                relation={t('common:catalog.samples.probableRelation')}
                pendingProposal
                accessibilityLabel={t('common:catalog.samples.probableNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
                onPress={noop}
              />
              <TreeNode
                person={PEOPLE.moussa}
                name={PEOPLE.moussa.firstName}
                relation={t('common:catalog.samples.dad')}
                neutral
                health
                accessibilityLabel={t('common:catalog.samples.healthNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
                onPress={noop}
              />
              <TreeNode
                name={t('common:catalog.samples.unknownPlace')}
                relation={t('common:catalog.samples.unknownRelation')}
                state="unknown"
                accessibilityLabel={t('common:catalog.samples.unknownNodeLabel')}
                accessibilityHint={t('common:catalog.samples.addMotherHint')}
                onPress={noop}
              />
              <TreeNode
                person={PEOPLE.jean}
                name={PEOPLE.jean.firstName}
                relation={t('common:catalog.samples.dad')}
                state="faded"
                accessibilityLabel={t('common:catalog.samples.fadedNodeLabel')}
                accessibilityHint={t('common:catalog.samples.openProfileHint')}
              />
            </Row>
          </Section>

          <Section title={t('common:catalog.sections.privacy')}>
            <PrivacyNote label={t('common:privacy.onlyYou')} />
            <PrivacyNote label={t('common:catalog.samples.privacyFamily')} circle="family" />
            <PrivacyNote label={t('common:catalog.samples.privacyHealth')} health />
          </Section>

          <Section title={t('common:catalog.sections.profileTabs')}>
            <ProfileTabs
              active={profileTab}
              onChange={setProfileTab}
              tabs={[
                {
                  key: TAB_KEYS.memories,
                  label: t('common:catalog.samples.tabMemories'),
                  accessibilityHint: t('common:catalog.samples.tabsHint'),
                },
                {
                  key: TAB_KEYS.documents,
                  label: t('common:catalog.samples.tabDocuments'),
                  accessibilityHint: t('common:catalog.samples.tabsHint'),
                },
              ]}
            />
          </Section>

          <Section title={t('common:catalog.sections.tabBar')}>
            <TabBar
              activeKey={mainTab}
              onSelect={setMainTab}
              items={[
                {
                  key: TAB_KEYS.tree,
                  label: t('common:navigation.tree'),
                  hint: t('common:navigation.treeHint'),
                  icon: 'treeSymbol',
                },
                {
                  key: TAB_KEYS.family,
                  label: t('common:navigation.family'),
                  hint: t('common:navigation.familyHint'),
                  icon: 'famille',
                },
              ]}
            />
          </Section>

          <Section title={t('common:catalog.sections.notification')}>
            <Notification
              appName={t('common:app.name')}
              title={t('common:catalog.samples.notificationTitle')}
              text={t('common:catalog.samples.notificationText')}
              time={t('common:catalog.samples.notificationTime')}
              onPress={noop}
            />
          </Section>

          <Section title={t('common:catalog.sections.icons')}>
            <Row>
              {iconNames.map((icon) => (
                <View key={icon} style={{ padding: space[2] }}>
                  <Icon name={icon} />
                </View>
              ))}
            </Row>
          </Section>

          <Section title={t('common:catalog.sections.logo')}>
            <Logo height={space[12]} label={t('common:app.name')} />
            <Row>
              <Logo variant="symbol" height={space[12]} label={t('common:app.name')} />
              <Logo variant="symbol" height={space[8]} label={t('common:app.name')} />
              <Logo variant="wordmark" height={space[8]} label={t('common:app.name')} />
            </Row>
          </Section>
        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: space.margeEcran,
          right: space.margeEcran,
          bottom: insets.bottom + space[4],
        }}
      >
        <Toast
          message={t('common:tree.personJoined', { name: SAMPLE_NAME })}
          visible={toastVisible}
          onHide={() => {
            setToastVisible(false);
          }}
          closeLabel={t('common:controls.close')}
        />
      </View>

      <Sheet
        visible={sheetVisible}
        title={t('common:catalog.samples.invite')}
        subtitle={t('common:catalog.samples.sheetSubtitle')}
        onClose={() => {
          setSheetVisible(false);
        }}
        closeLabel={t('common:controls.close')}
      >
        <Field
          label={t('common:catalog.samples.phone')}
          value={phone}
          onChangeText={setPhone}
          keyboard="phone"
        />
        <Button
          label={t('common:catalog.samples.sendInvite')}
          fullWidth
          onPress={() => {
            setSheetVisible(false);
            setToastVisible(true);
          }}
        />
      </Sheet>
    </View>
  );
}

export default function CatalogScreen() {
  const parent = useTheme();
  const [seniorMode, setSeniorMode] = useState(parent.seniorMode);
  const [night, setNight] = useState(parent.scheme === 'nuit');
  const [reduceMotion, setReduceMotion] = useState(parent.reduceMotion);
  if (!__DEV__) return <Redirect href="/" />;
  const set = (key: 'seniorMode' | 'night' | 'reduceMotion', value: boolean): void => {
    if (key === 'seniorMode') setSeniorMode(value);
    else if (key === 'night') setNight(value);
    else setReduceMotion(value);
  };
  return (
    <ThemeProvider
      seniorMode={seniorMode}
      scheme={night ? 'nuit' : 'jour'}
      reduceMotion={reduceMotion}
    >
      <Catalog display={{ seniorMode, night, reduceMotion, set }} />
    </ThemeProvider>
  );
}
