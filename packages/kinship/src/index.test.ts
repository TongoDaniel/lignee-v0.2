import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/kinship', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/kinship');
  });
});
