import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTENSION_SETTINGS,
  ensureCompleteSettings,
} from '../extension-settings-defaults';

describe('ensureCompleteSettings', () => {
  it('fills missing categories from defaults when storage is empty', () => {
    expect(ensureCompleteSettings(null)).toEqual(DEFAULT_EXTENSION_SETTINGS);
  });

  it('deep-merges each category over defaults', () => {
    // `Partial<ExtensionSettings>` is shallow: nested `assigned` is still `AssignedSettings`, not
    // `Partial<AssignedSettings>`. Assert the runtime shape we actually merge (see `saveSettings` patches).
    const merged = ensureCompleteSettings({
      assigned: { sound: 'bell' },
    } as Parameters<typeof ensureCompleteSettings>[0]);

    expect(merged.assigned.sound).toBe('bell');
    expect(merged.assigned.notificationsEnabled).toBe(
      DEFAULT_EXTENSION_SETTINGS.assigned.notificationsEnabled
    );
    expect(merged.merged).toEqual(DEFAULT_EXTENSION_SETTINGS.merged);
    expect(merged.inbox).toEqual(DEFAULT_EXTENSION_SETTINGS.inbox);
  });

  it('normalizes a blank org filter to all organizations', () => {
    const merged = ensureCompleteSettings({
      inbox: {
        orgFilter: '  all ',
        dateRange: '30d',
        showHidden: true,
        includeTeamReviews: true,
        teamReviewSlugs: [],
      },
    });
    expect(merged.inbox.orgFilter).toBe('');
    expect(merged.inbox.dateRange).toBe('30d');
    expect(merged.inbox.showHidden).toBe(true);
    expect(merged.inbox.includeTeamReviews).toBe(true);
  });

  it('defaults dateRange, showHidden, and includeTeamReviews when inbox is missing', () => {
    const merged = ensureCompleteSettings({});
    expect(merged.inbox.dateRange).toBe('all');
    expect(merged.inbox.showHidden).toBe(false);
    expect(merged.inbox.includeTeamReviews).toBe(false);
    expect(merged.inbox.teamReviewSlugs).toEqual([]);
  });

  it('normalizes teamReviewSlugs (empty = all teams)', () => {
    const merged = ensureCompleteSettings({
      inbox: {
        orgFilter: '',
        dateRange: 'all',
        showHidden: false,
        includeTeamReviews: true,
        teamReviewSlugs: [' Acme/Frontend ', 'acme/frontend', 'bad', 'org/backend'],
      },
    });
    expect(merged.inbox.teamReviewSlugs).toEqual(['acme/frontend', 'org/backend']);
  });
});
