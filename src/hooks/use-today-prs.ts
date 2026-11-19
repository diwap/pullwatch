import { useQuery } from '@tanstack/react-query';
import type { PullRequest } from '@common/types';
import { queryKeys } from '@src/constants/query-keys';
import { chromeExtensionService } from '@common/chrome-extension-service';
import { isExtensionContext } from '@src/utils/is-extension-context';

/**
 * Today tab list — API-backed, stored locally like the other lists.
 */
export const useTodayPRs = () => {
  return useQuery({
    queryKey: queryKeys.todayPrs,
    queryFn: () =>
      isExtensionContext()
        ? chromeExtensionService.prs.readTodayFromLocal()
        : Promise.resolve([] as PullRequest[]),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
