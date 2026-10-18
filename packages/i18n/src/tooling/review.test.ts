import { describe, expect, it } from 'vitest';

import { countReview, parseReviewFile, syncReview } from './review';

const catalog = new Map([
  ['common:actions.cancel', 'Cancel'],
  ['common:actions.confirm', 'Confirm'],
  ['common:actions.save', 'Save'],
]);

describe('syncReview', () => {
  it('marks new messages to review and drops removed ones', () => {
    const synced = syncReview(catalog, {
      'common:actions.cancel': { status: 'reviewed', text: 'Cancel' },
      'common:old.key': { status: 'reviewed', text: 'Old' },
    });
    expect(synced).toEqual({
      'common:actions.cancel': { status: 'reviewed', text: 'Cancel' },
      'common:actions.confirm': { status: 'to-review' },
      'common:actions.save': { status: 'to-review' },
    });
  });

  it('sends a message back to review when its text changed after review', () => {
    const synced = syncReview(catalog, {
      'common:actions.confirm': { status: 'reviewed', text: 'Validate' },
    });
    expect(synced['common:actions.confirm']).toEqual({ status: 'to-review' });
  });
});

describe('countReview', () => {
  it('counts only messages reviewed with their current text', () => {
    const count = countReview(catalog, {
      'common:actions.cancel': { status: 'reviewed', text: 'Cancel' },
      'common:actions.confirm': { status: 'reviewed', text: 'Validate' },
      'common:actions.save': { status: 'to-review' },
    });
    expect(count).toEqual({
      total: 3,
      reviewed: 1,
      toReview: ['common:actions.confirm', 'common:actions.save'],
    });
  });
});

describe('parseReviewFile', () => {
  it('accepts the two entry shapes', () => {
    const json: unknown = {
      a: { status: 'to-review' },
      b: { status: 'reviewed', text: 'Cancel' },
    };
    expect(parseReviewFile(json, 'f')).toEqual(json);
  });

  it('rejects anything else', () => {
    expect(() => parseReviewFile([], 'f')).toThrow();
    expect(() => parseReviewFile({ a: { status: 'reviewed' } }, 'f')).toThrow(/« a »/);
    expect(() => parseReviewFile({ a: { status: 'done' } }, 'f')).toThrow(/« a »/);
    expect(() => parseReviewFile({ a: { status: 'to-review', by: 'x' } }, 'f')).toThrow(/« a »/);
  });
});
