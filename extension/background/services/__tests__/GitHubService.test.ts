/// <reference types="vitest/globals" />
import { GitHubService } from '../GitHubService';
import {
  GitHubOutageError,
  GITHUB_WEB_SESSION_NOT_LOGGED_IN_MESSAGE,
  ParserBreakageError,
  isGitHubWebSessionAuthError,
} from '@common/errors';
import { DEFAULT_COMPILED_PATTERNS } from '@common/default-patterns';
import { STORAGE_KEY_ROUTE_HINT } from '@common/constants';
import { chromeExtensionService } from '@common/chrome-extension-service';
import type { PullRequest } from '@common/types';
import type { IDebugService } from '../../interfaces/IDebugService';
import type { IAvatarService } from '../../interfaces/IAvatarService';
import type { IPatternRegistryService } from '../../interfaces/IPatternRegistryService';

vi.mock('@common/chrome-extension-service', () => ({
  chromeExtensionService: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

const LOGGED_OUT_SHELL_HTML =
  '<html><head><meta name="is_logged_out_page" content="true"/></head><body></body></html>';

function htmlOkResponse(html: string, url: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url,
    text: async () => html,
  } as Response;
}

function httpErrorResponse(status: number, url: string): Response {
  return {
    ok: false,
    status,
    statusText: status === 500 ? 'Internal Server Error' : 'Service Unavailable',
    url,
    headers: new Headers(),
  } as Response;
}

function createCollaborators(): {
  debug: IDebugService;
  avatar: IAvatarService;
  patterns: IPatternRegistryService;
} {
  const debug = {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as IDebugService;

  const avatar = {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    enrichPRsWithAvatars: vi.fn(async <T extends { id: string }>(prs: T[]) => prs),
  } as unknown as IAvatarService;

  const patterns = {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    getPatterns: vi.fn(() => DEFAULT_COMPILED_PATTERNS),
    refreshIfStale: vi.fn().mockResolvedValue(undefined),
  } as unknown as IPatternRegistryService;

  return { debug, avatar, patterns };
}

describe('GitHub session problems while loading PR lists', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces a logged out experience when GitHub returns the logged out HTML shell', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      return Promise.resolve(htmlOkResponse(LOGGED_OUT_SHELL_HTML, url));
    });

    const { debug, avatar, patterns } = createCollaborators();
    const service = new GitHubService(debug, avatar, patterns);
    await service.initialize();

    let caught: unknown;
    try {
      await service.fetchAssignedPRs();
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(isGitHubWebSessionAuthError(caught)).toBe(true);
    expect((caught as Error).message).toBe(GITHUB_WEB_SESSION_NOT_LOGGED_IN_MESSAGE);
    expect(caught).not.toBeInstanceOf(ParserBreakageError);
    expect(caught).not.toBeInstanceOf(GitHubOutageError);
    expect(avatar.enrichPRsWithAvatars).not.toHaveBeenCalled();
  });
});

describe('GitHub infrastructure blips', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('treats transient 5xx responses as an outage signal rather than a broken parser', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      return Promise.resolve(httpErrorResponse(503, url));
    });

    const { debug, avatar, patterns } = createCollaborators();
    const service = new GitHubService(debug, avatar, patterns);
    await service.initialize();

    const settled = service.fetchAssignedPRs().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3000);
    const err = await settled;

    expect(err).toBeInstanceOf(GitHubOutageError);
    expect((err as GitHubOutageError).httpStatus).toBe(503);
    expect(err).not.toBeInstanceOf(ParserBreakageError);

    expect(avatar.enrichPRsWithAvatars).not.toHaveBeenCalled();
  });

  it('bounds a hung GitHub request by the overall retry deadline', async () => {
    vi.mocked(fetch).mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('GitHub request deadline exceeded', 'AbortError')),
          { once: true }
        );
      });
    });

    const { debug, avatar, patterns } = createCollaborators();
    const service = new GitHubService(debug, avatar, patterns);
    await service.initialize();

    const settled = service.fetchAssignedPRs().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(18_000);
    const err = await settled;

    expect(err).toBeInstanceOf(GitHubOutageError);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(debug.warn).not.toHaveBeenCalledWith(expect.stringContaining('retrying'));
    expect(avatar.enrichPRsWithAvatars).not.toHaveBeenCalled();
  });
});

describe('fetchAuthoredPRs dedupes overlapping buckets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function basePR(id: string): Omit<PullRequest, 'authorReviewStatus'> {
    return {
      id,
      url: id,
      title: `PR ${id}`,
      number: null,
      repoName: 'acme/repo',
      author: [{ login: 'me' }],
      type: 'draft',
    };
  }

  it('returns a single draft row when the same PR appears in pending and draft buckets', async () => {
    const { debug, avatar, patterns } = createCollaborators();
    const service = new GitHubService(debug, avatar, patterns);
    await service.initialize();

    const sharedId = 'https://github.com/acme/repo/pull/1';
    const fetchFromURL = vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(service as any, 'fetchFromURL')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((async (_url: string, status: PullRequest['authorReviewStatus']) => {
        if (status === 'pending' || status === 'draft') {
          return [{ ...basePR(sharedId), authorReviewStatus: status }];
        }
        return [];
      }) as any);

    const settled = service.fetchAuthoredPRs();
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await settled;

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(sharedId);
    expect(result[0].authorReviewStatus).toBe('draft');
    expect(result[0].type).toBe('draft');
    expect(fetchFromURL).toHaveBeenCalledTimes(4);
  });
});

/**
 * WHY [unit coverage]: Live canary monitors `/pulls/search` only. These tests
 * lock the production escape hatch when a stuck `legacy` route hint hits a
 * 200 empty shell on bare `/pulls` (no ParserBreakageError) and must reprobe search.
 */
describe('empty legacy URL → search reprobe', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(chromeExtensionService.storage.local.get).mockResolvedValue({});
    vi.mocked(chromeExtensionService.storage.local.set).mockResolvedValue(undefined);
    vi.mocked(chromeExtensionService.storage.local.remove).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function samplePR(): PullRequest {
    return {
      id: 'https://github.com/acme/repo/pull/9',
      url: 'https://github.com/acme/repo/pull/9',
      title: 'Reprobe hit',
      number: 9,
      repoName: 'acme/repo',
      author: [{ login: 'bot' }],
      createdAt: '2026-01-01T00:00:00Z',
      type: 'merged',
      isNew: false,
    };
  }

  async function serviceWithLegacyHint() {
    vi.mocked(chromeExtensionService.storage.local.get).mockResolvedValue({
      [STORAGE_KEY_ROUTE_HINT]: { route: 'legacy', timestamp: Date.now() },
    });
    const { debug, avatar, patterns } = createCollaborators();
    const service = new GitHubService(debug, avatar, patterns);
    await service.initialize();
    return { service, avatar, debug };
  }

  it('reprobes /pulls/search once when legacy primary returns an empty list', async () => {
    const { service, avatar } = await serviceWithLegacyHint();
    const pr = samplePR();

    const fetchGitHubData = vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(service as any, 'fetchGitHubData')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((async (url: string) => {
        if (url.includes('/pulls/search')) return [pr];
        return [];
      }) as any);

    const result = await service.fetchMergedPRs();

    expect(result).toEqual([pr]);
    expect(fetchGitHubData).toHaveBeenCalledTimes(2);
    expect(fetchGitHubData.mock.calls[0][0]).not.toContain('/pulls/search');
    expect(fetchGitHubData.mock.calls[1][0]).toContain('/pulls/search');
    expect(fetchGitHubData.mock.calls[1][1]).toContain('empty legacy → search reprobe');
    expect(chromeExtensionService.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEY_ROUTE_HINT]: expect.objectContaining({ route: 'search' }),
    });
    expect(avatar.enrichPRsWithAvatars).toHaveBeenCalledWith([pr]);
  });

  it('clears the route hint and returns empty when search reprobe throws ParserBreakageError', async () => {
    const { service, avatar } = await serviceWithLegacyHint();

    vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(service as any, 'fetchGitHubData')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((async (url: string) => {
        if (url.includes('/pulls/search')) {
          throw new ParserBreakageError('search shell unparseable');
        }
        return [];
      }) as any);

    const result = await service.fetchMergedPRs();

    expect(result).toEqual([]);
    expect(chromeExtensionService.storage.local.remove).toHaveBeenCalledWith(
      STORAGE_KEY_ROUTE_HINT
    );
    expect(avatar.enrichPRsWithAvatars).toHaveBeenCalledWith([]);
  });

  it('does not reprobe legacy when the primary search route returns an empty list', async () => {
    // WHY: empty on `search` is a valid empty inbox — do not invent a reverse legacy probe.
    vi.mocked(chromeExtensionService.storage.local.get).mockResolvedValue({
      [STORAGE_KEY_ROUTE_HINT]: { route: 'search', timestamp: Date.now() },
    });
    const { debug, avatar, patterns } = createCollaborators();
    const service = new GitHubService(debug, avatar, patterns);
    await service.initialize();

    const fetchGitHubData = vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(service as any, 'fetchGitHubData')
      .mockResolvedValue([]) as any;

    const result = await service.fetchMergedPRs();

    expect(result).toEqual([]);
    expect(fetchGitHubData).toHaveBeenCalledTimes(1);
    expect(fetchGitHubData.mock.calls[0][0]).toContain('/pulls/search');
    expect(chromeExtensionService.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEY_ROUTE_HINT]: expect.objectContaining({ route: 'search' }),
    });
    expect(avatar.enrichPRsWithAvatars).toHaveBeenCalledWith([]);
  });
});
