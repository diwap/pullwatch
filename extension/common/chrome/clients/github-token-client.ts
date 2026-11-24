import { GITHUB_TOKEN_ACTION } from '../../runtime-actions';
import type { BackgroundActionClient } from './background-action-client';

export interface GitHubTokenStatus {
  configured: boolean;
  login: string | null;
}

export class GitHubTokenClient {
  constructor(private readonly bg: BackgroundActionClient) {}

  getStatus(): Promise<GitHubTokenStatus> {
    return this.bg.dispatch(GITHUB_TOKEN_ACTION.getTokenStatus);
  }

  save(token: string): Promise<GitHubTokenStatus> {
    return this.bg.dispatch(GITHUB_TOKEN_ACTION.saveToken, { token });
  }

  clear(): Promise<void> {
    return this.bg.dispatch(GITHUB_TOKEN_ACTION.clearToken);
  }

  test(token?: string): Promise<GitHubTokenStatus> {
    return this.bg.dispatch(GITHUB_TOKEN_ACTION.testToken, { token });
  }

  listViewerTeams(): Promise<Array<{ slug: string; name: string }>> {
    return this.bg.dispatch(GITHUB_TOKEN_ACTION.listViewerTeams);
  }
}
