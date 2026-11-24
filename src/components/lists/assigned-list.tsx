import { useEffect } from 'react';
import type { PullRequest } from '@common/types';
import { useInboxPartition, useInboxPreferences } from '@src/hooks/inbox-preferences';
import { PRItem } from '../pr-item';
import { HiddenPrSection } from './hidden-pr-section';
import { PRListEmptyState } from './pr-list-empty-state';
import { PrListSectionHeader } from './pr-list-section-header';

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

  const { ready, orgFilter, showHidden, includeTeamReviews, visible, hidden } =
    useInboxPartition(prs);
  const { hide, unhide } = useInboxPreferences();

  const pendingPRs = visible.filter((pr) => pr.reviewStatus === 'pending');
  const reviewedPRs = visible.filter((pr) => pr.reviewStatus === 'reviewed');
  const directPending = pendingPRs.filter((pr) => pr.reviewRequestKind !== 'team');
  const teamPending = includeTeamReviews
    ? pendingPRs.filter((pr) => pr.reviewRequestKind === 'team')
    : [];

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
            : includeTeamReviews
              ? 'PRs requesting your review (personal or team) will appear here'
              : 'PRs requesting your review will appear here. Turn on Teams next to refresh to include team requests.'
        }
        hasEverLoaded={hasEverLoaded}
      />
    );
  }

  const sections: Array<{
    key: string;
    title: string;
    rows: PullRequest[];
    reviewed?: boolean;
  }> = [
    { key: 'direct', title: 'Requested of you', rows: directPending },
    ...(includeTeamReviews
      ? [{ key: 'team', title: 'Requested of your teams', rows: teamPending }]
      : []),
    { key: 'reviewed', title: 'Reviewed', rows: reviewedPRs, reviewed: true },
  ].filter((section) => section.rows.length > 0);

  let firstRendered = false;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {visible.length === 0 && (
        <p className="px-5 py-4 text-sm italic text-base-content/50">Nothing to show</p>
      )}
      {sections.map((section) => (
        <section key={section.key} aria-label={section.title}>
          {(includeTeamReviews || section.key === 'reviewed') && (
            <PrListSectionHeader title={section.title} count={section.rows.length} />
          )}
          {section.rows.map((pr, i) => {
            const isFirst = !firstRendered && i === 0;
            if (isFirst) firstRendered = true;
            return (
              <PRItem
                key={pr.id}
                pr={pr}
                isNew={newPrIds.has(pr.id)}
                isFirst={isFirst}
                isReviewed={Boolean(section.reviewed)}
                canApprove
                onToggleHidden={hide}
                onPrLinkActivated={onEntranceSeenOpen}
              />
            );
          })}
        </section>
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
