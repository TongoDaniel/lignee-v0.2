// Ouvre la base locale chiffrée au démarrage, sans retarder l'interface, et la met à disposition
// des écrans (`useLocalDatabase`). Monté par la racine de l'app avant le chargement des polices :
// l'ouverture se fait en parallèle. En développement, une base vide reçoit un arbre généré.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LocalDatabase } from '@lignee/sync';

import { openAppDatabase, type AppDatabase } from './openAppDatabase';

export type LocalDatabaseState =
  | { readonly status: 'opening' }
  | { readonly status: 'ready'; readonly db: LocalDatabase }
  | { readonly status: 'failed' };

const LocalDatabaseContext = createContext<LocalDatabaseState>({ status: 'opening' });

export interface LocalDatabaseProviderProps {
  readonly children: ReactNode;
  /** Ouverture de la base ; remplacée dans les tests. */
  readonly open?: () => Promise<AppDatabase>;
  /** Charger un arbre généré dans une base vide : en développement seulement. */
  readonly seedDevelopmentTree?: boolean;
}

export function LocalDatabaseProvider({
  children,
  open = openAppDatabase,
  seedDevelopmentTree = __DEV__,
}: LocalDatabaseProviderProps) {
  const [state, setState] = useState<LocalDatabaseState>({ status: 'opening' });

  useEffect(() => {
    // Lu par une fonction : l'état change entre deux `await`.
    let mounted = true;
    const active = () => mounted;
    let opened: AppDatabase | undefined;
    const start = async () => {
      const database = await open();
      opened = database;
      // Démonté pendant l'ouverture : la connexion est fermée tout de suite.
      if (!active()) {
        database.close();
        return;
      }
      if (__DEV__ && seedDevelopmentTree) {
        // Branche retirée du bundle de production : le générateur n'y entre pas.
        const dev = await import('./dev/seedDevelopmentTree');
        dev.seedDevelopmentTree(database.db);
      }
      if (active()) setState({ status: 'ready', db: database.db });
    };
    start().catch(() => {
      // Aucun détail exposé ni journalisé : l'erreur peut citer un chemin ou une requête. Le
      // suivi des erreurs (GlitchTip) viendra avec l'observabilité.
      if (active()) setState({ status: 'failed' });
    });
    return () => {
      mounted = false;
      opened?.close();
    };
  }, [open, seedDevelopmentTree]);

  return <LocalDatabaseContext.Provider value={state}>{children}</LocalDatabaseContext.Provider>;
}

export function useLocalDatabase(): LocalDatabaseState {
  return useContext(LocalDatabaseContext);
}
