// Écran de la fiche d'une personne (T-024 du plan V1) : lit la copie locale filtrée du lecteur
// (`readProfile` de @lignee/sync) quand la base est prête, puis passe la fiche à `ProfileView`.
// Aucun appel au serveur. La lecture est repoussée après le premier dessin : relire un arbre de
// plusieurs milliers de personnes ne doit pas bloquer l'ouverture de l'écran.
import type { CalendarDay, Profile } from '@lignee/domain';
import { Header, space, useTheme } from '@lignee/ui';
import { readProfile } from '@lignee/sync';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalChangeVersion } from '../db/localChanges';
import { useLocalDatabase } from '../db/LocalDatabaseProvider';
import { editPersonRoute } from '../navigation/personFormRoute';
import { useTranslator } from '../i18n/I18nProvider';
import { ProfileView } from './ProfileView';

export interface PersonProfileScreenProps {
  readonly personId: string;
  readonly treeId?: string | undefined;
}

type ProfileState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly profile: Profile; readonly treeName: string };

/** Jour d'aujourd'hui sur le téléphone : l'horloge est lue ici, jamais dans le domaine. */
function today(): CalendarDay {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Message d'attente, d'absence ou d'échec, sous l'en-tête de la fiche. */
function Notice({ message, testID }: { readonly message: string; readonly testID: string }) {
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
        title={t('common:profile.title')}
        back={{
          onPress: goBack,
          accessibilityLabel: t('common:controls.back'),
          accessibilityHint: t('common:profile.backHint'),
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

export function PersonProfileScreen({ personId, treeId }: PersonProfileScreenProps) {
  const { t } = useTranslator();
  const database = useLocalDatabase();
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  // Une saisie enregistrée (T-031) : la fiche relit la copie locale en revenant du formulaire.
  const changes = useLocalChangeVersion();

  useEffect(() => {
    // Une autre personne : on repart de l'attente, jamais la fiche précédente.
    setState({ status: 'loading' });
    if (database.status === 'opening') return;
    if (database.status === 'failed') {
      setState({ status: 'failed' });
      return;
    }
    const { db } = database;
    const timer = setTimeout(() => {
      try {
        const result = readProfile(db, personId, {
          today: today(),
          ...(treeId === undefined ? {} : { treeId }),
        });
        setState(
          result === undefined
            ? { status: 'missing' }
            : { status: 'ready', profile: result.profile, treeName: result.treeName },
        );
      } catch {
        // Aucun détail exposé ni journalisé : l'erreur pourrait citer une requête ou une donnée.
        setState({ status: 'failed' });
      }
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [database, personId, treeId, changes]);

  switch (state.status) {
    case 'loading':
      return <Notice testID="screen-profile-loading" message={t('common:profile.loading')} />;
    case 'missing':
      return <Notice testID="screen-profile-missing" message={t('common:profile.notFound')} />;
    case 'failed':
      return <Notice testID="screen-profile-failed" message={t('common:profile.failed')} />;
    case 'ready':
      return (
        <ProfileView
          profile={state.profile}
          treeName={state.treeName}
          onBack={goBack}
          onEdit={() => {
            router.push(editPersonRoute(personId, treeId));
          }}
        />
      );
  }
}
