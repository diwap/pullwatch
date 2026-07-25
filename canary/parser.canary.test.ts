/**
 * Parser Canary Tests — Hourly synthetic monitor.
 *
 * Validates parsers against live GitHub so DOM and SSR changes surface before
 * users hit them.
 *
 * **Runbook:** [canary/DOM_CHANGE_RUNBOOK.md](DOM_CHANGE_RUNBOOK.md)
 *
 * - **Tier 1** — public `/owner/repo/pulls` baseline via legacy `GitHubHTMLParser`
 *   ([Step 2+](DOM_CHANGE_RUNBOOK.md#step-2--identify-which-pattern-broke)).
 * - **Tier 2** — authenticated `/pulls/search` — [embedded JSON / HTML fallback](DOM_CHANGE_RUNBOOK.md#step-2--identify-which-pattern-broke),
 *   markers `CANARY_EMBEDDED_JSON_DRIFT` / `CANARY_NEW_HTML_FALLBACK_DEGRADED`.
 *
 * WHY [Tier 2 = search only]: The global PR dashboard at github.com/pulls is GA;
 * production defaults the route hint to `search`. Authenticated monitoring hits
 * `/pulls/search` (SSR JSON + new HTML), not bare `/pulls` classic rows.
 *
 * Environment variables (Tier 2):
 *   GH_CANARY_USERNAME_NEW — preferred bot username
 *   GH_CANARY_USERNAME_LEGACY — compat alias if NEW is unset
 *   GH_CANARY_PASSWORD — shared password
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN — device OTP bypass
 */

/// <reference types="vitest/globals" />
import { chromium, type Browser } from 'playwright';
import {
  PUBLIC_TARGETS,
  AUTH_TARGETS,
  HAS_AUTH_CREDENTIALS,
  CANARY_USERNAME,
  CANARY_USERNAME_ENV_HINT,
  CANARY_PASSWORD,
  STATE_FILE,
  BROWSER_HEADERS,
} from './utils/config';
import { GitHubOutageError, RateLimitError } from '@common/errors';
import { parseAndAssert, parseSearchRouteAndAssert } from './utils/parse-orchestrator';
import { observeNewExperienceSearchObservability } from './utils/dual-probe';
import { checkAvatarCoverage } from './utils/assertions';
import { GitHubSession } from './utils/github-session';

// 5xx and Cloudflare edge errors (520-530) that GitHub's CDN can return.
// These are infrastructure issues, not content/DOM problems.
const TRANSIENT_STATUS_CODES = new Set([
  429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530,
]);

function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUS_CODES.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries on transient HTTP errors so a brief GitHub blip doesn't trigger
 * a false-positive Discord alert about a DOM change. The canary runs hourly,
 * so a single failed run has outsized impact on alert fatigue — retrying
 * 2x with 5s gaps absorbs most short-lived 502/503 incidents.
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 2,
  delayMs = 5_000
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, { headers, redirect: 'follow' });
    if (resp.ok) return resp;
    if (isTransientStatus(resp.status) && attempt < retries) {
      console.warn(
        `  [fetch] HTTP ${resp.status} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`
      );
      await sleep(delayMs);
      continue;
    }
    // Align with `GitHubService` / production retry classification for logs and `instanceof` checks.
    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get('retry-after') ?? '0', 10) || 0;
      throw new RateLimitError(`canary fetch ${url}`, retryAfter);
    }
    if (resp.status >= 500 && resp.status < 600) {
      throw new GitHubOutageError(`canary fetch ${url}`, resp.status);
    }
    return resp;
  }
  throw new Error('fetchWithRetry: unreachable');
}

// ═════════════════════════════════════════════════════════════════════════
// Tier 1: Public Baseline (always runs, no auth)
// ═════════════════════════════════════════════════════════════════════════

describe('Canary: GitHub PR parser against live DOM', () => {
  describe('Tier 1 — Public baseline (no auth required)', () => {
    describe.each(PUBLIC_TARGETS)('$label', (target) => {
      it('fetches with browser-like headers, parses ≥1 PR when required, and validates structure', async () => {
        console.log(`\n── Tier 1: ${target.label} ──`);
        console.log(`  [fetch] GET ${target.url}`);

        const resp = await fetchWithRetry(target.url, BROWSER_HEADERS);
        const html = await resp.text();

        console.log(`  [fetch] HTTP ${resp.status} — ${html.length} bytes received`);
        expect(resp.status, `[${target.label}] HTTP status`).toBe(200);

        const prs = await parseAndAssert(html, target);
        checkAvatarCoverage(prs, target.label, 3);

        console.log(`── Tier 1: ${target.label} — PASSED ──\n`);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Tier 2: Authenticated /pulls/search (production default route)
  // ═════════════════════════════════════════════════════════════════════════

  describe.skipIf(!HAS_AUTH_CREDENTIALS)('Tier 2 — Authenticated /pulls/search', () => {
    let browser: Browser;
    let session!: GitHubSession;

    beforeAll(async () => {
      // WHY [shared Chromium]: one browser process; GitHubSession still opens an
      // isolated context so cookies stay on the single auth bot.
      console.log('\n── Tier 2: Launching Chromium for /pulls/search ──');
      browser = await chromium.launch({ headless: true });
      session = new GitHubSession({
        username: CANARY_USERNAME,
        password: CANARY_PASSWORD,
        stateFile: STATE_FILE,
        browser,
        usernameEnvHint: CANARY_USERNAME_ENV_HINT,
      });
      await session.launch();
    });

    afterAll(async () => {
      await session?.close();
      await browser?.close();
      console.log('── Tier 2: Browser closed ──\n');
    });

    describe.each(AUTH_TARGETS)('$label', (target) => {
      it('embedded SSR JSON path, HTML fallback observability, and search-route parse — see Runbook Step 2 / markers', async () => {
        console.log(`\n── Tier 2: ${target.label} ──`);

        if (!session.isLoggedIn) {
          console.warn(
            `  ⊘ Skipping "${target.label}" — login did not succeed (see beforeAll logs above)`
          );
          return;
        }

        const html = await session.getPageHTML(target.url);
        // Observability first: emits CANARY_* markers and throws on critical JSON drift
        // before we assert parse success — keeps Discord/workflow logic aligned with logs.
        observeNewExperienceSearchObservability(html, target.label);
        const prs = await parseSearchRouteAndAssert(html, target);
        checkAvatarCoverage(prs, target.label, 2);

        console.log(`── Tier 2: ${target.label} — PASSED ──\n`);
      });
    });
  });
});
