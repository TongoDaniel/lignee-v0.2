import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/sync', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/sync');
  });
});
