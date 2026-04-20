import Link from 'next/link';
import type { ScanResult } from '@/types/scan';

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--score-excellent)';
  if (score >= 70) return 'var(--score-good)';
  if (score >= 50) return 'var(--score-improve)';
  return 'var(--score-poor)';
}

function urlHash(url: string): string {
  // SHA-256 lite — mirrors server `urlToHash`. We cannot run crypto.subtle here sync,
  // so just reuse the screenshot filename which already contains the hash.
  return url;
}

export function PagesList({ result }: { result: ScanResult }) {
  const pages = result.pages.filter((p) => p.status !== 'skipped');

  if (pages.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="ty-label" style={{ marginBottom: 12 }}>
        [ PAGES / {pages.length.toString().padStart(3, '0')} ]
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {pages.map((page) => {
          const issueCount = page.axeViolations.length + (page.aiIssues?.length ?? 0);
          const hash = page.screenshotFilename.replace(/\.(jpeg|jpg|png)$/, '');
          return (
            <Link
              key={page.url}
              href={`/scans/${result.scanId}/pages/${hash}`}
              style={{
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.2s, transform 0.15s',
                display: 'block',
              }}
              className="page-card-hover"
            >
              {page.screenshotFilename && (
                <div
                  style={{
                    height: 160,
                    overflow: 'hidden',
                    background: 'var(--bg-surface-2)',
                    borderBottom: '1px solid var(--border-faint)',
                  }}
                >
                  <img
                    src={`/api/scans/${result.scanId}/screenshots/${page.screenshotFilename}`}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                      opacity: 0.85,
                    }}
                    loading="lazy"
                  />
                </div>
              )}
              <div style={{ padding: '12px 14px' }}>
                <div
                  className="ty-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 10,
                  }}
                >
                  {(() => {
                    try {
                      return new URL(page.url).pathname || '/';
                    } catch {
                      return urlHash(page.url);
                    }
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    className="ty-mono"
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      color: scoreColor(page.score),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {page.score.toString().padStart(3, '0')}
                  </span>
                  <span className="ty-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {issueCount.toString().padStart(2, '0')}_ISSUE
                    {issueCount !== 1 ? 'S' : ''}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
