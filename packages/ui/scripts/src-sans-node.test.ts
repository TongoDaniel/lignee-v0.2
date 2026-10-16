// Le code de src/ tourne sous React Native : ni `process`, ni `Buffer`, ni `node:fs`. Ce test
// compile un fichier qui utilise `process` avec la configuration de src/ (tsconfig.json) et
// vérifie que le typecheck échoue ; le même fichier passe avec celle des scripts.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { packageRoot } from './paths.ts';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const dir = mkdtempSync(join(tmpdir(), 'lignee-ui-src-sans-node-'));
writeFileSync(join(dir, 'sonde.ts'), "export const env = process.env['LIGNEE'];\n");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function typecheck(baseConfig: string): { status: number | null; output: string } {
  const config = join(dir, `tsconfig.${String(Math.random()).slice(2)}.json`);
  writeFileSync(
    config,
    JSON.stringify({
      extends: join(packageRoot, baseConfig),
      compilerOptions: { typeRoots: [join(packageRoot, 'node_modules', '@types')] },
      include: [],
      files: ['./sonde.ts'],
    }),
  );
  const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', config], {
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('types de Node', () => {
  it('sont absents de src/ : `process` y échoue au typecheck', () => {
    const { status, output } = typecheck('tsconfig.json');
    expect(status).not.toBe(0);
    expect(output).toMatch(/TS2591|Cannot find name 'process'/);
  });

  it('sont présents dans scripts/', () => {
    const { status, output } = typecheck('scripts/tsconfig.json');
    expect(output).toBe('');
    expect(status).toBe(0);
  });
});
