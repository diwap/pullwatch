import { PR_ACTION } from '../../runtime-actions';
import type { PrDetails } from '../../types';
import type { BackgroundActionClient } from './background-action-client';

export class PrActionClient {
  constructor(private readonly bg: BackgroundActionClient) {}

  approve(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.approve, { url });
  }

  updateBranch(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.updateBranch, { url });
  }

  merge(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.merge, { url });
  }

  bypassMerge(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.bypassMerge, { url });
  }

  enableAutoMerge(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.enableAutoMerge, { url });
  }

  disableAutoMerge(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.disableAutoMerge, { url });
  }

  close(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.close, { url });
  }

  refreshDetails(url: string): Promise<PrDetails | null> {
    return this.bg.dispatch(PR_ACTION.refreshDetails, { url });
  }
}
