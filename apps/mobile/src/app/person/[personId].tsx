// Route de la fiche d'une personne, par identifiant (T-024 du plan V1). Fin du chemin : l'écran
// lui-même est dans src/screens/PersonProfileScreen.tsx.
import { useLocalSearchParams } from 'expo-router';

import { PersonProfileScreen } from '../../screens/PersonProfileScreen';

export default function PersonRoute() {
  const { personId, treeId } = useLocalSearchParams<{ personId: string; treeId?: string }>();
  return <PersonProfileScreen personId={personId} treeId={treeId} />;
}
