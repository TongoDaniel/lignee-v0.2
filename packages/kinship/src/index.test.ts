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
    expect(typeof kinship.presentRelationships).toBe('function');
    expect(typeof kinship.invertPresentedLink).toBe('function');
    expect(typeof kinship.ascentSide).toBe('function');
    // Calcul découpé (T-028).
    expect(typeof kinship.createKinshipGraphInSlices).toBe('function');
    expect(typeof kinship.createAllianceContextInSlices).toBe('function');
    // Interne : jamais exporté par le paquet.
    expect('clearAncestorCacheForTest' in kinship).toBe(false);
    expect(typeof kinship.findRelationshipsInSlices).toBe('function');
    expect(typeof kinship.presentRelationshipsInSlices).toBe('function');
    expect(kinship.MAX_SLICE_MS).toBe(50);
    // Mots des liens (T-026).
    expect(typeof kinship.describeLink).toBe('function');
    expect(typeof kinship.describeResult).toBe('function');
    expect(typeof kinship.alsoText).toBe('function');
  });
});
