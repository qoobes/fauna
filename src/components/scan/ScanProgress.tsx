'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/hooks/useSSE';

function scoreBadgeClass(score: number): string {
  if (score >= 90) return 'score-badge score-excellent';
  if (score >= 70) return 'score-badge score-good';
  if (score >= 50) return 'score-badge score-improve';
  return 'score-badge score-poor';
}

interface ScanProgressProps {
  scanId: string;
  scanUrl: string;
}

export function ScanProgress({ scanId, scanUrl }: ScanProgressProps) {
  const router = useRouter();
  const { pages, status, error, totalDiscovered, queuePosition } = useSSE(scanId);

  useEffect(() => {
    if (status === 'complete' || status === 'cancelled') {
      router.refresh();
    }
  }, [status, router]);

  const completedCount = pages.filter((p) => p.status !== 'crawling').length;
  const estimatedTotal = Math.max(totalDiscovered, pages.length, 1);
  const progress = Math.min(1, completedCount / estimatedTotal);
  const segmentCount = 20;
  const filledSegments = Math.round(progress * segmentCount);

  const handleCancel = async () => {
    await fetch(`/api/scans/${scanId}`, { method: 'DELETE' }).catch(() => {});
    router.refresh();
  };

  return (
    <div className="app-shell fade-in" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div className="ty-label" style={{ marginBottom: 16 }}>
        [ SCAN / {status === 'queued' ? 'QUEUED' : status === 'running' ? 'RUNNING' : status.toUpperCase()} ]
      </div>
      <h1 className="ty-page-title" style={{ marginBottom: 4 }}>{scanUrl}</h1>
      <p className="ty-mono" style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 40 }}>
        SCAN_ID: {scanId}
      </p>

      <div className="instrument-panel" style={{ marginBottom: 28 }}>
        <span className="ip-c-bl" aria-hidden />
        <span className="ip-c-br" aria-hidden />
        <div className="ip-label">[ PROGRESS ]</div>

        {status === 'queued' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span className="spinner" />
            <span className="ty-mono" style={{ fontSize: 13 }}>
              Waiting for a scan slot. Position in queue: {queuePosition ?? '—'}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span className="ty-section" style={{ color: 'var(--text-primary)' }}>
            {status === 'error' ? 'Scan failed' : `Analyzed ${completedCount} of ~${estimatedTotal} pages`}
          </span>
          <span className="ty-mono" style={{ color: 'var(--accent)', fontSize: 13 }}>
            {Math.round(progress * 100).toString().padStart(3, '0')}%
          </span>
        </div>

        <div className="seg-progress" style={{ marginBottom: 20 }}>
          {Array.from({ length: segmentCount }).map((_, i) => (
            <span
              key={i}
              className={`seg ${
                status === 'error' && i < filledSegments
                  ? 'err'
                  : i < filledSegments
                    ? 'on'
                    : ''
              }`}
            />
          ))}
        </div>

        {error && <div className="alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12 }}>
          {(status === 'running' || status === 'queued') && (
            <button onClick={handleCancel} className="btn btn-danger">CANCEL_SCAN</button>
          )}
          {status === 'error' && (
            <button onClick={() => router.push('/')} className="btn">BACK_TO_HOME</button>
          )}
        </div>
      </div>

      {pages.length > 0 && (
        <div>
          <div className="ty-label" style={{ marginBottom: 12 }}>[ PAGE_LOG ]</div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {[...pages].reverse().map((page) => (
              <div
                key={page.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-faint)',
                }}
              >
                <span
                  style={{
                    width: 24,
                    display: 'inline-flex',
                    justifyContent: 'center',
                    color:
                      page.status === 'success'
                        ? 'var(--accent)'
                        : page.status === 'error'
                          ? 'var(--sev-critical)'
                          : page.status === 'skipped'
                            ? 'var(--text-muted)'
                            : 'var(--accent)',
                  }}
                >
                  {page.status === 'crawling' && <span className="spinner" />}
                  {page.status === 'success' && '✓'}
                  {page.status === 'error' && '✗'}
                  {page.status === 'skipped' && '—'}
                </span>
                <span
                  className="ty-mono"
                  style={{
                    flex: 1,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {page.url}
                </span>
                {page.status === 'success' && page.score !== undefined && (
                  <span className={scoreBadgeClass(page.score)}>
                    {page.score.toString().padStart(3, '0')}
                  </span>
                )}
                {page.status === 'error' && (
                  <span className="severity-badge severity-critical">FAILED</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
