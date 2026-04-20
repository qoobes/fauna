import Link from 'next/link';
import type { PageResult } from '@/types/scan';

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--score-excellent)';
  if (score >= 70) return 'var(--score-good)';
  if (score >= 50) return 'var(--score-improve)';
  return 'var(--score-poor)';
}

interface PageDetailProps {
  page: PageResult;
  scanId: string;
}

export function PageDetail({ page, scanId }: PageDetailProps) {
  return (
    <div className="fade-in">
      <Link href={`/scans/${scanId}`} className="ty-label" style={{ display: 'inline-block', marginBottom: 20 }}>
        &larr; BACK_TO_SCAN
      </Link>

      <h1 className="ty-page-title" style={{ marginBottom: 4 }}>
        {page.metadata.title || page.url}
      </h1>
      <p className="ty-mono" style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
        {page.url}
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 32 }}>
        <div className="readout">
          <span className="readout-label">[ PAGE_SCORE ]</span>
          <span
            className="ty-mono"
            style={{
              fontSize: 40,
              fontWeight: 500,
              color: scoreColor(page.score),
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {page.score.toString().padStart(3, '0')}
          </span>
        </div>
        <div className="readout">
          <span className="readout-label">[ AXE_VIOLATIONS ]</span>
          <span className="readout-value" style={{ fontSize: 24 }}>
            {page.axeViolations.length.toString().padStart(3, '0')}
          </span>
        </div>
        {page.aiIssues && (
          <div className="readout">
            <span className="readout-label">[ AI_FINDINGS ]</span>
            <span className="readout-value" style={{ fontSize: 24 }}>
              {page.aiIssues.length.toString().padStart(3, '0')}
            </span>
          </div>
        )}
        {(() => {
          const aiStatus = page.aiStatus ?? (page.aiIssues !== null ? 'ok' : 'auth-error');
          const isOk = aiStatus === 'ok' || aiStatus === 'ok-empty';
          return (
            <div className="readout">
              <span className="readout-label">[ AI_STATUS ]</span>
              <span
                className="severity-badge"
                style={{
                  marginTop: 6,
                  ...(isOk
                    ? {
                        background: 'var(--score-excellent-bg)',
                        color: 'var(--score-excellent)',
                        borderColor: 'var(--score-excellent-bg)',
                      }
                    : {
                        background: 'var(--sev-serious-bg)',
                        color: 'var(--sev-serious)',
                        borderColor: 'var(--sev-serious-bd)',
                      }),
                }}
              >
                {aiStatus.replace(/-/g, '_').toUpperCase()}
              </span>
            </div>
          );
        })()}
      </div>

      {page.screenshotFilename && (
        <div
          style={{
            marginBottom: 32,
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            maxHeight: 560,
            overflowY: 'auto',
          }}
        >
          <img
            src={`/api/scans/${scanId}/screenshots/${page.screenshotFilename}`}
            alt={`Screenshot of ${page.url}`}
            style={{ width: '100%', display: 'block' }}
          />
        </div>
      )}

      {page.aiSummary && (
        <div
          className="instrument-panel"
          style={{ marginBottom: 32 }}
        >
          <span className="ip-c-bl" aria-hidden />
          <span className="ip-c-br" aria-hidden />
          <div className="ip-label">[ AI_SUMMARY ]</div>
          <p
            className="ty-serif"
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: 'var(--text-primary)',
            }}
          >
            {page.aiSummary}
          </p>
        </div>
      )}

      {page.axeViolations.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="ty-label" style={{ marginBottom: 12 }}>
            [ AUTOMATED_FINDINGS / {page.axeViolations.length.toString().padStart(3, '0')} ]
          </div>
          {page.axeViolations.map((v, i) => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className={`severity-badge severity-${v.impact}`}>{v.impact}</span>
                <span className="ty-mono" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {v.id}
                </span>
              </div>
              <p style={{ fontSize: 14, marginBottom: 4, color: 'var(--text-secondary)' }}>{v.description}</p>
              <div className="ty-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {v.nodes.length.toString().padStart(2, '0')}_ELEMENT{v.nodes.length !== 1 ? 'S' : ''}_AFFECTED
              </div>
            </div>
          ))}
        </div>
      )}

      {page.aiIssues && page.aiIssues.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="ty-label" style={{ marginBottom: 12 }}>
            [ AI_IDENTIFIED_ISSUES / {page.aiIssues.length.toString().padStart(3, '0')} ]
          </div>
          {page.aiIssues.map((ai, i) => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className={`severity-badge severity-${ai.severity}`}>{ai.severity}</span>
                <span className="ty-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  WCAG {ai.wcagCriterion}
                </span>
              </div>
              <p style={{ fontSize: 14, marginBottom: 6, color: 'var(--text-primary)' }}>
                {ai.description}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Fix:</strong> {ai.remediation}
              </p>
            </div>
          ))}
        </div>
      )}

      {page.aiPositiveFindings && page.aiPositiveFindings.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="ty-label" style={{ marginBottom: 12 }}>[ POSITIVE_FINDINGS ]</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {page.aiPositiveFindings.map((f, i) => (
              <li
                key={i}
                style={{
                  fontSize: 14,
                  color: 'var(--score-excellent)',
                  paddingLeft: 20,
                  position: 'relative',
                  marginBottom: 4,
                }}
              >
                <span style={{ position: 'absolute', left: 0, color: 'var(--score-excellent)' }}>✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <div className="ty-label" style={{ marginBottom: 12 }}>[ PAGE_STRUCTURE ]</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <div className="ty-section" style={{ marginBottom: 10 }}>Headings</div>
            {page.metadata.headings.length === 0 ? (
              <p className="ty-mono" style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                [ NONE ]
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {page.metadata.headings.map((h, i) => (
                  <li
                    key={i}
                    className="ty-mono"
                    style={{
                      fontSize: 12,
                      paddingLeft: (h.level - 1) * 16,
                      marginBottom: 2,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span style={{ color: 'var(--text-faint)' }}>h{h.level}</span> {h.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="ty-section" style={{ marginBottom: 10 }}>Landmarks</div>
            {page.metadata.landmarks.length === 0 ? (
              <p className="ty-mono" style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                [ NONE ]
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {page.metadata.landmarks.map((l, i) => (
                  <li
                    key={i}
                    className="ty-mono"
                    style={{ fontSize: 12, marginBottom: 2, color: 'var(--text-secondary)' }}
                  >
                    <span style={{ color: 'var(--text-faint)' }}>&lt;{l.tag}&gt;</span>
                    {l.role !== l.tag && <span> role={`"${l.role}"`}</span>}
                    {l.label && <span style={{ color: 'var(--accent)' }}> "{l.label}"</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
