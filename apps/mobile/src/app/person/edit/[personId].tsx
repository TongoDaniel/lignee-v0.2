// Route « Modifier la fiche » (T-031 du plan V1), par identifiant de personne.
import { useLocalSearchParams } from 'expo-router';

import { PersonFormScreen } from '../../../personForm/PersonFormScreen';

export default function EditPersonRoute() {
  const { personId, treeId } = useLocalSearchParams<{ personId: string; treeId?: string }>();
  return <PersonFormScreen personId={personId} treeId={treeId} />;
}
