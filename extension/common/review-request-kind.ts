import type { PullRequest, ReviewRequestKind, TodayReason } from './types';

/** Normalize to lowercase `org/slug`. */
export function normalizeTeamSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  if (!slug || !slug.includes('/')) return null;
  return slug;
}

/** True when this row came from a team membership review request. */
export function isTeamReviewRequest(
  pr: Pick<PullRequest, 'reviewRequestKind' | 'todayReason'>
): boolean {
  return pr.reviewRequestKind === 'team' || pr.todayReason === 'team';
}

/**
 * When team reviews are off, drop team-only rows.
 * When an allowlist is set (`teamReviewSlugs` non-empty), keep only matching teams.
 * Empty allowlist = all teams. Rows with unknown teams stay visible until enriched.
 */
export function filterByTeamReviewPreference<
  T extends Pick<PullRequest, 'reviewRequestKind' | 'todayReason' | 'requestedTeams'>,
>(prs: T[], includeTeamReviews: boolean, teamReviewSlugs: readonly string[] = []): T[] {
  const allow = teamReviewSlugs
    .map((slug) => normalizeTeamSlug(slug))
    .filter((slug): slug is string => Boolean(slug));
  const allowSet = new Set(allow);

  return prs.filter((pr) => {
    if (!isTeamReviewRequest(pr)) return true;
    if (!includeTeamReviews) return false;
    if (allowSet.size === 0) return true;
    const teams = (pr.requestedTeams ?? [])
      .map((slug) => normalizeTeamSlug(slug))
      .filter((slug): slug is string => Boolean(slug));
    if (teams.length === 0) return true;
    return teams.some((slug) => allowSet.has(slug));
  });
}

export function tagReviewRequestKind(
  prs: PullRequest[],
  kind: ReviewRequestKind
): PullRequest[] {
  return prs.map((pr) => ({ ...pr, reviewRequestKind: kind }));
}

/** Map Today reason ↔ review request kind for review-ish rows. */
export function todayReasonForReviewKind(kind: ReviewRequestKind): TodayReason {
  return kind === 'team' ? 'team' : 'review';
}

/** Collect unique `org/slug` values from loaded PRs (for settings fallback). */
export function collectRequestedTeamSlugs(
  prs: Pick<PullRequest, 'requestedTeams'>[]
): string[] {
  const names = new Set<string>();
  for (const pr of prs) {
    for (const raw of pr.requestedTeams ?? []) {
      const slug = normalizeTeamSlug(raw);
      if (slug) names.add(slug);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
