import { describe, expect, it } from 'vitest';

import * as kinship from './index';

describe('@lignee/kinship', () => {
  it('expose le graphe et le calcul des liens', () => {
    expect(typeof kinship.createKinshipGraph).toBe('function');
    expect(typeof kinship.findRelationships).toBe('function');
    expect(typeof kinship.commonAncestorsOfPaths).toBe('function');
    expect(typeof kinship.invertRelationship).toBe('function');
    expect(typeof kinship.siblingLink).toBe('function');
    expect(typeof kinship.siblingsOf).toBe('function');
    expect(typeof kinship.invertSiblingLink).toBe('function');
    expect(typeof kinship.parentSide).toBe('function');
  });
});
