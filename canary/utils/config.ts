/**
 * Canary test configuration — environment, targets, and HTTP identity.
 *
 * Centralizes every "what" and "where" the canary suite needs so the test
 * files themselves only contain orchestration logic. Env-var diagnostics
 * run at import time (module side-effect) to appear at the top of every
 * CI log, making it obvious which tier will execute before any test starts.
 */

import { GITHUB_BASE_URL } from '@common/constants';
import { toPullsSearchUrl } from '@common/github-url-utils';

// Re-export for call sites that only import canary config (same string as production).
export { GITHUB_BASE_URL };

// ── GitHub coordinates ───────────────────────────────────────────────────

/**
 * WHY [single state]: Authenticated Tier 2 uses one bot against `/pulls/search`.
 * A single Playwright `storageState` file avoids mixing cookies across accounts
 * and matches the one-session canary shape after the global dashboard GA.
 */
export const STATE_FILE = 'playwright-state.json';

// ── Typed env loader (Tier 2 credentials + Gmail) ───────────────────────

/** All three must be set for Gmail OTP device verification in Playwright login. */
export interface CanaryGmailSecrets {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

type CanaryEnvBase = {
  gmail: CanaryGmailSecrets | null;
  /** Non-fatal issues (e.g. half-set env vars that look like mistakes). */
  warnings: string[];
};

/** Which Actions secret supplied the Tier 2 username (for operator-facing errors). */
export type CanaryUsernameEnvHint = 'GH_CANARY_USERNAME_NEW' | 'GH_CANARY_USERNAME_LEGACY';

/**
 * Discriminated union for canary credentials. Use `mode` to branch; each variant
 * carries only the fields that are valid for that configuration — avoids “half-set”
 * secrets silently behaving like “skip tier 2” with no explanation.
 */
export type CanaryEnv =
  | (CanaryEnvBase & { mode: 'public-only' })
  | (CanaryEnvBase & {
      mode: 'authenticated';
      username: string;
      password: string;
      /** Secret name that supplied `username` — shown in Playwright login errors. */
      usernameEnvHint: CanaryUsernameEnvHint;
    });

function parseGmailSecrets(): { gmail: CanaryGmailSecrets | null; partial: boolean } {
  const clientId = (process.env.GMAIL_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.GMAIL_CLIENT_SECRET ?? '').trim();
  const refreshToken = (process.env.GMAIL_REFRESH_TOKEN ?? '').trim();
  const parts = [clientId, clientSecret, refreshToken].filter((s) => s.length > 0);
  if (parts.length === 3) {
    return { gmail: { clientId, clientSecret, refreshToken }, partial: false };
  }
  return { gmail: null, partial: parts.length > 0 };
}

/**
 * WHY [NEW then LEGACY]: Prefer `GH_CANARY_USERNAME_NEW`; fall back to
 * `GH_CANARY_USERNAME_LEGACY` so existing CI secrets keep working without a
 * same-PR secret rename. Both map to the same `/pulls/search` Tier 2 path.
 */
function resolveAuthUsername(): {
  username: string;
  source: CanaryUsernameEnvHint | null;
  newUser: string;
  legacyUser: string;
} {
  const newUser = (process.env.GH_CANARY_USERNAME_NEW ?? '').trim();
  const legacyUser = (process.env.GH_CANARY_USERNAME_LEGACY ?? '').trim();
  if (newUser) {
    return { username: newUser, source: 'GH_CANARY_USERNAME_NEW', newUser, legacyUser };
  }
  if (legacyUser) {
    return { username: legacyUser, source: 'GH_CANARY_USERNAME_LEGACY', newUser, legacyUser };
  }
  return { username: '', source: null, newUser, legacyUser };
}

/**
 * Reads process env once and returns a tagged union describing whether Tier 2
 * can authenticate. Emits {@link CanaryEnv.warnings} when env looks mis-set.
 */
export function loadCanaryEnv(): CanaryEnv {
  const warnings: string[] = [];
  const password = (process.env.GH_CANARY_PASSWORD ?? '').trim();
  const { username, source, newUser, legacyUser } = resolveAuthUsername();

  const { gmail, partial: gmailPartial } = parseGmailSecrets();
  if (gmailPartial) {
    warnings.push(
      'Gmail OTP: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN partially set — all three required; device verification bypass DISABLED'
    );
  }

  const usernamePresent = username.length > 0;
  const passwordPresent = password.length > 0;
  // Default hint when nothing is set — operators still know which secret to create first.
  const usernameEnvHint: CanaryUsernameEnvHint = source ?? 'GH_CANARY_USERNAME_NEW';

  if (usernamePresent && !passwordPresent) {
    warnings.push(
      `${usernameEnvHint} is set but GH_CANARY_PASSWORD is empty — Tier 2 will not run (password required).`
    );
  }
  if (passwordPresent && !usernamePresent) {
    warnings.push(
      'GH_CANARY_PASSWORD is set but neither GH_CANARY_USERNAME_NEW nor GH_CANARY_USERNAME_LEGACY is set — Tier 2 skipped.'
    );
  }
  if (newUser.length > 0 && legacyUser.length > 0 && newUser !== legacyUser) {
    warnings.push(
      'Both GH_CANARY_USERNAME_NEW and GH_CANARY_USERNAME_LEGACY are set — using NEW; LEGACY is ignored (compat alias only).'
    );
  }

  const base = (): CanaryEnvBase => ({ gmail, warnings });

  if (!usernamePresent || !passwordPresent) {
    return { ...base(), mode: 'public-only' };
  }
  return {
    ...base(),
    mode: 'authenticated',
    username,
    password,
    usernameEnvHint,
  };
}

/** Singleton env snapshot for the test process (read once at module load). */
export const canaryEnv: CanaryEnv = loadCanaryEnv();

/**
 * Parent Tier 2 describe runs only when auth credentials are complete.
 * WHY: avoid launching Chromium when username/password are missing (faster, clearer logs).
 */
export const HAS_AUTH_CREDENTIALS = canaryEnv.mode === 'authenticated';

export const HAS_GMAIL_SECRETS = canaryEnv.gmail !== null;

/** Empty when Tier 2 cannot run. */
export const CANARY_USERNAME = canaryEnv.mode === 'authenticated' ? canaryEnv.username : '';

/**
 * Env var name to show in login errors — taken from {@link canaryEnv}, not re-parsed.
 * Falls back to NEW when Tier 2 is skipped so error copy still names a real secret.
 */
export const CANARY_USERNAME_ENV_HINT: CanaryUsernameEnvHint =
  canaryEnv.mode === 'authenticated' ? canaryEnv.usernameEnvHint : 'GH_CANARY_USERNAME_NEW';

/** Shared password; empty when Tier 2 cannot run. */
export const CANARY_PASSWORD = canaryEnv.mode === 'authenticated' ? canaryEnv.password : '';

// ── HTTP identity ────────────────────────────────────────────────────────
// GitHub aggressively blocks non-browser User-Agents with 429s or CAPTCHAs.
// We mimic a real Chrome session so Tier 1 fetch() requests succeed reliably.

export const REALISTIC_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': REALISTIC_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

// ── Canary targets ───────────────────────────────────────────────────────

export interface CanaryTarget {
  label: string;
  url: string;
  /**
   * When true, the test hard-fails if the parser returns zero PRs.
   * Set to false for queries that may legitimately be empty (e.g.
   * review-requested:@me when the bot has no pending reviews).
   */
  requireResults: boolean;
  /**
   * Tier 2 only: when true and the page looks like the new dashboard, we hard-require
   * a non-null result from `GitHubEmbeddedJsonPullHarvest` before accepting HTML fallback.
   * WHY: merged `@me` is a high-signal target (usually non-empty); proving the SSR blob
   * path works there catches envelope drift without flaking on legitimately empty queries.
   */
  requireEmbeddedJson?: boolean;
}

export const PUBLIC_TARGETS: CanaryTarget[] = [
  {
    label: 'Public: Open PRs (facebook/react)',
    url: `${GITHUB_BASE_URL}/facebook/react/pulls`,
    requireResults: true,
  },
  {
    label: 'Public: Open PRs (microsoft/vscode)',
    url: `${GITHUB_BASE_URL}/microsoft/vscode/pulls`,
    requireResults: true,
  },
];

/**
 * Tier 2 — authenticated global pulls on `/pulls/search?q=…`.
 * WHY [search URL]: Production defaults the route hint to `search`; that path
 * carries the SSR embedded JSON blob the dual-probe and waterfall exercise.
 * Bare `/pulls` is the GA inbox shell, not a classic scrapable list contract.
 */
const AUTH_QUERY_TEMPLATES: Array<{
  label: string;
  /** `/pulls?q=…` form; mapped through `toPullsSearchUrl` before export. */
  pullsQueryUrl: string;
  requireResults: boolean;
}> = [
  {
    label: 'Auth (search): Assigned PRs (review-requested:@me)',
    pullsQueryUrl: `${GITHUB_BASE_URL}/pulls?q=is%3Aopen+is%3Apr+user-review-requested%3A%40me+`,
    requireResults: false,
  },
  {
    label: 'Auth (search): Merged PRs (author:@me)',
    pullsQueryUrl: `${GITHUB_BASE_URL}/pulls?q=is%3Apr+is%3Amerged+author%3A%40me`,
    requireResults: true,
  },
];

export const AUTH_TARGETS: CanaryTarget[] = AUTH_QUERY_TEMPLATES.map((t) => ({
  label: t.label,
  url: toPullsSearchUrl(t.pullsQueryUrl),
  requireResults: t.requireResults,
  // WHY: assert SSR JSON only where we expect rows (merged); assigned may be empty.
  requireEmbeddedJson: t.requireResults ? true : undefined,
}));

// ── Env-var diagnostics (side-effect at import time) ─────────────────────

const tier2 = HAS_AUTH_CREDENTIALS ? 'RUN' : 'SKIP';

console.log(`\n[env] canaryEnv.mode: ${canaryEnv.mode}`);
if (canaryEnv.warnings.length > 0) {
  for (const w of canaryEnv.warnings) {
    console.warn(`[env] ⚠ ${w}`);
  }
}
console.log(
  `[env] auth username present: ${CANARY_USERNAME.length > 0} (via ${CANARY_USERNAME_ENV_HINT})`
);
console.log(`[env] GH_CANARY_PASSWORD present: ${CANARY_PASSWORD.length > 0}`);
console.log(`[env] Tier 2 (/pulls/search): ${tier2}`);
console.log(
  `[env] GMAIL secrets present: ${HAS_GMAIL_SECRETS} → Device verification bypass ${HAS_GMAIL_SECRETS ? 'ENABLED' : 'DISABLED'}\n`
);
