/// <reference types="vitest/globals" />
import { loadCanaryEnv } from './config';

/** Prevent real machine / CI env from affecting union outcomes. */
function stubBaseEmpty() {
  vi.stubEnv('GH_CANARY_USERNAME_LEGACY', '');
  vi.stubEnv('GH_CANARY_USERNAME_NEW', '');
  vi.stubEnv('GH_CANARY_PASSWORD', '');
  vi.stubEnv('GMAIL_CLIENT_ID', '');
  vi.stubEnv('GMAIL_CLIENT_SECRET', '');
  vi.stubEnv('GMAIL_REFRESH_TOKEN', '');
}

describe('loadCanaryEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns public-only with no auth env', () => {
    stubBaseEmpty();
    const env = loadCanaryEnv();
    expect(env.mode).toBe('public-only');
    expect(env.gmail).toBeNull();
  });

  it('returns authenticated when NEW username and password are set', () => {
    stubBaseEmpty();
    vi.stubEnv('GH_CANARY_USERNAME_NEW', 'new-bot');
    vi.stubEnv('GH_CANARY_PASSWORD', 'secret');
    const env = loadCanaryEnv();
    expect(env).toMatchObject({
      mode: 'authenticated',
      username: 'new-bot',
      password: 'secret',
      usernameEnvHint: 'GH_CANARY_USERNAME_NEW',
    });
  });

  it('returns authenticated using LEGACY username as compat alias when NEW is unset', () => {
    stubBaseEmpty();
    vi.stubEnv('GH_CANARY_USERNAME_LEGACY', 'legacy-bot');
    vi.stubEnv('GH_CANARY_PASSWORD', 'secret');
    const env = loadCanaryEnv();
    expect(env).toMatchObject({
      mode: 'authenticated',
      username: 'legacy-bot',
      password: 'secret',
      usernameEnvHint: 'GH_CANARY_USERNAME_LEGACY',
    });
  });

  it('prefers NEW over LEGACY when both are set and warns about the alias', () => {
    stubBaseEmpty();
    vi.stubEnv('GH_CANARY_USERNAME_LEGACY', 'legacy-bot');
    vi.stubEnv('GH_CANARY_USERNAME_NEW', 'new-bot');
    vi.stubEnv('GH_CANARY_PASSWORD', 'secret');
    const env = loadCanaryEnv();
    expect(env).toMatchObject({
      mode: 'authenticated',
      username: 'new-bot',
      password: 'secret',
      usernameEnvHint: 'GH_CANARY_USERNAME_NEW',
    });
    expect(env.warnings.some((w) => w.includes('using NEW'))).toBe(true);
  });

  it('treats username without password as public-only and records a warning', () => {
    stubBaseEmpty();
    vi.stubEnv('GH_CANARY_USERNAME_NEW', 'orphan-user');
    const env = loadCanaryEnv();
    expect(env.mode).toBe('public-only');
    expect(env.warnings.some((w) => w.includes('GH_CANARY_USERNAME_NEW'))).toBe(true);
  });

  it('treats LEGACY username without password as public-only and records a warning', () => {
    stubBaseEmpty();
    vi.stubEnv('GH_CANARY_USERNAME_LEGACY', 'orphan-user');
    const env = loadCanaryEnv();
    expect(env.mode).toBe('public-only');
    expect(env.warnings.some((w) => w.includes('GH_CANARY_USERNAME_LEGACY'))).toBe(true);
  });

  it('parses gmail when all three vars are set', () => {
    stubBaseEmpty();
    vi.stubEnv('GMAIL_CLIENT_ID', 'id');
    vi.stubEnv('GMAIL_CLIENT_SECRET', 'sec');
    vi.stubEnv('GMAIL_REFRESH_TOKEN', 'tok');
    const env = loadCanaryEnv();
    expect(env.gmail).toEqual({
      clientId: 'id',
      clientSecret: 'sec',
      refreshToken: 'tok',
    });
  });

  it('warns when gmail vars are partially set', () => {
    stubBaseEmpty();
    vi.stubEnv('GMAIL_CLIENT_ID', 'id');
    const env = loadCanaryEnv();
    expect(env.gmail).toBeNull();
    expect(env.warnings.some((w) => w.includes('Gmail OTP'))).toBe(true);
  });
});
