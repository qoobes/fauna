import type { ScanResult } from '@/types/scan';

function getScoreInfo(score: number) {
  if (score >= 90) return { label: 'EXCELLENT', cls: 'score-excellent' };
  if (score >= 70) return { label: 'GOOD', cls: 'score-good' };
  if (score >= 50) return { label: 'NEEDS_IMPROVEMENT', cls: 'score-improve' };
  return { label: 'POOR', cls: 'score-poor' };
}

export function ScoreHeader({ result }: { result: ScanResult }) {
  const info = getScoreInfo(result.overallScore);
  const criticalCount = result.pages.reduce(
    (sum, p) => sum + p.axeViolations.filter((v) => v.impact === 'critical').length,
    0,
  );

  return (
    <div className={`instrument-panel ${info.cls}`} style={{ marginBottom: 24 }}>
      <span className="ip-c-bl" aria-hidden />
      <span className="ip-c-br" aria-hidden />
      <div className="ip-label">[ OVERALL_READOUT ]</div>

      <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 140 }}>
          <div className="readout-label">[ SCORE ]</div>
          <div
            style={{
              fontFamily: 'var(--font-ibm-mono)',
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: `var(--${info.cls})`,
              fontVariantNumeric: 'tabular-nums',
              marginTop: 8,
            }}
          >
            {result.overallScore.toString().padStart(3, '0')}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ibm-mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: `var(--${info.cls})`,
              marginTop: 6,
            }}
          >
            {info.label}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 24,
            flex: 1,
          }}
        >
          <div className="readout">
            <span className="readout-label">[ PAGES ]</span>
            <span className="readout-value" style={{ fontSize: 24 }}>
              {result.totalPages.toString().padStart(3, '0')}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">[ ISSUES ]</span>
            <span className="readout-value" style={{ fontSize: 24 }}>
              {result.totalIssues.toString().padStart(3, '0')}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">[ CRITICAL ]</span>
            <span
              className="readout-value"
              style={{
                fontSize: 24,
                color: criticalCount > 0 ? 'var(--sev-critical)' : 'var(--text-primary)',
              }}
            >
              {criticalCount.toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
