import type { AxeViolation, AiIssue } from '@/types/scan';

// Capped per-severity deductions. Each severity bucket contributes at most its cap,
// so a page with 50 minor violations doesn't flatten the whole score — it caps at 15.
// This preserves gradation across "bad" / "very bad" / "catastrophic" pages.
const AXE_CAPS = { critical: 30, serious: 25, moderate: 20, minor: 15 } as const;
const AXE_PER = { critical: 10, serious: 6, moderate: 3, minor: 1 } as const;

const AI_CAPS = { critical: 18, serious: 14, moderate: 10, minor: 6 } as const;
const AI_PER = { critical: 6, serious: 4, moderate: 2, minor: 1 } as const;

// WCAG success criteria that axe-core covers well. If the AI reports something under
// one of these criteria, it's either a true miss by axe (possible) or AI overreading
// (common). Demote AI severity by one tier to reflect lower confidence.
const AXE_COVERAGE_CRITERIA = new Set([
  '1.1.1', // Non-text content (alt text)
  '1.3.1', // Info and relationships (semantic HTML)
  '1.3.5', // Input purpose
  '1.4.3', // Contrast (minimum)
  '2.1.1', // Keyboard
  '2.4.4', // Link purpose (in context)
  '2.4.6', // Headings and labels
  '3.3.2', // Labels or instructions
  '4.1.1', // Parsing
  '4.1.2', // Name, role, value (ARIA)
]);

const SEVERITY_ORDER = ['critical', 'serious', 'moderate', 'minor'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];

function axeTagToCriterion(tag: string): string | null {
  const m = tag.match(/^wcag(\d)(\d)(\d+)$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

function demoteSeverity(s: Severity): Severity | null {
  const idx = SEVERITY_ORDER.indexOf(s);
  // 'minor' demoted → remove entirely (drop findings we have very low confidence in)
  if (idx === -1 || idx === SEVERITY_ORDER.length - 1) return null;
  return SEVERITY_ORDER[idx + 1];
}

/**
 * Apply confidence demotion: AI findings claiming axe-coverable criteria are
 * demoted one severity tier. Returns a new array of adjusted findings.
 */
export function adjustAiConfidence(issues: AiIssue[]): AiIssue[] {
  const out: AiIssue[] = [];
  for (const ai of issues) {
    if (AXE_COVERAGE_CRITERIA.has(ai.wcagCriterion)) {
      const demoted = demoteSeverity(ai.severity as Severity);
      if (demoted) out.push({ ...ai, severity: demoted });
      // else: drop (minor → removed)
    } else {
      out.push(ai);
    }
  }
  return out;
}

function countBySeverity<T extends { impact?: string; severity?: string }>(
  items: T[],
  key: 'impact' | 'severity',
): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const item of items) {
    const s = item[key] as Severity | undefined;
    if (s && s in counts) counts[s]++;
  }
  return counts;
}

function capped(caps: Record<Severity, number>, per: Record<Severity, number>, counts: Record<Severity, number>): number {
  let total = 0;
  for (const sev of SEVERITY_ORDER) {
    total += Math.min(caps[sev], counts[sev] * per[sev]);
  }
  return total;
}

export function computePageScore(axeViolations: AxeViolation[], aiIssues: AiIssue[] | null): number {
  const axeDeduction = capped(AXE_CAPS, AXE_PER, countBySeverity(axeViolations, 'impact'));

  let aiDeduction = 0;
  if (aiIssues && aiIssues.length > 0) {
    // Deduplicate: skip AI issues whose WCAG criterion matches an axe tag on this page
    const axeCriteria = new Set<string>();
    for (const v of axeViolations) {
      for (const tag of v.wcagTags) {
        const c = axeTagToCriterion(tag);
        if (c) axeCriteria.add(c);
      }
    }
    const deduped = aiIssues.filter((ai) => !ai.wcagCriterion || !axeCriteria.has(ai.wcagCriterion));
    aiDeduction = capped(AI_CAPS, AI_PER, countBySeverity(deduped, 'severity'));
  }

  return Math.max(5, 100 - axeDeduction - aiDeduction);
}

export function computeOverallScore(
  pageScores: number[],
  crossPageConsistencyScore: number | null,
): number {
  if (pageScores.length === 0) return 0;
  const avgPage = pageScores.reduce((a, b) => a + b, 0) / pageScores.length;
  if (crossPageConsistencyScore !== null) {
    return Math.round(avgPage * 0.8 + crossPageConsistencyScore * 0.2);
  }
  return Math.round(avgPage);
}

export function computeCriticalCount(
  pages: Array<{ axeViolations: AxeViolation[] }>,
): number {
  let n = 0;
  for (const p of pages) {
    for (const v of p.axeViolations) if (v.impact === 'critical') n++;
  }
  return n;
}
