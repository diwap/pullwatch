import { describe, expect, it } from 'vitest';
import { getPrMenuActions, resolveMergeMethod } from '../pr-menu-actions';
import type { PrDetails } from '../types';

const details = (partial: Partial<PrDetails> = {}): PrDetails => ({
  url: 'https://github.com/o/r/pull/1',
  nodeId: 'PR_1',
  state: 'OPEN',
  isDraft: false,
  checkState: 'SUCCESS',
  mergeStateStatus: 'CLEAN',
  mergeable: true,
  reviewDecision: 'APPROVED',
  viewerCanMergeAsAdmin: false,
  viewerCanUpdateBranch: false,
  viewerCanEnableAutoMerge: false,
  viewerCanDisableAutoMerge: false,
  autoMergeEnabled: false,
  viewerDefaultMergeMethod: 'SQUASH',
  mergeCommitAllowed: true,
  squashMergeAllowed: true,
  rebaseMergeAllowed: false,
  viewerCanClose: true,
  labels: [],
  ...partial,
});

describe('getPrMenuActions', () => {
  it('always includes hide/show', () => {
    expect(
      getPrMenuActions(null, { isHidden: false, canApprove: false, hasToken: false }).map(
        (a) => a.id
      )
    ).toEqual(['hide']);
    expect(
      getPrMenuActions(null, { isHidden: true, canApprove: false, hasToken: true }).map((a) => a.id)
    ).toEqual(['show']);
  });

  it('shows merge when clean and bypass when blocked with admin', () => {
    expect(
      getPrMenuActions(details(), {
        isHidden: false,
        canApprove: false,
        hasToken: true,
      }).map((a) => a.id)
    ).toContain('merge');

    expect(
      getPrMenuActions(details({ mergeStateStatus: 'BLOCKED', viewerCanMergeAsAdmin: true }), {
        isHidden: false,
        canApprove: false,
        hasToken: true,
      }).map((a) => a.id)
    ).toEqual(expect.arrayContaining(['bypassMerge', 'close']));
  });

  it('shows update branch and approve when allowed', () => {
    const ids = getPrMenuActions(
      details({ mergeStateStatus: 'BEHIND', viewerCanUpdateBranch: true }),
      { isHidden: false, canApprove: true, hasToken: true }
    ).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['approve', 'updateBranch']));
  });

  it('treats UNKNOWN + mergeable as merge-ready and still offers close', () => {
    const ids = getPrMenuActions(
      details({ mergeStateStatus: 'UNKNOWN', mergeable: true }),
      { isHidden: false, canApprove: false, hasToken: true }
    ).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['merge', 'close']));
  });
});

describe('resolveMergeMethod', () => {
  it('prefers viewer default when allowed', () => {
    expect(resolveMergeMethod(details({ viewerDefaultMergeMethod: 'SQUASH' }))).toBe('squash');
    expect(
      resolveMergeMethod(
        details({ viewerDefaultMergeMethod: 'REBASE', rebaseMergeAllowed: true })
      )
    ).toBe('rebase');
  });
});
