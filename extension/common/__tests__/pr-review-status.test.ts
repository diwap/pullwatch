import { describe, expect, it } from 'vitest';
import { resolvePrReviewBadgeStatus } from '../pr-review-status';

describe('resolvePrReviewBadgeStatus', () => {
  it('prefers reviewDecision over scraped author status', () => {
    expect(
      resolvePrReviewBadgeStatus({
        reviewDecision: 'REVIEW_REQUIRED',
        showAuthorStatus: true,
        authorReviewStatus: 'approved',
      })
    ).toBe('review_required');

    expect(
      resolvePrReviewBadgeStatus({
        reviewDecision: 'CHANGES_REQUESTED',
        showAuthorStatus: true,
        authorReviewStatus: 'pending',
      })
    ).toBe('changes_requested');

    expect(
      resolvePrReviewBadgeStatus({
        reviewDecision: 'APPROVED',
        showAuthorStatus: false,
      })
    ).toBe('approved');
  });

  it('falls back to author status when reviewDecision is absent', () => {
    expect(
      resolvePrReviewBadgeStatus({
        reviewDecision: null,
        showAuthorStatus: true,
        authorReviewStatus: 'pending',
      })
    ).toBe('pending');

    expect(
      resolvePrReviewBadgeStatus({
        showAuthorStatus: false,
        authorReviewStatus: 'pending',
      })
    ).toBeNull();
  });
});
