import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/ui', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/ui');
  });
});
