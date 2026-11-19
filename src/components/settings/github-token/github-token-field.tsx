import { useEffect, useState } from 'react';
import { chromeExtensionService } from '@common/chrome-extension-service';
import { isExtensionContext } from '@src/utils/is-extension-context';

export const GitHubTokenField = () => {
  const [token, setToken] = useState('');
  const [login, setLogin] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExtensionContext()) return;
    void chromeExtensionService.githubToken
      .getStatus()
      .then((status) => {
        setConfigured(status.configured);
        setLogin(status.login);
      })
      .catch(() => {
        setConfigured(false);
        setLogin(null);
      });
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-base-content">GitHub token</span>
        <span className="text-xs text-base-content/60">
          Needed for check status, mentions in Today, approve, merge, and auto-merge. Stored only
          on this device. If your org uses SAML SSO, open the token on GitHub and authorize that
          organization — Test can pass while private org search still returns nothing.
        </span>
      </div>

      <input
        type="password"
        autoComplete="off"
        className="input input-bordered input-sm w-full bg-base-200 font-mono"
        placeholder={configured ? '•••••••• (paste to replace)' : 'ghp_… or github_pat_…'}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy || !token.trim()}
          onClick={() =>
            run(async () => {
              const status = await chromeExtensionService.githubToken.save(token.trim());
              setConfigured(true);
              setLogin(status.login);
              setToken('');
              setMessage(status.login ? `Saved as ${status.login}` : 'Token saved');
            })
          }
        >
          Save
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={busy || (!token.trim() && !configured)}
          onClick={() =>
            run(async () => {
              const status = await chromeExtensionService.githubToken.test(
                token.trim() || undefined
              );
              setLogin(status.login);
              setMessage(status.login ? `OK — ${status.login}` : 'Token works');
            })
          }
        >
          Test
        </button>
        {configured && (
          <button
            type="button"
            className="btn btn-sm btn-ghost text-error"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await chromeExtensionService.githubToken.clear();
                setConfigured(false);
                setLogin(null);
                setToken('');
                setMessage('Token cleared');
              })
            }
          >
            Clear
          </button>
        )}
      </div>

      {configured && login && (
        <p className="text-xs text-base-content/60">Signed in as {login}</p>
      )}
      {message && <p className="text-xs text-success">{message}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
};
