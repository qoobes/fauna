import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { scanManager } from '@/lib/scanner/scanManager';
import { ScanProgress } from '@/components/scan/ScanProgress';
import { ScanResults } from '@/components/scan/ScanResults';

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Check memory first for fresh state (running scans)
  const live = scanManager.getScan(id);

  let status: string;
  let url: string;
  let result: unknown = null;
  let errorMessage: string | null = null;

  if (live) {
    status = live.status;
    url = live.config.url;
    result = live.result;
  } else {
    const [row] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
    if (!row) notFound();
    status = row.status;
    url = row.url;
    result = row.result;
    errorMessage = row.errorMessage;
  }

  // Live scans (queued or running) → progress view with SSE
  if (status === 'queued' || status === 'running') {
    return <ScanProgress scanId={id} scanUrl={url} />;
  }

  // Cancelled / errored → brief status panel
  if (status === 'error' || status === 'cancelled') {
    return (
      <div className="app-shell" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <div className="ty-label" style={{ marginBottom: 16 }}>
          [ SCAN / {status.toUpperCase()} ]
        </div>
        <h1 className="ty-page-title" style={{ marginBottom: 4 }}>{url}</h1>
        <p className="ty-mono" style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
          SCAN_ID: {id}
        </p>
        <div className="instrument-panel">
          <span className="ip-c-bl" aria-hidden />
          <span className="ip-c-br" aria-hidden />
          <div className="ip-label">[ STATUS_READOUT ]</div>
          <p className="ty-body" style={{ marginBottom: 16 }}>
            {status === 'error'
              ? errorMessage || 'The scan ended with an error.'
              : 'The scan was cancelled before completion.'}
          </p>
          <a href="/" className="btn">BACK_TO_HOME</a>
        </div>
      </div>
    );
  }

  // Complete with no result payload (edge case)
  if (!result) {
    return (
      <div className="app-shell" style={{ paddingTop: 48 }}>
        <div className="ty-label">[ SCAN / COMPLETE / NO_DATA ]</div>
        <p className="ty-body" style={{ marginTop: 12 }}>
          This scan completed but its result payload is unavailable.
        </p>
      </div>
    );
  }

  // Complete scan → show full results
  const typedResult = result as import('@/types/scan').ScanResult;
  return (
    <div className="app-shell" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div className="ty-label" style={{ marginBottom: 16 }}>[ SCAN / RESULTS ]</div>
      <h1 className="ty-page-title" style={{ marginBottom: 4 }}>{url}</h1>
      <p className="ty-mono" style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 32 }}>
        SCAN_ID: {id}
      </p>
      <ScanResults result={typedResult} />
    </div>
  );
}
