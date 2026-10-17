import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/worker', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/worker');
  });
});
