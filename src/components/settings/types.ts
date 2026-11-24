import type { InboxDateRange, NotificationSound, CustomSoundMeta } from '@common/types';

export type { NotificationSound, CustomSoundMeta, InboxDateRange };

export interface ExtensionSettings {
  assigned: {
    notificationsEnabled: boolean;
    notifyOnDrafts: boolean;
    sound: NotificationSound;
    showDraftsInList: boolean;
  };
  merged: {
    notificationsEnabled: boolean;
    sound: NotificationSound;
  };
  inbox: {
    /** GitHub organization login. Empty string shows every organization. */
    orgFilter: string;
    dateRange: InboxDateRange;
    showHidden: boolean;
    /** Popup header toggle — include team membership review requests. */
    includeTeamReviews: boolean;
    /** Empty = all teams; otherwise only these `org/slug` values. */
    teamReviewSlugs: string[];
  };
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  assigned: {
    notificationsEnabled: true,
    notifyOnDrafts: false,
    sound: 'ping',
    showDraftsInList: true,
  },
  merged: {
    notificationsEnabled: false,
    sound: 'bell',
  },
  inbox: {
    orgFilter: '',
    dateRange: 'all',
    showHidden: false,
    includeTeamReviews: false,
    teamReviewSlugs: [],
  },
};
