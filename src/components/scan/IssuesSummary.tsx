'use client';

import { useState } from 'react';
import type { ScanResult } from '@/types/scan';

interface AggregatedIssue {
  id: string;
  severity: string;
  description: string;
  remediation?: string;
  pageCount: number;
  pages: string[];
  source: 'axe' | 'ai';
  wcagRef?: string;
}

const severityOrder: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

export function IssuesSummary({ result }: { result: ScanResult }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const issueMap = new Map<string, AggregatedIssue>();

  for (const page of result.pages) {
    for (const v of page.axeViolations) {
      const existing = issueMap.get(v.id);
      if (existing) {
        existing.pageCount++;
        existing.pages.push(page.url);
      } else {
        issueMap.set(v.id, {
          id: v.id,
          severity: v.impact,
          description: v.description,
          pageCount: 1,
          pages: [page.url],
          source: 'axe',
        });
      }
    }
    if (page.aiIssues) {
      for (const ai of page.aiIssues) {
        const key = `ai-${ai.wcagCriterion}-${ai.description.slice(0, 50)}`;
        const existing = issueMap.get(key);
        if (existing) {
          existing.pageCount++;
          existing.pages.push(page.url);
        } else {
          issueMap.set(key, {
            id: key,
            severity: ai.severity,
            description: ai.description,
            remediation: ai.remediation,
            pageCount: 1,
            pages: [page.url],
            source: 'ai',
            wcagRef: ai.wcagCriterion,
          });
        }
      }
    }
  }

  const sorted = [...issueMap.values()]
    .sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))
    .slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="ty-label" style={{ marginBottom: 32, color: 'var(--score-excellent)' }}>
        [ NO_ISSUES_FOUND ]
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="ty-label" style={{ marginBottom: 12 }}>[ TOP_ISSUES ]</div>
      <div>
        {sorted.map((issue) => {
          const isExpanded = expanded === issue.id;
          return (
            <div
              key={issue.id}
              style={{
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 8,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              <div
                onClick={() => setExpanded(isExpanded ? null : issue.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span className={`severity-badge severity-${issue.severity}`}>{issue.severity}</span>
                {issue.wcagRef && (
                  <span className="ty-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {issue.wcagRef}
                  </span>
                )}
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>
                  {issue.description}
                </span>
                <span className="ty-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {issue.pageCount.toString().padStart(2, '0')}_PAGE
                  {issue.pageCount > 1 ? 'S' : ''}
                </span>
                <span
                  className="ty-mono"
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: issue.source === 'ai' ? 'var(--accent-glow)' : 'var(--bg-surface-3)',
                    color: issue.source === 'ai' ? 'var(--accent)' : 'var(--text-muted)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {issue.source === 'ai' ? 'AI' : 'AXE'}
                </span>
              </div>
              {isExpanded && (
                <div
                  style={{
                    padding: '12px 16px 16px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                  }}
                >
                  {issue.remediation && (
                    <p style={{ marginBottom: 10, color: 'var(--text-primary)' }}>
                      {issue.remediation}
                    </p>
                  )}
                  <div className="ty-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    AFFECTED:{' '}
                    {issue.pages
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
