import { describe, expect, it } from 'vitest';
import {
  filterByTeamReviewPreference,
  isTeamReviewRequest,
  tagReviewRequestKind,
} from '../review-request-kind';
import type { PullRequest } from '../types';

function pr(partial: Partial<PullRequest> & Pick<PullRequest, 'id'>): PullRequest {
  return {
    url: `https://github.com/o/r/pull/${partial.id}`,
    title: 't',
    number: 1,
    repoName: 'o/r',
    author: [{ login: 'u' }],
    type: 'open',
    reviewStatus: 'pending',
    ...partial,
  };
}

describe('review-request-kind helpers', () => {
  it('detects team rows from kind or todayReason', () => {
    expect(isTeamReviewRequest(pr({ id: '1', reviewRequestKind: 'team' }))).toBe(true);
    expect(isTeamReviewRequest(pr({ id: '2', todayReason: 'team' }))).toBe(true);
    expect(isTeamReviewRequest(pr({ id: '3', reviewRequestKind: 'direct' }))).toBe(false);
  });

  it('filters team rows when the preference is off', () => {
    const rows = [
      pr({ id: '1', reviewRequestKind: 'direct' }),
      pr({ id: '2', reviewRequestKind: 'team' }),
      pr({ id: '3', todayReason: 'mine' }),
    ];
    expect(filterByTeamReviewPreference(rows, false).map((r) => r.id)).toEqual(['1', '3']);
    expect(filterByTeamReviewPreference(rows, true)).toHaveLength(3);
  });

  it('allowlists team rows by org/slug (empty = all)', () => {
    const rows = [
      pr({
        id: '1',
        reviewRequestKind: 'team',
        requestedTeams: ['acme/frontend'],
      }),
      pr({
        id: '2',
        reviewRequestKind: 'team',
        requestedTeams: ['acme/backend'],
      }),
      pr({
        id: '3',
        reviewRequestKind: 'team',
        requestedTeams: [],
      }),
      pr({ id: '4', reviewRequestKind: 'direct' }),
    ];
    expect(filterByTeamReviewPreference(rows, true, []).map((r) => r.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(
      filterByTeamReviewPreference(rows, true, ['acme/frontend']).map((r) => r.id)
    ).toEqual(['1', '3', '4']);
  });

  it('tags a list with a review request kind', () => {
    expect(tagReviewRequestKind([pr({ id: '9' })], 'team')[0]?.reviewRequestKind).toBe('team');
  });
});
