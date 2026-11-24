import type { PullRequest, TodayPullRequest, TodayReason } from './types';

/** Local calendar YYYY-MM-DD for GraphQL `created:>=` / `updated:>=` search. */
export function localDateYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True when `iso` falls on the viewer's local calendar day. */
export function isLocalCalendarDay(iso: string | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const REASON_RANK: Record<TodayReason, number> = {
  mine: 0,
  review: 1,
  team: 2,
  mentioned: 3,
};

/** Today is an open-PR inbox — merged (and non-open) rows never belong there. */
export function isOpenTodayCandidate(pr: Pick<PullRequest, 'type'>): boolean {
  return pr.type === 'open' || pr.type === 'draft';
}

/**
 * Seeds Today from session-scraped Authored / To Review lists.
 * Skips rows whose scrape timestamp failed (createdAt often falls back to "now").
 */
export function seedTodayFromScrapedLists(
  authored: PullRequest[],
  assigned: PullRequest[],
  now = new Date()
): TodayPullRequest[] {
  const byUrl = new Map<string, TodayPullRequest>();

  const upsert = (pr: PullRequest, reason: TodayReason) => {
    upsertTodayPr(byUrl, pr, reason);
  };

  for (const pr of authored) {
    if (pr.timestampParseFailed) continue;
    const createdIso =
      pr.eventAtKind === 'created' && pr.eventAt ? pr.eventAt : pr.createdAt;
    if (isLocalCalendarDay(createdIso, now)) upsert(pr, 'mine');
  }

  for (const pr of assigned) {
    // Match To Review: only pending review requests, not already-reviewed rows.
    if (pr.reviewStatus === 'reviewed') continue;
    if (pr.timestampParseFailed) continue;
    if (
      isLocalCalendarDay(pr.createdAt, now) ||
      isLocalCalendarDay(pr.updatedAt, now) ||
      isLocalCalendarDay(pr.eventAt, now)
    ) {
      const reason: TodayReason = pr.reviewRequestKind === 'team' ? 'team' : 'review';
      upsert(
        {
          ...pr,
          reviewRequestKind: pr.reviewRequestKind ?? (reason === 'team' ? 'team' : 'direct'),
        },
        reason
      );
    }
  }

  return [...byUrl.values()];
}

/** Merge API search hits into an existing Today map (mine > review > mentioned). */
export function upsertTodayPr(
  byUrl: Map<string, TodayPullRequest>,
  pr: PullRequest,
  reason: TodayReason
): void {
  if (!pr.url) return;
  // Drop merged/closed hits and clear any stale open row for the same URL.
  if (!isOpenTodayCandidate(pr)) {
    byUrl.delete(pr.url);
    return;
  }
  const next: TodayPullRequest = { ...pr, todayReason: reason, id: pr.id || pr.url };
  const existing = byUrl.get(next.url);
  if (!existing || REASON_RANK[reason] < REASON_RANK[existing.todayReason]) {
    byUrl.set(next.url, next);
  }
}

/** Remove Today rows that appear in the Merged list (or are already typed merged). */
export function pruneMergedFromToday(
  today: TodayPullRequest[],
  merged: PullRequest[]
): TodayPullRequest[] {
  const mergedIds = new Set(
    merged.flatMap((pr) => [pr.id, pr.url].filter((value): value is string => Boolean(value)))
  );
  return today.filter(
    (pr) => isOpenTodayCandidate(pr) && !mergedIds.has(pr.id) && !mergedIds.has(pr.url)
  );
}

export function sortTodayPrs(prs: TodayPullRequest[]): TodayPullRequest[] {
  return [...prs].sort((a, b) => {
    const at = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    const bt = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    return at - bt;
  });
}
