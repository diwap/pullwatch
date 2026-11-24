import type { PrDetails } from './types';

export type PrMenuActionId =
  | 'hide'
  | 'show'
  | 'approve'
  | 'updateBranch'
  | 'merge'
  | 'bypassMerge'
  | 'enableAutoMerge'
  | 'disableAutoMerge'
  | 'close';

export interface PrMenuAction {
  id: PrMenuActionId;
  label: string;
  /** Destructive / warning styling in the menu. */
  tone?: 'default' | 'warning' | 'danger';
  needsConfirm?: boolean;
}

export interface PrMenuContext {
  isHidden: boolean;
  /** To Review tab rows may approve. */
  canApprove: boolean;
  /** Token is present; without it only hide/show remain. */
  hasToken: boolean;
}

/**
 * Pure menu visibility rules for the row three-dot menu.
 * Merge vs Bypass and merge are mutually exclusive.
 */
export function getPrMenuActions(
  details: PrDetails | null | undefined,
  context: PrMenuContext
): PrMenuAction[] {
  const actions: PrMenuAction[] = [
    context.isHidden
      ? { id: 'show', label: 'Show' }
      : { id: 'hide', label: 'Hide' },
  ];

  if (!context.hasToken || !details) return actions;
  if (details.state !== 'OPEN' || details.isDraft) return actions;

  // Approve after CI is green (or no checks configured). Independent of reviewDecision /
  // merge BLOCKED — those wait on approval; checks must not.
  if (context.canApprove && checksAllowApprove(details.checkState)) {
    actions.push({ id: 'approve', label: 'Approve' });
  }

  if (details.mergeStateStatus === 'BEHIND' && details.viewerCanUpdateBranch) {
    actions.push({ id: 'updateBranch', label: 'Update branch' });
  }

  const blocked =
    details.mergeStateStatus === 'BLOCKED' || details.mergeStateStatus === 'BEHIND';
  // UNKNOWN is common while GitHub computes mergeability; treat mergeable===true as ready.
  const mergeReady =
    details.mergeStateStatus === 'CLEAN' ||
    details.mergeStateStatus === 'HAS_HOOKS' ||
    details.mergeStateStatus === 'UNSTABLE' ||
    (details.mergeStateStatus === 'UNKNOWN' && details.mergeable === true);

  if (blocked && details.viewerCanMergeAsAdmin) {
    actions.push({
      id: 'bypassMerge',
      label: 'Bypass and merge',
      tone: 'warning',
      needsConfirm: true,
    });
  } else if (mergeReady) {
    actions.push({ id: 'merge', label: 'Merge', needsConfirm: true });
  }

  if (details.autoMergeEnabled && details.viewerCanDisableAutoMerge) {
    actions.push({ id: 'disableAutoMerge', label: 'Disable auto-merge' });
  } else if (!details.autoMergeEnabled && details.viewerCanEnableAutoMerge) {
    actions.push({ id: 'enableAutoMerge', label: 'Enable auto-merge' });
  }

  if (details.viewerCanClose) {
    actions.push({ id: 'close', label: 'Close', tone: 'danger', needsConfirm: true });
  }

  return actions;
}

/** True when CI is done successfully, or the PR has no status checks at all. */
export function checksAllowApprove(checkState: PrDetails['checkState']): boolean {
  return checkState === 'SUCCESS' || checkState == null;
}

export function resolveMergeMethod(details: PrDetails): 'merge' | 'squash' | 'rebase' {
  const preferred = details.viewerDefaultMergeMethod;
  if (preferred === 'SQUASH' && details.squashMergeAllowed) return 'squash';
  if (preferred === 'REBASE' && details.rebaseMergeAllowed) return 'rebase';
  if (preferred === 'MERGE' && details.mergeCommitAllowed) return 'merge';
  if (details.squashMergeAllowed) return 'squash';
  if (details.mergeCommitAllowed) return 'merge';
  if (details.rebaseMergeAllowed) return 'rebase';
  return 'squash';
}
