import { createHash } from 'crypto';

export function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);

    if (!['http:', 'https:'].includes(url.protocol)) return null;

    url.hash = '';

    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    url.searchParams.sort();

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Same-origin check that treats `example.com` and `www.example.com` as equivalent.
 * Without this, a seed URL of `liverpool.ac.uk` (which redirects to `www.liverpool.ac.uk`)
 * would reject every internal link as cross-origin and the crawl never expands.
 */
export function isSameOrigin(url: string, seedUrl: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(seedUrl);
    if (a.protocol !== b.protocol) return false;
    if (a.port !== b.port) return false;
    return stripWww(a.hostname) === stripWww(b.hostname);
  } catch {
    return false;
  }
}

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

export function urlToHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 12);
}
