import { describe, expect, it } from 'vitest';
import type { PullRequest } from '../types';
import {
  isLocalCalendarDay,
  localDateYmd,
  seedTodayFromScrapedLists,
  upsertTodayPr,
} from '../today-prs';

function pr(partial: Partial<PullRequest> & Pick<PullRequest, 'url'>): PullRequest {
  return {
    id: partial.url,
    title: 't',
    number: 1,
    repoName: 'AcmeCorp/widgets',
    author: [{ login: 'diwap' }],
    type: 'open',
    reviewStatus: 'pending',
    ...partial,
  };
}

/** Build an ISO string that is definitely that local calendar day at noon. */
function localNoonIso(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day, 12, 0, 0).toISOString();
}

describe('localDateYmd / isLocalCalendarDay', () => {
  it('formats local YMD', () => {
    expect(localDateYmd(new Date(2026, 10, 19, 15, 0, 0))).toBe('2026-11-19');
  });

  it('matches the viewer local calendar day', () => {
    const now = new Date(2026, 10, 19, 18, 0, 0);
    expect(isLocalCalendarDay(localNoonIso(2026, 10, 19), now)).toBe(true);
    expect(isLocalCalendarDay(localNoonIso(2026, 10, 18), now)).toBe(false);
    expect(isLocalCalendarDay(undefined, now)).toBe(false);
  });
});

describe('seedTodayFromScrapedLists', () => {
  const now = new Date(2026, 10, 19, 18, 0, 0);
  const today = localNoonIso(2026, 10, 19);
  const yesterday = localNoonIso(2026, 10, 18);

  it('includes authored PRs created today and skips parse failures', () => {
    const authored = [
      pr({
        url: 'https://github.com/AcmeCorp/widgets/pull/1',
        createdAt: today,
        eventAt: today,
        eventAtKind: 'created',
      }),
      pr({
        url: 'https://github.com/AcmeCorp/widgets/pull/2',
        createdAt: yesterday,
      }),
      pr({
        url: 'https://github.com/AcmeCorp/widgets/pull/3',
        createdAt: today,
        timestampParseFailed: true,
      }),
    ];

    const seeded = seedTodayFromScrapedLists(authored, [], now);
    expect(seeded.map((p) => p.url)).toEqual([
      'https://github.com/AcmeCorp/widgets/pull/1',
    ]);
    expect(seeded[0]?.todayReason).toBe('mine');
  });

  it('includes pending assigned PRs touched today as review', () => {
    const assigned = [
      pr({
        url: 'https://github.com/AcmeCorp/widgets/pull/9',
        createdAt: localNoonIso(2026, 10, 1),
        updatedAt: today,
        reviewStatus: 'pending',
      }),
      pr({
        url: 'https://github.com/AcmeCorp/widgets/pull/10',
        createdAt: localNoonIso(2026, 10, 1),
        updatedAt: today,
        reviewStatus: 'reviewed',
      }),
    ];
    const seeded = seedTodayFromScrapedLists([], assigned, now);
    expect(seeded).toHaveLength(1);
    expect(seeded[0]?.url).toBe('https://github.com/AcmeCorp/widgets/pull/9');
    expect(seeded[0]?.todayReason).toBe('review');
  });

  it('prefers mine over review when the same URL appears in both lists', () => {
    const url = 'https://github.com/AcmeCorp/widgets/pull/5';
    const row = pr({
      url,
      createdAt: today,
      eventAt: today,
      eventAtKind: 'created',
    });
    const seeded = seedTodayFromScrapedLists([row], [row], now);
    expect(seeded).toHaveLength(1);
    expect(seeded[0]?.todayReason).toBe('mine');
  });
});

describe('upsertTodayPr', () => {
  it('upgrades mentioned → review → mine', () => {
    const byUrl = new Map();
    const url = 'https://github.com/AcmeCorp/widgets/pull/7';
    upsertTodayPr(byUrl, pr({ url }), 'mentioned');
    upsertTodayPr(byUrl, pr({ url }), 'review');
    expect(byUrl.get(url)?.todayReason).toBe('review');
    upsertTodayPr(byUrl, pr({ url }), 'mine');
    expect(byUrl.get(url)?.todayReason).toBe('mine');
  });
});
