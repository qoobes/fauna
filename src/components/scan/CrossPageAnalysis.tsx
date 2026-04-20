import type { CrossPageAnalysis as CrossPageAnalysisType } from '@/types/scan';

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--score-excellent)';
  if (score >= 70) return 'var(--score-good)';
  if (score >= 50) return 'var(--score-improve)';
  return 'var(--score-poor)';
}

export function CrossPageAnalysis({ analysis }: { analysis: CrossPageAnalysisType }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="ty-label" style={{ marginBottom: 12 }}>[ CROSS_PAGE_FLOW ]</div>

      <div className="instrument-panel" style={{ marginBottom: 16 }}>
        <span className="ip-c-bl" aria-hidden />
        <span className="ip-c-br" aria-hidden />
        <div className="ip-label">[ CONSISTENCY_SCORE ]</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <span
            className="ty-mono"
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: scoreColor(analysis.consistencyScore),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {analysis.consistencyScore.toString().padStart(3, '0')}
          </span>
          <span className="ty-mono" style={{ color: 'var(--text-faint)' }}>/ 100</span>
        </div>

        <p className="ty-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {analysis.summary}
        </p>
      </div>

      {analysis.issues.length > 0 && (
        <div>
          {analysis.issues.map((issue, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className={`severity-badge severity-${issue.severity}`}>{issue.severity}</span>
                <span className="ty-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  WCAG {issue.wcagCriterion}
                </span>
              </div>
              <p style={{ fontSize: 14, marginBottom: 6, color: 'var(--text-primary)' }}>
                {issue.description}
              </p>
              <p style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Fix:</strong> {issue.remediation}
              </p>
              <div className="ty-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                AFFECTS:{' '}
                {issue.affectedPages
                  .map((u) => {
                    try {
                      return new URL(u).pathname || '/';
                    } catch {
                      return u;
                    }
                  })
                  .join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
