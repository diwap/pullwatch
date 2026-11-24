import type { PullRequest } from '@common/types';
import { useInboxPartition, useInboxPreferences } from '@src/hooks/inbox-preferences';
import { PRItem } from '../pr-item';
import { HiddenPrSection } from './hidden-pr-section';
import { PRListEmptyState } from './pr-list-empty-state';
import { PrListSectionHeader } from './pr-list-section-header';

interface TodayListProps {
  prs: PullRequest[];
  hasEverLoaded: boolean;
  hasToken: boolean;
}

export const TodayList = ({ prs, hasEverLoaded, hasToken }: TodayListProps) => {
  const { ready, orgFilter, showHidden, includeTeamReviews, visible, hidden } = useInboxPartition(
    prs,
    { skipDateRange: true }
  );
  const { hide, unhide } = useInboxPreferences();
  const openVisible = visible.filter((pr) => pr.type !== 'merged');
  const openHidden = hidden.filter((pr) => pr.type !== 'merged');

  const mine = openVisible.filter((pr) => pr.todayReason === 'mine');
  const direct = openVisible.filter((pr) => pr.todayReason === 'review');
  const team = includeTeamReviews
    ? openVisible.filter((pr) => pr.todayReason === 'team')
    : [];
  const mentioned = openVisible.filter((pr) => pr.todayReason === 'mentioned');
  const other = openVisible.filter(
    (pr) =>
      pr.todayReason !== 'mine' &&
      pr.todayReason !== 'review' &&
      pr.todayReason !== 'team' &&
      pr.todayReason !== 'mentioned'
  );

  if (!ready) {
    return <div className="h-full" />;
  }

  if (openVisible.length === 0 && openHidden.length === 0) {
    return (
      <PRListEmptyState
        message={orgFilter ? `Nothing today in ${orgFilter}` : 'Nothing today'}
        subMessage={
          hasToken
            ? includeTeamReviews
              ? 'Hit refresh after sync. Mentions need API search; if private org PRs are missing, authorize SSO on the token.'
              : 'Hit refresh after sync. Turn on Teams (next to refresh) to include team membership review requests.'
            : 'Opened by you today and review requests touched today. Add a token for mentions.'
        }
        hasEverLoaded={hasEverLoaded}
      />
    );
  }

  const sections: Array<{
    key: string;
    title: string;
    rows: PullRequest[];
    canApprove?: boolean;
  }> = [
    { key: 'mine', title: 'Opened by you', rows: mine },
    { key: 'direct', title: 'Requested of you', rows: direct, canApprove: true },
    ...(includeTeamReviews
      ? [{ key: 'team', title: 'Requested of your teams', rows: team, canApprove: true }]
      : []),
    { key: 'mentioned', title: 'Mentions', rows: mentioned },
    { key: 'other', title: 'Other', rows: other },
  ].filter((section) => section.rows.length > 0);

  let firstRendered = false;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {sections.length === 0 && (
        <p className="px-5 py-4 text-sm italic text-base-content/50">Nothing to show</p>
      )}
      {sections.map((section) => (
        <section key={section.key} aria-label={section.title}>
          <PrListSectionHeader title={section.title} count={section.rows.length} />
          {section.rows.map((pr, i) => {
            const isFirst = !firstRendered && i === 0;
            if (isFirst) firstRendered = true;
            return (
              <PRItem
                key={pr.id}
                pr={pr}
                isNew={false}
                isFirst={isFirst}
                canApprove={Boolean(section.canApprove)}
                onToggleHidden={hide}
              />
            );
          })}
        </section>
      ))}
      {showHidden && (
        <HiddenPrSection
          prs={openHidden}
          canApprove
          onShow={unhide}
        />
      )}
    </div>
  );
};
