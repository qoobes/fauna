import type { AiStatus, ScanResult } from '@/types/scan';

const MESSAGES: Record<AiStatus, string | null> = {
  ok: null,
  'ok-empty': null,
  'no-key': 'AI analysis was disabled: no ANTHROPIC_API_KEY configured. Results show axe-core findings only.',
  'auth-error': 'AI analysis could not run: Claude API returned an authentication error. Results show axe-core findings only.',
  'api-error': 'AI analysis failed: the Claude API returned an error. Results show axe-core findings only.',
  'parse-error': 'AI analysis returned malformed output. Results show axe-core findings only.',
  skipped: 'AI analysis was skipped for this page.',
};

export function AiStatusBanner({ result }: { result: ScanResult }) {
  // Aggregate page-level AI statuses
  const statuses = new Set<AiStatus>();
  for (const p of result.pages) {
    if (p.status === 'success') statuses.add(p.aiStatus);
  }

  // All pages had AI running fine — no banner
  const allOk = [...statuses].every((s) => s === 'ok' || s === 'ok-empty');
  if (allOk) return null;

  // Pick the most informative non-ok status
  const priority: AiStatus[] = [
    'no-key',
    'auth-error',
    'api-error',
    'parse-error',
    'skipped',
  ];
  const shown = priority.find((s) => statuses.has(s));
  if (!shown) return null;

  const message = MESSAGES[shown];
  if (!message) return null;

  return (
    <div
      style={{
        padding: '14px 18px',
        background: 'var(--sev-serious-bg)',
        border: '1px solid var(--sev-serious-bd)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 20,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span
        className="severity-badge severity-serious"
        style={{ marginTop: 2, flexShrink: 0 }}
      >
        WARNING
      </span>
      <div>
        <div className="ty-label" style={{ marginBottom: 4, color: 'var(--sev-serious)' }}>
          [ AI_ANALYSIS / {shown.toUpperCase()} ]
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{message}</p>
      </div>
    </div>
  );
}
