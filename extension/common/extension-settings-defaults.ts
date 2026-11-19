import { normalizedDateRange, normalizedOrgFilter } from './pr-visibility';
import type { ExtensionSettings } from './types';

/**
 * Default settings aligned with UI defaults (`src/components/settings/types.ts`).
 */
export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
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
  authored: {
    notificationsEnabled: false,
    sound: 'ping',
  },
  inbox: {
    orgFilter: '',
    dateRange: 'all',
    showHidden: false,
  },
};

/**
 * Merges stored or partial settings with {@link DEFAULT_EXTENSION_SETTINGS} per category.
 *
 * WHY [shared module]: `StorageService` and the popup must apply the **same** merge so a direct
 * `chrome.storage.sync.get` in the UI round-trips with what the background wrote and with
 * `saveSettings` payloads that only touch one category.
 */
export function ensureCompleteSettings(
  settings: ExtensionSettings | Partial<ExtensionSettings> | null | undefined
): ExtensionSettings {
  const base = settings ?? {};
  return {
    assigned: {
      ...DEFAULT_EXTENSION_SETTINGS.assigned,
      ...base.assigned,
    },
    merged: {
      ...DEFAULT_EXTENSION_SETTINGS.merged,
      ...base.merged,
    },
    authored: {
      ...DEFAULT_EXTENSION_SETTINGS.authored,
      ...base.authored,
    },
    inbox: {
      orgFilter: normalizedOrgFilter(
        base.inbox?.orgFilter ?? DEFAULT_EXTENSION_SETTINGS.inbox.orgFilter
      ),
      dateRange: normalizedDateRange(
        base.inbox?.dateRange ?? DEFAULT_EXTENSION_SETTINGS.inbox.dateRange
      ),
      showHidden:
        typeof base.inbox?.showHidden === 'boolean'
          ? base.inbox.showHidden
          : DEFAULT_EXTENSION_SETTINGS.inbox.showHidden,
    },
  };
}
