import { defineConfig } from 'vitest/config';
import { viteResolveAliases } from './vite.aliases';

/**
 * Isolated Vitest config for the canary parser tests.
 * Run with: npx vitest run --config vitest.canary.config.ts
 *
 * This config intentionally skips all src/** unit tests —
 * it only targets the canary/ directory.
 */
export default defineConfig({
  resolve: {
    alias: viteResolveAliases,
  },
  test: {
    // WHY [globals]: Match main Vite Vitest config so suites can use
    // `/// <reference types="vitest/globals" />` without importing `describe`/`it`
    // (Vitest 4 + explicit vitest imports currently breaks suite collection here).
    globals: true,
    include: ['canary/**/*.canary.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: 'forks',
    // WHY [maxWorkers 1]: Tier 2 shares one Browser/Page; parallel `it` blocks would race.
    maxWorkers: 1,
    reporters: ['verbose'],
    // One retry filters out single-request flakes (e.g. brief GitHub 502)
    // without masking real DOM-change breakage. Higher values would delay
    // legitimate alerts by minutes, defeating the "early warning" goal.
    retry: 1,
  },
});
