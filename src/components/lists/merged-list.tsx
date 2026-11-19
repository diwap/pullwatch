import { useEffect } from 'react';
import type { PullRequest } from '@common/types';
import { useInboxPartition, useInboxPreferences } from '@src/hooks/inbox-preferences';
import { PRItem } from '../pr-item';
import { HiddenPrSection } from './hidden-pr-section';
import { PRListEmptyState } from './pr-list-empty-state';

interface MergedListProps {
  prs: PullRequest[];
  newPrIds: Set<string>;
  hasEverLoaded: boolean;
  onViewIds: (ids: string[]) => void;
  onEntranceSeenOpen?: (prId: string) => void;
}

export const MergedList = ({
  prs,
  newPrIds,
  hasEverLoaded,
  onViewIds,
  onEntranceSeenOpen,
}: MergedListProps) => {
  useEffect(() => {
    return () => {
      const idsToMark = prs.filter((pr) => newPrIds.has(pr.id)).map((pr) => pr.id);
      if (idsToMark.length > 0) onViewIds(idsToMark);
    };
  }, [prs, newPrIds, onViewIds]);

  const { ready, orgFilter, showHidden, visible, hidden } = useInboxPartition(prs);
  const { hide, unhide } = useInboxPreferences();

  if (!ready) {
    return <div className="h-full" />;
  }

  if (visible.length === 0 && hidden.length === 0) {
    return (
      <PRListEmptyState
        message={orgFilter ? `No pull requests in ${orgFilter}` : 'No merged PRs'}
        subMessage={
          orgFilter ? 'PRs from other organizations stay hidden' : 'Merged PRs will appear here'
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
          isNew={newPrIds.has(pr.id)}
          isFirst={i === 0}
          onToggleHidden={hide}
          onPrLinkActivated={onEntranceSeenOpen}
        />
      ))}
      {showHidden && (
        <HiddenPrSection
          prs={hidden}
          newPrIds={newPrIds}
          onShow={unhide}
          onPrLinkActivated={onEntranceSeenOpen}
        />
      )}
    </div>
  );
};
