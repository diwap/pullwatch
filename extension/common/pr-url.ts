export interface ParsedPrUrl {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

/** Parses `https://github.com/owner/repo/pull/123` (with optional query/hash). */
export function parsePrUrl(raw: string | null | undefined): ParsedPrUrl | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!/github\.com$/i.test(url.hostname.replace(/^www\./, ''))) return null;
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
    if (!match) return null;
    return {
      owner: match[1],
      repo: match[2],
      number: Number(match[3]),
      url: `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`,
    };
  } catch {
    return null;
  }
}
