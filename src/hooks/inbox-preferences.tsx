import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { InboxDateRange, PullRequest } from '@common/types';
import { STORAGE_KEY_GITHUB_API_TOKEN, STORAGE_KEY_HIDDEN_PR_IDS } from '@common/constants';
import { chromeExtensionService } from '@common/chrome-extension-service';
import { isExtensionContext } from '@src/utils/is-extension-context';
import {
  hiddenPrIdSet,
  normalizedDateRange,
  normalizedOrgFilter,
  partitionByHidden,
  prMatchesOrg,
  prWithinDateRange,
} from '@common/pr-visibility';

interface InboxPreferences {
  /** False until the extension has read the org filter and hidden ids. */
  ready: boolean;
  orgFilter: string;
  dateRange: InboxDateRange;
  showHidden: boolean;
  hiddenIds: ReadonlySet<string>;
  hide: (prId: string) => void;
  unhide: (prId: string) => void;
  hasToken: boolean;
}

const EMPTY_HIDDEN = new Set<string>();

const InboxPreferencesContext = createContext<InboxPreferences | null>(null);

export const InboxPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const inExtension = isExtensionContext();
  const [ready, setReady] = useState(!inExtension);
  const [orgFilter, setOrgFilter] = useState('');
  const [dateRange, setDateRange] = useState<InboxDateRange>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const hiddenRef = useRef<string[]>([]);
  hiddenRef.current = hiddenIds;

  useEffect(() => {
    if (!inExtension) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [settings, stored, tokenStatus] = await Promise.all([
          chromeExtensionService.settings.get(),
          chromeExtensionService.storage.local.get(STORAGE_KEY_HIDDEN_PR_IDS),
          chromeExtensionService.githubToken.getStatus().catch(() => ({
            configured: false,
            login: null,
          })),
        ]);
        if (cancelled) return;
        setOrgFilter(normalizedOrgFilter(settings.inbox.orgFilter));
        setDateRange(normalizedDateRange(settings.inbox.dateRange));
        setShowHidden(Boolean(settings.inbox.showHidden));
        setHiddenIds([...hiddenPrIdSet(stored[STORAGE_KEY_HIDDEN_PR_IDS])]);
        setHasToken(Boolean(tokenStatus.configured));
      } catch (error) {
        console.warn('[InboxPreferences] Failed to load inbox filters:', error);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void load();

    const unsubscribeSettings = chromeExtensionService.settings.onChange((settings) => {
      setOrgFilter(normalizedOrgFilter(settings.inbox.orgFilter));
      setDateRange(normalizedDateRange(settings.inbox.dateRange));
      setShowHidden(Boolean(settings.inbox.showHidden));
    });

    const onStorageChanged = (
      changes: { [key: string]: { newValue?: unknown } },
      area: string
    ) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEY_HIDDEN_PR_IDS]) {
        setHiddenIds([...hiddenPrIdSet(changes[STORAGE_KEY_HIDDEN_PR_IDS].newValue)]);
      }
      if (changes[STORAGE_KEY_GITHUB_API_TOKEN]) {
        const next = changes[STORAGE_KEY_GITHUB_API_TOKEN].newValue;
        setHasToken(typeof next === 'string' && next.trim().length > 0);
      }
    };
    chromeExtensionService.storage.onChanged.addListener(onStorageChanged);

    return () => {
      cancelled = true;
      unsubscribeSettings();
      chromeExtensionService.storage.onChanged.removeListener(onStorageChanged);
    };
  }, [inExtension]);

  const persistHidden = useCallback(async (next: string[]) => {
    hiddenRef.current = next;
    setHiddenIds(next);
    if (!isExtensionContext()) return;
    try {
      await chromeExtensionService.storage.local.set({ [STORAGE_KEY_HIDDEN_PR_IDS]: next });
      await chromeExtensionService.settings.syncBadge();
    } catch (error) {
      console.warn('[InboxPreferences] Failed to save hidden pull requests:', error);
    }
  }, []);

  const hide = useCallback(
    (prId: string) => {
      if (!prId || hiddenRef.current.includes(prId)) return;
      void persistHidden([...hiddenRef.current, prId]);
    },
    [persistHidden]
  );

  const unhide = useCallback(
    (prId: string) => {
      if (!hiddenRef.current.includes(prId)) return;
      void persistHidden(hiddenRef.current.filter((id) => id !== prId));
    },
    [persistHidden]
  );

  const hiddenIdSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const value = useMemo<InboxPreferences>(
    () => ({
      ready,
      orgFilter,
      dateRange,
      showHidden,
      hiddenIds: hiddenIdSet,
      hide,
      unhide,
      hasToken,
    }),
    [ready, orgFilter, dateRange, showHidden, hiddenIdSet, hide, unhide, hasToken]
  );

  return (
    <InboxPreferencesContext.Provider value={value}>{children}</InboxPreferencesContext.Provider>
  );
};

const fallbackPreferences: InboxPreferences = {
  ready: true,
  orgFilter: '',
  dateRange: 'all',
  showHidden: false,
  hiddenIds: EMPTY_HIDDEN,
  hide: () => {},
  unhide: () => {},
  hasToken: false,
};

export const useInboxPreferences = (): InboxPreferences =>
  useContext(InboxPreferencesContext) ?? fallbackPreferences;

export const useInboxPartition = (
  prs: PullRequest[],
  options: { skipDateRange?: boolean } = {}
) => {
  const { ready, orgFilter, dateRange, showHidden, hiddenIds } = useInboxPreferences();
  return useMemo(() => {
    if (!ready) {
      return {
        ready,
        orgFilter,
        dateRange,
        showHidden,
        visible: [] as PullRequest[],
        hidden: [] as PullRequest[],
      };
    }
    const filtered = prs.filter((pr) => {
      if (!prMatchesOrg(pr, orgFilter)) return false;
      if (!options.skipDateRange && !prWithinDateRange(pr, dateRange)) return false;
      return true;
    });
    const partitioned = partitionByHidden(filtered, hiddenIds);
    return {
      ready,
      orgFilter,
      dateRange,
      showHidden,
      visible: partitioned.visible,
      hidden: showHidden ? partitioned.hidden : ([] as PullRequest[]),
    };
  }, [prs, ready, orgFilter, dateRange, showHidden, hiddenIds, options.skipDateRange]);
};
