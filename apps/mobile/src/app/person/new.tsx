// Route « Ajouter une personne » (T-031 du plan V1). Le formulaire est dans
// src/personForm/PersonFormScreen.tsx ; sans `personId`, il crée une personne.
import { useLocalSearchParams } from 'expo-router';

import { PersonFormScreen } from '../../personForm/PersonFormScreen';

export default function NewPersonRoute() {
  const { treeId } = useLocalSearchParams<{ treeId?: string }>();
  return <PersonFormScreen treeId={treeId} />;
}
