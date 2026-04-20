import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { ScanForm } from '@/components/scan/ScanForm';

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--score-excellent)';
  if (score >= 70) return 'var(--score-good)';
  if (score >= 50) return 'var(--score-improve)';
  return 'var(--score-poor)';
}

function formatHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function timeAgo(d: Date | null): string {
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function HomePage() {
  const recent = await db
    .select({
      id: scans.id,
      url: scans.url,
      status: scans.status,
      overallScore: scans.overallScore,
      totalPages: scans.totalPages,
      ownerEmail: scans.ownerEmail,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .orderBy(desc(scans.createdAt))
    .limit(5);

  return (
    <div className="app-shell" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div className="ty-label" style={{ marginBottom: 16 }}>[ NEW_SCAN ]</div>
      <h1 className="ty-page-title" style={{ marginBottom: 12 }}>
        Start a new accessibility scan
      </h1>
      <p className="ty-body" style={{ maxWidth: 620, marginBottom: 40, color: 'var(--text-secondary)' }}>
        FAUNA crawls your target site, runs axe-core deterministic checks, captures a screenshot of
        each page, and asks Claude to analyse both the visual and structural accessibility. Scans
        are shared across the Liverpool community.
      </p>

      <div className="instrument-panel" style={{ marginBottom: 56 }}>
        <span className="ip-c-bl" aria-hidden />
        <span className="ip-c-br" aria-hidden />
        <div className="ip-label">[ 01 / CONFIGURE ]</div>
        <ScanForm />
      </div>

      <div className="tick-divider" />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div className="ty-label">[ RECENT_COMMUNITY_SCANS ]</div>
          <Link
            href="/scans"
            className="ty-mono"
            style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            VIEW_ALL &rarr;
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="ty-mono" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
            [ NO_SCANS_YET ] Be the first — start one above.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {recent.map((s) => (
              <Link
                key={s.id}
                href={`/scans/${s.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr auto auto',
                  gap: 16,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-faint)',
                  textDecoration: 'none',
                  color: 'inherit',
                  alignItems: 'center',
                }}
              >
                <span
                  className="ty-mono"
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color:
                      s.status === 'complete'
                        ? scoreColor(s.overallScore)
                        : s.status === 'running' || s.status === 'queued'
                          ? 'var(--accent)'
                          : 'var(--text-faint)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.status === 'complete'
                    ? s.overallScore.toString().padStart(3, '0')
                    : s.status === 'error'
                      ? 'ERR'
                      : s.status === 'cancelled'
                        ? '—'
                        : '···'}
                </span>
                <div style={{ overflow: 'hidden' }}>
                  <div
                    className="ty-mono"
                    style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatHost(s.url)}
                  </div>
                  <div
                    className="ty-mono"
                    style={{ fontSize: 11, color: 'var(--text-faint)' }}
                  >
                    {s.ownerEmail} · {s.totalPages} page{s.totalPages !== 1 ? 's' : ''}
                  </div>
                </div>
                <span
                  className="ty-mono"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 3,
                    background:
                      s.status === 'complete'
                        ? 'var(--score-excellent-bg)'
                        : s.status === 'running' || s.status === 'queued'
                          ? 'var(--accent-glow)'
                          : 'var(--sev-minor-bg)',
                    color:
                      s.status === 'complete'
                        ? 'var(--score-excellent)'
                        : s.status === 'running' || s.status === 'queued'
                          ? 'var(--accent)'
                          : 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {s.status}
                </span>
                <span
                  className="ty-mono"
                  style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}
                >
                  {timeAgo(s.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
