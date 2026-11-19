import type {
  MergeMethod,
  PrDetails,
  PrDetailsMap,
  PullRequest,
  TodayPullRequest,
} from '@common/types';
import type { IService } from './IService';

export interface GitHubTokenStatus {
  configured: boolean;
  login: string | null;
}

export interface IGitHubApiService extends IService {
  getTokenStatus(): Promise<GitHubTokenStatus>;
  saveToken(token: string): Promise<GitHubTokenStatus>;
  clearToken(): Promise<void>;
  testToken(token?: string): Promise<GitHubTokenStatus>;
  hasToken(): Promise<boolean>;

  fetchPrDetails(urls: string[]): Promise<PrDetailsMap>;
  refreshPrDetail(url: string): Promise<PrDetails | null>;
  syncPrDetailsFromStoredLists(): Promise<PrDetailsMap>;
  fetchTodayPrs(): Promise<TodayPullRequest[]>;

  approve(url: string): Promise<void>;
  updateBranch(url: string): Promise<void>;
  merge(url: string, opts?: { bypass?: boolean; method?: MergeMethod }): Promise<void>;
  enableAutoMerge(url: string): Promise<void>;
  disableAutoMerge(url: string): Promise<void>;
  close(url: string): Promise<void>;

  /** Maps GraphQL search nodes into PullRequest rows (used by Today). */
  mapSearchNodeToPr(node: unknown, reason?: TodayPullRequest['todayReason']): PullRequest | null;
}
