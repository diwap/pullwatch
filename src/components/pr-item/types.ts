import type { PullRequest } from '@common/types';

export interface PRItemProps {
  pr: PullRequest;
  isNew: boolean;
  isFirst?: boolean;
  isReviewed?: boolean;
  showAuthorStatus?: boolean;
  /** Called when the user activates the PR link (assigned / merged entrance-seen). */
  onPrLinkActivated?: (prId: string) => void;
  /** Hide from the main list, or show again from the Hidden section. */
  onToggleHidden?: (prId: string) => void;
  /** When true, the menu's toggle action is Show instead of Hide. */
  isHidden?: boolean;
  /** Enables Approve in the three-dot menu (To Review / Today review rows). */
  canApprove?: boolean;
}
