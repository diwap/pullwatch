import { resolvePrReviewBadgeStatus } from '@common/pr-review-status';
import type { CheckRollupState, PrReviewDecision, PullRequest } from '@common/types';
import { CheckIcon } from '../../ui/icons';
import { PRStatusIcon } from '../../ui/pr-status-icon';
import { StatusBadge } from '../../ui/status-badge';
import { CheckStatusIcon } from './check-status-icon';
import { PrItemTruncatedTitle } from './pr-item-truncated-title';

interface PrItemHeaderRowProps {
  prType: PullRequest['type'];
  title: string;
  isFirst: boolean;
  isReviewed: boolean;
  showAuthorStatus: boolean;
  authorReviewStatus: PullRequest['authorReviewStatus'];
  checkState?: CheckRollupState;
  reviewDecision?: PrReviewDecision;
  todayReason?: PullRequest['todayReason'];
  /** Keeps the PR row stacked above neighbors while the truncated-title tooltip finishes its CSS hide animation. */
  onTruncatedTitleStackLiftChange?: (lifted: boolean) => void;
}

const TODAY_REASON_LABEL: Record<NonNullable<PullRequest['todayReason']>, string> = {
  mine: 'Mine',
  review: 'Review',
  mentioned: 'Mentioned',
};

export const PrItemHeaderRow = ({
  prType,
  title,
  isFirst,
  isReviewed,
  showAuthorStatus,
  authorReviewStatus,
  checkState,
  reviewDecision,
  todayReason,
  onTruncatedTitleStackLiftChange,
}: PrItemHeaderRowProps) => {
  const reviewBadge = resolvePrReviewBadgeStatus({
    reviewDecision,
    showAuthorStatus,
    authorReviewStatus,
  });

  return (
    <div className="flex items-center gap-1 mb-1.5">
      <PRStatusIcon type={prType} reviewed={isReviewed} />
      <CheckStatusIcon state={checkState} />
      <PrItemTruncatedTitle
        title={title}
        isFirst={isFirst}
        isReviewed={isReviewed}
        onStackLiftChange={onTruncatedTitleStackLiftChange}
      />
      <div className="flex items-center gap-1 shrink-0">
        {todayReason && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-base-300 text-base-content/70 text-[11px] font-medium">
            {TODAY_REASON_LABEL[todayReason]}
          </span>
        )}
        {isReviewed && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-base-300 text-base-content/70 text-[11px] font-medium">
            <CheckIcon width={10} height={10} className="shrink-0" />
            Reviewed
          </span>
        )}
        {reviewBadge && <StatusBadge status={reviewBadge} />}
      </div>
    </div>
  );
};
