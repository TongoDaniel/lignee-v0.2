// Overrides pnpm de l'app mobile (package.json racine, `pnpm.overrides`) : ils figent des paquets
// qu'Expo installe lui-même, sur des versions publiées depuis au moins 14 jours. Quand `expo`
// change de version, un override resté en arrière forcerait une version qu'il ne demande plus.
// Ce test compare chaque override à la plage demandée par l'expo installé (ou par sa ligne de
// commande) et à l'éventuelle version épinglée par l'app : il échoue au premier décalage.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import semver from 'semver';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const mobileRoot = join(repoRoot, 'apps', 'mobile');

interface PackageJson {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly pnpm?: { readonly overrides?: Record<string, string> };
}

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

/** package.json d'un paquet tel que le résout `from` (installation isolée de pnpm). */
function resolvePackage(fromDirectory: string, name: string): { dir: string; pkg: PackageJson } {
  const require = createRequire(join(fromDirectory, 'package.json'));
  const path = require.resolve(`${name}/package.json`);
  return { dir: dirname(path), pkg: readJson(path) };
}

const overrides = readJson(join(repoRoot, 'package.json')).pnpm?.overrides ?? {};
const mobile = readJson(join(mobileRoot, 'package.json'));
const expo = resolvePackage(mobileRoot, 'expo');
const expoCli = resolvePackage(expo.dir, '@expo/cli');
/** Paquets d'Expo dont les dépendances fixent la plage admise. */
const requesters = [expo.pkg, expoCli.pkg];

/**
 * Overrides volontairement hors de la plage demandée (avis de sécurité sans correctif dans cette
 * plage). Clé : l'override ; valeur : la plage qu'Expo demande aujourd'hui. Si Expo change sa
 * plage, le test échoue : l'override est alors à réexaminer ou à retirer (voir le README, Outillage).
 */
const intentionallyOutOfRange: Record<string, string> = {
  // GHSA-mrhx-c7xc-m3w5 : pas de correctif en zod 3.x.
  '@expo/cli>zod': '^3.25.76',
};

describe('overrides pnpm des paquets d’Expo', () => {
  it('existent (sinon ce test ne vérifie rien)', () => {
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(overrides))(
    '%s %s reste dans la plage demandée par Expo',
    (name, version) => {
      // Un sélecteur « parent>enfant » cible la dépendance de ce seul parent.
      const [parentName, childName] = name.includes('>')
        ? (name.split('>') as [string, string])
        : [undefined, name];
      const ranges = requesters
        .filter((pkg) => parentName === undefined || pkg.name === parentName)
        .map((pkg) => ({
          by: `${pkg.name}@${pkg.version}`,
          range: pkg.dependencies?.[childName],
        }))
        .filter((entry): entry is { by: string; range: string } => entry.range !== undefined);

      expect(
        ranges,
        `${name} n'est demandé ni par expo ni par @expo/cli : override à retirer`,
      ).not.toEqual([]);
      const expectedOutOfRange = intentionallyOutOfRange[name];
      for (const { by, range } of ranges) {
        if (expectedOutOfRange !== undefined) {
          expect(
            range,
            `${by} ne demande plus ${expectedOutOfRange} pour ${name} : réexaminer l'override`,
          ).toBe(expectedOutOfRange);
          continue;
        }
        expect(
          semver.satisfies(version, range),
          `${name}@${version} hors de la plage ${range} demandée par ${by}`,
        ).toBe(true);
      }

      const pinned = mobile.dependencies?.[childName] ?? mobile.devDependencies?.[childName];
      if (pinned !== undefined) expect(pinned).toBe(version);
    },
  );

  it('@expo/cli installé est bien celui de l’override', () => {
    expect(expoCli.pkg.version).toBe(overrides['@expo/cli']);
  });
});
