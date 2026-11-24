import { describe, expect, it } from 'vitest';
import type { PullRequest } from '../types';
import {
  collectOrgNames,
  countVisibleInboxBadge,
  countVisiblePendingAssigned,
  filterToVisibleInbox,
  normalizedDateRange,
  normalizedOrgFilter,
  partitionByHidden,
  prMatchesOrg,
  prWithinDateRange,
} from '../pr-visibility';

const pr = (partial: Partial<PullRequest> & Pick<PullRequest, 'id' | 'repoName'>): PullRequest => ({
  url: `https://github.com/${partial.repoName}/pull/1`,
  title: partial.id,
  number: 1,
  author: [{ login: 'dev' }],
  type: 'open',
  reviewStatus: 'pending',
  ...partial,
});

describe('pr visibility', () => {
  it('treats blank and "all" as every organization', () => {
    expect(normalizedOrgFilter('')).toBe('');
    expect(normalizedOrgFilter('  All ')).toBe('');
    expect(normalizedOrgFilter('AcmeCorp')).toBe('AcmeCorp');
  });

  it('normalizes date ranges', () => {
    expect(normalizedDateRange('7d')).toBe('7d');
    expect(normalizedDateRange('nope')).toBe('all');
  });

  it('matches the owner segment case-insensitively', () => {
    const acme = pr({ id: '1', repoName: 'AcmeCorp/ivy-config' });
    const other = pr({ id: '2', repoName: 'widgets/web' });
    expect(prMatchesOrg(acme, 'acmecorp')).toBe(true);
    expect(prMatchesOrg(other, 'AcmeCorp')).toBe(false);
    expect(prMatchesOrg(other, '')).toBe(true);
  });

  it('filters by createdAt for date ranges', () => {
    const now = Date.parse('2026-11-19T12:00:00.000Z');
    const recent = pr({
      id: 'recent',
      repoName: 'AcmeCorp/web',
      createdAt: '2026-11-10T12:00:00.000Z',
    });
    const old = pr({
      id: 'old',
      repoName: 'AcmeCorp/web',
      createdAt: '2025-01-01T12:00:00.000Z',
    });
    expect(prWithinDateRange(recent, '30d', now)).toBe(true);
    expect(prWithinDateRange(old, '30d', now)).toBe(false);
    expect(prWithinDateRange(old, 'all', now)).toBe(true);
    expect(prWithinDateRange({ createdAt: undefined }, '7d', now)).toBe(true);
  });

  it('hides other orgs, hidden ids, and out-of-range rows', () => {
    const now = Date.parse('2026-11-19T12:00:00.000Z');
    const prs = [
      pr({
        id: 'keep',
        repoName: 'AcmeCorp/web',
        createdAt: '2026-11-10T12:00:00.000Z',
      }),
      pr({
        id: 'hidden',
        repoName: 'AcmeCorp/api',
        createdAt: '2026-11-10T12:00:00.000Z',
      }),
      pr({
        id: 'other',
        repoName: 'widgets/web',
        createdAt: '2026-11-10T12:00:00.000Z',
      }),
      pr({
        id: 'old',
        repoName: 'AcmeCorp/web',
        createdAt: '2024-01-01T12:00:00.000Z',
      }),
    ];
    const hidden = new Set(['hidden']);

    expect(
      filterToVisibleInbox(prs, {
        orgFilter: 'AcmeCorp',
        dateRange: '30d',
        hiddenIds: hidden,
      }).map((item) => item.id)
    ).toEqual(['keep']);

    void now;
    expect(countVisiblePendingAssigned(prs, true, 'AcmeCorp', hidden, 'all')).toBe(2);
    expect(
      partitionByHidden(filterToVisibleInbox(prs, 'AcmeCorp', new Set()), hidden).hidden
    ).toEqual([prs[1]]);
  });

  it('counts toolbar badge from Today ∪ pending To Review without double-counting', () => {
    const today = [
      pr({ id: 'today-1', repoName: 'AcmeCorp/web', reviewStatus: 'pending' }),
      pr({ id: 'shared', repoName: 'AcmeCorp/web', reviewStatus: 'pending' }),
      pr({ id: 'merged-today', repoName: 'AcmeCorp/web', type: 'merged' }),
    ];
    const assigned = [
      pr({ id: 'shared', repoName: 'AcmeCorp/web', reviewStatus: 'pending' }),
      pr({ id: 'old-review', repoName: 'AcmeCorp/web', reviewStatus: 'pending' }),
      pr({ id: 'other-org', repoName: 'widgets/web', reviewStatus: 'pending' }),
    ];
    expect(countVisibleInboxBadge(today, assigned, true, 'AcmeCorp', new Set(), 'all')).toBe(3);
  });

  it('collects org names for the settings picker', () => {
    expect(
      collectOrgNames([
        pr({ id: '1', repoName: 'AcmeCorp/web' }),
        pr({ id: '2', repoName: 'widgets/web' }),
        pr({ id: '3', repoName: 'AcmeCorp/api' }),
        pr({ id: '4', repoName: 'Unknown Repo' }),
      ])
    ).toEqual(['AcmeCorp', 'widgets']);
  });
});
