import { useEffect } from 'react';
import type { PullRequest } from '@common/types';
import { useInboxPartition, useInboxPreferences } from '@src/hooks/inbox-preferences';
import { PRItem } from '../pr-item';
import { HiddenPrSection } from './hidden-pr-section';
import { PRListEmptyState } from './pr-list-empty-state';

interface AssignedListProps {
  prs: PullRequest[];
  newPrIds: Set<string>;
  hasEverLoaded: boolean;
  onViewIds: (ids: string[]) => void;
  onEntranceSeenOpen?: (prId: string) => void;
}

export const AssignedList = ({
  prs,
  newPrIds,
  hasEverLoaded,
  onViewIds,
  onEntranceSeenOpen,
}: AssignedListProps) => {
  useEffect(() => {
    return () => {
      const idsToMark = prs.filter((pr) => newPrIds.has(pr.id)).map((pr) => pr.id);
      if (idsToMark.length > 0) onViewIds(idsToMark);
    };
  }, [prs, newPrIds, onViewIds]);

  const { ready, orgFilter, showHidden, visible, hidden } = useInboxPartition(prs);
  const { hide, unhide } = useInboxPreferences();

  const pendingPRs = visible.filter((pr) => pr.reviewStatus === 'pending');
  const reviewedPRs = visible.filter((pr) => pr.reviewStatus === 'reviewed');

  if (!ready) {
    return <div className="h-full" />;
  }

  if (visible.length === 0 && hidden.length === 0) {
    return (
      <PRListEmptyState
        message={orgFilter ? `No pull requests in ${orgFilter}` : 'No PRs to review'}
        subMessage={
          orgFilter
            ? 'PRs from other organizations stay hidden'
            : 'PRs requesting your review will appear here'
        }
        hasEverLoaded={hasEverLoaded}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {visible.length === 0 && (
        <p className="px-5 py-4 text-sm italic text-base-content/50">Nothing to show</p>
      )}
      {pendingPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={newPrIds.has(pr.id)}
          isFirst={i === 0}
          isReviewed={false}
          canApprove
          onToggleHidden={hide}
          onPrLinkActivated={onEntranceSeenOpen}
        />
      ))}
      {reviewedPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={newPrIds.has(pr.id)}
          isFirst={pendingPRs.length === 0 && i === 0}
          isReviewed
          canApprove
          onToggleHidden={hide}
          onPrLinkActivated={onEntranceSeenOpen}
        />
      ))}
      {showHidden && (
        <HiddenPrSection
          prs={hidden}
          newPrIds={newPrIds}
          canApprove
          onShow={unhide}
          onPrLinkActivated={onEntranceSeenOpen}
        />
      )}
    </div>
  );
};
