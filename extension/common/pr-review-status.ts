import type { PrReviewDecision, PullRequest } from './types';

/** Badge statuses shown on PR rows for review / author state. */
export type PrReviewBadgeStatus =
  | 'changes_requested'
  | 'approved'
  | 'pending'
  | 'commented'
  | 'draft'
  | 'review_required';

/**
 * Prefer GraphQL `reviewDecision` (branch protection) over scraped author status so
 * Today/To Review still show "Review required" when CI is green but merge is blocked.
 */
export function resolvePrReviewBadgeStatus(options: {
  reviewDecision?: PrReviewDecision;
  showAuthorStatus?: boolean;
  authorReviewStatus?: PullRequest['authorReviewStatus'];
}): PrReviewBadgeStatus | null {
  const { reviewDecision, showAuthorStatus, authorReviewStatus } = options;
  if (reviewDecision === 'REVIEW_REQUIRED') return 'review_required';
  if (reviewDecision === 'CHANGES_REQUESTED') return 'changes_requested';
  if (reviewDecision === 'APPROVED') return 'approved';
  if (showAuthorStatus && authorReviewStatus) return authorReviewStatus;
  return null;
}
