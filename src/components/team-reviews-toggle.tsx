import clsx from 'clsx';
import { useInboxPreferences } from '@src/hooks/inbox-preferences';

interface TeamReviewsToggleProps {
  /** Called after the preference is saved so the caller can refresh lists. */
  onEnabled?: () => void;
}

/**
 * Popup header control (left of refresh): personal-only vs personal + team review requests.
 */
export const TeamReviewsToggle = ({ onEnabled }: TeamReviewsToggleProps) => {
  const { includeTeamReviews, setIncludeTeamReviews } = useInboxPreferences();

  return (
    <button
      type="button"
      aria-pressed={includeTeamReviews}
      title={
        includeTeamReviews
          ? 'Showing personal and team review requests — click for personal only'
          : 'Showing personal review requests only — click to include teams you are on'
      }
      className={clsx(
        'btn btn-ghost btn-xs h-7 min-h-0 px-2 text-[10px] font-semibold uppercase tracking-wide',
        includeTeamReviews
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'text-base-content/55 hover:text-base-content'
      )}
      onClick={() => {
        const next = !includeTeamReviews;
        void (async () => {
          await setIncludeTeamReviews(next);
          if (next) onEnabled?.();
        })();
      }}
    >
      Teams
    </button>
  );
};
