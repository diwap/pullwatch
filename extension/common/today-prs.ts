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

const REASON_RANK: Record<TodayReason, number> = { mine: 0, review: 1, mentioned: 2 };

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
    if (!pr.url) return;
    const next: TodayPullRequest = { ...pr, todayReason: reason, id: pr.id || pr.url };
    const existing = byUrl.get(next.url);
    if (!existing || REASON_RANK[reason] < REASON_RANK[existing.todayReason]) {
      byUrl.set(next.url, next);
    }
  };

  for (const pr of authored) {
    if (pr.timestampParseFailed) continue;
    const createdIso =
      pr.eventAtKind === 'created' && pr.eventAt ? pr.eventAt : pr.createdAt;
    if (isLocalCalendarDay(createdIso, now)) upsert(pr, 'mine');
  }

  for (const pr of assigned) {
    // Match To Review: only pending personal review requests, not already-reviewed rows.
    if (pr.reviewStatus === 'reviewed') continue;
    if (pr.timestampParseFailed) continue;
    if (
      isLocalCalendarDay(pr.createdAt, now) ||
      isLocalCalendarDay(pr.updatedAt, now) ||
      isLocalCalendarDay(pr.eventAt, now)
    ) {
      upsert(pr, 'review');
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
  const next: TodayPullRequest = { ...pr, todayReason: reason, id: pr.id || pr.url };
  const existing = byUrl.get(next.url);
  if (!existing || REASON_RANK[reason] < REASON_RANK[existing.todayReason]) {
    byUrl.set(next.url, next);
  }
}

export function sortTodayPrs(prs: TodayPullRequest[]): TodayPullRequest[] {
  return [...prs].sort((a, b) => {
    const at = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    const bt = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    return at - bt;
  });
}
