import { useEffect, useState } from 'react';
import { STORAGE_KEY_PR_DETAILS } from '@common/constants';
import { chromeExtensionService } from '@common/chrome-extension-service';
import type { PrDetails, PrDetailsMap } from '@common/types';
import { isExtensionContext } from '@src/utils/is-extension-context';

export const usePrDetailsMap = (): PrDetailsMap => {
  const [map, setMap] = useState<PrDetailsMap>({});

  useEffect(() => {
    if (!isExtensionContext()) return;

    let cancelled = false;
    void chromeExtensionService.prs.readPrDetailsFromLocal().then((next) => {
      if (!cancelled) setMap(next);
    });

    const onStorageChanged = (
      changes: { [key: string]: { newValue?: unknown } },
      area: string
    ) => {
      if (area !== 'local' || !changes[STORAGE_KEY_PR_DETAILS]) return;
      setMap((changes[STORAGE_KEY_PR_DETAILS].newValue as PrDetailsMap | undefined) ?? {});
    };
    chromeExtensionService.storage.onChanged.addListener(onStorageChanged);
    return () => {
      cancelled = true;
      chromeExtensionService.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  return map;
};

export const usePrDetails = (url: string): PrDetails | null => {
  const map = usePrDetailsMap();
  return map[url] ?? null;
};
