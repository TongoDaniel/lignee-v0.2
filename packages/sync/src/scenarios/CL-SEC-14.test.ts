// CL-SEC-14 « Téléphone perdu ou volé », partie base locale chiffrée (T-016). Le voleur a le
// fichier de la base et son journal, pas le trousseau du téléphone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadScenario, scenarioSchema } from '@lignee/domain/test-support';
import { generateTree } from '@lignee/domain/tree-generator';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { devReaderSnapshot } from '../dev-seed/projection';
import { enteredTexts } from '../test-support/generated-snapshot';
import {
  nodeDatabaseFile,
  nodeDrizzle,
  openTestDatabase,
  nodeRandomBytesSource,
  temporaryDirectory,
  type NodeConnection,
} from '../test-support/node-database';
import { DATABASE_KEY_ENTRY } from '../local-db/key';
import { openLocalDatabase, rotateDatabaseKey } from '../local-db/open';
import {
  readTreeSnapshot,
  replaceTreeSnapshot,
  type LocalTreeSnapshot,
} from '../local-db/snapshot';

const refused = z.literal('refusee');
const sameTree = z.literal('arbre_identique');
const schema = scenarioSchema('CL-SEC-14', {
  action: z.strictObject({
    arbre_genere: z.strictObject({ graine: z.int(), personnes: z.int().min(10) }),
    cause_de_deces: z.string().min(5),
    voleur: z.strictObject({
      fichier: z.literal(true),
      journal: z.literal(true),
      trousseau: z.literal(false),
    }),
  }),
  attendu: z.strictObject({
    en_tete_sqlite_en_clair: z.literal(false),
    textes_en_clair: z.literal('aucun'),
    ouverture_sans_cle: refused,
    ouverture_autre_cle: refused,
    ouverture_avec_le_trousseau: sameTree,
    apres_rotation: z.strictObject({ ancienne_cle: refused, nouvelle_cle: sameTree }),
  }),
});

const tmp = temporaryDirectory();
afterAll(() => {
  tmp.cleanup();
});

/** Lecture du voleur : ouvre le fichier avec une clé donnée (ou aucune) et lit les tables. */
function thiefReads(path: string, key: string | undefined): void {
  const connection = nodeDatabaseFile(path).open();
  try {
    if (key !== undefined) connection.exec(`PRAGMA key = "x'${key}'"`);
    connection.get('SELECT count(*) FROM people');
  } finally {
    connection.close();
  }
}

function bytesOf(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch {
    return Buffer.alloc(0);
  }
}

// Arbre généré de 200 personnes écrit dans une base chiffrée, puis relu octet par octet : le délai
// par défaut de vitest (5 s) est trop court sous la charge de la CI.
describe('CL-SEC-14 — téléphone perdu ou volé (base locale chiffrée)', { timeout: 30_000 }, () => {
  it('le fichier volé ne livre ni l’arbre ni la cause de décès sans la clé du trousseau', async () => {
    const scenario = loadScenario('CL-SEC-14', schema);
    const { arbre_genere: params, cause_de_deces: cause } = scenario.action;
    const generated = generateTree({ seed: params.graine, size: params.personnes });
    const reader = generated.accounts[0]?.accountId;
    if (reader === undefined) throw new Error('Generated tree without an account');
    const projected = devReaderSnapshot(generated, reader);
    const subject = projected.people[0];
    if (subject === undefined) throw new Error('Empty tree');
    const snapshot: LocalTreeSnapshot = {
      ...projected,
      facts: [
        ...projected.facts,
        {
          id: '01999999-0000-7000-8000-00000000c514',
          treeId: projected.tree.id,
          subject: { kind: 'person', personId: subject.id },
          type: 'death_cause',
          value: cause,
          authorAccountId: reader,
        },
      ],
    };

    const path = join(tmp.dir, 'stolen.db');
    const { db, connection, keyStore } = await openTestDatabase(path);
    replaceTreeSnapshot(db, snapshot, { now: 1 });

    // Le voleur copie le fichier et le journal WAL pendant que l'app tourne.
    const texts = [...enteredTexts(snapshot), cause, subject.id];
    expect(texts.length).toBeGreaterThan(50);
    const stolen = [bytesOf(path), bytesOf(`${path}-wal`)];
    expect(stolen[0]?.length).toBeGreaterThan(0);
    expect(stolen[1]?.length).toBeGreaterThan(0);
    for (const bytes of stolen) {
      expect(bytes.subarray(0, 16).toString('latin1') === 'SQLite format 3\0').toBe(
        scenario.attendu.en_tete_sqlite_en_clair,
      );
      const plain = texts.filter(
        (text) =>
          bytes.includes(Buffer.from(text, 'utf8')) || bytes.includes(Buffer.from(text, 'utf16le')),
      );
      expect(plain.length === 0 ? 'aucun' : plain.length).toBe(scenario.attendu.textes_en_clair);
    }
    connection.close();

    // Sans clé, ou avec une autre clé : SQLite ne reconnaît pas une base.
    expect(scenario.attendu.ouverture_sans_cle).toBe('refusee');
    expect(() => {
      thiefReads(path, undefined);
    }).toThrow(/not a database/);
    expect(scenario.attendu.ouverture_autre_cle).toBe('refusee');
    expect(() => {
      thiefReads(path, 'cd'.repeat(32));
    }).toThrow(/not a database/);

    // Le téléphone, lui, rouvre la base avec la clé de son trousseau.
    const file = nodeDatabaseFile(path);
    const again = await openLocalDatabase({ file, keyStore, randomBytes: nodeRandomBytesSource });
    expect(scenario.attendu.ouverture_avec_le_trousseau).toBe('arbre_identique');
    expect(again.outcome).toBe('opened');
    const phone = again.connection as NodeConnection;
    expect(readTreeSnapshot(nodeDrizzle(phone), snapshot.tree.id)).toEqual(snapshot);

    // Après une rotation (par exemple quand l'appareil est retrouvé), l'ancienne clé ne sert
    // plus à rien.
    const oldKey = keyStore.entries.get(DATABASE_KEY_ENTRY);
    await rotateDatabaseKey(phone, keyStore, nodeRandomBytesSource);
    phone.close();
    expect(scenario.attendu.apres_rotation.ancienne_cle).toBe('refusee');
    expect(() => {
      thiefReads(path, oldKey);
    }).toThrow(/not a database/);
    expect(scenario.attendu.apres_rotation.nouvelle_cle).toBe('arbre_identique');
    const rotated = await openLocalDatabase({ file, keyStore, randomBytes: nodeRandomBytesSource });
    expect(rotated.outcome).toBe('opened');
    expect(
      readTreeSnapshot(nodeDrizzle(rotated.connection as NodeConnection), snapshot.tree.id),
    ).toEqual(snapshot);
    rotated.connection.close();
  });
});
