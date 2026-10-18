// Ouvre la base locale chiffrée au démarrage, sans retarder l'interface, et la met à disposition
// des écrans (`useLocalDatabase`). En développement, une base vide reçoit un arbre généré.
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
  /** Remplacé dans les tests. */
  readonly open?: () => Promise<AppDatabase>;
}

export function LocalDatabaseProvider({
  children,
  open = openAppDatabase,
}: LocalDatabaseProviderProps) {
  const [state, setState] = useState<LocalDatabaseState>({ status: 'opening' });

  useEffect(() => {
    let active = true;
    const start = async () => {
      const { db } = await open();
      if (__DEV__) {
        // Branche retirée du bundle de production : le générateur n'y entre pas.
        const { seedDevelopmentTree } = await import('./dev/seedDevelopmentTree');
        seedDevelopmentTree(db);
      }
      if (active) setState({ status: 'ready', db });
    };
    start().catch(() => {
      // Aucun détail : l'erreur peut citer un chemin ou une requête. Le suivi des erreurs
      // (GlitchTip) viendra avec l'observabilité.
      if (active) setState({ status: 'failed' });
    });
    return () => {
      active = false;
    };
  }, [open]);

  return <LocalDatabaseContext.Provider value={state}>{children}</LocalDatabaseContext.Provider>;
}

export function useLocalDatabase(): LocalDatabaseState {
  return useContext(LocalDatabaseContext);
}
