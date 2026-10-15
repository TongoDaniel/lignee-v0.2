import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/domain', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/domain');
  });
});
