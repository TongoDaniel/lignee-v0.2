// Onglet Arbre (T-017) : ouvre la copie locale de l'arbre (T-016) et la dessine. Tant que la base
// s'ouvre, ou s'il n'y a rien à dessiner, la phrase d'attente de T-011 reste affichée. En
// développement, un lien mène à la page de revue des composants de la charte.
import type { Id } from '@lignee/domain';
import { Button } from '@lignee/ui';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';

import { useLocalChangeVersion } from '../db/localChanges';
import { useLocalDatabase } from '../db/LocalDatabaseProvider';
import { useTranslator } from '../i18n/I18nProvider';
import { newPersonRoute } from '../navigation/personFormRoute';
import { profileRoute } from '../navigation/profileRoute';
import { EmptyTabScreen } from '../screens/EmptyTabScreen';
import { TreeView } from './TreeView';
import { readFirstTreeModel, type TreeModel } from './treeModel';

/** Page de revue des composants (développement seulement). */
const CATALOG_ROUTE = '/catalog';

/**
 * Clé de l'arbre affiché. TreeView garde le centre, la personne choisie, le fil d'Ariane, les
 * filtres et la descendance sans lien avec le modèle : si une personne disparaît (suppression,
 * T-031), l'un d'eux peut ne plus exister et la disposition échouerait. Quand une personne du
 * modèle précédent n'est plus dans le nouveau, la clé change et l'arbre repart de « Vous ».
 * Un ajout ne change pas la clé : la vue reste où elle est.
 */
export function useTreeViewKey(model: TreeModel | undefined): string {
  const previous = useRef<{ ids: ReadonlySet<Id>; epoch: number }>({ ids: new Set(), epoch: 0 });
  return useMemo(() => {
    if (model === undefined) return 'none';
    const ids = new Set(model.cards.keys());
    const lost = [...previous.current.ids].some((id) => !ids.has(id));
    previous.current = { ids, epoch: previous.current.epoch + (lost ? 1 : 0) };
    return `${model.treeId}:${String(previous.current.epoch)}`;
  }, [model]);
}

export function TreeScreen() {
  const { t } = useTranslator();
  const database = useLocalDatabase();
  // Une personne saisie ou supprimée (T-031) : l'arbre relit la copie locale.
  const changes = useLocalChangeVersion();
  const model = useMemo(
    () => (database.status === 'ready' ? readFirstTreeModel(database.db) : undefined),
    // `changes` n'est pas lu dans le calcul : il relance la lecture de la copie locale.
    [database, changes],
  );
  const viewKey = useTreeViewKey(model);

  // Toucher une personne choisie, ou « Ouvrir la fiche », ouvre sa fiche dans cet arbre (T-024).
  const openPerson = useCallback(
    (personId: Id) => {
      if (model !== undefined) router.push(profileRoute(personId, model.treeId));
    },
    [model],
  );
  // « Ajouter une personne » est dans la barre de l'arbre, avec les autres actions secondaires.
  const addPerson = useCallback(() => {
    router.push(newPersonRoute(model?.treeId));
  }, [model]);

  if (model !== undefined) {
    return (
      <TreeView key={viewKey} model={model} onOpenPerson={openPerson} onAddPerson={addPerson} />
    );
  }
  const message =
    database.status === 'opening'
      ? t('common:treeScreen.loading')
      : database.status === 'failed'
        ? t('common:treeScreen.failed')
        : t('common:treeScreen.empty');
  return (
    <EmptyTabScreen
      testID="screen-tree"
      title={t('common:treeScreen.title')}
      message={message}
      footer={
        __DEV__ ? (
          <Button
            testID="open-catalog"
            label={t('common:catalog.open')}
            variant="quiet"
            onPress={() => {
              router.push(CATALOG_ROUTE);
            }}
          />
        ) : undefined
      }
    />
  );
}
