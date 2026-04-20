import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';

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

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const mine = params.owner === 'me';

  const rows = await db
    .select({
      id: scans.id,
      url: scans.url,
      status: scans.status,
      overallScore: scans.overallScore,
      totalPages: scans.totalPages,
      totalIssues: scans.totalIssues,
      criticalCount: scans.criticalCount,
      ownerId: scans.ownerId,
      ownerEmail: scans.ownerEmail,
      createdAt: scans.createdAt,
      completedAt: scans.completedAt,
    })
    .from(scans)
    .where(mine && session?.user?.id ? eq(scans.ownerId, session.user.id) : undefined)
    .orderBy(desc(scans.createdAt))
    .limit(100);

  return (
    <div className="app-shell" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="ty-label" style={{ marginBottom: 12 }}>[ SCAN_HISTORY ]</div>
          <h1 className="ty-page-title">
            {mine ? 'My scans' : 'Community scans'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href="/scans"
            className="btn"
            style={{
              borderColor: !mine ? 'var(--accent)' : 'var(--border-default)',
              color: !mine ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            EVERYONE
          </Link>
          <Link
            href="/scans?owner=me"
            className="btn"
            style={{
              borderColor: mine ? 'var(--accent)' : 'var(--border-default)',
              color: mine ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            MINE
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="instrument-panel">
          <span className="ip-c-bl" aria-hidden />
          <span className="ip-c-br" aria-hidden />
          <div className="ip-label">[ EMPTY ]</div>
          <p className="ty-body" style={{ marginBottom: 16 }}>
            {mine ? "You haven't started any scans yet." : 'No scans yet — be the first.'}
          </p>
          <Link href="/" className="btn btn-primary">START_A_SCAN &rarr;</Link>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 140px 140px 80px 80px',
              gap: 16,
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-default)',
              background: 'var(--bg-surface-1)',
            }}
          >
            <span className="ty-label" style={{ fontSize: 10 }}>[ SCORE ]</span>
            <span className="ty-label" style={{ fontSize: 10 }}>[ URL / OWNER ]</span>
            <span className="ty-label" style={{ fontSize: 10 }}>[ ISSUES ]</span>
            <span className="ty-label" style={{ fontSize: 10 }}>[ STATUS ]</span>
            <span className="ty-label" style={{ fontSize: 10 }}>[ PAGES ]</span>
            <span className="ty-label" style={{ fontSize: 10, textAlign: 'right' }}>[ AGE ]</span>
          </div>
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/scans/${s.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 140px 140px 80px 80px',
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
                  fontSize: 22,
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
                <div className="ty-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {s.ownerEmail}
                </div>
              </div>
              <span className="ty-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {s.totalIssues.toString().padStart(3, '0')}
                {s.criticalCount > 0 && (
                  <span style={{ color: 'var(--sev-critical)', marginLeft: 6 }}>
                    · {s.criticalCount} CRIT
                  </span>
                )}
              </span>
              <span
                className="ty-mono"
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 3,
                  width: 'fit-content',
                  background:
                    s.status === 'complete'
                      ? 'var(--score-excellent-bg)'
                      : s.status === 'running' || s.status === 'queued'
                        ? 'var(--accent-glow)'
                        : s.status === 'error'
                          ? 'var(--sev-critical-bg)'
                          : 'var(--sev-minor-bg)',
                  color:
                    s.status === 'complete'
                      ? 'var(--score-excellent)'
                      : s.status === 'running' || s.status === 'queued'
                        ? 'var(--accent)'
                        : s.status === 'error'
                          ? 'var(--sev-critical)'
                          : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {s.status}
              </span>
              <span className="ty-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {s.totalPages.toString().padStart(2, '0')}
              </span>
              <span
                className="ty-mono"
                style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}
              >
                {timeAgo(s.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
