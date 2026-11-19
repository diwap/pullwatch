import { animated } from '@react-spring/web';
import clsx from 'clsx';
import { useCallback, useState } from 'react';
import { PrItemFooterRow } from './components/pr-item-footer-row';
import { PrItemHeaderRow } from './components/pr-item-header-row';
import { PrItemLabels } from './components/pr-item-labels';
import { PrItemRepoRow } from './components/pr-item-repo-row';
import { PrRowMenu } from './components/pr-row-menu';
import type { PRItemProps } from './types';
import { usePrEntranceSpring } from './hooks/use-pr-entrance-spring';
import { usePrLinkClick } from './hooks/use-pr-link-click';
import { usePrDetails } from '@src/hooks/use-pr-details';

export function PrItemShell({
  pr,
  isNew,
  isFirst = false,
  isReviewed = false,
  showAuthorStatus = false,
  onPrLinkActivated,
  onToggleHidden,
  isHidden = false,
  canApprove = false,
}: PRItemProps) {
  const handleClick = usePrLinkClick({
    url: pr.url,
    prId: pr.id,
    onPrLinkActivated,
  });
  const slideSpring = usePrEntranceSpring(isNew);
  const details = usePrDetails(pr.url);
  const [titleTooltipStackLift, setTitleTooltipStackLift] = useState(false);
  const handleTitleTooltipStackLiftChange = useCallback((lifted: boolean) => {
    setTitleTooltipStackLift(lifted);
  }, []);

  return (
    <animated.div
      style={isNew && !isReviewed ? slideSpring : {}}
      data-pr-id={pr.id}
      className={clsx(
        'group flex items-start gap-2 px-5 py-2 transition-[color,background-color,border-color,opacity,box-shadow] duration-200 relative isolate border-b border-base-200',
        titleTooltipStackLift ? 'z-10' : 'hover:z-10',
        isReviewed
          ? 'bg-base-200 text-base-content/70 opacity-90 border-l-2 hover:opacity-100'
          : 'bg-base-100 text-base-content border-l-2 hover:bg-base-200'
      )}
    >
      <a
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block min-w-0 flex-1 cursor-pointer"
      >
        <PrItemHeaderRow
          prType={pr.type}
          title={pr.title}
          isFirst={isFirst}
          isReviewed={isReviewed}
          showAuthorStatus={showAuthorStatus}
          authorReviewStatus={pr.authorReviewStatus}
          checkState={details?.checkState}
          reviewDecision={details?.reviewDecision}
          todayReason={pr.todayReason}
          onTruncatedTitleStackLiftChange={handleTitleTooltipStackLiftChange}
        />
        <PrItemRepoRow repoName={pr.repoName} number={pr.number} isReviewed={isReviewed} />
        <PrItemLabels labels={details?.labels?.length ? details.labels : pr.labels} isReviewed={isReviewed} />
        <PrItemFooterRow
          authors={pr.author}
          createdAt={pr.createdAt || ''}
          isReviewed={isReviewed}
          isFirst={isFirst}
        />
      </a>
      {onToggleHidden && (
        <PrRowMenu
          prId={pr.id}
          url={pr.url}
          details={details}
          isHidden={isHidden}
          canApprove={canApprove}
          onToggleHidden={onToggleHidden}
        />
      )}
    </animated.div>
  );
}
