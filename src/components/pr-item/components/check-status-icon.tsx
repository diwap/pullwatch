import clsx from 'clsx';
import type { CheckRollupState } from '@common/types';

interface CheckStatusIconProps {
  state: CheckRollupState | undefined;
  className?: string;
}

export const CheckStatusIcon = ({ state, className }: CheckStatusIconProps) => {
  if (!state) return null;

  if (state === 'SUCCESS') {
    return (
      <span
        className={clsx('inline-flex size-3.5 shrink-0 items-center justify-center', className)}
        title="Checks passed"
        aria-label="Checks passed"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" className="text-success">
          <path
            fill="currentColor"
            d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.5 5.5-4.2 4.3-1.8-1.8-.7.7 2.5 2.5 4.9-5-.7-.7Z"
          />
        </svg>
      </span>
    );
  }

  if (state === 'FAILURE' || state === 'ERROR') {
    return (
      <span
        className={clsx('inline-flex size-3.5 shrink-0 items-center justify-center', className)}
        title="Checks failed"
        aria-label="Checks failed"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" className="text-error">
          <path
            fill="currentColor"
            d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm2.5 4.5-.7-.7L8 7.3 6.2 5.5l-.7.7L7.3 8l-1.8 1.8.7.7L8 8.7l1.8 1.8.7-.7L8.7 8l1.8-1.8Z"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={clsx('inline-flex size-3.5 shrink-0 items-center justify-center', className)}
      title="Checks pending"
      aria-label="Checks pending"
    >
      <span className="size-2.5 rounded-full bg-warning" />
    </span>
  );
};
