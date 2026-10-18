// Base locale côté app (T-016) : états du fournisseur, ouverture unique et fermeture, et
// effacement du fichier et de ses fichiers annexes.
import type { LocalDatabase } from '@lignee/sync';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { deleteDatabaseFiles, type DatabaseFileSystem } from './expoDatabaseFile';
import { LocalDatabaseProvider, useLocalDatabase } from './LocalDatabaseProvider';
import type { AppDatabase } from './openAppDatabase';

function Status() {
  const state = useLocalDatabase();
  return <Text testID="status">{JSON.stringify(state)}</Text>;
}

function statusText(): string {
  return String(screen.getByTestId('status').props.children);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
}

const fakeDb = { fake: 'db' } as unknown as LocalDatabase;

describe('LocalDatabaseProvider', () => {
  it('passe de « opening » à « ready » quand la base est ouverte', async () => {
    const pending = deferred<AppDatabase>();
    const close = jest.fn();
    render(
      <LocalDatabaseProvider open={() => pending.promise} seedDevelopmentTree={false}>
        <Status />
      </LocalDatabaseProvider>,
    );
    expect(JSON.parse(statusText())).toEqual({ status: 'opening' });
    await act(async () => {
      pending.resolve({ db: fakeDb, outcome: 'opened', close });
      await pending.promise;
    });
    expect(JSON.parse(statusText())).toEqual({ status: 'ready', db: { fake: 'db' } });
    expect(close).not.toHaveBeenCalled();
  });

  it('passe de « opening » à « failed » sans exposer l’erreur', async () => {
    const pending = deferred<AppDatabase>();
    render(
      <LocalDatabaseProvider open={() => pending.promise} seedDevelopmentTree={false}>
        <Status />
      </LocalDatabaseProvider>,
    );
    await act(async () => {
      pending.reject(new Error('/data/user/0/com.lignee.app/files/SQLite/lignee.db: Nomsecret'));
      await pending.promise.catch(() => undefined);
    });
    expect(JSON.parse(statusText())).toEqual({ status: 'failed' });
    expect(statusText()).not.toMatch(/Nomsecret|lignee\.db/);
  });

  it('ferme la base au démontage', async () => {
    const close = jest.fn();
    const database: AppDatabase = { db: fakeDb, outcome: 'opened', close };
    const view = render(
      <LocalDatabaseProvider open={() => Promise.resolve(database)} seedDevelopmentTree={false}>
        <Status />
      </LocalDatabaseProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(JSON.parse(statusText())).toMatchObject({ status: 'ready' });
    view.unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('ferme la base ouverte après un démontage survenu pendant l’ouverture', async () => {
    const pending = deferred<AppDatabase>();
    const close = jest.fn();
    const view = render(
      <LocalDatabaseProvider open={() => pending.promise} seedDevelopmentTree={false}>
        <Status />
      </LocalDatabaseProvider>,
    );
    view.unmount();
    await act(async () => {
      pending.resolve({ db: fakeDb, outcome: 'opened', close });
      await pending.promise;
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('openAppDatabase', () => {
  it('n’ouvre la base qu’une fois, jusqu’à sa fermeture', async () => {
    jest.resetModules();
    const openLocalDatabase = jest.fn(() =>
      Promise.resolve({ connection: { native: {}, close: jest.fn() }, outcome: 'opened' }),
    );
    jest.doMock('@lignee/sync', () => ({ localSchema: {}, openLocalDatabase }));
    jest.doMock('drizzle-orm/expo-sqlite', () => ({ drizzle: () => ({}) }));
    jest.doMock('./expoDatabaseFile', () => ({ expoDatabaseFile: () => ({}) }));
    const actual = jest.requireActual<typeof import('./openAppDatabase')>('./openAppDatabase');
    const [a, b] = await Promise.all([actual.openAppDatabase(), actual.openAppDatabase()]);
    expect(a).toBe(b);
    expect(openLocalDatabase).toHaveBeenCalledTimes(1);
    a.close();
    await actual.openAppDatabase();
    expect(openLocalDatabase).toHaveBeenCalledTimes(2);
  });
});

describe('deleteDatabaseFiles', () => {
  function fakeFileSystem(files: string[]): DatabaseFileSystem & { files: Set<string> } {
    const set = new Set(files);
    return {
      files: set,
      exists: (path) => set.has(path),
      remove: (path) => {
        set.delete(path);
      },
    };
  }
  const dir = '/data/files/SQLite';

  it('efface la base par expo-sqlite, puis ses fichiers -wal, -shm et -journal', () => {
    const fs = fakeFileSystem([
      `${dir}/lignee.db`,
      `${dir}/lignee.db-wal`,
      `${dir}/lignee.db-shm`,
      `${dir}/lignee.db-journal`,
      `${dir}/autre.db`,
    ]);
    const deleteDatabase = jest.fn((name: string) => {
      fs.files.delete(`${dir}/${name}`);
    });
    expect(deleteDatabaseFiles(fs, deleteDatabase, dir)).toBe(true);
    expect(deleteDatabase).toHaveBeenCalledWith('lignee.db');
    expect([...fs.files]).toEqual([`${dir}/autre.db`]);
  });

  it('renvoie faux seulement si la base est absente, et efface quand même un journal resté', () => {
    const fs = fakeFileSystem([`${dir}/lignee.db-wal`]);
    const deleteDatabase = jest.fn();
    expect(deleteDatabaseFiles(fs, deleteDatabase, dir)).toBe(false);
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(fs.files.size).toBe(0);
  });

  it('laisse remonter toute autre erreur (connexion encore ouverte)', () => {
    const fs = fakeFileSystem([`${dir}/lignee.db`, `${dir}/lignee.db-wal`]);
    const error = new Error('Unable to delete the database file because it is currently open');
    expect(() =>
      deleteDatabaseFiles(
        fs,
        () => {
          throw error;
        },
        dir,
      ),
    ).toThrow(error);
    expect(fs.files.has(`${dir}/lignee.db-wal`)).toBe(true);
  });
});
