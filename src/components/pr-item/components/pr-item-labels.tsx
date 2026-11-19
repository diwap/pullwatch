import type { PrLabel } from '@common/types';
import {
  labelForeground,
  normalizeLabelColor,
  normalizePrLabels,
  visiblePrLabels,
} from '@common/pr-labels';
import clsx from 'clsx';

interface PrItemLabelsProps {
  labels: Array<PrLabel | string> | undefined;
  isReviewed?: boolean;
}

export const PrItemLabels = ({ labels, isReviewed = false }: PrItemLabelsProps) => {
  const normalized = normalizePrLabels(labels);
  if (normalized.length === 0) return null;

  const { shown, overflow } = visiblePrLabels(normalized);

  return (
    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((label) => {
        const bg = normalizeLabelColor(label.color);
        return (
          <span
            key={label.name}
            title={label.name}
            className={clsx(
              'inline-flex max-w-full truncate rounded-full border px-1.5 py-px text-[10px] font-medium leading-4',
              !bg &&
                (isReviewed
                  ? 'border-base-content/15 bg-base-300/70 text-base-content/55'
                  : 'border-base-content/20 bg-base-200 text-base-content/75')
            )}
            style={
              bg
                ? {
                    backgroundColor: bg,
                    color: labelForeground(bg),
                    borderColor: 'transparent',
                    opacity: isReviewed ? 0.75 : 1,
                  }
                : undefined
            }
          >
            {label.name}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className={clsx(
            'text-[10px] font-medium',
            isReviewed ? 'text-base-content/40' : 'text-base-content/50'
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};
