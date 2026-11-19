import type { PullRequest } from '@common/types';
import { useInboxPartition, useInboxPreferences } from '@src/hooks/inbox-preferences';
import { PRItem } from '../pr-item';
import { HiddenPrSection } from './hidden-pr-section';
import { PRListEmptyState } from './pr-list-empty-state';

interface TodayListProps {
  prs: PullRequest[];
  hasEverLoaded: boolean;
  hasToken: boolean;
}

export const TodayList = ({ prs, hasEverLoaded, hasToken }: TodayListProps) => {
  const { ready, orgFilter, showHidden, visible, hidden } = useInboxPartition(prs, {
    skipDateRange: true,
  });
  const { hide, unhide } = useInboxPreferences();

  if (!ready) {
    return <div className="h-full" />;
  }

  if (visible.length === 0 && hidden.length === 0) {
    return (
      <PRListEmptyState
        message={orgFilter ? `Nothing today in ${orgFilter}` : 'Nothing today'}
        subMessage={
          hasToken
            ? 'Hit refresh after sync. Mentions need API search; if private org PRs are missing, authorize SSO on the token.'
            : 'Opened by you today and review requests touched today. Add a token for mentions.'
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
      {visible.map((pr, i) => (
        <PRItem
          key={pr.id}
          pr={pr}
          isNew={false}
          isFirst={i === 0}
          canApprove={pr.todayReason === 'review'}
          onToggleHidden={hide}
        />
      ))}
      {showHidden && (
        <HiddenPrSection
          prs={hidden}
          canApprove
          onShow={unhide}
        />
      )}
    </div>
  );
};
