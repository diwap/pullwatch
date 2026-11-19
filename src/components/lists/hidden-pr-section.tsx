import type { PullRequest } from '@common/types';
import { PRItem } from '../pr-item';

interface HiddenPrSectionProps {
  prs: PullRequest[];
  newPrIds?: Set<string>;
  showAuthorStatus?: boolean;
  canApprove?: boolean;
  onShow: (prId: string) => void;
  onPrLinkActivated?: (prId: string) => void;
}

export const HiddenPrSection = ({
  prs,
  newPrIds,
  showAuthorStatus = false,
  canApprove = false,
  onShow,
  onPrLinkActivated,
}: HiddenPrSectionProps) => {
  if (prs.length === 0) return null;

  return (
    <section aria-label="Hidden pull requests">
      <h3 className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
        Hidden ({prs.length})
      </h3>
      {prs.map((pr, index) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={newPrIds?.has(pr.id) ?? false}
          isFirst={index === 0}
          isReviewed={pr.reviewStatus === 'reviewed'}
          showAuthorStatus={showAuthorStatus}
          isHidden
          canApprove={canApprove}
          onToggleHidden={onShow}
          onPrLinkActivated={onPrLinkActivated}
        />
      ))}
    </section>
  );
};
