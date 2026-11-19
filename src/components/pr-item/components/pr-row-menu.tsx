import { useEffect, useRef, useState } from 'react';
import { getPrMenuActions, type PrMenuActionId } from '@common/pr-menu-actions';
import type { PrDetails } from '@common/types';
import { chromeExtensionService } from '@common/chrome-extension-service';
import { useInboxPreferences } from '@src/hooks/inbox-preferences';

interface PrRowMenuProps {
  prId: string;
  url: string;
  details: PrDetails | null;
  isHidden: boolean;
  canApprove: boolean;
  onToggleHidden: (prId: string) => void;
}

export const PrRowMenu = ({
  prId,
  url,
  details,
  isHidden,
  canApprove,
  onToggleHidden,
}: PrRowMenuProps) => {
  const { hasToken } = useInboxPreferences();
  const [open, setOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PrMenuActionId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const actions = getPrMenuActions(details, { isHidden, canApprove, hasToken });

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setPendingConfirm(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const runAction = async (id: PrMenuActionId) => {
    if (id === 'hide' || id === 'show') {
      onToggleHidden(prId);
      setOpen(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const client = chromeExtensionService.prActions;
      switch (id) {
        case 'approve':
          await client.approve(url);
          break;
        case 'updateBranch':
          await client.updateBranch(url);
          break;
        case 'merge':
          await client.merge(url);
          break;
        case 'bypassMerge':
          await client.bypassMerge(url);
          break;
        case 'enableAutoMerge':
          await client.enableAutoMerge(url);
          break;
        case 'disableAutoMerge':
          await client.disableAutoMerge(url);
          break;
        case 'close':
          await client.close(url);
          break;
      }
      setOpen(false);
      setPendingConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="btn btn-ghost btn-xs px-1 min-h-0 h-6 text-base-content/50 hover:text-base-content"
        aria-label="Pull request actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
          setPendingConfirm(null);
          setError(null);
        }}
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-base-300 bg-base-100 py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {!hasToken && (
            <p className="px-3 py-2 text-[11px] text-base-content/50">
              Add a GitHub token in Settings for approve, merge, and status.
            </p>
          )}
          {actions.map((action) => {
            const confirming = pendingConfirm === action.id;
            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                disabled={busy}
                className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-base-200 disabled:opacity-50 ${
                  action.tone === 'danger'
                    ? 'text-error'
                    : action.tone === 'warning'
                      ? 'text-warning'
                      : 'text-base-content'
                }`}
                onClick={() => {
                  if (action.needsConfirm && !confirming) {
                    setPendingConfirm(action.id);
                    return;
                  }
                  void runAction(action.id);
                }}
              >
                {confirming ? `Confirm ${action.label.toLowerCase()}?` : action.label}
              </button>
            );
          })}
          {error && <p className="px-3 py-2 text-[11px] text-error">{error}</p>}
        </div>
      )}
    </div>
  );
};
