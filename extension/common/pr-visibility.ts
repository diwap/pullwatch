import type { InboxDateRange, PullRequest } from './types';

/** Stored value that means "do not filter by organization". */
export const ALL_ORGS_FILTER = '';

/**
 * Empty, whitespace, and the literal "all" all mean every organization.
 * Any other value is the GitHub org login, trimmed but not case-folded.
 */
export function normalizedOrgFilter(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return ALL_ORGS_FILTER;
  return trimmed;
}

export function normalizedDateRange(value: string | null | undefined): InboxDateRange {
  if (value === '7d' || value === '30d' || value === '1y' || value === 'all') return value;
  return 'all';
}

/** Owner segment of `owner/repo`. A name without a slash is treated as the owner. */
export function prOrg(pr: Pick<PullRequest, 'repoName'>): string {
  const name = pr.repoName ?? '';
  const slash = name.indexOf('/');
  return (slash === -1 ? name : name.slice(0, slash)).trim();
}

export function prMatchesOrg(
  pr: Pick<PullRequest, 'repoName'>,
  orgFilter: string | null | undefined
): boolean {
  const org = normalizedOrgFilter(orgFilter);
  if (!org) return true;
  return prOrg(pr).toLowerCase() === org.toLowerCase();
}

const DATE_RANGE_MS: Record<Exclude<InboxDateRange, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
};

/** Uses `createdAt`. Missing/invalid dates pass so incomplete rows are not dropped. */
export function prWithinDateRange(
  pr: Pick<PullRequest, 'createdAt'>,
  range: InboxDateRange | null | undefined,
  now: number = Date.now()
): boolean {
  const normalized = normalizedDateRange(range ?? 'all');
  if (normalized === 'all') return true;
  if (!pr.createdAt) return true;
  const created = Date.parse(pr.createdAt);
  if (Number.isNaN(created)) return true;
  return created >= now - DATE_RANGE_MS[normalized];
}

export function hiddenPrIdSet(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0));
}

export function partitionByHidden<T extends { id: string }>(
  items: T[],
  hiddenIds: ReadonlySet<string>
): { visible: T[]; hidden: T[] } {
  const visible: T[] = [];
  const hidden: T[] = [];
  for (const item of items) {
    (hiddenIds.has(item.id) ? hidden : visible).push(item);
  }
  return { visible, hidden };
}

export interface InboxVisibilityOptions {
  orgFilter?: string | null;
  dateRange?: InboxDateRange | null;
  hiddenIds?: ReadonlySet<string>;
  /** When false, apply date range (default). Today tab passes true. */
  skipDateRange?: boolean;
}

/** PRs that pass org, date, and hidden-id filters. */
export function filterToVisibleInbox<T extends Pick<PullRequest, 'id' | 'repoName' | 'createdAt'>>(
  prs: T[],
  orgFilterOrOptions: string | null | undefined | InboxVisibilityOptions,
  hiddenIds?: ReadonlySet<string>
): T[] {
  const options: InboxVisibilityOptions =
    typeof orgFilterOrOptions === 'object' && orgFilterOrOptions !== null
      ? orgFilterOrOptions
      : { orgFilter: orgFilterOrOptions, hiddenIds };

  const hidden = options.hiddenIds ?? hiddenIds ?? new Set<string>();
  const skipDate = options.skipDateRange === true;

  return prs.filter((pr) => {
    if (hidden.has(pr.id)) return false;
    if (!prMatchesOrg(pr, options.orgFilter)) return false;
    if (!skipDate && !prWithinDateRange(pr, options.dateRange)) return false;
    return true;
  });
}

/**
 * Toolbar count: pending assigned PRs the inbox would actually show.
 * Drafts follow the same rule as `filterPendingAssignedByDraftSetting`.
 */
export function countVisiblePendingAssigned(
  prs: PullRequest[],
  showDraftsInList: boolean,
  orgFilter: string | null | undefined,
  hiddenIds: ReadonlySet<string>,
  dateRange: InboxDateRange | null | undefined = 'all'
): number {
  return prs.filter((pr) => {
    if (pr.reviewStatus === 'reviewed') return false;
    if (!showDraftsInList && pr.type === 'draft') return false;
    if (hiddenIds.has(pr.id)) return false;
    if (!prMatchesOrg(pr, orgFilter)) return false;
    if (!prWithinDateRange(pr, dateRange)) return false;
    return true;
  }).length;
}

/**
 * Toolbar badge: unique visible Today rows (org + hidden, no date filter) plus any
 * remaining visible pending To Review items. Matches the Today tab when that list is
 * the active inbox; still shows classic review count when Today is empty.
 */
export function countVisibleInboxBadge(
  todayPrs: PullRequest[],
  assignedPrs: PullRequest[],
  showDraftsInList: boolean,
  orgFilter: string | null | undefined,
  hiddenIds: ReadonlySet<string>,
  dateRange: InboxDateRange | null | undefined = 'all'
): number {
  const ids = new Set<string>();
  for (const pr of filterToVisibleInbox(todayPrs, {
    orgFilter,
    hiddenIds,
    skipDateRange: true,
  })) {
    if (pr.id) ids.add(pr.id);
  }
  for (const pr of assignedPrs) {
    if (pr.reviewStatus === 'reviewed') continue;
    if (!showDraftsInList && pr.type === 'draft') continue;
    if (hiddenIds.has(pr.id)) continue;
    if (!prMatchesOrg(pr, orgFilter)) continue;
    if (!prWithinDateRange(pr, dateRange)) continue;
    if (pr.id) ids.add(pr.id);
  }
  return ids.size;
}

/** Unique org logins from loaded pull requests, for the settings picker. */
export function collectOrgNames(prs: Pick<PullRequest, 'repoName'>[]): string[] {
  const names = new Set<string>();
  for (const pr of prs) {
    const org = prOrg(pr);
    if (!org || org === 'Unknown Repo') continue;
    names.add(org);
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
