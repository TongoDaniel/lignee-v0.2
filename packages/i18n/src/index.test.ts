import { describe, expect, it } from 'vitest';

import { packageName } from './index';

describe('@lignee/i18n', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@lignee/i18n');
  });
});
