import type { IDebugService } from '../interfaces/IDebugService';
import type { IStorageService } from '../interfaces/IStorageService';
import type {
  GitHubTokenStatus,
  IGitHubApiService,
} from '../interfaces/IGitHubApiService';
import {
  STORAGE_KEY_ASSIGNED_PRS,
  STORAGE_KEY_AUTHORED_PRS,
  STORAGE_KEY_GITHUB_API_TOKEN,
  STORAGE_KEY_MERGED_PRS,
  STORAGE_KEY_PR_DETAILS,
  STORAGE_KEY_TODAY_PRS,
} from '@common/constants';
import { parsePrUrl } from '@common/pr-url';
import { resolveMergeMethod } from '@common/pr-menu-actions';
import { normalizePrLabels } from '@common/pr-labels';
import {
  localDateYmd,
  seedTodayFromScrapedLists,
  sortTodayPrs,
  upsertTodayPr,
} from '@common/today-prs';
import type {
  CheckRollupState,
  MergeMethod,
  PrDetails,
  PrDetailsMap,
  PullRequest,
  TodayPullRequest,
  TodayReason,
} from '@common/types';

const API = 'https://api.github.com';
const DETAILS_CHUNK = 40;

type GraphQlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

export class GitHubApiService implements IGitHubApiService {
  constructor(
    private readonly debugService: IDebugService,
    private readonly storageService: IStorageService
  ) {}

  async initialize(): Promise<void> {
    this.debugService.log('[GitHubApiService] initialized');
  }

  async dispose(): Promise<void> {
    this.debugService.log('[GitHubApiService] disposed');
  }

  async hasToken(): Promise<boolean> {
    const token = await this.readToken();
    return Boolean(token);
  }

  async getTokenStatus(): Promise<GitHubTokenStatus> {
    const token = await this.readToken();
    if (!token) return { configured: false, login: null };
    try {
      const user = await this.restJson<{ login: string }>('GET', '/user', undefined, token);
      return { configured: true, login: user.login };
    } catch {
      return { configured: true, login: null };
    }
  }

  async saveToken(token: string): Promise<GitHubTokenStatus> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error('Token is empty');
    const status = await this.testToken(trimmed);
    await this.storageService.set(STORAGE_KEY_GITHUB_API_TOKEN, trimmed);
    return status;
  }

  async clearToken(): Promise<void> {
    await this.storageService.remove(STORAGE_KEY_GITHUB_API_TOKEN);
  }

  async testToken(token?: string): Promise<GitHubTokenStatus> {
    const value = (token ?? (await this.readToken()) ?? '').trim();
    if (!value) throw new Error('No token configured');
    const user = await this.restJson<{ login: string }>('GET', '/user', undefined, value);
    return { configured: true, login: user.login };
  }

  async fetchPrDetails(urls: string[]): Promise<PrDetailsMap> {
    const unique = [...new Set(urls.filter(Boolean))];
    if (unique.length === 0) return {};
    if (!(await this.hasToken())) return {};

    const out: PrDetailsMap = {};
    for (let i = 0; i < unique.length; i += DETAILS_CHUNK) {
      const chunk = unique.slice(i, i + DETAILS_CHUNK);
      Object.assign(out, await this.fetchPrDetailsChunk(chunk));
    }
    return out;
  }

  async refreshPrDetail(url: string): Promise<PrDetails | null> {
    const map = await this.fetchPrDetails([url]);
    const detail = map[url] ?? null;
    if (detail) {
      const existing = (await this.storageService.get<PrDetailsMap>(STORAGE_KEY_PR_DETAILS)) ?? {};
      await this.storageService.set(STORAGE_KEY_PR_DETAILS, { ...existing, [url]: detail });
    }
    return detail;
  }

  async syncPrDetailsFromStoredLists(): Promise<PrDetailsMap> {
    if (!(await this.hasToken())) return {};
    const [assigned, authored, merged, today] = await Promise.all([
      this.storageService.getStoredPRs(STORAGE_KEY_ASSIGNED_PRS),
      this.storageService.getStoredPRs(STORAGE_KEY_AUTHORED_PRS),
      this.storageService.getStoredPRs(STORAGE_KEY_MERGED_PRS),
      this.storageService.getStoredPRs(STORAGE_KEY_TODAY_PRS),
    ]);

    const urls = [
      ...(assigned?.prs ?? []),
      ...(authored?.prs ?? []),
      ...(today?.prs ?? []),
    ]
      .filter((pr) => pr.type !== 'merged')
      .map((pr) => pr.url);

    // Merged list is historical; still enrich open authored/assigned/today.
    void merged;

    const details = await this.fetchPrDetails(urls);
    await this.storageService.set(STORAGE_KEY_PR_DETAILS, details);
    return details;
  }

  /**
   * Builds the Today tab from:
   * 1. Session-scraped Authored / To Review lists (works without a token)
   * 2. GraphQL search when a token is present (adds mentions + anything scrape missed)
   *
   * WHY [local seed first]: `GET /user` can succeed while org search returns [] if the token
   * is not SSO-authorized for a private org. The HTML scrape already sees those PRs.
   */
  async fetchTodayPrs(): Promise<TodayPullRequest[]> {
    const [authored, assigned] = await Promise.all([
      this.storageService.getStoredPRs(STORAGE_KEY_AUTHORED_PRS),
      this.storageService.getStoredPRs(STORAGE_KEY_ASSIGNED_PRS),
    ]);

    const byUrl = new Map<string, TodayPullRequest>();
    for (const pr of seedTodayFromScrapedLists(authored?.prs ?? [], assigned?.prs ?? [])) {
      byUrl.set(pr.url, pr);
    }

    if (await this.hasToken()) {
      const date = localDateYmd();
      // WHY [user-review-requested]: `review-requested:@me` also matches team requests for every
      // team you are on (noisy in large orgs). To Review scrape already uses user-review-requested.
      const queries: Array<{ q: string; reason: TodayReason }> = [
        { q: `is:pr author:@me created:>=${date}`, reason: 'mine' },
        { q: `is:pr user-review-requested:@me updated:>=${date}`, reason: 'review' },
        { q: `is:pr mentions:@me updated:>=${date}`, reason: 'mentioned' },
      ];

      for (const { q, reason } of queries) {
        try {
          const nodes = await this.searchPullRequests(q);
          for (const node of nodes) {
            const mapped = this.mapSearchNodeToPr(node, reason);
            if (mapped) upsertTodayPr(byUrl, mapped, reason);
          }
        } catch (error) {
          // Keep local seed; private-org search often fails when SSO is not authorized on the token.
          this.debugService.warn(`[GitHubApiService] Today search failed (${reason}):`, error);
        }
      }
    }

    const prs = sortTodayPrs([...byUrl.values()]);
    await this.storageService.setStoredPRs(STORAGE_KEY_TODAY_PRS, prs);
    this.debugService.log(`[GitHubApiService] Today list: ${prs.length} PR(s)`);
    return prs;
  }

  async approve(url: string): Promise<void> {
    const parsed = requireParsed(url);
    await this.restJson(
      'POST',
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/reviews`,
      { event: 'APPROVE' }
    );
  }

  async updateBranch(url: string): Promise<void> {
    const parsed = requireParsed(url);
    await this.restJson(
      'PUT',
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/update-branch`,
      {}
    );
  }

  async merge(
    url: string,
    opts: { bypass?: boolean; method?: MergeMethod } = {}
  ): Promise<void> {
    const parsed = requireParsed(url);
    const details = (await this.refreshPrDetail(url)) ?? undefined;
    const method = opts.method
      ? opts.method.toLowerCase()
      : details
        ? resolveMergeMethod(details)
        : 'squash';

    // Admin bypass uses the same merge endpoint when the token user has rights.
    await this.restJson(
      'PUT',
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/merge`,
      { merge_method: method }
    );
    void opts.bypass;
  }

  async enableAutoMerge(url: string): Promise<void> {
    const details = await this.refreshPrDetail(url);
    if (!details?.nodeId) throw new Error('Missing pull request id');
    const method = resolveMergeMethod(details).toUpperCase() as MergeMethod;
    await this.graphql(
      `mutation($id: ID!, $method: PullRequestMergeMethod!) {
        enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) {
          clientMutationId
        }
      }`,
      { id: details.nodeId, method }
    );
  }

  async disableAutoMerge(url: string): Promise<void> {
    const details = await this.refreshPrDetail(url);
    if (!details?.nodeId) throw new Error('Missing pull request id');
    await this.graphql(
      `mutation($id: ID!) {
        disablePullRequestAutoMerge(input: { pullRequestId: $id }) {
          clientMutationId
        }
      }`,
      { id: details.nodeId }
    );
  }

  async close(url: string): Promise<void> {
    const parsed = requireParsed(url);
    await this.restJson(
      'PATCH',
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
      { state: 'closed' }
    );
  }

  mapSearchNodeToPr(node: unknown, reason?: TodayReason): PullRequest | null {
    if (!node || typeof node !== 'object') return null;
    const n = node as Record<string, unknown>;
    const url = typeof n.url === 'string' ? n.url : null;
    if (!url) return null;
    const repo = n.repository as { nameWithOwner?: string } | undefined;
    const author = n.author as { login?: string; avatarUrl?: string } | undefined;
    const isDraft = Boolean(n.isDraft);
    const state = String(n.state || 'OPEN').toUpperCase();
    const type: PullRequest['type'] =
      state === 'MERGED' ? 'merged' : isDraft ? 'draft' : 'open';

    return {
      id: url,
      url,
      title: String(n.title || 'Untitled'),
      number: typeof n.number === 'number' ? n.number : null,
      repoName: repo?.nameWithOwner || 'Unknown Repo',
      author: author?.login
        ? [{ login: author.login, avatarUrl: author.avatarUrl }]
        : [],
      createdAt: typeof n.createdAt === 'string' ? n.createdAt : undefined,
      updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : undefined,
      type,
      todayReason: reason,
    };
  }

  // ─── internals ───────────────────────────────────────────────────────────

  private async readToken(): Promise<string | null> {
    const value = await this.storageService.get<string>(STORAGE_KEY_GITHUB_API_TOKEN);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async restJson<T>(
    method: string,
    path: string,
    body?: unknown,
    tokenOverride?: string
  ): Promise<T> {
    const token = tokenOverride ?? (await this.readToken());
    if (!token) throw new Error('Add a GitHub token in Settings');

    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(formatGithubError(response.status, text));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const token = await this.readToken();
    if (!token) throw new Error('Add a GitHub token in Settings');

    const response = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = (await response.json()) as GraphQlResponse<T>;
    if (!response.ok) {
      throw new Error(formatGithubError(response.status, JSON.stringify(json)));
    }
    if (json.errors?.length) {
      const message = json.errors.map((e) => e.message).join('; ');
      // Prefer partial data when GitHub returns both — a single bad field used to wipe all PR details.
      if (!json.data) throw new Error(message);
      this.debugService.warn('[GitHubApiService] GraphQL partial errors:', message);
    }
    if (!json.data) throw new Error('Empty GraphQL response');
    return json.data;
  }

  private async fetchPrDetailsChunk(urls: string[]): Promise<PrDetailsMap> {
    const aliases: string[] = [];
    const variables: Record<string, string> = {};
    urls.forEach((url, index) => {
      const key = `p${index}`;
      variables[key] = url;
      aliases.push(`
        ${key}: resource(url: $${key}) {
          ... on PullRequest {
            id
            url
            state
            isDraft
            updatedAt
            mergeStateStatus
            mergeable
            viewerCanMergeAsAdmin
            viewerCanUpdateBranch
            viewerCanEnableAutoMerge
            viewerCanDisableAutoMerge
            autoMergeRequest { enabledAt }
            author { login }
            labels(first: 20) {
              nodes { name color }
            }
            repository {
              mergeCommitAllowed
              squashMergeAllowed
              rebaseMergeAllowed
              viewerDefaultMergeMethod
            }
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup { state }
                }
              }
            }
          }
        }
      `);
    });

    const varDefs = urls.map((_, i) => `$p${i}: URI!`).join(', ');
    const data = await this.graphql<Record<string, unknown>>(
      `query(${varDefs}) {
        viewer { login }
        ${aliases.join('\n')}
      }`,
      variables
    );
    const viewerLogin =
      typeof (data.viewer as { login?: string } | undefined)?.login === 'string'
        ? (data.viewer as { login: string }).login
        : undefined;

    const out: PrDetailsMap = {};
    for (let i = 0; i < urls.length; i++) {
      const node = data[`p${i}`];
      const mapped = mapResourceToDetails(node, urls[i], viewerLogin);
      if (mapped) out[mapped.url] = mapped;
    }
    return out;
  }

  private async searchPullRequests(query: string): Promise<unknown[]> {
    const data = await this.graphql<{
      search: { nodes: unknown[] };
    }>(
      `query($q: String!) {
        search(query: $q, type: ISSUE, first: 50) {
          nodes {
            ... on PullRequest {
              id
              url
              title
              number
              state
              isDraft
              createdAt
              updatedAt
              author { login avatarUrl }
              repository { nameWithOwner }
            }
          }
        }
      }`,
      { q: query }
    );
    return data.search?.nodes ?? [];
  }
}

function requireParsed(url: string) {
  const parsed = parsePrUrl(url);
  if (!parsed) throw new Error(`Invalid pull request URL: ${url}`);
  return parsed;
}

function formatGithubError(status: number, body: string): string {
  if (status === 401) return 'GitHub token rejected (401). Re-check the token.';
  if (status === 403 && /sso/i.test(body)) {
    return 'Authorize the token for SSO (org) at github.com/settings/tokens.';
  }
  if (status === 403) return `GitHub forbidden (403): ${truncate(body)}`;
  if (status === 405 || status === 409) return truncate(body) || `GitHub conflict (${status})`;
  return truncate(body) || `GitHub API error (${status})`;
}

function truncate(text: string, max = 180): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function mapResourceToDetails(
  node: unknown,
  fallbackUrl: string,
  viewerLogin?: string
): PrDetails | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as Record<string, unknown>;
  if (typeof n.id !== 'string') return null;

  const repo = (n.repository ?? {}) as Record<string, unknown>;
  const commits = n.commits as {
    nodes?: Array<{ commit?: { statusCheckRollup?: { state?: string } } }>;
  } | undefined;
  const rollup = commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null;
  const auto = n.autoMergeRequest as { enabledAt?: string } | null;
  const author = n.author as { login?: string } | undefined;
  const url = typeof n.url === 'string' ? n.url : fallbackUrl;
  const labelNodes = (n.labels as { nodes?: unknown } | undefined)?.nodes;
  const labels = normalizePrLabels(
    Array.isArray(labelNodes)
      ? labelNodes.map((node) => {
          const row = (node ?? {}) as { name?: unknown; color?: unknown };
          return {
            name: typeof row.name === 'string' ? row.name : '',
            color: typeof row.color === 'string' ? row.color : undefined,
          };
        })
      : []
  );

  const mergeableRaw = n.mergeable;
  const mergeable =
    mergeableRaw === 'MERGEABLE' ? true : mergeableRaw === 'CONFLICTING' ? false : null;

  return {
    url,
    nodeId: n.id,
    state: String(n.state || 'OPEN'),
    isDraft: Boolean(n.isDraft),
    checkState: (rollup as CheckRollupState) ?? null,
    mergeStateStatus: String(n.mergeStateStatus || 'UNKNOWN'),
    mergeable,
    viewerCanMergeAsAdmin: Boolean(n.viewerCanMergeAsAdmin),
    viewerCanUpdateBranch: Boolean(n.viewerCanUpdateBranch),
    viewerCanEnableAutoMerge: Boolean(n.viewerCanEnableAutoMerge),
    viewerCanDisableAutoMerge: Boolean(n.viewerCanDisableAutoMerge),
    autoMergeEnabled: Boolean(auto?.enabledAt),
    viewerDefaultMergeMethod:
      (repo.viewerDefaultMergeMethod as MergeMethod | null) ??
      (n.viewerDefaultMergeMethod as MergeMethod | null) ??
      null,
    mergeCommitAllowed: Boolean(repo.mergeCommitAllowed),
    squashMergeAllowed: Boolean(repo.squashMergeAllowed),
    rebaseMergeAllowed: Boolean(repo.rebaseMergeAllowed),
    viewerCanClose:
      Boolean(viewerLogin) &&
      (viewerLogin?.toLowerCase() === author?.login?.toLowerCase() ||
        Boolean(n.viewerCanMergeAsAdmin)),
    labels,
    updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : undefined,
  };
}
