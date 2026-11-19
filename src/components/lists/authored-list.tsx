import type { PullRequest } from '@common/types';
import { useInboxPartition, useInboxPreferences } from '@src/hooks/inbox-preferences';
import { PRItem } from '../pr-item';
import { HiddenPrSection } from './hidden-pr-section';
import { PRListEmptyState } from './pr-list-empty-state';

interface AuthoredListProps {
  prs: PullRequest[];
  hasEverLoaded: boolean;
}

export const AuthoredList = ({ prs, hasEverLoaded }: AuthoredListProps) => {
  const { ready, orgFilter, showHidden, visible, hidden } = useInboxPartition(prs);
  const { hide, unhide } = useInboxPreferences();

  const changesRequestedPRs = visible.filter((pr) => pr.authorReviewStatus === 'changes_requested');
  const approvedPRs = visible.filter((pr) => pr.authorReviewStatus === 'approved');
  const pendingPRs = visible.filter((pr) => pr.authorReviewStatus === 'pending');
  const commentedPRs = visible.filter((pr) => pr.authorReviewStatus === 'commented');
  const draftPRs = visible.filter((pr) => pr.authorReviewStatus === 'draft');

  if (!ready) {
    return <div className="h-full" />;
  }

  if (visible.length === 0 && hidden.length === 0) {
    return (
      <PRListEmptyState
        message={orgFilter ? `No pull requests in ${orgFilter}` : 'No PRs authored by you'}
        subMessage={
          orgFilter ? 'PRs from other organizations stay hidden' : 'PRs you authored will appear here'
        }
        hasEverLoaded={hasEverLoaded}
      />
    );
  }

  const orderedGroups = [changesRequestedPRs, approvedPRs, pendingPRs, commentedPRs, draftPRs];
  const firstGroupIndex = orderedGroups.findIndex((g) => g.length > 0);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {visible.length === 0 && (
        <p className="px-5 py-4 text-sm italic text-base-content/50">Nothing to show</p>
      )}
      {changesRequestedPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={false}
          isFirst={firstGroupIndex === 0 && i === 0}
          showAuthorStatus
          onToggleHidden={hide}
        />
      ))}
      {approvedPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={false}
          isFirst={firstGroupIndex === 1 && i === 0}
          showAuthorStatus
          onToggleHidden={hide}
        />
      ))}
      {pendingPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={false}
          isFirst={firstGroupIndex === 2 && i === 0}
          showAuthorStatus
          onToggleHidden={hide}
        />
      ))}
      {commentedPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={false}
          isFirst={firstGroupIndex === 3 && i === 0}
          showAuthorStatus
          onToggleHidden={hide}
        />
      ))}
      {draftPRs.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={false}
          isFirst={firstGroupIndex === 4 && i === 0}
          showAuthorStatus
          onToggleHidden={hide}
        />
      ))}
      {showHidden && <HiddenPrSection prs={hidden} showAuthorStatus onShow={unhide} />}
    </div>
  );
};
