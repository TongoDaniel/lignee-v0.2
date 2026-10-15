import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/voice', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/voice');
  });
});
